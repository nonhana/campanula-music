import type { App } from '#lib/app/app.js'
import type { NeteasePlaylistSongs } from '#lib/app/library.js'
import { describe, expect, it } from 'vitest'
import { held, never } from './harness/hold'
import { listener, queueIds } from './harness/listener'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInAtLikedTracks } = listener(world)

// 打开不在曲库里的歌单（#56，Spec #11“搜索”、ADR-0007）：每次打开都联网取，不存进本机副本。
// 录制见 tests/fixtures/netease/README.md 的 #56 一条
const DIR = 'library/netease-playlist'
/** 搜“真夜中”的歌单结果里的一张，81 首 */
const SMALL = { id: 95050200, detail: `${DIR}/001-playlist_detail.json.gz`, songs: `${DIR}/002-song_detail.json.gz` }
/** 1,201 首：歌曲信息两页（1,000 首 + 201 首） */
const BIG = {
  id: 2137987910,
  detail: `${DIR}/003-playlist_detail.json.gz`,
  pages: [`${DIR}/004-song_detail.json.gz`, `${DIR}/005-song_detail.json.gz`],
}
/** 不存在的歌单：网易云回 404“歌单不存在” */
const MISSING = { id: 99999999999, detail: `${DIR}/006-playlist_detail.json.gz` }
/** #22 时在官方 App 里删掉的临时歌单 poems（创建者本人看）：网易云照样回 200，status 是 10 */
const DELETED = { id: 900000019, detail: `${DIR}/007-playlist_detail.json.gz` }
/** 别人的隐私歌单（作者只有一个账号，用匿名身份看自己的临时隐私歌单）：网易云回 401“该歌单已被创建者设置为隐私” */
const PRIVATE = { id: 900000022, detail: `${DIR}/anonymous/002-playlist_detail.json.gz` }
/** 曲库里收藏的歌单「私人雷达」（35 首）：它的全部曲目编号（#22 录制） */
const RADAR = { id: 3136952023, detail: 'library/sync/deleted/002-playlist_detail.json.gz' }
/** 一首歌的播放地址：点歌后放哪首都用它，压着不回（这里只看播放队列） */
const PLAY_URL = 'playback/liked/001-song_url_v1.json.gz'

/** 打开着的不在曲库里的歌单显示的样子 */
function shownContent(app: App, playlistId: number): NeteasePlaylistSongs {
  const page = app.state.library?.neteasePlaylist(playlistId)
  if (page?.status !== 'shown')
    throw new Error(`歌单 ${playlistId} 没显示：${JSON.stringify(page)}`)
  return page.content
}

/** 打开 1,201 首的歌单，第二页歌曲信息压着：显示着前 1,000 首。返回放出第二页的函数 */
async function openBigHeldAtPage2(app: App): Promise<() => void> {
  await world.netease.reply(BIG.detail)
  await world.netease.reply(BIG.pages[0])
  const page2 = held()
  await world.netease.reply(BIG.pages[1], { until: page2.until })
  void app.openPlaylist(BIG.id)
  await world.settle()
  return page2.release
}

describe('打开不在曲库里的歌单', () => {
  it('联网取头部和全部曲目编号，再按页取歌曲信息；头部有创建者、播放次数、简介和标签；不存进本机副本', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    await world.netease.reply(SMALL.detail)
    await world.netease.reply(SMALL.songs)
    await app.openPlaylist(SMALL.id)

    expect(device.requests.slice(-2).map(({ method, path }) => `${method} ${path}`)).toEqual([`GET /api/playlists/${SMALL.id}`, 'POST /api/songs'])
    expect(world.netease.calls.findLast(call => call.module === 'playlist_detail')).toMatchObject({
      query: { id: SMALL.id },
    })
    const page = app.state.library?.neteasePlaylist(SMALL.id)
    expect(page).toMatchObject({
      status: 'shown',
      content: {
        playlist: {
          id: SMALL.id,
          name: 'ACAね / ずっと真夜中でいいのに。',
          coverUrl: 'https://p1.music.126.net/n49r8CZI0TiXf_yvSMhVVg==/109951165248220925.jpg',
          creator: '用户334',
          playCount: 273065,
          description: '永远是深夜有多好 ZUTOMAYO',
          tags: ['日语'],
        },
        total: 81,
        complete: true,
        more: null,
      },
    })
    const songs = page?.status === 'shown'
      ? page.content.songs
      : []
    expect(songs).toHaveLength(81)
    expect(songs[0]).toEqual({
      id: 3445419179,
      name: 'あかねさす頃',
      artists: [
        { id: 15021101, name: 'ずっと真夜中でいいのに。' },
      ],
      album: { id: 402730746, name: 'あかねさす頃', coverUrl: 'https://p3.music.126.net/ZI_saDvp5XFnpwPg1C_TNA==/109951174077481119.jpg' },
      duration: 210233,
      availability: 'full',
    })
    expect(app.state.library?.songsOf(SMALL.id)).toBeNull()
    const stored = await device.stored()
    expect(stored.tracks).toEqual([])
    expect(stored.songs).toEqual([])
  })

  it('曲库里有的歌单照旧：拉进本机副本，不联网现取', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    await world.netease.reply(RADAR.detail)
    await world.netease.reply(SMALL.songs, {
      until: never(),
    })
    void app.openPlaylist(RADAR.id)
    await world.settle()

    const paths = device.requests.map(request => request.path)
    expect(paths).toContain(`/api/playlists/${RADAR.id}/track-ids`)
    expect(paths).not.toContain(`/api/playlists/${RADAR.id}`)
    expect(app.state.library?.neteasePlaylist(RADAR.id)).toBeNull()
    expect(app.state.library?.songsOf(RADAR.id)).toMatchObject({
      playlist: { kind: 'collected' },
      total: 35,
      complete: false,
    })
    expect((await device.stored()).tracks.map(([id]) => id)).toEqual([RADAR.id])
  })

  it('几千首的歌单按页取歌曲信息，取到一页就先显示，没取全时标出来；取全了不再标', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const releasePage2 = await openBigHeldAtPage2(app)

    const songsRequests = device.requests.filter(request => request.path === '/api/songs')
    expect(songsRequests.map(request => (request.body as { ids: number[] }).ids.length)).toEqual([1000, 201])
    const partial = shownContent(app, BIG.id)
    expect(partial).toMatchObject({
      playlist: {
        name: '评论过万日语歌合集',
        tags: ['日语', '流行', 'ACG'],
      },
      total: 1201,
      complete: false,
      more: { status: 'loading' },
    })
    expect(partial.songs).toHaveLength(1000)

    releasePage2()
    await world.settle()
    const whole = shownContent(app, BIG.id)
    expect(whole).toMatchObject({ total: 1201, complete: true, more: null })
    expect(whole.songs).toHaveLength(1201)
    expect(whole.songs[1000]).toMatchObject({ id: 713131, name: '英雄' })
  })

  it('歌单内搜索在已取到的歌里找：没取全时标“可能不全”，取全后找得到后面的歌、不再标', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const releasePage2 = await openBigHeldAtPage2(app)

    // 第一页、第二页各有一首 doa 的《英雄》；搜的时候不分大小写
    const partial = app.searchPlaylist(BIG.id, 'DOA')
    expect(partial?.songs.map(song => song.id)).toEqual([406347677])
    expect(partial?.incomplete).toBe(true)

    releasePage2()
    await world.settle()
    const whole = app.searchPlaylist(BIG.id, 'DOA')
    expect(whole?.songs.map(song => song.id)).toEqual([406347677, 713131])
    expect(whole?.incomplete).toBe(false)
  })

  it('在里面点一首歌：用整张歌单替换播放队列、从这首开始放，播放来源是这张歌单；还没取全时先用已取到的，取全了把后面的补上（规则⑫）', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const releasePage2 = await openBigHeldAtPage2(app)
    const partial = shownContent(app, BIG.id)
    const clicked = partial.songs.slice(1).find(song => song.availability !== 'noCopyright')!

    await world.netease.reply(PLAY_URL, {
      until: never(),
    })
    app.play({ kind: 'playlist', id: BIG.id }, clicked.id)
    await world.settle()
    expect(queueIds(app)).toEqual(partial.songs.map(song => song.id))
    expect(app.state.player.queue[app.state.player.current!].song.id).toBe(clicked.id)
    expect(app.state.player.queue.every(entry => entry.source.kind === 'playlist' && entry.source.id === BIG.id)).toBe(true)

    releasePage2()
    await world.settle()
    const whole = shownContent(app, BIG.id)
    expect(queueIds(app)).toEqual(whole.songs.map(song => song.id))
    expect(queueIds(app)).toHaveLength(1201)
    expect(app.state.player.queue[app.state.player.current!].song.id).toBe(clicked.id)
    expect(app.state.player.queue.every(entry => entry.source.kind === 'playlist' && entry.source.id === BIG.id)).toBe(true)
  })

  it('每次打开都联网取：再打开时先显示上次取到的，同时联网取头部和曲目编号', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await world.netease.reply(SMALL.detail)
    await world.netease.reply(SMALL.songs)
    await app.openPlaylist(SMALL.id)
    const first = shownContent(app, SMALL.id)

    await world.netease.reply(SMALL.detail, {
      until: never(),
    })
    void app.openPlaylist(SMALL.id)
    await world.settle()
    expect(device.pending.map(request => request.path)).toContain(`/api/playlists/${SMALL.id}`)
    expect(shownContent(app, SMALL.id)).toEqual(first)
  })

  it('再打开时断网：照常显示上次取到的；联网后再打开，只取头部和曲目编号', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await world.netease.reply(SMALL.detail)
    await world.netease.reply(SMALL.songs)
    await app.openPlaylist(SMALL.id)
    const first = shownContent(app, SMALL.id)

    device.setOnline(false)
    await app.openPlaylist(SMALL.id)
    expect(shownContent(app, SMALL.id)).toEqual(first)

    device.setOnline(true)
    await world.netease.reply(SMALL.detail)
    const sent = device.requests.length
    await app.openPlaylist(SMALL.id)
    expect(device.requests.slice(sent).map(request => request.path)).toEqual([`/api/playlists/${SMALL.id}`])
    expect(shownContent(app, SMALL.id)).toEqual(first)
  })
})

describe('打不开时说明原因', () => {
  it('第一次打开时断网：说要联网才能打开；联网后再打开就取到了', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    device.setOnline(false)
    await app.openPlaylist(SMALL.id)
    expect(app.state.library?.neteasePlaylist(SMALL.id)).toEqual({
      status: 'failed',
      failure: { kind: 'offline' },
    })

    device.setOnline(true)
    await world.netease.reply(SMALL.detail)
    await world.netease.reply(SMALL.songs)
    await app.openPlaylist(SMALL.id)
    expect(shownContent(app, SMALL.id).songs).toHaveLength(81)
  })

  it('歌单不存在、已被删除、是别人的隐私歌单：说明是哪一种，不取歌曲信息', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    for (const [playlist, reason] of [
      [MISSING, 'missing'],
      [DELETED, 'deleted'],
      [PRIVATE, 'private'],
    ] as const) {
      await world.netease.reply(playlist.detail)
      await app.openPlaylist(playlist.id)
      expect(world.netease.calls.findLast(call => call.module === 'playlist_detail')).toMatchObject({
        query: { id: playlist.id },
      })
      expect(app.state.library?.neteasePlaylist(playlist.id)).toEqual({ status: 'unavailable', reason })
    }
    expect(device.requests.map(request => request.path)).not.toContain('/api/songs')
  })

  it('歌曲信息有一页没取成：已经取到的照常显示，说明没取全的原因；再打开一次接着取', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await world.netease.reply(BIG.detail)
    await world.netease.reply(BIG.pages[0])
    await world.netease.reply('library/song_detail.liked-page4.502-null-artist.json.gz')
    await app.openPlaylist(BIG.id)
    expect(shownContent(app, BIG.id)).toMatchObject({
      complete: false,
      more: {
        status: 'failed',
        failure: { kind: 'upstreamChanged' },
      },
    })
    expect(shownContent(app, BIG.id).songs).toHaveLength(1000)

    await world.netease.reply(BIG.detail)
    await world.netease.reply(BIG.pages[1])
    const sent = device.requests.length
    await app.openPlaylist(BIG.id)
    const retried = device.requests.slice(sent)
    expect(retried.map(request => request.path)).toEqual([`/api/playlists/${BIG.id}`, '/api/songs'])
    expect((retried[1].body as { ids: number[] }).ids).toHaveLength(201)
    expect(shownContent(app, BIG.id)).toMatchObject({ complete: true, more: null })
    expect(shownContent(app, BIG.id).songs).toHaveLength(1201)
  })
})
