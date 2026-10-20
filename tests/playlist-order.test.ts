import type { Playlist } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'
import type { Device, Tab } from './harness/device'
import { describe, expect, it } from 'vitest'
import { held } from './harness/hold'
import { signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()

// 曲库里自建歌单之间的排序（#37，Spec #11“客户端：晚一点才提交的修改”“多选、拖拽与换封面”）：
// 我喜欢的音乐固定在最前，收藏的歌单不参与；拖完先改本地，停手 2 秒才一次提交；
// 连拖两次只提交一次；失败退回原来的顺序、提示里可以重试；页面隐藏时立即提交。
// 网易云返回只用验证关卡②录下的数据（tests/fixtures/netease/playlist-edit/）
const HEARTS = 'library/likelist.json'
/** 歌单列表：#22 在官方 App 里删掉临时歌单 poems 之后的；我喜欢的音乐在最前，17 张自建歌单，后面是收藏的 */
const PLAYLISTS = 'library/sync/deleted/001-user_playlist.json.gz'
const COLLECTED_ALBUMS = 'library/album-artist/001-album_sublist.json.gz'
const COLLECTED_ARTISTS = 'library/album-artist/002-artist_sublist.json.gz'
const LIKED_TRACK_IDS = 'library/playlist_detail.liked-full.json.gz'
/** 网易云接受了新的顺序（验证关卡②录的） */
const ORDER_OK = 'playlist-edit/playlist_order_update.json'
/** 构造：网易云限流（照 playlist_delete.405-rate-limited.constructed.json 的返回体） */
const ORDER_RATE_LIMITED = 'playlist-edit/playlist_order_update.405-rate-limited.constructed.json'

const LIKED = 900_000_001
const OWN = [900_000_002, 900_000_003, 900_000_004, 900_000_005, 900_000_006, 900_000_007, 900_000_008, 900_000_009, 900_000_010, 900_000_011, 900_000_012, 900_000_013, 900_000_014, 900_000_015, 900_000_016, 900_000_017, 900_000_018]
const A_COLLECTED = 3_200_013_727

/** 登录，后台同步停在我喜欢的音乐的曲目编号：本机副本里有歌单列表，还没有一首歌 */
async function signInHeld(device: Device): Promise<Tab> {
  const tab = await device.open()
  await world.netease.reply(HEARTS)
  await world.netease.reply(PLAYLISTS)
  await world.netease.reply(COLLECTED_ALBUMS)
  await world.netease.reply(COLLECTED_ARTISTS)
  const liked = held()
  await world.netease.reply(LIKED_TRACK_IDS, { until: liked.until })
  await signIn(world, tab.app)
  await world.settle()
  return tab
}

function shownIds(app: App): readonly number[] {
  return app.state.library?.playlists?.map(playlist => playlist.id) ?? []
}

async function storedIds(device: Device): Promise<readonly number[] | undefined> {
  const stored = await device.stored()
  const playlists = stored.library?.find(([key]) => key === 'playlists')?.[1] as Playlist[] | undefined
  return playlists?.map(playlist => playlist.id)
}

/** 收藏的歌单的先后：排序动不到它们 */
function collectedOf(app: App): readonly number[] {
  return shownIds(app).slice(1 + OWN.length)
}

const orderRequests = (device: Device) => device.requests.filter(request => request.method === 'POST' && request.path === '/api/library/order')
const orderCalls = () => world.netease.calls.filter(call => call.module === 'playlist_order_update')

describe('曲库里的自建歌单排序：我喜欢的音乐固定最前，收藏的歌单不参与', () => {
  it('提交的顺序里我喜欢的音乐必须在最前，收藏的歌单不能出现', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    const before = shownIds(app)
    expect(before.slice(0, 1 + OWN.length)).toEqual([LIKED, ...OWN])
    expect(before.length).toBeGreaterThan(1 + OWN.length)

    // 我喜欢的音乐被挪到自建歌单后面：不接受
    expect(app.orderPlaylists([OWN[0]!, LIKED, ...OWN.slice(1)])).toBe(false)
    // 把收藏的歌单也带进来：不接受
    expect(app.orderPlaylists([LIKED, ...OWN.slice(1), OWN[0]!, A_COLLECTED])).toBe(false)
    // 少了、多了自建歌单：不接受
    expect(app.orderPlaylists([LIKED, ...OWN.slice(1)])).toBe(false)
    expect(app.orderPlaylists([LIKED, ...OWN, OWN[0]!])).toBe(false)
    expect(shownIds(app)).toEqual(before)
    expect(orderRequests(device)).toHaveLength(0)
  })

  it('合法的顺序立即显示，收藏的歌单保持原来的先后', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    const collected = collectedOf(app)
    const next = [LIKED, OWN[16]!, OWN[15]!, ...OWN.slice(0, 15)]

    expect(app.orderPlaylists(next)).toBe(true)
    expect(shownIds(app)).toEqual([...next, ...collected])
    expect(await storedIds(device)).toEqual([LIKED, ...OWN, ...collected])
  })
})

describe('拖完先改本地，停手 2 秒合并提交', () => {
  it('2 秒内连拖两次只提交一次，提交的是最后的新顺序；成功后写进本机副本', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    const before = [LIKED, ...OWN, ...collectedOf(app)]

    // 第一次：把最后一张自建歌单挪到自建歌单的最前面
    const first = [LIKED, OWN[16]!, ...OWN.slice(0, 16)]
    expect(app.orderPlaylists(first)).toBe(true)
    expect(shownIds(app)).toEqual([...first, ...collectedOf(app)])
    expect(await storedIds(device)).toEqual(before)

    await world.clock.advance(1000)
    expect(orderRequests(device)).toHaveLength(0)

    // 第二次：再把倒数第二张挪到最前，计时从头算
    const latest = [LIKED, OWN[15]!, OWN[16]!, ...OWN.slice(0, 15)]
    expect(app.orderPlaylists(latest)).toBe(true)
    expect(shownIds(app)).toEqual([...latest, ...collectedOf(app)])
    await world.clock.advance(1999)
    expect(orderRequests(device)).toHaveLength(0)

    await world.netease.reply(ORDER_OK)
    await world.clock.advance(1)
    await world.settle()

    expect(orderRequests(device)).toEqual([
      { method: 'POST', path: '/api/library/order', body: { playlistIds: latest } },
    ])
    expect(orderCalls()).toHaveLength(1)
    expect(orderCalls()[0]).toMatchObject({ query: { ids: JSON.stringify(latest) } })
    expect(await storedIds(device)).toEqual([...latest, ...collectedOf(app)])
    expect(shownIds(app)).toEqual([...latest, ...collectedOf(app)])
    expect(app.state.library?.notice).toBeNull()
  })

  it('拖回原来的顺序：撤掉这份修改，2 秒后什么都不发', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    const before = [LIKED, ...OWN, ...collectedOf(app)]
    const moved = [LIKED, OWN[16]!, ...OWN.slice(0, 16)]

    expect(app.orderPlaylists(moved)).toBe(true)
    expect(app.orderPlaylists(before.slice(0, 1 + OWN.length))).toBe(true)
    expect(shownIds(app)).toEqual(before)

    await world.clock.advance(2000)
    await world.settle()
    expect(orderRequests(device)).toHaveLength(0)
    expect(shownIds(app)).toEqual(before)
  })

  it('页面一被隐藏就立即提交，不等 2 秒；请求带 keepalive', async () => {
    const device = world.device()
    const tab = await signInHeld(device)
    const { app } = tab
    const next = [LIKED, OWN[10]!, ...OWN.slice(0, 10), ...OWN.slice(11)]

    expect(app.orderPlaylists(next)).toBe(true)
    await world.settle()
    expect(orderRequests(device)).toHaveLength(0)

    await world.netease.reply(ORDER_OK)
    tab.hide()
    await world.settle()

    expect(orderRequests(device)).toEqual([
      { method: 'POST', path: '/api/library/order', body: { playlistIds: next }, keepalive: true },
    ])
    expect(await storedIds(device)).toEqual([...next, ...collectedOf(app)])
  })

  it('提交中又拖了：等这一份回来，再等 2 秒没再拖才发最新的一次', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    const first = [LIKED, OWN[16]!, ...OWN.slice(0, 16)]
    const second = [LIKED, OWN[15]!, OWN[16]!, ...OWN.slice(0, 15)]

    const pending = held()
    await world.netease.reply(ORDER_OK, { until: pending.until })
    await world.netease.reply(ORDER_OK)

    expect(app.orderPlaylists(first)).toBe(true)
    await world.clock.advance(2000)
    expect(orderRequests(device)).toHaveLength(1)

    // 第一份还压着：再拖一次，只改本地，不发第二份
    expect(app.orderPlaylists(second)).toBe(true)
    expect(shownIds(app)).toEqual([...second, ...collectedOf(app)])

    pending.release()
    await world.settle()
    expect(orderRequests(device)).toHaveLength(1)
    await world.clock.advance(1999)
    expect(orderRequests(device)).toHaveLength(1)

    await world.clock.advance(1)
    await world.settle()
    expect(orderRequests(device)).toHaveLength(2)
    expect(orderRequests(device).at(-1)?.body).toEqual({ playlistIds: second })
    expect(await storedIds(device)).toEqual([...second, ...collectedOf(app)])
  })
})

describe('提交失败和回滚', () => {
  it('提交失败：退回原来的顺序，提示里可以重试；重试恢复刚才的顺序并提交', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    const before = [LIKED, ...OWN, ...collectedOf(app)]
    const next = [LIKED, OWN[16]!, ...OWN.slice(0, 16)]

    expect(app.orderPlaylists(next)).toBe(true)
    expect(shownIds(app)).toEqual([...next, ...collectedOf(app)])

    await world.netease.reply(ORDER_RATE_LIMITED)
    await world.clock.advance(2000)
    await world.settle()

    expect(shownIds(app)).toEqual(before)
    expect(await storedIds(device)).toEqual(before)
    expect(app.state.library?.notice).toMatchObject({ kind: 'playlistOrderFailed', restored: true, failure: { kind: 'rateLimited' } })

    await world.netease.reply(ORDER_OK)
    await app.retryPlaylistOrder()
    await world.settle()

    expect(orderRequests(device).at(-1)?.body).toEqual({ playlistIds: next })
    expect(shownIds(app)).toEqual([...next, ...collectedOf(app)])
    expect(await storedIds(device)).toEqual([...next, ...collectedOf(app)])
    expect(app.state.library?.notice).toBeNull()
  })

  it('断网时先不改本地（规则⑨）；连上网络后点“重试”把这次拖动排进去、提交', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    const before = [LIKED, ...OWN, ...collectedOf(app)]
    const next = [LIKED, OWN[16]!, ...OWN.slice(0, 16)]

    device.setOnline(false)
    expect(app.orderPlaylists(next)).toBe(false)
    expect(shownIds(app)).toEqual(before)
    expect(await storedIds(device)).toEqual(before)
    expect(app.state.library?.notice).toMatchObject({ kind: 'playlistOrderFailed', restored: false, failure: { kind: 'offline' } })

    device.setOnline(true)
    await world.netease.reply(ORDER_OK)
    await app.retryPlaylistOrder()
    await world.settle()

    expect(orderRequests(device).at(-1)?.body).toEqual({ playlistIds: next })
    expect(shownIds(app)).toEqual([...next, ...collectedOf(app)])
    expect(await storedIds(device)).toEqual([...next, ...collectedOf(app)])
    expect(app.state.library?.notice).toBeNull()
  })
})
