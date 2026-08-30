import {
  playlistDetail as sdkPlaylistDetail,
  playlistTrackAll as sdkPlaylistTrackAll,
  songDetail as sdkSongDetail,
  userPlaylistCollect as sdkUserPlaylistCollect,
  userPlaylistCreate as sdkUserPlaylistCreate,
} from 'hana-music-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userPlaylistsFixture from './fixtures/user-playlists.json'
import { mapUserPlaylists, ncmPlaylistDetail, ncmPlaylistTracks, ncmUserPlaylists, parsePlaylistDetail } from './playlists'
import { mapSongDetailList } from './songDetail'

vi.mock('hana-music-api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('hana-music-api')>()
  return {
    ...mod,
    playlistDetail: vi.fn(),
    playlistTrackAll: vi.fn(),
    songDetail: vi.fn(),
    userPlaylistCreate: vi.fn(),
    userPlaylistCollect: vi.fn(),
  }
})

const mockedDetail = vi.mocked(sdkPlaylistDetail)
const mockedTrackAll = vi.mocked(sdkPlaylistTrackAll)
const mockedSong = vi.mocked(sdkSongDetail)
const mockedCreate = vi.mocked(sdkUserPlaylistCreate)
const mockedCollect = vi.mocked(sdkUserPlaylistCollect)

/** 录制自真实上游的 user_playlist 封套（数组已裁剪至 3 条），形状知识以它为准 */
const fixture = userPlaylistsFixture as unknown as {
  created: { data: { playlist: Record<string, unknown>[] }, code: number }
  collected: { data: { playlist: Record<string, unknown>[] }, code: number }
}

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
  mockedTrackAll.mockReset()
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
      cover: 'https://p4.music.126.net/abc.jpg',
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
        album: { id: 21349, name: '叶惠美', cover: 'https://p3.music.126.net/c.jpg' },
      },
    ])
  })

  it('字段缺失的歌曲回落空值而非报错', () => {
    const songs = mapSongDetailList(songDetailBody([{ id: 9, name: '残缺', al: null }]))

    expect(songs[0]).toMatchObject({ duration: 0, artists: [], album: { id: 0, name: '', cover: '' } })
  })
})

describe('ncmPlaylistDetail', () => {
  it('实时拉取歌单头信息，歌曲不随详情补全（由分页接口按需拉取）', async () => {
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

    const detail = await ncmPlaylistDetail({ cookie: '' }, 42)

    expect(mockedSong).not.toHaveBeenCalled()
    expect(mockedTrackAll).not.toHaveBeenCalled()
    expect(detail).toEqual({
      id: 42,
      name: '精选',
      cover: '',
      creator: 'n',
      description: null,
      trackCount: 2,
      playCount: 1,
    })
  })
  it('「HTTP 200 + 业务失败码」形态映射为领域错误，不静默返回空壳', async () => {
    // 失败封套由真实录制包派生（真实 playlist 对象 + 仅改 code 相关字段；上游业务失败包未录制）
    mockedDetail.mockResolvedValue({
      body: { playlist: fixture.created.data.playlist[0], code: 301, msg: '需要登录' },
    } as never)

    await expect(ncmPlaylistDetail({ cookie: '' }, 1)).rejects.toMatchObject(
      { name: 'NcmError', code: 'UNAUTHENTICATED' },
    )
  })

  it('歌单详情失败映射为领域错误', async () => {
    mockedDetail.mockRejectedValue({ status: 429, body: { code: -460, msg: '操作太频繁' } })

    await expect(ncmPlaylistDetail({ cookie: '' }, 1)).rejects.toMatchObject({ name: 'NcmError', code: 'RATE_LIMITED' })
  })

  it('携带绑定凭据调用', async () => {
    mockedDetail.mockResolvedValue({
      body: { playlist: { id: 1, name: 'n', creator: { nickname: 'n' }, trackIds: [{ id: 7 }], tracks: [] } },
    } as never)

    await ncmPlaylistDetail({ cookie: 'MUSIC_U=abc' }, 1)

    expect(mockedDetail).toHaveBeenCalledWith({ id: '1' }, { cookie: 'MUSIC_U=abc' })
  })
})

describe('ncmPlaylistTracks', () => {
  it('按 limit/offset 请求 playlist/track/all 并映射为领域歌曲', async () => {
    mockedTrackAll.mockResolvedValue({
      body: songDetailBody([rawSong(202, '第二首'), rawSong(101, '第一首')]),
    } as never)

    const songs = await ncmPlaylistTracks({ cookie: '' }, 42, { limit: 100, offset: 100 })

    expect(mockedTrackAll).toHaveBeenCalledWith({ id: '42', limit: 100, offset: 100 }, undefined)
    expect(songs).toEqual([
      { id: 202, name: '第二首', duration: 269000, artists: [{ id: 6452, name: '周杰伦' }], album: { id: 21349, name: '叶惠美', cover: 'https://p3.music.126.net/c.jpg' } },
      { id: 101, name: '第一首', duration: 269000, artists: [{ id: 6452, name: '周杰伦' }], album: { id: 21349, name: '叶惠美', cover: 'https://p3.music.126.net/c.jpg' } },
    ])
  })

  it('携带绑定凭据调用', async () => {
    mockedTrackAll.mockResolvedValue({ body: songDetailBody([]) } as never)

    await ncmPlaylistTracks({ cookie: 'MUSIC_U=abc' }, 42, { limit: 100, offset: 200 })

    expect(mockedTrackAll).toHaveBeenCalledWith({ id: '42', limit: 100, offset: 200 }, { cookie: 'MUSIC_U=abc' })
  })

  it('失败映射为领域错误', async () => {
    mockedTrackAll.mockRejectedValue({ status: 429, body: { code: -460, msg: '操作太频繁' } })

    await expect(ncmPlaylistTracks({ cookie: '' }, 1, { limit: 100, offset: 0 })).rejects.toMatchObject({ name: 'NcmError', code: 'RATE_LIMITED' })
  })

  it('「HTTP 200 + 业务失败码」形态映射为领域错误（无版权）', async () => {
    // 失败封套由最小成功封套派生，仅改 code 相关字段（上游业务失败包未录制）
    mockedTrackAll.mockResolvedValue({ body: { ...songDetailBody([rawSong(1, '第一首')]), code: -110, msg: '无版权' } } as never)

    await expect(ncmPlaylistTracks({ cookie: '' }, 1, { limit: 100, offset: 0 })).rejects.toMatchObject(
      { name: 'NcmError', code: 'RESOURCE_UNAVAILABLE' },
    )
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
    mockedCreate.mockResolvedValue({ body: fixture.created } as never)
    mockedCollect.mockResolvedValue({ body: fixture.collected } as never)

    const groups = await ncmUserPlaylists({ cookie: '' }, 98765)

    expect(mockedCreate).toHaveBeenCalledWith({ uid: '98765', limit: 100, offset: 0 }, undefined)
    expect(mockedCollect).toHaveBeenCalledWith({ uid: '98765', limit: 100, offset: 0 }, undefined)
    // 封套回归：真实上游为 {data:{playlist:[...]}}，解包后两组均非空且逐条映射
    expect(groups.created.length).toBe(fixture.created.data.playlist.length)
    expect(groups.created.length).toBeGreaterThan(0)
    expect(groups.collected.length).toBe(fixture.collected.data.playlist.length)
    expect(groups.collected.length).toBeGreaterThan(0)
    expect(groups.created[0]).toMatchObject({
      id: fixture.created.data.playlist[0]?.id,
      name: fixture.created.data.playlist[0]?.name,
    })
    expect(groups.collected[0]).toMatchObject({
      id: fixture.collected.data.playlist[0]?.id,
      name: fixture.collected.data.playlist[0]?.name,
    })
  })

  it('顶层 playlist 旧形状同样兼容解包', async () => {
    mockedCreate.mockResolvedValue({
      body: { playlist: [{ id: 1, name: '旧形状', creator: { nickname: '甲' } }] },
    } as never)
    mockedCollect.mockResolvedValue({ body: { playlist: [] } } as never)

    const groups = await ncmUserPlaylists({ cookie: '' }, 98765)

    expect(groups.created).toEqual([expect.objectContaining({ id: 1, name: '旧形状' })])
    expect(groups.collected).toEqual([])
  })

  it('携带绑定凭据调用两组接口', async () => {
    mockedCreate.mockResolvedValue({ body: fixture.created } as never)
    mockedCollect.mockResolvedValue({ body: fixture.collected } as never)

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
    mockedCreate.mockResolvedValue({ body: fixture.created } as never)
    mockedCollect.mockRejectedValue({ body: { code: -462, msg: '登录状态已失效' }, status: 301 })

    await expect(ncmUserPlaylists({ cookie: '' }, 1)).rejects.toMatchObject(
      { name: 'NcmError', code: 'UNAUTHENTICATED' },
    )
  })

  it('「HTTP 200 + 业务失败码」形态映射为领域错误，不静默返回空分组', async () => {
    // 失败封套由真实录制包派生（仅改 code 相关字段；上游业务失败包未录制）
    mockedCreate.mockResolvedValue({ body: { ...fixture.created, code: 801, msg: '登录状态已失效' } } as never)
    mockedCollect.mockResolvedValue({ body: fixture.collected } as never)

    await expect(ncmUserPlaylists({ cookie: '' }, 1)).rejects.toMatchObject(
      { name: 'NcmError', code: 'UNAUTHENTICATED' },
    )
  })
})
