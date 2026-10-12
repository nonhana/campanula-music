import type { Device, SentRequest } from './harness/device'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import { ANOTHER_ACCOUNT, LIBRARY_SYNC_MODULES, RECORDED_ACCOUNT, signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()

// 作者的“我喜欢的音乐”（#21 录制，4,984 首）：每页 1,000 首，第 4 页里有 3 首上传的歌没有歌手名，
// hana-music-api 2.3.0 认不出这一页（nonhana/hana-music-api#48）
const HEARTS = 'library/likelist.json'
const PLAYLISTS = 'library/user_playlist.full.json.gz'
const LIKED_TRACK_IDS = 'library/playlist_detail.liked-full.json.gz'
const PAGE = (n: 1 | 2 | 3 | 5) => `library/song_detail.liked-page${n}.json.gz`
const PAGE_4_UNREADABLE = 'library/song_detail.liked-page4.502-null-artist.json.gz'
const RATE_LIMITED = 'library/song_detail.405-rate-limited.constructed.json'
const LIKED_ID = 900000001

/** 录下的我喜欢的音乐的全部曲目编号，按歌单里的顺序 */
async function recordedTrackIds(): Promise<number[]> {
  const fixture = JSON.parse(gunzipSync(await readFile(new URL(`./fixtures/netease/${LIKED_TRACK_IDS}`, import.meta.url))).toString('utf8')) as {
    response: { body: { playlist: { trackIds: { id: number }[] } } }
  }
  return fixture.response.body.playlist.trackIds.map(track => track.id)
}

/** 一个压着不回的网易云返回：release() 了才回 */
function held() {
  let release = (): void => {}
  const until = new Promise<void>((resolve) => {
    release = resolve
  })
  return { until, release }
}

/** 网易云依次回：红心、歌单列表、我喜欢的音乐的曲目编号 */
async function replyListAndTrackIds(): Promise<void> {
  await world.netease.reply(HEARTS)
  await world.netease.reply(PLAYLISTS)
  await world.netease.reply(LIKED_TRACK_IDS)
}

const SYNC_PATHS = ['/api/hearts', '/api/playlists', '/api/songs']
/** 同步请求（问账号、登录、退出不算） */
const isSync = (request: SentRequest) => SYNC_PATHS.some(path => request.path.startsWith(path))
const syncRequests = (device: Device) => device.requests.filter(isSync)
const songPages = (device: Device) => syncRequests(device).filter(request => request.path === '/api/songs').map(request => (request.body as { ids: number[] }).ids)

describe('首次同步', () => {
  it('登录后先拿红心和歌单列表，再拿我喜欢的音乐的全部曲目编号，然后按歌单顺序一页一页地取歌曲信息，每页最多 1,000 首', async () => {
    const trackIds = await recordedTrackIds()
    const device = world.device()
    const { app } = await device.open()
    const page2 = held()
    await replyListAndTrackIds()
    await world.netease.reply(PAGE(1))
    await world.netease.reply(PAGE(2), { until: page2.until })
    await world.netease.reply(PAGE(3))

    await signIn(world, app)

    // 第 2 页还没回：第 1 页的 1,000 首已经能看到，歌单列表也到了
    await vi.waitFor(() => expect(app.state.library?.liked?.songs).toHaveLength(1000))
    const library = app.state.library!
    expect(library.playlists).toHaveLength(53)
    expect(library.liked?.playlist).toMatchObject({ id: LIKED_ID, kind: 'liked', name: '测试听众喜欢的音乐' })
    expect(library.liked?.total).toBe(4984)
    expect(library.liked?.songs.map(song => song.id)).toEqual(trackIds.slice(0, 1000))
    expect(library.sync).toEqual({ status: 'syncing' })

    await world.netease.reply(PAGE_4_UNREADABLE)
    page2.release()
    await device.idle()

    expect(syncRequests(device).map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /api/hearts?uid=10000001',
      'GET /api/playlists?uid=10000001',
      `GET /api/playlists/${LIKED_ID}/track-ids`,
      'POST /api/songs',
      'POST /api/songs',
      'POST /api/songs',
      'POST /api/songs',
    ])
    expect(songPages(device)).toEqual([0, 1, 2, 3].map(page => trackIds.slice(page * 1000, (page + 1) * 1000)))
    expect(world.netease.calls.filter(call => call.module !== 'song_detail').slice(2).map(({ module, query }) => ({ module, query }))).toEqual([
      { module: 'likelist', query: { uid: 10000001 } },
      { module: 'user_playlist', query: { uid: 10000001, limit: 1000, offset: 0 } },
      { module: 'playlist_detail', query: { id: LIKED_ID } },
    ])
    expect(app.state.library?.liked?.songs.map(song => song.id)).toEqual(trackIds.slice(0, 3000))
    // 服务端只回界面用得到的字段：网易云的原始返回一页歌曲信息约 2.1 MB、曲目编号约 3.1 MB，Vercel 单次响应的上限是 4.5 MB
    expect(Math.max(...device.responseBodies.map(body => body.length))).toBeLessThan(1_000_000)
  })

  it('有一页 SDK 认不出（上传的歌没有歌手名）：已经同步的照常显示，同步停在“没能同步”；重试从这一页接着取，不重取前面的', async () => {
    const trackIds = await recordedTrackIds()
    const device = world.device()
    const { app } = await device.open()
    await replyListAndTrackIds()
    for (const page of [1, 2, 3] as const)
      await world.netease.reply(PAGE(page))
    await world.netease.reply(PAGE_4_UNREADABLE)
    await signIn(world, app)
    await device.idle()

    expect(app.state.library?.sync).toEqual({ status: 'failed', failure: { kind: 'upstreamChanged' } })
    expect(app.state.library?.liked?.songs).toHaveLength(3000)
    const before = songPages(device).length

    await world.netease.reply(HEARTS)
    await world.netease.reply(PLAYLISTS)
    await world.netease.reply(PAGE_4_UNREADABLE)
    app.retrySync()
    await device.idle()

    expect(songPages(device).slice(before)).toEqual([trackIds.slice(3000, 4000)])
    expect(world.netease.calls.filter(call => call.module === 'playlist_detail')).toHaveLength(1)
    expect(app.state.library?.sync).toEqual({ status: 'failed', failure: { kind: 'upstreamChanged' } })
  })
})

describe('本机副本', () => {
  /** 登录并同步到第 4 页停下：本机副本里有 3,000 首 */
  async function syncFirstThreePages(device: Device) {
    const { app } = await device.open()
    await replyListAndTrackIds()
    for (const page of [1, 2, 3] as const)
      await world.netease.reply(PAGE(page))
    await world.netease.reply(PAGE_4_UNREADABLE)
    await signIn(world, app)
    await device.idle()
    return app
  }

  it('再次打开 App：先显示本机副本，不等同步；曲目没变的我喜欢的音乐不重拉编号，只取还没有的歌', async () => {
    const trackIds = await recordedTrackIds()
    const device = world.device()
    await syncFirstThreePages(device)
    const sent = syncRequests(device).length

    const hearts = held()
    await world.netease.reply('login/user_account.vip.json')
    await world.netease.reply(HEARTS, { until: hearts.until })
    await world.netease.reply(PLAYLISTS)
    await world.netease.reply(PAGE_4_UNREADABLE)
    const { app } = await device.open()

    expect(app.state.session).toEqual({ status: 'signedIn', account: RECORDED_ACCOUNT })
    expect(app.state.library?.liked?.songs.map(song => song.id)).toEqual(trackIds.slice(0, 3000))
    expect(app.state.library?.playlists).toHaveLength(53)

    hearts.release()
    await device.idle()
    expect(syncRequests(device).slice(sent).map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /api/hearts?uid=10000001',
      'GET /api/playlists?uid=10000001',
      'POST /api/songs',
    ])
    expect(songPages(device).at(-1)).toEqual(trackIds.slice(3000, 4000))
  })

  it('主动退出：删掉本机副本；同一个账号再登录，从头同步', async () => {
    const device = world.device()
    const app = await syncFirstThreePages(device)

    await world.netease.reply('login/logout.json')
    await app.logout()
    expect(app.state.library).toBeNull()
    expect(await device.stored()).toMatchObject({ library: [], tracks: [], songs: [] })

    const hearts = held()
    await world.netease.reply(HEARTS, { until: hearts.until })
    await signIn(world, app)

    expect(app.state.library).toMatchObject({ playlists: null, liked: null, hearts: null })
  })

  it('退出时还有一页在路上：它回来后也不会写回本机副本', async () => {
    const device = world.device()
    const { app } = await device.open()
    const page2 = held()
    await replyListAndTrackIds()
    await world.netease.reply(PAGE(1))
    await world.netease.reply(PAGE(2), { until: page2.until })
    await signIn(world, app)
    await vi.waitFor(() => expect(app.state.library?.liked?.songs).toHaveLength(1000))

    await world.netease.reply('login/logout.json')
    await app.logout()
    page2.release()
    await device.idle()
    expect(await device.stored()).toMatchObject({ library: [], tracks: [], songs: [] })

    const hearts = held()
    await world.netease.reply(HEARTS, { until: hearts.until })
    await signIn(world, app)
    expect(app.state.library).toMatchObject({ playlists: null, liked: null, hearts: null })
  })

  it('登录失效后换另一个账号登录：不沿用上一个账号的副本，按新账号同步', async () => {
    const device = world.device()
    await syncFirstThreePages(device)
    await world.netease.reply('login/user_account.invalid.json')
    await world.netease.reply('login/login_refresh.301-invalid.json')
    const { app } = await device.open()
    expect(app.state.session).toEqual({ status: 'loginExpired' })
    expect(app.state.library).toBeNull()
    const sent = syncRequests(device).length

    const hearts = held()
    await world.netease.reply(HEARTS, { until: hearts.until })
    await signIn(world, app, { another: true })

    expect(app.state.session).toEqual({ status: 'signedIn', account: ANOTHER_ACCOUNT })
    expect(app.state.library).toMatchObject({ playlists: null, liked: null, hearts: null })
    expect(await device.stored()).toMatchObject({ library: [['owner', ANOTHER_ACCOUNT.id]], tracks: [], songs: [] })
    expect(syncRequests(device).slice(sent).map(request => request.path)).toEqual(['/api/hearts?uid=10000002'])
  })
})

describe('请求节奏', () => {
  it('网易云说操作频繁：后台同步停到 retryAfter 再重发被拒的那页；这期间退出这样的前台请求照常马上发', async () => {
    const trackIds = await recordedTrackIds()
    const device = world.device()
    const { app } = await device.open()
    await replyListAndTrackIds()
    await world.netease.reply(PAGE(1))
    await world.netease.reply(RATE_LIMITED)
    await world.netease.reply(PAGE(2))
    await world.netease.reply(PAGE(3))
    await world.netease.reply(PAGE_4_UNREADABLE)
    await signIn(world, app)
    await device.idle()

    const limitedAt = Date.now()
    expect(app.state.library?.sync).toEqual({ status: 'rateLimited', until: limitedAt + 30_000 })
    expect(songPages(device)).toEqual([trackIds.slice(0, 1000), trackIds.slice(1000, 2000)])

    await world.clock.advance(29_999)
    expect(songPages(device)).toHaveLength(2)

    await world.clock.advance(1)
    expect(songPages(device).slice(2)).toEqual([0, 1, 2].map(page => trackIds.slice((page + 1) * 1000, (page + 2) * 1000)))
    expect(app.state.library?.liked?.songs).toHaveLength(3000)
  })

  it('同步被操作频繁停着时，前台请求（退出）不排在后面：马上发出', async () => {
    const device = world.device()
    const { app } = await device.open()
    await replyListAndTrackIds()
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
    await replyListAndTrackIds()
    await world.netease.reply(PAGE(1), { until: page1.until })
    await signIn(world, app)
    await vi.waitFor(() => expect(world.netease.held).toBe(1))

    device.setOnline(false)
    page1.release()
    await device.idle()

    expect(app.state.library?.liked?.songs).toHaveLength(1000)
    expect(app.state.library?.sync).toEqual({ status: 'offline' })

    await world.netease.reply(PAGE(2))
    await world.netease.reply(PAGE(3))
    await world.netease.reply(PAGE_4_UNREADABLE)
    device.setOnline(true)
    await device.idle()

    expect(songPages(device)).toEqual([0, 1, 2, 3].map(page => trackIds.slice(page * 1000, (page + 1) * 1000)))
  })

  it('同步途中网易云说需要登录、续期也被拒：同步停下，App 显示需要重新登录；同一个账号重新登录后从停下的地方接着同步', async () => {
    const trackIds = await recordedTrackIds()
    const device = world.device()
    const { app } = await device.open()
    await replyListAndTrackIds()
    for (const page of [1, 2, 3] as const)
      await world.netease.reply(PAGE(page))
    await world.netease.reply(PAGE_4_UNREADABLE)
    await signIn(world, app)
    await device.idle()

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
    await world.netease.reply(HEARTS, { until: hearts.until })
    await world.netease.reply(PLAYLISTS)
    await world.netease.reply(PAGE_4_UNREADABLE)
    await signIn(world, reopened)
    expect(reopened.state.library?.liked?.songs).toHaveLength(3000)

    hearts.release()
    await device.idle()
    expect(syncRequests(device).slice(sent).map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /api/hearts?uid=10000001',
      'GET /api/playlists?uid=10000001',
      'POST /api/songs',
    ])
    expect(songPages(device).at(-1)).toEqual(trackIds.slice(3000, 4000))
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
    await world.netease.reply(HEARTS, { until: fresh.until })
    await signIn(world, app)

    stale.release()
    await world.settle()

    expect(app.state.session).toEqual({ status: 'signedIn', account: RECORDED_ACCOUNT })
    expect(app.state.library?.sync).toEqual({ status: 'syncing' })
    expect(syncRequests(device).map(request => request.path)).toEqual(['/api/hearts?uid=10000001', '/api/hearts?uid=10000001'])
    expect(world.netease.held).toBe(1)
  })
})

describe('随机操作检查（借鉴逻辑原型）', () => {
  /** 可重现的伪随机数（mulberry32）：失败时按打出来的种子重跑同一串操作 */
  function seeded(seed: number): () => number {
    let state = seed
    return () => {
      state = (state + 0x6D2B79F5) | 0
      let next = Math.imul(state ^ (state >>> 15), 1 | state)
      next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296
    }
  }

  it('随便怎么操作，每一步之后：同步请求同时最多一个在路上、同一页不会同时请求两次、显示“同步中”时一定有同步请求在路上、登录失效或退出后不挂着同步', async () => {
    // 全局的 Date 被世界的时钟冻结在同一时刻，不能拿来当种子
    const seed = Math.floor(Math.random() * 100_000)
    const random = seeded(seed)
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]
    /** 压着的网易云返回，随机地放出来 */
    let holds: (() => void)[] = []
    const queued = new Map<string, number>()

    /**
     * 网易云对一个模块的下一次调用回 fixture。同步的返回一半压着，等随机操作放出来；
     * 退出、续期是听众正在等的，不压（压着的话退出、登录会一直等下去）
     */
    async function reply(module: string, fixture: string): Promise<void> {
      queued.set(module, (queued.get(module) ?? 0) + 1)
      if (!LIBRARY_SYNC_MODULES.has(module) || random() < 0.5) {
        await world.netease.reply(fixture)
        return
      }
      const hold = held()
      holds.push(hold.release)
      await world.netease.reply(fixture, { until: hold.until })
    }

    /** 每个模块都至少还有两份没用掉的返回：同步、退出、续期随时都可能发生 */
    async function topUp(): Promise<void> {
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
        await reply('user_playlist', PLAYLISTS)
      while (left('playlist_detail') < 2)
        await reply('playlist_detail', LIKED_TRACK_IDS)
      while (left('song_detail') < 2)
        await reply('song_detail', pick(['library/song_detail.vip.json', 'library/song_detail.vip.json', 'library/song_detail.vip.json', RATE_LIMITED, PAGE_4_UNREADABLE]))
      while (left('logout') < 2)
        await reply('logout', 'login/logout.json')
    }

    for (let round = 0; round < 20; round++) {
      const device = world.device()
      const { app } = await device.open()
      const steps: string[] = []

      for (let step = 0; step < 30; step++) {
        await topUp()
        const { session, library } = app.state
        const actions = session.status === 'signedIn'
          ? ['advance', 'release', 'release', 'network', 'logout', ...(library?.sync.status === 'failed' ? ['retry'] : [])]
          : ['advance', 'release', 'network', 'signIn', 'signIn']
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
          case 'signIn':
            device.setOnline(true)
            await signIn(world, app, { another: random() < 0.3 })
            break
        }
        await world.settle()

        const where = `种子 ${seed}，第 ${round} 轮，操作 ${steps.join(' → ')}`
        const pending = device.pending.filter(isSync)
        const pages = pending.filter(request => request.path === '/api/songs').map(request => JSON.stringify(request.body))
        const sync = app.state.library?.sync.status
        expect(pending.length, `同步请求同时最多一个在路上（${where}）`).toBeLessThanOrEqual(1)
        expect(new Set(pages).size, `同一页不会同时请求两次（${where}）`).toBe(pages.length)
        if (sync === 'syncing')
          expect(pending.length, `显示“同步中”时一定有同步请求在路上（${where}）`).toBe(1)
        if (sync === 'rateLimited' || sync === 'offline')
          expect(pending, `等着的时候没有同步请求在路上（${where}）`).toEqual([])
        if (app.state.session.status !== 'signedIn')
          expect(app.state.library, `登录失效或退出后不挂着同步（${where}）`).toBeNull()
      }

      for (const release of holds)
        release()
      holds = []
      device.setOnline(true)
      await device.idle()
    }
  }, 120_000)
})
