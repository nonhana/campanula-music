import { search as sdkSearch, songDetail as sdkSongDetail } from 'hana-music-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mapSearchPage, ncmSearch } from './search'

vi.mock('hana-music-api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('hana-music-api')>()
  return { ...mod, search: vi.fn(), songDetail: vi.fn() }
})

const mockedSearch = vi.mocked(sdkSearch)
const mockedSong = vi.mocked(sdkSongDetail)

/** 与 hana-music-api 的 search 返回体一致的最小夹具 */
function sdkBody(partial: Record<string, unknown> = {}) {
  return { result: { hasMore: false, ...partial } }
}

/** 与 hana-music-api 的 song/detail 返回体一致的最小夹具（带封面） */
function songDetailBody(ids: number[]) {
  return {
    songs: ids.map(id => ({
      id,
      name: `song-${id}`,
      dt: 269000,
      ar: [{ id: 6452, name: '周杰伦' }],
      al: { id: 21349, name: '叶惠美', picUrl: 'http://p1.music.126.net/c.jpg' },
    })),
    privileges: [],
  }
}

beforeEach(() => {
  mockedSearch.mockReset()
  mockedSong.mockReset()
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
          cover: 'https://p4.music.126.net/abc.jpg',
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
      artists: [{ id: 6452, name: '周杰伦', avatar: 'https://p1.music.126.net/a.jpg' }],
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

describe('ncmSearch 封面回填', () => {
  it('歌曲搜索借一次批量 song/detail 回填专辑封面', async () => {
    mockedSearch.mockResolvedValue({
      body: sdkBody({ songCount: 2, songs: [{ id: 101, name: 'a', duration: 1, artists: [], album: { id: 1, name: 'x' } }, { id: 202, name: 'b', duration: 1, artists: [], album: { id: 1, name: 'x' } }] }),
    } as never)
    mockedSong.mockResolvedValue({ body: songDetailBody([101, 202]) } as never)

    const page = await ncmSearch({ cookie: '' }, { keywords: '晴天', type: 'song' })

    expect(mockedSong).toHaveBeenCalledTimes(1)
    expect(mockedSong).toHaveBeenCalledWith({ ids: '101,202' }, undefined)
    expect(page.type === 'song' && page.songs.every(song => song.album.cover === 'https://p3.music.126.net/c.jpg')).toBe(true)
  })

  it('回填部分缺失时缺失歌曲封面留空不报错', async () => {
    mockedSearch.mockResolvedValue({
      body: sdkBody({ songCount: 2, songs: [{ id: 101, name: 'a', duration: 1, artists: [], album: { id: 1, name: 'x' } }, { id: 202, name: 'b', duration: 1, artists: [], album: { id: 1, name: 'x' } }] }),
    } as never)
    mockedSong.mockResolvedValue({ body: songDetailBody([101]) } as never)

    const page = await ncmSearch({ cookie: '' }, { keywords: '晴天', type: 'song' })

    expect(page.type === 'song'
      && page.songs[0].album.cover === 'https://p3.music.126.net/c.jpg'
      && page.songs[1].album.cover === '').toBe(true)
  })

  it('回填上游失败不阻断搜索（封面留空、搜索正常返回）', async () => {
    mockedSearch.mockResolvedValue({
      body: sdkBody({ songCount: 1, songs: [{ id: 101, name: 'a', duration: 1, artists: [], album: { id: 1, name: 'x' } }] }),
    } as never)
    mockedSong.mockRejectedValue({ status: 500, body: { code: -460 } })

    const page = await ncmSearch({ cookie: '' }, { keywords: '晴天', type: 'song' })

    expect(page.type === 'song' && page.songs[0].album.cover === '').toBe(true)
    expect(page.type === 'song' && page.songs).toHaveLength(1)
  })

  it('歌单与歌手搜索不触发歌曲详情回填', async () => {
    mockedSearch.mockResolvedValue({ body: sdkBody({ playlistCount: 0, playlists: [] }) } as never)

    await ncmSearch({ cookie: '' }, { keywords: 'x', type: 'playlist' })

    expect(mockedSong).not.toHaveBeenCalled()
  })
})
