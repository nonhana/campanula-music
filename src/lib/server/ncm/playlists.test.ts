import {
  playlistDetail as sdkPlaylistDetail,
  songDetail as sdkSongDetail,
  userPlaylistCollect as sdkUserPlaylistCollect,
  userPlaylistCreate as sdkUserPlaylistCreate,
} from 'hana-music-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mapUserPlaylists, ncmPlaylistDetail, ncmUserPlaylists, parsePlaylistDetail } from './playlists'
import { mapSongDetailList } from './songDetail'

vi.mock('hana-music-api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('hana-music-api')>()
  return {
    ...mod,
    playlistDetail: vi.fn(),
    songDetail: vi.fn(),
    userPlaylistCreate: vi.fn(),
    userPlaylistCollect: vi.fn(),
  }
})

const mockedDetail = vi.mocked(sdkPlaylistDetail)
const mockedSong = vi.mocked(sdkSongDetail)
const mockedCreate = vi.mocked(sdkUserPlaylistCreate)
const mockedCollect = vi.mocked(sdkUserPlaylistCollect)

/** 与 hana-music-api 的 song/detail 返回体一致的最小夹具 */
function songDetailBody(songs: unknown[]) {
  return { songs, privileges: [] }
}

function rawSong(id: number, name: string, dt = 269000) {
  return {
    id,
    name,
    dt,
    ar: [{ id: 6452, name: '周杰伦' }],
    al: { id: 21349, name: '叶惠美', picUrl: 'http://p1.music.126.net/c.jpg' },
  }
}

beforeEach(() => {
  mockedDetail.mockReset()
  mockedSong.mockReset()
  mockedCreate.mockReset()
  mockedCollect.mockReset()
})

describe('parsePlaylistDetail', () => {
  it('映射歌单头信息并提取完整 trackIds', () => {
    const parts = parsePlaylistDetail({
      playlist: {
        id: 6792103822,
        name: '周杰伦精选',
        coverImgUrl: 'http://p1.music.126.net/abc.jpg',
        creator: { nickname: 'Buradarrr' },
        description: '经典曲目',
        trackCount: 3,
        playCount: 32251352,
        trackIds: [{ id: 1 }, { id: 2 }, { id: 3 }],
        tracks: [{ id: 1 }],
      },
    })

    expect(parts).toEqual({
      id: 6792103822,
      name: '周杰伦精选',
      cover: 'https://p1.music.126.net/abc.jpg',
      creator: 'Buradarrr',
      description: '经典曲目',
      trackCount: 3,
      playCount: 32251352,
      trackIds: [1, 2, 3],
    })
  })

  it('描述缺失回落 null，封面与创建者缺失回落空串', () => {
    const parts = parsePlaylistDetail({
      playlist: {
        id: 1,
        name: '无名歌单',
        creator: null,
        trackIds: null,
        tracks: [],
      },
    })

    expect(parts).toMatchObject({ creator: '', description: null, trackIds: [] })
  })
})

describe('mapSongDetailList', () => {
  it('把 songDetail 返回的歌曲映射为领域歌曲', () => {
    const songs = mapSongDetailList(songDetailBody([rawSong(186016, '晴天')]))

    expect(songs).toEqual([
      {
        id: 186016,
        name: '晴天',
        duration: 269000,
        artists: [{ id: 6452, name: '周杰伦' }],
        album: { id: 21349, name: '叶惠美', cover: 'https://p1.music.126.net/c.jpg' },
      },
    ])
  })

  it('字段缺失的歌曲回落空值而非报错', () => {
    const songs = mapSongDetailList(songDetailBody([{ id: 9, name: '残缺', al: null }]))

    expect(songs[0]).toMatchObject({ duration: 0, artists: [], album: { id: 0, name: '', cover: '' } })
  })
})

describe('ncmPlaylistDetail', () => {
  it('用完整 trackIds 补全全部歌曲并归位到歌单顺序', async () => {
    mockedDetail.mockResolvedValue({
      body: {
        playlist: {
          id: 42,
          name: '精选',
          creator: { nickname: 'n' },
          trackCount: 2,
          playCount: 1,
          trackIds: [{ id: 101 }, { id: 202 }],
          tracks: [{ id: 101 }],
        },
      },
    } as never)
    mockedSong.mockResolvedValue({
      body: songDetailBody([rawSong(202, '第二首'), rawSong(101, '第一首')]),
    } as never)

    const detail = await ncmPlaylistDetail({ cookie: '' }, 42)

    expect(mockedSong).toHaveBeenCalledWith({ ids: '101,202' }, undefined)
    expect(detail).toMatchObject({
      id: 42,
      name: '精选',
      trackCount: 2,
      songs: [{ id: 101, name: '第一首' }, { id: 202, name: '第二首' }],
    })
  })

  it('trackIds 超过分片大小时分片请求并在顺序归位后合并', async () => {
    const ids = Array.from({ length: 2001 }, (_, i) => i + 1)
    mockedDetail.mockResolvedValue({
      body: {
        playlist: { id: 1, name: '大全', creator: { nickname: 'n' }, trackCount: ids.length, playCount: 1, trackIds: ids.map(id => ({ id })), tracks: [] },
      },
    } as never)
    mockedSong.mockImplementation((async (query: unknown) => {
      const chunk = typeof query === 'object' && query !== null && 'ids' in query && typeof query.ids === 'string'
        ? query.ids
        : ''
      return { body: songDetailBody(chunk.split(',').map(id => rawSong(Number(id), `song-${id}`))) }
    }) as never)

    const detail = await ncmPlaylistDetail({ cookie: '' }, 1)

    expect(mockedSong).toHaveBeenCalledTimes(3)
    expect(mockedSong).toHaveBeenNthCalledWith(1, { ids: ids.slice(0, 1000).join(',') }, undefined)
    expect(mockedSong).toHaveBeenNthCalledWith(3, { ids: ids.slice(2000).join(',') }, undefined)
    expect(detail.songs).toHaveLength(ids.length)
    expect(detail.songs[0].id).toBe(1)
    expect(detail.songs[2000].id).toBe(2001)
  })

  it('无 trackIds 时不请求歌曲详情', async () => {
    mockedDetail.mockResolvedValue({
      body: { playlist: { id: 1, name: '空歌单', creator: { nickname: 'n' }, trackIds: [], tracks: [] } },
    } as never)

    const detail = await ncmPlaylistDetail({ cookie: '' }, 1)

    expect(mockedSong).not.toHaveBeenCalled()
    expect(detail.songs).toEqual([])
  })

  it('歌曲详情缺失部分歌曲时跳过（已下架歌曲不报错）', async () => {
    mockedDetail.mockResolvedValue({
      body: {
        playlist: { id: 1, name: '有下架', creator: { nickname: 'n' }, trackCount: 2, playCount: 1, trackIds: [{ id: 11 }, { id: 22 }], tracks: [] },
      },
    } as never)
    mockedSong.mockResolvedValue({ body: songDetailBody([rawSong(11, '在架')]) } as never)

    const detail = await ncmPlaylistDetail({ cookie: '' }, 1)

    expect(detail.songs).toEqual([
      { id: 11, name: '在架', duration: 269000, artists: [{ id: 6452, name: '周杰伦' }], album: { id: 21349, name: '叶惠美', cover: 'https://p1.music.126.net/c.jpg' } },
    ])
  })

  it('歌单详情失败映射为领域错误', async () => {
    mockedDetail.mockRejectedValue({ status: 429, body: { code: -460, msg: '操作太频繁' } })

    await expect(ncmPlaylistDetail({ cookie: '' }, 1)).rejects.toMatchObject({ name: 'NcmError', code: 'RATE_LIMITED' })
  })

  it('携带绑定凭据调用并透传给歌曲详情', async () => {
    mockedDetail.mockResolvedValue({
      body: { playlist: { id: 1, name: 'n', creator: { nickname: 'n' }, trackIds: [{ id: 7 }], tracks: [] } },
    } as never)
    mockedSong.mockResolvedValue({ body: songDetailBody([rawSong(7, 's')]) } as never)

    await ncmPlaylistDetail({ cookie: 'MUSIC_U=abc' }, 1)

    expect(mockedDetail).toHaveBeenCalledWith({ id: '1' }, { cookie: 'MUSIC_U=abc' })
    expect(mockedSong).toHaveBeenCalledWith({ ids: '7' }, { cookie: 'MUSIC_U=abc' })
  })
})

describe('mapUserPlaylists', () => {
  it('把用户歌单列表映射为条目，封面转 https', () => {
    const list = mapUserPlaylists([
      {
        id: 1,
        name: '创建的歌单',
        coverImgUrl: 'http://p1.music.126.net/a.jpg',
        trackCount: 12,
        playCount: 34,
        creator: { nickname: '站主' },
      },
    ])

    expect(list).toEqual([
      { id: 1, name: '创建的歌单', cover: 'https://p1.music.126.net/a.jpg', trackCount: 12, playCount: 34, creator: '站主' },
    ])
  })

  it('字段缺失时回落空值', () => {
    const list = mapUserPlaylists([{ id: 2, name: '空', creator: null }])

    expect(list[0]).toMatchObject({ cover: '', trackCount: 0, playCount: 0, creator: '' })
  })
})

describe('ncmUserPlaylists', () => {
  it('并行拉取创建与收藏两组歌单并分组返回', async () => {
    mockedCreate.mockResolvedValue({
      body: { playlist: [{ id: 1, name: '我的创建', creator: { nickname: '甲' } }] },
    } as never)
    mockedCollect.mockResolvedValue({
      body: { playlist: [{ id: 2, name: '收藏的', creator: { nickname: '乙' } }] },
    } as never)

    const groups = await ncmUserPlaylists({ cookie: '' }, 98765)

    expect(mockedCreate).toHaveBeenCalledWith({ uid: '98765', limit: 100, offset: 0 }, undefined)
    expect(mockedCollect).toHaveBeenCalledWith({ uid: '98765', limit: 100, offset: 0 }, undefined)
    expect(groups).toEqual({
      created: [expect.objectContaining({ id: 1, name: '我的创建' })],
      collected: [expect.objectContaining({ id: 2, name: '收藏的' })],
    })
  })

  it('携带绑定凭据调用两组接口', async () => {
    mockedCreate.mockResolvedValue({ body: { playlist: [] } } as never)
    mockedCollect.mockResolvedValue({ body: { playlist: [] } } as never)

    await ncmUserPlaylists({ cookie: 'MUSIC_U=abc' }, 7)

    expect(mockedCreate).toHaveBeenCalledWith(
      { uid: '7', limit: 100, offset: 0 },
      { cookie: 'MUSIC_U=abc' },
    )
    expect(mockedCollect).toHaveBeenCalledWith(
      { uid: '7', limit: 100, offset: 0 },
      { cookie: 'MUSIC_U=abc' },
    )
  })

  it('任一组失败映射为领域错误', async () => {
    mockedCreate.mockResolvedValue({ body: { playlist: [] } } as never)
    mockedCollect.mockRejectedValue({ body: { code: -462, msg: '登录状态已失效' }, status: 301 })

    await expect(ncmUserPlaylists({ cookie: '' }, 1)).rejects.toMatchObject(
      { name: 'NcmError', code: 'UNAUTHENTICATED' },
    )
  })
})
