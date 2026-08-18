import { search as sdkSearch } from 'hana-music-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mapSearchPage, ncmSearch } from './search'

vi.mock('hana-music-api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('hana-music-api')>()
  return { ...mod, search: vi.fn() }
})

const mockedSearch = vi.mocked(sdkSearch)

/** 与 hana-music-api 的 search 返回体一致的最小夹具 */
function sdkBody(partial: Record<string, unknown> = {}) {
  return { result: { hasMore: false, ...partial } }
}

beforeEach(() => {
  mockedSearch.mockReset()
})

describe('mapSearchPage', () => {
  it('歌曲结果：映射歌手与专辑并取 songCount 为总数', () => {
    const page = mapSearchPage('song', sdkBody({
      songCount: 273,
      songs: [
        {
          id: 6452,
          name: '七里香',
          duration: 269000,
          artists: [{ id: 6452, name: '周杰伦' }],
          album: { id: 21349, name: '七里香' },
        },
      ],
    }))

    expect(page).toEqual({
      type: 'song',
      total: 273,
      songs: [
        {
          id: 6452,
          name: '七里香',
          duration: 269000,
          artists: [{ id: 6452, name: '周杰伦' }],
          album: { id: 21349, name: '七里香', cover: '' },
        },
      ],
    })
  })

  it('歌曲缺失专辑时回落空专辑', () => {
    const page = mapSearchPage('song', sdkBody({
      songs: [{ id: 1, name: '无名', duration: 0, artists: [], album: null }],
    }))

    expect(page.type === 'song' && page.songs[0].album).toEqual({ id: 0, name: '', cover: '' })
  })

  it('歌单映射：封面、数量、播放次数与创建者', () => {
    const page = mapSearchPage('playlist', sdkBody({
      playlistCount: 463,
      playlists: [
        {
          id: 6792103822,
          name: '周杰伦精选',
          coverImgUrl: 'http://p1.music.126.net/abc.jpg',
          trackCount: 139,
          playCount: 32251352,
          creator: { nickname: 'Buradarrr' },
        },
      ],
    }))

    expect(page).toEqual({
      type: 'playlist',
      total: 463,
      playlists: [
        {
          id: 6792103822,
          name: '周杰伦精选',
          cover: 'https://p1.music.126.net/abc.jpg',
          trackCount: 139,
          playCount: 32251352,
          creator: 'Buradarrr',
        },
      ],
    })
  })

  it('歌单封面与创建者缺失时回落空串', () => {
    const page = mapSearchPage('playlist', sdkBody({
      playlists: [{ id: 1, name: '无名歌单', trackCount: 0, playCount: 0, coverImgUrl: null, creator: null }],
    }))

    expect(page.type === 'playlist' && page.playlists[0]).toMatchObject({ cover: '', creator: '' })
  })

  it('歌手映射：id、名称与头像', () => {
    const page = mapSearchPage('artist', sdkBody({
      artistCount: 81,
      artists: [{ id: 6452, name: '周杰伦', picUrl: 'https://p3.music.126.net/a.jpg' }],
    }))

    expect(page).toEqual({
      type: 'artist',
      total: 81,
      artists: [{ id: 6452, name: '周杰伦', avatar: 'https://p3.music.126.net/a.jpg' }],
    })
  })
})

describe('ncmSearch', () => {
  it('按类型传网易云 type 码并返回映射结果', async () => {
    mockedSearch.mockResolvedValue({
      body: sdkBody({ songCount: 1, songs: [{ id: 2, name: '稻香', duration: 1, artists: [], album: null }] }),
    } as never)

    const page = await ncmSearch({ cookie: '' }, { keywords: '稻香', type: 'song', limit: 5 })

    expect(mockedSearch).toHaveBeenCalledWith(
      { keywords: '稻香', type: 1, limit: 5, offset: 0 },
      undefined,
    )
    expect(page).toMatchObject({ type: 'song', songs: [{ name: '稻香' }] })
  })

  it('搜索失败映射为领域错误', async () => {
    mockedSearch.mockRejectedValue({ status: 429, body: { code: -460, msg: '操作太频繁' } })

    await expect(ncmSearch({ cookie: '' }, { keywords: 'x', type: 'playlist' })).rejects.toMatchObject(
      { name: 'NcmError', code: 'RATE_LIMITED' },
    )
  })

  it('携带绑定凭据调用', async () => {
    mockedSearch.mockResolvedValue({ body: sdkBody({ artistCount: 0, artists: [] }) } as never)

    await ncmSearch({ cookie: 'MUSIC_U=abc' }, { keywords: '周', type: 'artist' })

    expect(mockedSearch).toHaveBeenCalledWith(
      { keywords: '周', type: 100, limit: 30, offset: 0 },
      { cookie: 'MUSIC_U=abc' },
    )
  })

  it('无凭据时不传 cookie 配置', async () => {
    mockedSearch.mockResolvedValue({ body: sdkBody({ artistCount: 0, artists: [] }) } as never)

    await ncmSearch({ cookie: '' }, { keywords: '周', type: 'artist' })

    expect(mockedSearch).toHaveBeenCalledWith(
      { keywords: '周', type: 100, limit: 30, offset: 0 },
      undefined,
    )
  })
})
