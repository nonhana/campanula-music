import { describe, expect, it } from 'vitest'

import type { App } from '#lib/app/app.js'

import type { Device } from './harness/device'
import { held, never } from './harness/hold'
import { listener, storedPlaylistIds } from './harness/listener'
import { signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInAtLikedTracks, replyLibrary } = listener(world)

// 曲库里自建歌单之间的排序（#37，Spec #11“客户端：晚一点才提交的修改”“多选、拖拽与换封面”）：
// 我喜欢的音乐固定在最前，收藏的歌单不参与；拖完先改本地，停手 2 秒才一次提交；
// 连拖两次只提交一次；失败退回原来的顺序、提示里可以重试；页面隐藏时立即提交。
// 网易云返回只用验证关卡②录下的数据（tests/fixtures/netease/playlist-edit/）
/** 网易云接受了新的顺序（验证关卡②录的） */
const ORDER_OK = 'playlist-edit/playlist_order_update.json'
/** 构造：网易云限流（照 playlist_delete.405-rate-limited.constructed.json 的返回体） */
const ORDER_RATE_LIMITED = 'playlist-edit/playlist_order_update.405-rate-limited.constructed.json'

const LIKED = 900_000_001
const OWN = [
  900_000_002,
  900_000_003,
  900_000_004,
  900_000_005,
  900_000_006,
  900_000_007,
  900_000_008,
  900_000_009,
  900_000_010,
  900_000_011,
  900_000_012,
  900_000_013,
  900_000_014,
  900_000_015,
  900_000_016,
  900_000_017,
  900_000_018,
]
const A_COLLECTED = 3_200_013_727

const shownIds = (app: App): readonly number[] => app.state.library?.playlists?.map(playlist => playlist.id) ?? []

/** 收藏的歌单的先后：排序动不到它们 */
const collectedOf = (app: App): readonly number[] => shownIds(app).slice(1 + OWN.length)

const orderRequests = (device: Device) => device.requests.filter(request => request.method === 'POST' && request.path === '/api/library/order')
const orderCalls = () => world.netease.calls.filter(call => call.module === 'playlist_order_update')
const pendingChanges = async (device: Device) => (await device.stored()).library?.find(([key]) => key === 'pendingChanges')?.[1]
/** 让一个前台请求回 301 needsLogin：触发 App 的登录失效 */
const NEEDS_LOGIN_SEARCH = 'search/cloudsearch.301-invalid.constructed.json'

describe('曲库里的自建歌单排序：只收自建歌单，我喜欢的音乐由 App 放在最前', () => {
  it('非法输入：重复、含收藏、漏一首、未知编号、多一首、传入我喜欢的音乐都抛错', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const before = shownIds(app)
    expect(before.slice(0, 1 + OWN.length)).toEqual([LIKED, ...OWN])
    expect(before.length).toBeGreaterThan(1 + OWN.length)

    // 重复：（17 张，命中“重复”分支）
    expect(() => app.orderPlaylists([
      ...OWN.slice(0, 16),
      OWN[0]!,
    ])).toThrow('自建歌单顺序里有重复的编号')
    // 含收藏：（17 张，命中“不是自建歌单”分支）
    expect(() => app.orderPlaylists([
      ...OWN.slice(0, 16),
      A_COLLECTED,
    ])).toThrow('自建歌单顺序里混进了不是自建歌单的编号：3200013727')
    // 漏一首：16 张
    expect(() => app.orderPlaylists([
      ...OWN.slice(1),
    ])).toThrow('自建歌单顺序不对：要 17 张，给了 16 张')
    // 未知编号：17 张
    expect(() => app.orderPlaylists([
      ...OWN.slice(0, 16),
      999_999_999,
    ])).toThrow('自建歌单顺序里混进了不是自建歌单的编号：999999999')
    // 多一首：18 张
    expect(() => app.orderPlaylists([...OWN, OWN[0]!])).toThrow('自建歌单顺序不对：要 17 张，给了 18 张')
    // 我喜欢的音乐不是自建歌单：17 张
    expect(() => app.orderPlaylists([
      LIKED,
      ...OWN.slice(1),
    ])).toThrow('自建歌单顺序里混进了不是自建歌单的编号：900000001')

    expect(shownIds(app)).toEqual(before)
    expect(orderRequests(device)).toHaveLength(0)
  })

  it('合法的顺序立即显示，提交时我喜欢的音乐在最前，收藏的歌单保持原来的先后', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const collected = collectedOf(app)
    const next = [
      OWN[16]!,
      OWN[15]!,
      ...OWN.slice(0, 15),
    ]

    expect(app.orderPlaylists(next)).toBe(true)
    expect(shownIds(app)).toEqual([
      LIKED,
      ...next,
      ...collected,
    ])
    expect(await storedPlaylistIds(device)).toEqual([
      LIKED,
      ...OWN,
      ...collected,
    ])

    await world.netease.reply(ORDER_OK)
    await world.clock.advance(2000)
    await world.settle()

    expect(orderRequests(device)).toEqual([
      {
        method: 'POST',
        path: '/api/library/order',
        body: {
          playlistIds: [LIKED, ...next],
        },
      },
    ])
    expect(await storedPlaylistIds(device)).toEqual([
      LIKED,
      ...next,
      ...collected,
    ])
  })
})

describe('拖完先改本地，停手 2 秒合并提交', () => {
  it('2 秒内连拖两次只提交一次，提交的是最后的新顺序；成功后写进本机副本', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const before = [
      LIKED,
      ...OWN,
      ...collectedOf(app),
    ]

    // 第一次：把最后一张自建歌单挪到自建歌单的最前面
    const first = [
      OWN[16]!,
      ...OWN.slice(0, 16),
    ]
    expect(app.orderPlaylists(first)).toBe(true)
    expect(shownIds(app)).toEqual([
      LIKED,
      ...first,
      ...collectedOf(app),
    ])
    expect(await storedPlaylistIds(device)).toEqual(before)

    await world.clock.advance(1000)
    expect(orderRequests(device)).toHaveLength(0)

    // 第二次：再把倒数第二张挪到最前，计时从头算
    const latest = [
      OWN[15]!,
      OWN[16]!,
      ...OWN.slice(0, 15),
    ]
    expect(app.orderPlaylists(latest)).toBe(true)
    expect(shownIds(app)).toEqual([
      LIKED,
      ...latest,
      ...collectedOf(app),
    ])
    await world.clock.advance(1999)
    expect(orderRequests(device)).toHaveLength(0)

    await world.netease.reply(ORDER_OK)
    await world.clock.advance(1)
    await world.settle()

    expect(orderRequests(device)).toEqual([
      {
        method: 'POST',
        path: '/api/library/order',
        body: {
          playlistIds: [LIKED, ...latest],
        },
      },
    ])
    expect(orderCalls()).toHaveLength(1)
    expect(orderCalls()[0]).toMatchObject({
      query: {
        ids: JSON.stringify([LIKED, ...latest]),
      },
    })
    expect(await storedPlaylistIds(device)).toEqual([
      LIKED,
      ...latest,
      ...collectedOf(app),
    ])
    expect(shownIds(app)).toEqual([
      LIKED,
      ...latest,
      ...collectedOf(app),
    ])
    expect(app.state.library?.notice).toBeNull()
  })

  it('拖回原来的顺序：撤掉这份修改，2 秒后什么都不发', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const before = [
      LIKED,
      ...OWN,
      ...collectedOf(app),
    ]
    const moved = [
      OWN[16]!,
      ...OWN.slice(0, 16),
    ]

    expect(app.orderPlaylists(moved)).toBe(true)
    expect(app.orderPlaylists(OWN)).toBe(true)
    expect(shownIds(app)).toEqual(before)

    await world.clock.advance(2000)
    await world.settle()
    expect(orderRequests(device)).toHaveLength(0)
    expect(shownIds(app)).toEqual(before)
  })

  it('页面一被隐藏就立即提交，不等 2 秒；请求带 keepalive', async () => {
    const device = world.device()
    const tab = await signInAtLikedTracks(device)
    const { app } = tab
    const next = [
      OWN[10]!,
      ...OWN.slice(0, 10),
      ...OWN.slice(11),
    ]

    expect(app.orderPlaylists(next)).toBe(true)
    await world.settle()
    expect(orderRequests(device)).toHaveLength(0)

    await world.netease.reply(ORDER_OK)
    tab.hide()
    await world.settle()

    expect(orderRequests(device)).toEqual([
      {
        method: 'POST',
        path: '/api/library/order',
        body: {
          playlistIds: [LIKED, ...next],
        },
        keepalive: true,
      },
    ])
    expect(await storedPlaylistIds(device)).toEqual([
      LIKED,
      ...next,
      ...collectedOf(app),
    ])
  })

  it('提交中又拖了：等这一份回来，再等 2 秒没再拖才发最新的一次', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const first = [
      OWN[16]!,
      ...OWN.slice(0, 16),
    ]
    const second = [
      OWN[15]!,
      OWN[16]!,
      ...OWN.slice(0, 15),
    ]

    const pending = held()
    await world.netease.reply(ORDER_OK, { until: pending.until })
    await world.netease.reply(ORDER_OK)

    expect(app.orderPlaylists(first)).toBe(true)
    await world.clock.advance(2000)
    expect(orderRequests(device)).toHaveLength(1)

    // 第一份还压着：再拖一次，只改本地，不发第二份
    expect(app.orderPlaylists(second)).toBe(true)
    expect(shownIds(app)).toEqual([
      LIKED,
      ...second,
      ...collectedOf(app),
    ])

    pending.release()
    await world.settle()
    expect(orderRequests(device)).toHaveLength(1)
    await world.clock.advance(1999)
    expect(orderRequests(device)).toHaveLength(1)

    await world.clock.advance(1)
    await world.settle()
    expect(orderRequests(device)).toHaveLength(2)
    expect(orderRequests(device).at(-1)?.body).toEqual({
      playlistIds: [LIKED, ...second],
    })
    expect(await storedPlaylistIds(device)).toEqual([
      LIKED,
      ...second,
      ...collectedOf(app),
    ])
  })

  it('退出登录作废待提交的计时；重新登录后照常排序，只发新的一份', async () => {
    const device = world.device()
    // 第一次同步的最后一页压着：退出后放它回来，旧的一轮结束，新登录的同步不被它堵住
    const firstSync = held()
    const { app } = await signInAtLikedTracks(device, { until: firstSync.until })
    const stale = [
      OWN[16]!,
      ...OWN.slice(0, 16),
    ]
    expect(app.orderPlaylists(stale)).toBe(true)

    await world.netease.reply('login/logout.json')
    await app.logout()
    firstSync.release()
    await world.clock.advance(2000)
    await world.settle()
    expect(orderRequests(device)).toHaveLength(0)

    await replyLibrary({
      until: never(),
    })
    await signIn(world, app)
    await world.settle()
    expect(app.state.library?.playlists?.length).toBeGreaterThan(0)

    const next = [
      OWN[10]!,
      ...OWN.slice(0, 10),
      ...OWN.slice(11),
    ]
    await world.netease.reply(ORDER_OK)
    expect(app.orderPlaylists(next)).toBe(true)
    await world.clock.advance(2000)
    await world.settle()

    expect(orderRequests(device)).toEqual([
      {
        method: 'POST',
        path: '/api/library/order',
        body: {
          playlistIds: [LIKED, ...next],
        },
      },
    ])
  })

  it('登录失效：自建歌单排序作废、不发请求；重登没有 recovered（它没有待提交标记）', async () => {
    const device = world.device()
    const firstSync = held()
    const { app } = await signInAtLikedTracks(device, { until: firstSync.until })
    const next = [
      OWN[10]!,
      ...OWN.slice(0, 10),
      ...OWN.slice(11),
    ]
    expect(app.orderPlaylists(next)).toBe(true)
    await world.settle()
    // 曲库列表的顺序没有对应的歌单：不写 pendingChanges
    expect(await pendingChanges(device)).toBeUndefined()

    await world.netease.reply(NEEDS_LOGIN_SEARCH)
    await world.netease.reply('login/login_refresh.301-invalid.json')
    expect(await app.searchSongs('真夜中')).toMatchObject({
      ok: false,
      failure: { kind: 'needsLogin' },
    })
    await world.settle()
    expect(app.state.session.status).toBe('loginExpired')

    firstSync.release()
    await world.clock.advance(2000)
    await world.settle()
    expect(orderRequests(device)).toHaveLength(0)
    expect(await pendingChanges(device)).toBeUndefined()

    await replyLibrary({
      until: never(),
    })
    await signIn(world, app)
    await world.settle()

    expect(app.state.library?.notice).toBeNull()
    expect(orderRequests(device)).toHaveLength(0)
    expect(await pendingChanges(device)).toBeUndefined()
  })
})

describe('提交失败和回滚', () => {
  it('提交失败：退回原来的顺序，提示里可以重试；重试恢复刚才的顺序并提交', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const before = [
      LIKED,
      ...OWN,
      ...collectedOf(app),
    ]
    const next = [
      OWN[16]!,
      ...OWN.slice(0, 16),
    ]

    expect(app.orderPlaylists(next)).toBe(true)
    expect(shownIds(app)).toEqual([
      LIKED,
      ...next,
      ...collectedOf(app),
    ])

    await world.netease.reply(ORDER_RATE_LIMITED)
    await world.clock.advance(2000)
    await world.settle()

    expect(shownIds(app)).toEqual(before)
    expect(await storedPlaylistIds(device)).toEqual(before)
    expect(app.state.library?.notice).toMatchObject({
      kind: 'playlistOrderFailed',
      failure: { kind: 'rateLimited' },
    })

    await world.netease.reply(ORDER_OK)
    await app.noticeAction('retry')
    await world.settle()

    expect(orderRequests(device).at(-1)?.body).toEqual({
      playlistIds: [LIKED, ...next],
    })
    expect(shownIds(app)).toEqual([
      LIKED,
      ...next,
      ...collectedOf(app),
    ])
    expect(await storedPlaylistIds(device)).toEqual([
      LIKED,
      ...next,
      ...collectedOf(app),
    ])
    expect(app.state.library?.notice).toBeNull()
  })

  it('断网时先不改本地（规则⑨）；连上网络后点“重试”把这次拖动排进去、提交', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const before = [
      LIKED,
      ...OWN,
      ...collectedOf(app),
    ]
    const next = [
      OWN[16]!,
      ...OWN.slice(0, 16),
    ]

    device.setOnline(false)
    expect(app.orderPlaylists(next)).toBe(false)
    expect(shownIds(app)).toEqual(before)
    expect(await storedPlaylistIds(device)).toEqual(before)
    expect(app.state.library?.notice).toMatchObject({
      kind: 'playlistOrderFailed',
      failure: { kind: 'offline' },
    })

    device.setOnline(true)
    await world.netease.reply(ORDER_OK)
    await app.noticeAction('retry')
    await world.settle()

    expect(orderRequests(device).at(-1)?.body).toEqual({
      playlistIds: [LIKED, ...next],
    })
    expect(shownIds(app)).toEqual([
      LIKED,
      ...next,
      ...collectedOf(app),
    ])
    expect(await storedPlaylistIds(device)).toEqual([
      LIKED,
      ...next,
      ...collectedOf(app),
    ])
    expect(app.state.library?.notice).toBeNull()
  })
})
