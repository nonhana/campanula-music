import { like as sdkLike, likelist as sdkLikelist, songDetail as sdkSongDetail } from 'hana-music-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userPlaylistsFixture from './fixtures/user-playlists.json'
import { mapLikedListBody, ncmLike, ncmLikedList, ncmLikedSongs } from './like'

vi.mock('hana-music-api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('hana-music-api')>()
  return { ...mod, like: vi.fn(), likelist: vi.fn(), songDetail: vi.fn() }
})

const mockedLike = vi.mocked(sdkLike)
const mockedLikelist = vi.mocked(sdkLikelist)
const mockedSongDetail = vi.mocked(sdkSongDetail)

/** 与 hana-music-api 的 song/detail 返回体一致的最小夹具 */
function songDetailBody(ids: number[]) {
  return {
    code: 200,
    songs: ids.map(id => ({
      id,
      name: `歌曲${id}`,
      dt: 180000,
      ar: [{ id: 1, name: '歌手A' }],
      al: { id: 2, name: '专辑B', picUrl: `https://p1.music.126.net/${id}.jpg` },
    })),
  }
}

beforeEach(() => {
  mockedLike.mockReset()
  mockedLikelist.mockReset()
  mockedSongDetail.mockReset()
})

describe('mapLikedListBody', () => {
  it('data 为纯数字数组时原样返回', () => {
    expect(mapLikedListBody({ code: 200, data: [186016, 6452] })).toEqual([186016, 6452])
  })

  it('data 为对象数组时取 id，并按红心时间倒序（最新在前）', () => {
    const ids = mapLikedListBody({
      code: 200,
      data: [
        { id: 1, time: 1700000000000 },
        { id: 2, time: 1710000000000 },
        { id: 3, time: 1705000000000 },
      ],
    })

    expect(ids).toEqual([2, 3, 1])
  })

  it('顶层 ids 字段兜底（上游偶发非 data 形态）', () => {
    expect(mapLikedListBody({ code: 200, ids: [7, 8] })).toEqual([7, 8])
  })

  it('data 缺失或非数组 → 空数组', () => {
    expect(mapLikedListBody({ code: 200 })).toEqual([])
    expect(mapLikedListBody({ code: 200, data: null })).toEqual([])
    expect(mapLikedListBody({ code: 200, data: 'x' })).toEqual([])
  })

  it('非法条目（非数字、缺 id）跳过', () => {
    expect(mapLikedListBody({ data: [1, '2', null, { id: 'x' }] })).toEqual([1])
  })
})

describe('ncmLike', () => {
  it('按歌曲 id 与红心状态调用 SDK 并携带绑定凭据', async () => {
    mockedLike.mockResolvedValue({ body: { code: 200 } } as never)

    await ncmLike({ cookie: 'MUSIC_U=abc' }, { id: 186016, like: true })
    await ncmLike({ cookie: 'MUSIC_U=abc' }, { id: 6452, like: false })

    expect(mockedLike).toHaveBeenNthCalledWith(1, { id: 186016, like: true }, { cookie: 'MUSIC_U=abc' })
    expect(mockedLike).toHaveBeenNthCalledWith(2, { id: 6452, like: false }, { cookie: 'MUSIC_U=abc' })
  })

  it('无绑定凭据时不传 cookie', async () => {
    mockedLike.mockResolvedValue({ body: { code: 200 } } as never)

    await ncmLike({ cookie: '' }, { id: 1, like: true })

    expect(mockedLike).toHaveBeenCalledWith({ id: 1, like: true }, undefined)
  })

  it('业务码非 200（无版权）映射为领域错误', async () => {
    mockedLike.mockResolvedValue({ body: { code: -110, msg: '无版权' } } as never)

    await expect(ncmLike({ cookie: '' }, { id: 1, like: true })).rejects.toMatchObject(
      { name: 'NcmError', code: 'RESOURCE_UNAVAILABLE' },
    )
  })

  it('sDK 失败映射为领域错误（限流/绑定失效）', async () => {
    mockedLike.mockRejectedValue({ status: 429, body: { code: -460, msg: '操作太频繁' } })

    await expect(ncmLike({ cookie: '' }, { id: 1, like: true })).rejects.toMatchObject(
      { name: 'NcmError', code: 'RATE_LIMITED' },
    )

    mockedLike.mockRejectedValue({ status: 301, body: { code: -462 } })

    await expect(ncmLike({ cookie: '' }, { id: 1, like: true })).rejects.toMatchObject(
      { name: 'NcmError', code: 'UNAUTHENTICATED' },
    )
  })

  it('「HTTP 200 + 登录失效业务码」形态按业务码分类为 UNAUTHENTICATED', async () => {
    mockedLike.mockResolvedValue({ body: { code: 801, msg: '登录状态已失效' }, status: 200 } as never)

    await expect(ncmLike({ cookie: '' }, { id: 1, like: true })).rejects.toMatchObject(
      { name: 'NcmError', code: 'UNAUTHENTICATED' },
    )
  })
})

/** 失败封套由真实录制包 fixtures/user-playlists.json 派生（仅改 code 相关字段；上游业务失败包未录制） */
function failedEnvelope(code: number, msg: string) {
  return {
    ...userPlaylistsFixture.created,
    code,
    msg,
  }
}

describe('ncmLikedList', () => {
  it('按账号 id 调用 SDK 并返回红心歌曲 id 列表', async () => {
    mockedLikelist.mockResolvedValue({
      body: { code: 200, data: [{ id: 1, time: 1700000000000 }, { id: 2, time: 1710000000000 }] },
    } as never)

    const ids = await ncmLikedList({ cookie: 'MUSIC_U=abc' }, 98765)

    expect(mockedLikelist).toHaveBeenCalledWith({ uid: 98765 }, { cookie: 'MUSIC_U=abc' })
    expect(ids).toEqual([2, 1])
  })

  it('「HTTP 200 + 业务失败码」形态映射为领域错误，不静默返回空列表', async () => {
    mockedLikelist.mockResolvedValue({ body: failedEnvelope(801, '登录状态已失效') } as never)

    await expect(ncmLikedList({ cookie: '' }, 1)).rejects.toMatchObject(
      { name: 'NcmError', code: 'UNAUTHENTICATED' },
    )
  })

  it('sDK 失败映射为领域错误', async () => {
    mockedLikelist.mockRejectedValue({ status: 429, body: { code: -460, msg: '操作太频繁' } })

    await expect(ncmLikedList({ cookie: '' }, 1)).rejects.toMatchObject(
      { name: 'NcmError', code: 'RATE_LIMITED' },
    )
  })
})

describe('ncmLikedSongs', () => {
  it('红心 id 列表按序补全歌曲详情', async () => {
    mockedLikelist.mockResolvedValue({ body: { code: 200, data: [2, 1] } } as never)
    mockedSongDetail.mockResolvedValue({ body: songDetailBody([2, 1]) } as never)

    const songs = await ncmLikedSongs({ cookie: 'MUSIC_U=abc' }, 98765)

    expect(mockedSongDetail).toHaveBeenCalledWith({ ids: '2,1' }, { cookie: 'MUSIC_U=abc' })
    expect(songs.map(song => song.id)).toEqual([2, 1])
    expect(songs[0]).toMatchObject({ name: '歌曲2', duration: 180000 })
  })

  it('详情缺失的歌曲跳过，不伪造条目', async () => {
    mockedLikelist.mockResolvedValue({ body: { code: 200, data: [1, 99] } } as never)
    mockedSongDetail.mockResolvedValue({ body: songDetailBody([1]) } as never)

    const songs = await ncmLikedSongs({ cookie: '' }, 1)

    expect(songs.map(song => song.id)).toEqual([1])
  })

  it('likelist 失败直接映射领域错误，不请求详情', async () => {
    mockedLikelist.mockRejectedValue({ status: 301, body: { code: -462 } })

    await expect(ncmLikedSongs({ cookie: '' }, 1)).rejects.toMatchObject(
      { name: 'NcmError', code: 'UNAUTHENTICATED' },
    )
    expect(mockedSongDetail).not.toHaveBeenCalled()
  })
})
