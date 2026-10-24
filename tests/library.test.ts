import { describe, expect, it, vi } from 'vitest'

import type { Device, SentRequest } from './harness/device'
import { held, never } from './harness/hold'
import type { RecordedPlaylist } from './harness/listener'
import { COLLECTED_ALBUMS, COLLECTED_ARTISTS, HEARTS, isSync, LIKED_TRACK_IDS, likedPage, listener, PLAYLISTS_WITH_POEMS, recordedBatch, recordedTrackIds, songPages, syncRequests, trackIdRequests } from './harness/listener'
import { ANOTHER_ACCOUNT, LIBRARY_SYNC_MODULES, RECORDED_ACCOUNT, signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()
const { replyLibrary, replyPlaylists, signInSynced } = listener(world, { playlists: PLAYLISTS_WITH_POEMS })

// 作者的“我喜欢的音乐”（#21 录制，4,984 首）：每页 1,000 首。第 4 页里有 3 首传到云盘、没匹配上曲库的歌，歌手名、专辑名是 null（hana-music-api 2.4.0 起原样返回，nonhana/hana-music-api#48）
/** SDK 认不出返回的结构时整页拒掉（502）：2.3.0 对第 4 页的真实返回。2.4.0 起这一页能认出了，但别人看云盘上传的歌（歌名也是 null）时照样这样拒，所以留着当“这一页没取到”用 */
const PAGE_4_REJECTED = 'library/song_detail.liked-page4.502-null-artist.json.gz'
const RATE_LIMITED = 'library/song_detail.405-rate-limited.constructed.json'
const LIKED_ID = 900000001
/** 第 4 页里一首传到云盘、没匹配上曲库的歌 */
const UPLOADED_SONG = 1984488794
/** 作者在官方 App 里新建的临时歌单（#22 录制时建的，录完就删了） */
const POEMS_ID = 900000019
/** 作者的一张自建歌单：35 首，只有 1 首不在我喜欢的音乐里 */
const RHYTHM_ID = 900000009
/** 作者收藏的一张别人的歌单 */
const COLLECTED_ID = 2483057410
/** 作者的一张自建歌单：写了简介，没打标签 */
const BANG_DREAM_OWN_ID = 900000004
const BEFORE = await recordedBatch('before')
const AFTER = await recordedBatch('after')
const DELETED = await recordedBatch('deleted')
const recorded = (id: number) => BEFORE.playlists.find(playlist => playlist.id === id)!

/** 作者收藏的别人的合集（1,204 首）：第 2 页的 138 首后面的歌单里都没有，这一页没取到也不影响后面的歌单要取哪些歌。别人传到云盘的歌在我们看来歌名是 null，SDK 会整页拒掉（#21 留言），这里拿它当“这一页没取到” */
const BANG_DREAM_ID = 4943170241
const BANG_DREAM_PAGE_2 = recorded(BANG_DREAM_ID).pages[1]

/** 登录并同步整个曲库：只有 Bang Dream 合集的第 2 页 SDK 认不出，同步最后停在“没能同步” */
const syncWithRejectedPage = async (device: Device) => {
  const { app } = await device.open()
  await replyLibrary()
  for (const page of [1, 2, 3, 4, 5] as const)
    await world.netease.reply(likedPage(page))
  await replyPlaylists(BEFORE.playlists, { rejected: BANG_DREAM_PAGE_2.fixture, rejection: PAGE_4_REJECTED })
  await signIn(world, app)
  await device.idle()
  return app
}

describe('首次同步', () => {
  it('登录后先拿红心、歌单列表、收藏的专辑和歌手，再一张一张地同步每张歌单：先我喜欢的音乐，再按歌单列表的顺序；每张先拿全部曲目编号，再一页一页地取还没有的歌曲信息（每页最多 1,000 首），直到同步完', async () => {
    const trackIds = await recordedTrackIds()
    const device = world.device()
    const { app } = await device.open()
    const page2 = held()
    await replyLibrary()
    await world.netease.reply(likedPage(1))
    await world.netease.reply(likedPage(2), { until: page2.until })
    await world.netease.reply(likedPage(3))

    await signIn(world, app)

    await vi.waitFor(() => expect(app.state.library?.liked?.songs).toHaveLength(1000))
    const library = app.state.library!
    expect(library.playlists).toHaveLength(54)
    expect(library.liked?.playlist).toMatchObject({ id: LIKED_ID, kind: 'liked', name: '测试听众喜欢的音乐' })
    expect(library.liked?.total).toBe(4984)
    expect(library.liked?.songs.map(song => song.id)).toEqual(trackIds.slice(0, 1000))
    expect(library.sync).toEqual({ status: 'syncing' })
    expect(library.songsOf(RHYTHM_ID)).toMatchObject({ songs: [], total: 35, complete: false })

    await world.netease.reply(likedPage(4))
    await world.netease.reply(likedPage(5))
    await replyPlaylists(BEFORE.playlists)
    page2.release()
    await device.idle()

    expect(syncRequests(device).slice(0, 10).map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /api/hearts?uid=10000001',
      'GET /api/playlists?uid=10000001',
      'GET /api/albums',
      'GET /api/artists',
      `GET /api/playlists/${LIKED_ID}/track-ids`,
      'POST /api/songs',
      'POST /api/songs',
      'POST /api/songs',
      'POST /api/songs',
      'POST /api/songs',
    ])
    expect(trackIdRequests(device)).toEqual([
      LIKED_ID,
      ...BEFORE.playlists.map(playlist => playlist.id),
    ])
    expect(songPages(device)).toEqual([
      ...[0, 1, 2, 3, 4].map(page => trackIds.slice(page * 1000, (page + 1) * 1000)),
      ...BEFORE.playlists.flatMap(playlist => playlist.pages.map(page => page.ids)),
    ])
    expect(world.netease.calls.filter(call => call.module !== 'song_detail').slice(2, 7).map(({ module, query }) => ({ module, query }))).toEqual([
      {
        module: 'likelist',
        query: { uid: 10000001 },
      },
      {
        module: 'user_playlist',
        query: { uid: 10000001, limit: 1000, offset: 0 },
      },
      {
        module: 'album_sublist',
        query: { limit: 1000, offset: 0 },
      },
      {
        module: 'artist_sublist',
        query: { limit: 1000, offset: 0 },
      },
      {
        module: 'playlist_detail',
        query: { id: LIKED_ID },
      },
    ])
    const synced = app.state.library!
    expect(synced.sync).toEqual({ status: 'synced' })
    expect(synced.liked?.songs.map(song => song.id)).toEqual(trackIds)
    expect(synced.liked).toMatchObject({ total: 4984, complete: true })
    expect(synced.playlists?.filter(playlist => !synced.songsOf(playlist.id)?.complete)).toEqual([])
    expect(synced.songsOf(RHYTHM_ID)?.songs.map(song => song.id)).toEqual(recorded(RHYTHM_ID).trackIds)
    expect(synced.songsOf(COLLECTED_ID)?.playlist).toMatchObject({ kind: 'collected', name: 'Jazz HipHop · 驶向落日的航班', creator: '用户4' })
    expect(synced.liked?.songs.find(song => song.id === UPLOADED_SONG)).toMatchObject({
      name: 'Sugar life',
      artists: [
        { id: 0, name: null },
      ],
      album: { id: 0, name: null },
    })
    // 服务端只回界面用得到的字段：网易云的原始返回一页歌曲信息约 2.1 MB、曲目编号约 3.1 MB，Vercel 单次响应的上限是 4.5 MB
    expect(Math.max(...device.responseBodies.map(body => body.length))).toBeLessThan(1_000_000)
  })

  it('歌单列表里每张歌单都带着简介、标签和播放次数：自建的、收藏的，和不在曲库里的歌单一样（user_playlist 和 playlist_detail 是同一份歌单，SDK 2.12.0）', async () => {
    const device = world.device()
    const { app } = await device.open()
    await replyLibrary({
      until: never(),
    })
    await signIn(world, app)
    await world.settle()

    const playlists = app.state.library?.playlists ?? []
    expect(playlists.find(playlist => playlist.id === COLLECTED_ID)).toMatchObject({
      kind: 'collected',
      description: '忙碌的春天终于过去了，接下来的几个月，踏上Jazz Hip Hop的热浪，一起Chill一下。\n\nJazz Jazz-HipHop Chill-HipHop Blues',
      tags: ['爵士', '夜晚', '怀旧'],
      playCount: 6173606,
    })
    expect(playlists.find(playlist => playlist.id === BANG_DREAM_OWN_ID)).toMatchObject({
      kind: 'own',
      description: '谢谢你带给我的感动！！',
      tags: [],
      playCount: 13,
    })
    expect(playlists.find(playlist => playlist.id === RHYTHM_ID)).toMatchObject({
      kind: 'own',
      description: null,
      tags: [],
      playCount: 439,
    })
  })

  it('收藏的专辑和歌手各一次拿全，最近收藏的在前，存进本机副本；再次打开 App 先显示副本，不等同步，断网也照样在', async () => {
    const device = world.device()
    const { app } = await device.open()
    const liked = held()
    await replyLibrary({ until: liked.until })
    await signIn(world, app)
    await vi.waitFor(() => expect(world.netease.held).toBe(1))

    const { albums, artists } = app.state.library!
    expect(albums).toHaveLength(55)
    expect(albums?.[0]).toEqual({
      id: 3149073,
      name: 'Keep The Village Alive',
      coverUrl: 'https://p3.music.126.net/GdQ9aQ3f3pscKhOpmIV4eA==/18345351510219723.jpg',
      artists: [
        { id: 99995, name: 'Stereophonics' },
      ],
      songCount: 10,
    })
    expect(artists).toHaveLength(236)
    expect(artists?.[0]).toEqual({
      id: 22298,
      name: 'world\'s end girlfriend',
      avatarUrl: 'http://p3.music.126.net/XHee86i0wEHO7QFjWMvXcw==/109951163214181883.jpg',
    })

    const hearts = held()
    await world.netease.reply('login/user_account.vip.json')
    await replyLibrary({ through: 'hearts', until: hearts.until })
    const { app: reopened } = await device.open()
    device.setOnline(false)

    expect(reopened.state.library).toMatchObject({ albums, artists })
  })

  it('收藏的歌单有一页 SDK 认不出返回的结构：这张歌单已经同步的照常显示，后面的歌单接着同步，最后停在“没能同步”；重试从这一页接着取，不重取前面的', async () => {
    const device = world.device()
    const app = await syncWithRejectedPage(device)

    const library = app.state.library!
    expect(library.sync).toEqual({
      status: 'failed',
      failure: { kind: 'upstreamChanged' },
    })
    const bangDream = library.songsOf(BANG_DREAM_ID)!
    expect(bangDream).toMatchObject({ total: 1204, complete: false })
    expect(bangDream.songs.filter(song => BANG_DREAM_PAGE_2.ids.includes(song.id))).toEqual([])
    expect(bangDream.songs).toHaveLength(1204 - BANG_DREAM_PAGE_2.ids.length)
    expect(BEFORE.playlists.filter(playlist => playlist.id !== BANG_DREAM_ID && !library.songsOf(playlist.id)?.complete)).toEqual([])
    const sentPages = songPages(device).length
    const sentTrackIds = trackIdRequests(device).length

    await replyLibrary({ through: 'artists' })
    await world.netease.reply(PAGE_4_REJECTED)
    app.retrySync()
    await device.idle()

    expect(songPages(device).slice(sentPages)).toEqual([BANG_DREAM_PAGE_2.ids])
    expect(trackIdRequests(device)).toHaveLength(sentTrackIds)
    expect(app.state.library?.sync).toEqual({
      status: 'failed',
      failure: { kind: 'upstreamChanged' },
    })
  })
})

describe('本机副本', () => {
  it('再次打开 App：先显示本机副本，不等同步；曲目没变的歌单不重拉编号，只取还没有的歌', async () => {
    const trackIds = await recordedTrackIds()
    const device = world.device()
    await syncWithRejectedPage(device)
    const sent = syncRequests(device).length

    const hearts = held()
    await world.netease.reply('login/user_account.vip.json')
    await replyLibrary({
      through: 'artists',
      holds: {
        hearts: { until: hearts.until },
      },
    })
    await world.netease.reply(PAGE_4_REJECTED)
    const { app } = await device.open()

    expect(app.state.session).toEqual({ status: 'signedIn', account: RECORDED_ACCOUNT })
    expect(app.state.library?.liked?.songs.map(song => song.id)).toEqual(trackIds)
    expect(app.state.library?.songsOf(BANG_DREAM_ID)?.songs).toHaveLength(1204 - BANG_DREAM_PAGE_2.ids.length)
    expect(app.state.library?.playlists).toHaveLength(54)

    hearts.release()
    await device.idle()
    expect(syncRequests(device).slice(sent).map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /api/hearts?uid=10000001',
      'GET /api/playlists?uid=10000001',
      'GET /api/albums',
      'GET /api/artists',
      'POST /api/songs',
    ])
    expect(songPages(device).at(-1)).toEqual(BANG_DREAM_PAGE_2.ids)
  })

  it('主动退出：删掉本机副本；同一个账号再登录，从头同步', async () => {
    const device = world.device()
    const app = await syncWithRejectedPage(device)

    await world.netease.reply('login/logout.json')
    await app.logout()
    expect(app.state.library).toBeNull()
    expect(await device.stored()).toMatchObject({
      library: [],
      tracks: [],
      songs: [],
      albumPages: [],
    })

    const hearts = held()
    await replyLibrary({ through: 'hearts', until: hearts.until })
    await signIn(world, app)

    expect(app.state.library).toMatchObject({ playlists: null, liked: null, hearts: null })
  })

  it('退出时还有一页在路上：它回来后也不会写回本机副本', async () => {
    const device = world.device()
    const { app } = await device.open()
    const page2 = held()
    await replyLibrary()
    await world.netease.reply(likedPage(1))
    await world.netease.reply(likedPage(2), { until: page2.until })
    await signIn(world, app)
    await vi.waitFor(() => expect(app.state.library?.liked?.songs).toHaveLength(1000))

    await world.netease.reply('login/logout.json')
    await app.logout()
    page2.release()
    await device.idle()
    expect(await device.stored()).toMatchObject({ library: [], tracks: [], songs: [] })

    const hearts = held()
    await replyLibrary({ through: 'hearts', until: hearts.until })
    await signIn(world, app)
    expect(app.state.library).toMatchObject({ playlists: null, liked: null, hearts: null })
  })

  it('登录失效后换另一个账号登录：不沿用上一个账号的副本，按新账号同步', async () => {
    const device = world.device()
    await syncWithRejectedPage(device)
    await world.netease.reply('login/user_account.invalid.json')
    await world.netease.reply('login/login_refresh.301-invalid.json')
    const { app } = await device.open()
    expect(app.state.session).toEqual({ status: 'loginExpired' })
    expect(app.state.library).toBeNull()
    const sent = syncRequests(device).length

    const hearts = held()
    await replyLibrary({ through: 'hearts', until: hearts.until })
    await signIn(world, app, { another: true })

    expect(app.state.session).toEqual({ status: 'signedIn', account: ANOTHER_ACCOUNT })
    expect(app.state.library).toMatchObject({ playlists: null, liked: null, hearts: null })
    expect(await device.stored()).toMatchObject({
      library: [
        ['owner', ANOTHER_ACCOUNT.id],
      ],
      tracks: [],
      songs: [],
    })
    expect(syncRequests(device).slice(sent).map(request => request.path)).toEqual(['/api/hearts?uid=10000002'])
  })
})

describe('请求节奏', () => {
  it('网易云说操作频繁：后台同步停到 retryAfter 再重发被拒的那页；这期间退出这样的前台请求照常马上发', async () => {
    const trackIds = await recordedTrackIds()
    const device = world.device()
    const { app } = await device.open()
    await replyLibrary()
    await world.netease.reply(likedPage(1))
    await world.netease.reply(RATE_LIMITED)
    await world.netease.reply(likedPage(2))
    await world.netease.reply(likedPage(3))
    await world.netease.reply(likedPage(4))
    await world.netease.reply(likedPage(5))
    await replyPlaylists(BEFORE.playlists)
    await signIn(world, app)
    await device.idle()

    const limitedAt = Date.now()
    expect(app.state.library?.sync).toEqual({ status: 'rateLimited', until: limitedAt + 30_000 })
    expect(songPages(device)).toEqual([
      trackIds.slice(0, 1000),
      trackIds.slice(1000, 2000),
    ])

    await world.clock.advance(29_999)
    expect(songPages(device)).toHaveLength(2)

    await world.clock.advance(1)
    expect(songPages(device).slice(2, 6)).toEqual([1, 2, 3, 4].map(page => trackIds.slice(page * 1000, (page + 1) * 1000)))
    expect(app.state.library?.liked).toMatchObject({ total: 4984, complete: true })
    expect(app.state.library?.sync).toEqual({ status: 'synced' })
  })

  it('同步被操作频繁停着时，前台请求（退出）不排在后面：马上发出', async () => {
    const device = world.device()
    const { app } = await device.open()
    await replyLibrary()
    await world.netease.reply(RATE_LIMITED)
    await signIn(world, app)
    await device.idle()
    expect(app.state.library?.sync.status).toBe('rateLimited')

    await world.netease.reply('login/logout.json')
    await app.logout()

    expect(device.requests.at(-1)).toEqual({ method: 'POST', path: '/api/logout', body: {} })
    expect(await device.cookies()).toEqual([])
  })

  it('断网：同步停下等联网，联网后从停下的那页接着取', async () => {
    const trackIds = await recordedTrackIds()
    const device = world.device()
    const { app } = await device.open()
    const page1 = held()
    await replyLibrary()
    await world.netease.reply(likedPage(1), { until: page1.until })
    await signIn(world, app)
    await vi.waitFor(() => expect(world.netease.held).toBe(1))

    device.setOnline(false)
    page1.release()
    await device.idle()

    expect(app.state.library?.liked?.songs).toHaveLength(1000)
    expect(app.state.library?.sync).toEqual({ status: 'offline' })

    await world.netease.reply(likedPage(2))
    await world.netease.reply(likedPage(3))
    await world.netease.reply(likedPage(4))
    await world.netease.reply(likedPage(5))
    await replyPlaylists(BEFORE.playlists)
    device.setOnline(true)
    await device.idle()

    expect(songPages(device).slice(0, 5)).toEqual([0, 1, 2, 3, 4].map(page => trackIds.slice(page * 1000, (page + 1) * 1000)))
    expect(app.state.library?.sync).toEqual({ status: 'synced' })
  })

  it('同步途中网易云说需要登录、续期也被拒：同步停下，App 显示需要重新登录；同一个账号重新登录后从停下的地方接着同步', async () => {
    const device = world.device()
    await syncWithRejectedPage(device)

    await world.netease.reply('login/user_account.vip.json')
    await world.netease.reply('library/likelist.301-invalid.json')
    await world.netease.reply('login/login_refresh.301-invalid.json')
    const { app: reopened } = await device.open()
    await device.idle()

    expect(reopened.state.session).toEqual({ status: 'loginExpired' })
    expect(reopened.state.library).toBeNull()
    expect(syncRequests(device).at(-1)?.path).toBe('/api/hearts?uid=10000001')
    const sent = syncRequests(device).length

    await world.clock.advance(60_000)
    expect(syncRequests(device)).toHaveLength(sent)

    const hearts = held()
    await replyLibrary({
      through: 'artists',
      holds: {
        hearts: { until: hearts.until },
      },
    })
    await world.netease.reply(PAGE_4_REJECTED)
    await signIn(world, reopened)
    expect(reopened.state.library?.songsOf(BANG_DREAM_ID)?.songs).toHaveLength(1204 - BANG_DREAM_PAGE_2.ids.length)

    hearts.release()
    await device.idle()
    expect(syncRequests(device).slice(sent).map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /api/hearts?uid=10000001',
      'GET /api/playlists?uid=10000001',
      'GET /api/albums',
      'GET /api/artists',
      'POST /api/songs',
    ])
    expect(songPages(device).at(-1)).toEqual(BANG_DREAM_PAGE_2.ids)
  })

  it('凭据在拿到红心之后失效，网易云给歌单列表的是匿名视角：当作需要登录，续期也被拒就停下同步、显示需要重新登录；匿名视角的歌单列表不写进副本', async () => {
    const device = world.device()
    const { app } = await device.open()
    await replyLibrary({ through: 'hearts' })
    await world.netease.reply('library/user_playlist.anonymous-view.json.gz')
    await world.netease.reply('login/login_refresh.301-invalid.json')
    await signIn(world, app)
    await device.idle()

    expect(app.state.session).toEqual({ status: 'loginExpired' })
    expect(syncRequests(device).map(request => request.path)).toEqual(['/api/hearts?uid=10000001', '/api/playlists?uid=10000001'])
    expect(world.netease.calls.slice(-2).map(call => call.module)).toEqual(['user_playlist', 'login_refresh'])
    expect((await device.stored()).library.map(([key]) => key)).toEqual(['hearts', 'owner'])
  })

  it('退出时有个同步请求还在路上，重新登录后它才回来说需要登录：不影响新的登录，新的同步照常进行', async () => {
    const device = world.device()
    const { app } = await device.open()
    const stale = held()
    await world.netease.reply('library/likelist.301-invalid.json', { until: stale.until })
    await world.netease.reply('login/login_refresh.301-invalid.json')
    await signIn(world, app)
    await world.settle()

    await world.netease.reply('login/logout.json')
    await app.logout()
    const fresh = held()
    await replyLibrary({ through: 'hearts', until: fresh.until })
    await signIn(world, app)

    stale.release()
    await world.settle()

    expect(app.state.session).toEqual({ status: 'signedIn', account: RECORDED_ACCOUNT })
    expect(app.state.library?.sync).toEqual({ status: 'syncing' })
    expect(syncRequests(device).map(request => request.path)).toEqual(['/api/hearts?uid=10000001', '/api/hearts?uid=10000001'])
    expect(world.netease.held).toBe(1)
  })
})

describe('歌单', () => {
  /** 再打开一次 App：网易云回这一批录制里的歌单列表，和更新时间变了的歌单 */
  const reopenWith = async (device: Device, batch: { list: string, playlists: readonly RecordedPlaylist[] }) => {
    await world.netease.reply('login/user_account.vip.json')
    await replyLibrary({ playlists: batch.list, through: 'artists' })
    await replyPlaylists(batch.playlists)
    const { app } = await device.open()
    await device.idle()
    return app
  }

  it('再次打开 App：只重拉更新时间变了的歌单，曲目跟着网易云变；歌曲信息只取新加的', async () => {
    const device = world.device()
    expect((await signInSynced(device)).app.state.library?.sync).toEqual({ status: 'synced' })
    const sentPages = songPages(device).length
    const sentTrackIds = trackIdRequests(device).length

    // 作者在官方 App 里往 poems 加了一首、移除了一首；录制时网易云另外三张歌单的更新时间也变了（歌没变）
    const app = await reopenWith(device, AFTER)

    expect(trackIdRequests(device).slice(sentTrackIds)).toEqual([
      POEMS_ID,
      900000012,
      900000018,
      3136952023,
    ])
    expect(songPages(device).slice(sentPages)).toEqual([
      [910000111],
    ])
    expect(app.state.library?.songsOf(POEMS_ID)?.songs.map(song => song.id)).toEqual([910000111, 910000102])
    expect(app.state.library?.sync).toEqual({ status: 'synced' })
  })

  it('在官方 App 里删掉的歌单，本地也删掉：歌单列表里没有了，本机副本里它的曲目也删了', async () => {
    const device = world.device()
    expect((await signInSynced(device)).app.state.library?.sync).toEqual({ status: 'synced' })
    await reopenWith(device, AFTER)
    expect((await device.stored()).tracks.map(([id]) => id)).toContain(POEMS_ID)
    const sentTrackIds = trackIdRequests(device).length

    const app = await reopenWith(device, DELETED)

    expect(app.state.library?.playlists?.map(playlist => playlist.id)).not.toContain(POEMS_ID)
    expect(app.state.library?.songsOf(POEMS_ID)).toBeNull()
    expect((await device.stored()).tracks.map(([id]) => id)).not.toContain(POEMS_ID)
    expect(trackIdRequests(device).slice(sentTrackIds)).toEqual([3136952023])
  })

  it('往歌单加歌时网易云说它已经不在了（在别处删掉了）：改回原样、说明原因，马上同步一次，曲库里就没有它了', async () => {
    const device = world.device()
    expect((await signInSynced(device)).app.state.library?.sync).toEqual({ status: 'synced' })
    // 作者在官方 App 里改过 poems（这一批里它还在）
    const app = await reopenWith(device, AFTER)
    const song = app.state.library!.liked!.songs[0]
    const sent = syncRequests(device).length

    // 作者已经在官方 App 里删掉了 poems
    await replyLibrary({ through: 'artists', playlists: DELETED.list })
    await replyPlaylists(DELETED.playlists)
    const reply = held()
    await world.netease.reply('playlist-edit/playlist_tracks.add-deleted-playlist.json', { until: reply.until })
    const adding = app.addToPlaylist(POEMS_ID, song)
    expect(app.state.library?.songsOf(POEMS_ID)?.songs[0]).toEqual(song)
    reply.release()
    await adding
    await device.idle()

    expect(app.state.library?.notice).toMatchObject({
      kind: 'playlistMissing',
      change: {
        kind: 'add',
        playlist: { id: POEMS_ID },
        song,
      },
    })
    expect(syncRequests(device).slice(sent).map(request => `${request.method} ${request.path}`)).toEqual([
      `POST /api/playlists/${POEMS_ID}/tracks`,
      'GET /api/hearts?uid=10000001',
      'GET /api/playlists?uid=10000001',
      'GET /api/albums',
      'GET /api/artists',
      ...DELETED.playlists.map(playlist => `GET /api/playlists/${playlist.id}/track-ids`),
    ])
    expect(app.state.library?.playlists?.map(playlist => playlist.id)).not.toContain(POEMS_ID)
    expect(app.state.library?.songsOf(POEMS_ID)).toBeNull()
    expect((await device.stored()).tracks.map(([id]) => id)).not.toContain(POEMS_ID)
    expect(app.state.library?.sync).toEqual({ status: 'synced' })
  })

  /** 登录并同步：我喜欢的音乐同步完了，后台正在等 poems 的曲目编号（压着不回） */
  const syncUntilPoems = async (device: Device) => {
    const { app } = await device.open()
    await replyLibrary()
    for (const page of [1, 2, 3, 4, 5] as const)
      await world.netease.reply(likedPage(page))
    const poems = held()
    await world.netease.reply(BEFORE.playlists[0].detail, { until: poems.until })
    await signIn(world, app)
    await vi.waitFor(() => expect(world.netease.held).toBe(1))
    expect(app.state.library?.songsOf(RHYTHM_ID)).toMatchObject({ songs: [], complete: false })
    return { app, poems }
  }

  /** 后台同步接着往下：poems 的歌曲信息，然后别的歌单 */
  const replyAfterPoems = async (except: number[] = []): Promise<void> => {
    const [poems, ...rest] = BEFORE.playlists
    for (const page of poems.pages)
      await world.netease.reply(page.fixture)
    await replyPlaylists(rest.filter(playlist => !except.includes(playlist.id)))
  }

  it('打开一张还没同步的歌单：马上用前台请求拉它，不等后台同步手上的请求；后台同步轮到它时不再重拉', async () => {
    const device = world.device()
    const { app, poems } = await syncUntilPoems(device)

    const rhythm = recorded(RHYTHM_ID)
    const detail = held()
    await world.netease.reply(rhythm.detail, { until: detail.until })
    await world.netease.reply(rhythm.pages[0].fixture)
    const opening = app.openPlaylist(RHYTHM_ID)

    await vi.waitFor(() => expect(world.netease.held).toBe(2))
    expect(device.pending.map(request => request.path)).toEqual([`/api/playlists/${POEMS_ID}/track-ids`, `/api/playlists/${RHYTHM_ID}/track-ids`])
    expect(app.state.library?.opening.get(RHYTHM_ID)).toEqual({ status: 'loading' })

    detail.release()
    await opening
    expect(device.pending.map(request => request.path)).toEqual([`/api/playlists/${POEMS_ID}/track-ids`])
    expect(songPages(device).at(-1)).toEqual(rhythm.pages[0].ids)
    expect(app.state.library?.songsOf(RHYTHM_ID)).toMatchObject({ total: 35, complete: true })
    expect(app.state.library?.songsOf(RHYTHM_ID)?.songs.map(song => song.id)).toEqual(rhythm.trackIds)
    expect(app.state.library?.opening.has(RHYTHM_ID)).toBe(false)

    await replyAfterPoems([RHYTHM_ID])
    poems.release()
    await device.idle()

    expect(trackIdRequests(device).filter(id => id === RHYTHM_ID)).toHaveLength(1)
    expect(app.state.library?.sync).toEqual({ status: 'synced' })
  })

  it('打开歌单时断网：说明没拉成；联网后后台同步照常拉它', async () => {
    const device = world.device()
    const { app, poems } = await syncUntilPoems(device)

    device.setOnline(false)
    await app.openPlaylist(RHYTHM_ID)
    expect(app.state.library?.opening.get(RHYTHM_ID)).toEqual({
      status: 'failed',
      failure: { kind: 'offline' },
    })
    expect(app.state.library?.songsOf(RHYTHM_ID)).toMatchObject({ songs: [], complete: false })

    await replyAfterPoems()
    poems.release()
    device.setOnline(true)
    await device.idle()

    expect(app.state.library?.songsOf(RHYTHM_ID)).toMatchObject({ total: 35, complete: true })
    expect(app.state.library?.opening.has(RHYTHM_ID)).toBe(false)
    expect(app.state.library?.sync).toEqual({ status: 'synced' })
  })

  it('后台同步正在等着拉的那张歌单（网易云说操作频繁），听众打开它：不再等，马上用前台请求拉；后台轮到它时不再重拉', async () => {
    const device = world.device()
    const { app } = await device.open()
    await replyLibrary()
    for (const page of [1, 2, 3, 4, 5] as const)
      await world.netease.reply(likedPage(page))
    const [poems, ...rest] = BEFORE.playlists
    await world.netease.reply(poems.detail)
    await world.netease.reply(RATE_LIMITED)
    await signIn(world, app)
    await device.idle()
    expect(app.state.library?.sync.status).toBe('rateLimited')
    const sentPages = songPages(device).length

    await world.netease.reply(poems.pages[0].fixture)
    await app.openPlaylist(POEMS_ID)

    // 没等操作频繁的 30 秒：前台请求马上发了
    expect(songPages(device).slice(sentPages)).toEqual([poems.pages[0].ids])
    expect(app.state.library?.songsOf(POEMS_ID)).toMatchObject({ complete: true })
    expect(app.state.library?.opening.has(POEMS_ID)).toBe(false)

    await replyPlaylists(rest)
    await world.clock.advance(30_000)
    await device.idle()
    expect(songPages(device).filter(ids => ids.join() === poems.pages[0].ids.join())).toHaveLength(2)
    expect(app.state.library?.sync).toEqual({ status: 'synced' })
  })

  it('打开 App 时先按本机旧的歌单列表拉开着的歌单，后台拿到新列表时它的更新时间变了：等旧的拉完再按新的重拉，不把旧的当成同步完', async () => {
    const device = world.device()
    const [poems] = BEFORE.playlists
    const { app: first } = await device.open()
    await replyLibrary()
    for (const page of [1, 2, 3, 4, 5] as const)
      await world.netease.reply(likedPage(page))
    await replyPlaylists(BEFORE.playlists, { rejected: poems.pages[0].fixture, rejection: PAGE_4_REJECTED })
    await signIn(world, first)
    await device.idle()
    expect(first.state.library?.songsOf(POEMS_ID)).toMatchObject({ complete: false })

    const hearts = held()
    const oldPage = held()
    await world.netease.reply('login/user_account.vip.json')
    await replyLibrary({ through: 'hearts', until: hearts.until })
    await world.netease.reply(poems.pages[0].fixture, { until: oldPage.until })
    const { app } = await device.open()
    const opening = app.openPlaylist(POEMS_ID)
    await vi.waitFor(() => expect(world.netease.held).toBe(2))

    await world.netease.reply(AFTER.list)
    await replyLibrary({ from: 'albums', through: 'artists' })
    await replyPlaylists(AFTER.playlists)
    hearts.release()
    await world.settle()
    oldPage.release()
    await opening
    await device.idle()

    expect(app.state.library?.songsOf(POEMS_ID)?.songs.map(song => song.id)).toEqual([910000111, 910000102])
    expect(app.state.library?.sync).toEqual({ status: 'synced' })
  })

  it('歌单内搜索在本机副本里即时完成：歌名、歌手、专辑都搜，不分大小写和全角半角；歌单只同步了一部分时结果标“可能不全”，同步完就不标', async () => {
    const device = world.device()
    const { app } = await device.open()
    const page2 = held()
    await replyLibrary()
    await world.netease.reply(likedPage(1))
    await world.netease.reply(likedPage(2), { until: page2.until })
    await signIn(world, app)
    await vi.waitFor(() => expect(app.state.library?.liked?.songs).toHaveLength(1000))

    // 我喜欢的音乐只同步了前 1,000 首，其中 5 首是 DJ OKAWARI 的
    const partial = app.searchPlaylist(LIKED_ID, 'dj okawari')
    expect(partial?.incomplete).toBe(true)
    expect(partial?.songs).toHaveLength(5)
    expect(partial?.songs.every(song => song.artists.some(artist => artist.name === 'DJ OKAWARI'))).toBe(true)
    expect(app.searchPlaylist(LIKED_ID, 'ＤＪ　ＯＫＡＷＡＲＩ')?.songs).toEqual(partial?.songs)
    expect(app.searchPlaylist(LIKED_ID, 'brown eyes')?.songs.map(song => song.name)).toEqual(['Brown Eyes feat. Brittany Campbell'])
    expect(app.searchPlaylist(LIKED_ID, 'kaleidoscope')?.songs.map(song => song.name)).toContain('Brown Eyes feat. Brittany Campbell')

    for (const page of [3, 4, 5] as const)
      await world.netease.reply(likedPage(page))
    await replyPlaylists(BEFORE.playlists)
    page2.release()
    await device.idle()

    const full = app.searchPlaylist(LIKED_ID, 'dj okawari')
    expect(full?.incomplete).toBe(false)
    expect(full?.songs).toHaveLength(33)
  })
})

describe('随机操作检查（借鉴逻辑原型）', () => {
  /** 可重现的伪随机数（mulberry32）：失败时按打出来的种子重跑同一串操作 */
  const seeded = (seed: number): () => number => {
    let state = seed
    return () => {
      state = (state + 0x6D2B79F5) | 0
      let next = Math.imul(state ^ (state >>> 15), 1 | state)
      next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296
    }
  }

  it('随便怎么操作，每一步之后：后台同步请求同时最多一个在路上、同一页不会同时请求两次、显示“同步中”时一定有同步请求在路上、打开的歌单和专辑页显示加载中时一定有请求在路上、登录失效或退出后不挂着同步', async () => {
    // 全局的 Date 被世界的时钟冻结在同一时刻，不能拿来当种子
    const seed = Math.floor(Math.random() * 100_000)
    const random = seeded(seed)
    // 回答按“下一次调用”排、一半随机压着：同时发出的请求谁拿到哪份本来就是随机的一部分，每一步之后的检查对哪种都要成立
    world.netease.anyOrder()
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]
    /** 压着的网易云返回，随机地放出来 */
    let holds: (() => void)[] = []
    const queued = new Map<string, number>()
    /** 一张收藏的专辑：随时打开它 */
    const ALBUM = { id: 3149073, fixture: 'library/album-artist/008-album.json.gz' }
    /** 一半压着的：同步和打开专辑页 */
    const sometimesHeld = new Set([...LIBRARY_SYNC_MODULES, 'album'])

    /** 网易云对一个模块的下一次调用回 fixture。同步和打开专辑页的返回一半压着，等随机操作放出来； 退出、续期是听众正在等的，不压（压着的话退出、登录会一直等下去） */
    const reply = async (module: string, fixture: string): Promise<void> => {
      queued.set(module, (queued.get(module) ?? 0) + 1)
      if (!sometimesHeld.has(module) || random() < 0.5) {
        await world.netease.reply(fixture)
        return
      }
      const hold = held()
      holds.push(hold.release)
      await world.netease.reply(fixture, { until: hold.until })
    }

    /** 每个模块都至少还有两份没用掉的返回：同步、退出、续期随时都可能发生 */
    const topUp = async (): Promise<void> => {
      const left = (module: string) => (queued.get(module) ?? 0) - world.netease.calls.filter(call => call.module === module).length
      while (left('likelist') < 2) {
        if (random() < 0.15) {
          // 凭据失效：红心回 301，服务端续期也被拒
          await reply('likelist', 'library/likelist.301-invalid.json')
          await reply('login_refresh', 'login/login_refresh.301-invalid.json')
        }
        else {
          await reply('likelist', HEARTS)
        }
      }
      while (left('user_playlist') < 2)
        await reply('user_playlist', PLAYLISTS_WITH_POEMS)
      while (left('album_sublist') < 2)
        await reply('album_sublist', COLLECTED_ALBUMS)
      while (left('artist_sublist') < 2)
        await reply('artist_sublist', COLLECTED_ARTISTS)
      while (left('playlist_detail') < 2)
        await reply('playlist_detail', LIKED_TRACK_IDS)
      while (left('song_detail') < 2) {
        await reply('song_detail', pick([
          'library/song_detail.vip.json',
          'library/song_detail.vip.json',
          'library/song_detail.vip.json',
          RATE_LIMITED,
          PAGE_4_REJECTED,
        ]))
      }
      while (left('logout') < 2)
        await reply('logout', 'login/logout.json')
      while (left('album') < 2)
        await reply('album', ALBUM.fixture)
    }

    for (let round = 0; round < 20; round++) {
      const device = world.device()
      const { app } = await device.open()
      const steps: string[] = []
      /** 上一次登录发出去、还没回来的请求：回来后结果不要了，不算这一次登录的同步 */
      const stale = new Set<SentRequest>()

      for (let step = 0; step < 30; step++) {
        await topUp()
        const { session, library } = app.state
        const actions = session.status === 'signedIn'
          ? [
              'advance',
              'release',
              'release',
              'network',
              'logout',
              'album',
              ...(library?.playlists
                ? ['open']
                : []),
              ...(library?.sync.status === 'failed'
                ? ['retry']
                : []),
            ]
          : [
              'advance',
              'release',
              'network',
              'signIn',
              'signIn',
            ]
        const action = pick(actions)
        steps.push(action)
        switch (action) {
          case 'advance':
            await world.clock.advance(Math.floor(random() * 40_000))
            break
          case 'release':
            holds.splice(Math.floor(random() * holds.length), 1)[0]?.()
            break
          case 'network':
            device.setOnline(random() < 0.6)
            break
          case 'logout':
            await app.logout()
            break
          case 'retry':
            app.retrySync()
            break
          case 'open': {
            // 不等它拉完：听众打开歌单后照样可以做别的。一半时候打开后台同步正轮到的那张（按歌单列表的顺序，第一张还没同步全的），
            // 前台和后台抢同一张歌单最容易出错
            const syncing = library!.playlists!.find(playlist => !library!.songsOf(playlist.id)?.complete)
            void app.openPlaylist((syncing && random() < 0.5
              ? syncing
              : pick(library!.playlists!)).id)
            break
          }
          case 'album':
            void app.openAlbum(ALBUM.id)
            break
          case 'signIn':
            device.setOnline(true)
            await signIn(world, app, { another: random() < 0.3 })
            break
        }
        await world.settle()

        const where = `种子 ${seed}，第 ${round} 轮，操作 ${steps.join(' → ')}`
        if (app.state.session.status !== 'signedIn') {
          expect(app.state.library, `登录失效或退出后不挂着同步（${where}）`).toBeNull()
          for (const request of device.pending)
            stale.add(request)
        }
        const inFlight = device.pending.filter(isSync)
        const pending = inFlight.filter(request => !stale.has(request))
        const pages = pending.filter(request => request.path === '/api/songs').map(request => JSON.stringify(request.body))
        const trackIdPaths = pending.filter(request => request.path.endsWith('/track-ids')).map(request => request.path)
        const sync = app.state.library?.sync.status
        /** 听众打开、正在用前台请求拉的歌单：每张最多再有一个请求在路上 */
        const opening = [
          ...app.state.library?.opening.values() ?? [],
        ].filter(open => open.status === 'loading').length
        expect(pending.length, `后台同步请求同时最多一个在路上（${where}）`).toBeLessThanOrEqual(1 + opening)
        expect(new Set(trackIdPaths).size, `同一张歌单的曲目编号不会同时拉两次（${where}）`).toBe(trackIdPaths.length)
        if (opening === 0)
          expect(new Set(pages).size, `同一页不会同时请求两次（${where}）`).toBe(pages.length)
        // 重新登录后的同步要等上一次登录在路上的请求回来才开始（同一时间只有一轮同步）：那时在路上的是它
        if (sync === 'syncing')
          expect(inFlight.length, `显示“同步中”时一定有同步请求在路上（${where}）`).toBeGreaterThanOrEqual(1)
        if (sync === 'rateLimited' || sync === 'offline')
          expect(pending.length, `等着的时候没有后台同步请求在路上（${where}）`).toBeLessThanOrEqual(opening)
        // 打开歌单是前台请求，不等后台同步：显示加载中时，拉它的请求一定已经发出去了
        if (opening > 0)
          expect(pending.length, `打开的歌单显示加载中时一定有请求在路上（${where}）`).toBeGreaterThanOrEqual(1)
        // 打开专辑页是前台请求：显示加载中时，拉它的请求一定在路上
        if (app.state.library?.albumPage(ALBUM.id)?.status === 'loading')
          expect(device.pending.some(request => request.path === `/api/albums/${ALBUM.id}` && !stale.has(request)), `打开的专辑页显示加载中时一定有拉它的请求在路上（${where}）`).toBe(true)
      }

      for (const release of holds)
        release()
      holds = []
      device.setOnline(true)
      await device.idle()
    }
  }, 120_000)
})
