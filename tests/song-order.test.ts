import { describe, expect, it } from 'vitest'

import type { Song } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'

import type { Device, Tab } from './harness/device'
import { loadFixture } from './harness/fixtures'
import { held } from './harness/hold'
import { listener, storedTrackIds } from './harness/listener'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInAtLikedTracks } = listener(world)

// 多选里的拖动排序（#36，Spec #11“客户端：晚一点才提交的修改”“多选、拖拽与换封面”）：拖完先改本地，停手 2 秒才把整张歌单的新顺序一次提交；连拖两次只提交一次；失败退回原来的顺序、提示里可以重试；页面隐藏时立即提交；一次拖多首保持原来的先后。
// 录制见 tests/fixtures/netease/README.md 的验证关卡②
/** 新建隐私歌单「Campanula 测试 · 可删除」，和紧接着读的详情（#33 录的） */
const CREATED = { id: 900000023, create: 'playlist-edit/create/001-playlist_create.json.gz', detail: 'playlist-edit/create/002-playlist_detail.json.gz' }
const ADD = 'playlist-edit/playlist_tracks.add.json'
/** 整张歌单的新顺序，网易云接受（只挪了几首、挪得不远的录制） */
const ORDER_OK = 'playlist-edit/song_order_update.missing-one-small-change.json'
/** 网易云约 3.3 秒后回 HTTP 400 / -1，但新顺序可能已经生效：要重新读一次确认 */
const ORDER_UNCONFIRMED = 'playlist-edit/song_order_update.missing-one.json'
/** 排序时这张歌单已经被删掉 */
const ORDER_MISSING = 'playlist-edit/song_order_update.deleted-playlist.json'
/** 重新读回来的是「小歌单」的 6 首（#22 录制），不是提交的顺序 */
const RE_READ = 'library/playlist_detail.own-small.json'

/** 造几首歌：拖动排序的判定用编号，歌名只给人看 */
const songsFrom = (ids: readonly number[]): Song[] => ids.map((id, index) => ({
  id,
  name: `测试歌曲 ${index + 1}`,
  artists: [
    { id: 0, name: '测试歌手' },
  ],
  album: { id: 0, name: '测试专辑', coverUrl: 'https://p1.music.126.net/placeholder/cover.jpg' },
  duration: 180_000,
  downloadSize: null,
  availability: 'full',
  trackNumber: null,
  disc: null,
  aliases: [],
  translations: [],
  publishedAt: null,
}))

/** 建一张自建歌单，加入这几首歌（加入后按传入的先后排在最前） */
const createdWith = async (device: Device, songs: readonly Song[]): Promise<{ app: App, tab: Tab }> => {
  const tab = await signInAtLikedTracks(device)
  const { app } = tab
  await world.netease.reply(CREATED.create)
  await world.netease.reply(CREATED.detail, {
    when: { id: CREATED.id },
  })
  expect(await app.createPlaylist({ name: '排序测试', private: true })).toEqual({ ok: true, playlistId: CREATED.id })
  await world.netease.reply(ADD)
  expect(await app.addSongsToPlaylist(CREATED.id, songs)).toEqual({ ok: true, added: songs.length })
  await world.settle()
  // 加歌的“已加入”提示不该影响后面排序的断言
  await app.noticeAction('dismiss')
  return { app, tab }
}

const shownTrackIds = (app: App, playlistId: number): readonly number[] | undefined => app.state.library?.songsOf(playlistId)?.trackIds

const orderRequests = (device: Device) => device.requests.filter(request => request.method === 'POST' && /\/api\/playlists\/\d+\/order$/.test(request.path))
const orderCalls = () => world.netease.calls.filter(call => call.module === 'song_order_update')

describe('拖动排序：本地立即生效，停手 2 秒合并提交', () => {
  it('拖完先改本地；2 秒内连拖两次只提交一次，提交的是最后的新顺序；成功后写进本机副本', async () => {
    const device = world.device()
    const songs = songsFrom([
      2_100_000_001,
      2_100_000_002,
      2_100_000_003,
      2_100_000_004,
    ])
    const { app } = await createdWith(device, songs)
    const ids = songs.map(song => song.id)
    expect(await storedTrackIds(device, CREATED.id)).toEqual(ids)

    expect(app.moveSongs(CREATED.id, [ids[3]!], ids[0]!)).toBe(true)
    expect(shownTrackIds(app, CREATED.id)).toEqual([ids[3], ids[0], ids[1], ids[2]])
    expect(await storedTrackIds(device, CREATED.id)).toEqual(ids)

    await world.clock.advance(1000)
    expect(orderRequests(device)).toHaveLength(0)

    expect(app.moveSongs(CREATED.id, [ids[1]!], null)).toBe(true)
    expect(shownTrackIds(app, CREATED.id)).toEqual([ids[3], ids[0], ids[2], ids[1]])
    await world.clock.advance(1999)
    expect(orderRequests(device)).toHaveLength(0)

    await world.netease.reply(ORDER_OK)
    await world.clock.advance(1)
    await world.settle()

    const latest = [ids[3], ids[0], ids[2], ids[1]]
    expect(orderRequests(device)).toEqual([
      {
        method: 'POST',
        path: `/api/playlists/${CREATED.id}/order`,
        body: { songIds: latest },
      },
    ])
    expect(orderCalls()).toHaveLength(1)
    expect(orderCalls()[0]).toMatchObject({
      query: {
        pid: CREATED.id,
        ids: JSON.stringify(latest),
      },
    })
    expect(await storedTrackIds(device, CREATED.id)).toEqual(latest)
    expect(shownTrackIds(app, CREATED.id)).toEqual(latest)
    expect(app.state.library?.notice).toBeNull()
  })

  it('页面一被隐藏就立即提交，不等 2 秒；请求带 keepalive', async () => {
    const device = world.device()
    const songs = songsFrom([2_100_000_011, 2_100_000_012, 2_100_000_013])
    const { app, tab } = await createdWith(device, songs)
    const ids = songs.map(song => song.id)

    expect(app.moveSongs(CREATED.id, [ids[2]!], ids[0]!)).toBe(true)
    await world.settle()
    expect(orderRequests(device)).toHaveLength(0)

    await world.netease.reply(ORDER_OK)
    tab.hide()
    await world.settle()

    expect(orderRequests(device)).toEqual([
      {
        method: 'POST',
        path: `/api/playlists/${CREATED.id}/order`,
        body: {
          songIds: [ids[2], ids[0], ids[1]],
        },
        keepalive: true,
      },
    ])
    expect(await storedTrackIds(device, CREATED.id)).toEqual([ids[2], ids[0], ids[1]])
  })

  it('请求体超过 64 KiB 时不用 keepalive，改用普通请求', async () => {
    const device = world.device()
    const songs = songsFrom(Array.from({ length: 6000 }, (_, index) => 3_000_000_000 + index))
    const { app, tab } = await createdWith(device, songs)
    const first = songs[0]!.id
    const last = songs.at(-1)!.id

    expect(app.moveSongs(CREATED.id, [last], first)).toBe(true)
    await world.settle()
    expect(orderRequests(device)).toHaveLength(0)

    await world.netease.reply(ORDER_OK)
    tab.hide()
    await world.settle()

    const request = orderRequests(device).at(-1)
    expect(request?.keepalive).toBeUndefined()
    expect(JSON.stringify(request?.body).length).toBeGreaterThan(64 * 1024)
    expect((request?.body as { songIds: number[] }).songIds).toHaveLength(6000)
  })

  it('提交中又拖了：等这一份回来，再等 2 秒没再拖才发最新的一次', async () => {
    const device = world.device()
    const songs = songsFrom([
      2_100_000_051,
      2_100_000_052,
      2_100_000_053,
      2_100_000_054,
    ])
    const { app } = await createdWith(device, songs)
    const [a, b, c, d] = songs.map(song => song.id)

    const first = held()
    await world.netease.reply(ORDER_OK, { until: first.until })
    await world.netease.reply(ORDER_OK)

    expect(app.moveSongs(CREATED.id, [d!], a!)).toBe(true)
    await world.clock.advance(2000)
    expect(orderRequests(device)).toHaveLength(1)

    expect(app.moveSongs(CREATED.id, [b!], null)).toBe(true)
    expect(shownTrackIds(app, CREATED.id)).toEqual([d, a, c, b])

    first.release()
    await world.settle()
    expect(orderRequests(device)).toHaveLength(1)
    await world.clock.advance(1999)
    expect(orderRequests(device)).toHaveLength(1)

    await world.clock.advance(1)
    await world.settle()
    expect(orderRequests(device)).toHaveLength(2)
    expect(orderRequests(device).at(-1)?.body).toEqual({
      songIds: [d, a, c, b],
    })
    expect(await storedTrackIds(device, CREATED.id)).toEqual([d, a, c, b])
  })

  it('一次拖几首：按列表里的先后一起挪，保持原来的先后', async () => {
    const device = world.device()
    const songs = songsFrom([
      2_100_000_021,
      2_100_000_022,
      2_100_000_023,
      2_100_000_024,
      2_100_000_025,
    ])
    const { app } = await createdWith(device, songs)
    const [a, b, c, d, e] = songs.map(song => song.id)
    expect(await storedTrackIds(device, CREATED.id)).toEqual([a, b, c, d, e])

    // 勾选的是 d、b（勾选的先后和列表里的先后不一样）：一起挪到 a 前面，仍按列表里的 b、d 排
    expect(app.moveSongs(CREATED.id, [d!, b!], a!)).toBe(true)
    expect(shownTrackIds(app, CREATED.id)).toEqual([b, d, a, c, e])

    // 再勾 a、c 一起挪到最后：仍是 a 在 c 前面
    expect(app.moveSongs(CREATED.id, [c!, a!], null)).toBe(true)
    expect(shownTrackIds(app, CREATED.id)).toEqual([b, d, e, a, c])

    await world.netease.reply(ORDER_OK)
    await world.clock.advance(2000)
    await world.settle()
    expect(orderRequests(device).at(-1)?.body).toEqual({
      songIds: [b, d, e, a, c],
    })
  })

  it('网易云回 -1、重新读回来就是提交的顺序：算成功，不退回', async () => {
    const device = world.device()
    // 用「小歌单」录制里的 6 首：反向加入，本机顺序正好和录制顺序差一次相邻交换
    const { outcome } = await loadFixture(RE_READ)
    const recorded = (outcome.response.body as { playlist: { trackIds: { id: number }[] } }).playlist.trackIds.map(track => track.id)
    const [first, second] = recorded
    const local = [
      second!,
      first!,
      ...recorded.slice(2),
    ]
    const { app } = await createdWith(device, songsFrom(local))
    expect(shownTrackIds(app, CREATED.id)).toEqual(local)

    expect(app.moveSongs(CREATED.id, [first!], second!)).toBe(true)
    expect(shownTrackIds(app, CREATED.id)).toEqual(recorded)

    await world.netease.reply(ORDER_UNCONFIRMED)
    await world.netease.reply(RE_READ, {
      when: { id: CREATED.id },
    })
    await world.clock.advance(2000)
    await world.settle()

    expect(orderRequests(device).at(-1)?.body).toEqual({ songIds: recorded })
    expect(device.requests.at(-1)?.path).toBe(`/api/playlists/${CREATED.id}/track-ids`)
    expect(shownTrackIds(app, CREATED.id)).toEqual(recorded)
    expect(await storedTrackIds(device, CREATED.id)).toEqual(recorded)
    expect(app.state.library?.notice).toBeNull()
  })

  it('提交的顺序过期（多出来一首还没同步到网易云）时，-1 重读只比两边都有的歌，算成功', async () => {
    const device = world.device()
    const { outcome } = await loadFixture(RE_READ)
    const recorded = (outcome.response.body as { playlist: { trackIds: { id: number }[] } }).playlist.trackIds.map(track => track.id)
    const extra = 2_200_000_001
    // 本地多一首（比如红心还在提交中）：网易云会忽略多出来的歌；重读只认两边都有的歌的先后
    const { app } = await createdWith(device, songsFrom([extra, ...recorded]))
    expect(shownTrackIds(app, CREATED.id)).toEqual([extra, ...recorded])
    expect(app.moveSongs(CREATED.id, [extra], null)).toBe(true)
    expect(shownTrackIds(app, CREATED.id)).toEqual([...recorded, extra])

    await world.netease.reply(ORDER_UNCONFIRMED)
    await world.netease.reply(RE_READ, {
      when: { id: CREATED.id },
    })
    await world.clock.advance(2000)
    await world.settle()

    expect(orderRequests(device).at(-1)?.body).toEqual({
      songIds: [...recorded, extra],
    })
    expect(shownTrackIds(app, CREATED.id)).toEqual([...recorded, extra])
    expect(await storedTrackIds(device, CREATED.id)).toEqual([...recorded, extra])
    expect(app.state.library?.notice).toBeNull()
  })

  it('排序时网易云说这张歌单已经不在了：退回原来的顺序、说明原因，马上同步一次', async () => {
    const device = world.device()
    const songs = songsFrom([2_100_000_061, 2_100_000_062, 2_100_000_063])
    const { app } = await createdWith(device, songs)
    const [a, b, c] = songs.map(song => song.id)

    expect(app.moveSongs(CREATED.id, [c!], a!)).toBe(true)
    expect(shownTrackIds(app, CREATED.id)).toEqual([c, a, b])

    await world.netease.reply(ORDER_MISSING)
    await world.clock.advance(2000)
    await world.settle()

    expect(shownTrackIds(app, CREATED.id)).toEqual([a, b, c])
    expect(await storedTrackIds(device, CREATED.id)).toEqual([a, b, c])
    expect(app.state.library?.notice).toMatchObject({
      kind: 'playlistMissing',
      change: {
        kind: 'order',
        playlist: { id: CREATED.id },
      },
    })
  })

  it('断网时先不改本地（规则⑨）；连上网络后点“重试”把这次拖动排进去、提交', async () => {
    const device = world.device()
    const songs = songsFrom([2_100_000_041, 2_100_000_042, 2_100_000_043])
    const { app } = await createdWith(device, songs)
    const [a, b, c] = songs.map(song => song.id)

    device.setOnline(false)
    expect(app.moveSongs(CREATED.id, [c!], a!)).toBe(false)
    expect(shownTrackIds(app, CREATED.id)).toEqual([a, b, c])
    expect(await storedTrackIds(device, CREATED.id)).toEqual([a, b, c])
    expect(app.state.library?.notice).toMatchObject({
      kind: 'orderFailed',
      playlist: { id: CREATED.id },
      failure: { kind: 'offline' },
    })

    device.setOnline(true)
    await world.netease.reply(ORDER_OK)
    await app.noticeAction('retry')
    await world.settle()

    expect(orderRequests(device).at(-1)?.body).toEqual({
      songIds: [c, a, b],
    })
    expect(shownTrackIds(app, CREATED.id)).toEqual([c, a, b])
    expect(await storedTrackIds(device, CREATED.id)).toEqual([c, a, b])
    expect(app.state.library?.notice).toBeNull()
  })

  it('提交失败：退回原来的顺序，提示里可以重试；重试恢复刚才的顺序并提交', async () => {
    const device = world.device()
    const songs = songsFrom([2_100_000_031, 2_100_000_032, 2_100_000_033])
    const { app } = await createdWith(device, songs)
    const [a, b, c] = songs.map(song => song.id)
    const before = [a, b, c]

    expect(app.moveSongs(CREATED.id, [c!], a!)).toBe(true)
    expect(shownTrackIds(app, CREATED.id)).toEqual([c, a, b])

    await world.netease.reply(ORDER_UNCONFIRMED)
    await world.netease.reply(RE_READ, {
      when: { id: CREATED.id },
    })
    await world.clock.advance(2000)
    await world.settle()

    expect(shownTrackIds(app, CREATED.id)).toEqual(before)
    expect(await storedTrackIds(device, CREATED.id)).toEqual(before)
    // 网易云回 -1、重读也不是新顺序：说不出原因，提示不编一个（#59）
    expect(app.state.library?.notice).toMatchObject({
      kind: 'orderFailed',
      playlist: { id: CREATED.id },
      failure: null,
    })

    await world.netease.reply(ORDER_OK)
    await app.noticeAction('retry')
    await world.settle()

    expect(orderRequests(device).at(-1)?.body).toEqual({
      songIds: [c, a, b],
    })
    expect(shownTrackIds(app, CREATED.id)).toEqual([c, a, b])
    expect(await storedTrackIds(device, CREATED.id)).toEqual([c, a, b])
    expect(app.state.library?.notice).toBeNull()
  })
})
