import type { Song } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'
import type { Device } from './harness/device'
import { describe, expect, it } from 'vitest'
import { held, never } from './harness/hold'
import { JAZZ_DETAIL, listener, SOME_SONGS, storedTrackIds } from './harness/listener'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInAtLikedTracks, signInSynced, openJazz, replyLibrary } = listener(world)

// 多选与批量操作（#35，Spec #11“多选、拖拽与换封面”“客户端：晚一点才提交的修改”）：
// 批量加入歌单一次一个请求；批量移除先在本地拿掉，提示条留 5 秒撤销，页面隐藏立即用 keepalive 提交；
// 提交失败放回原位、可以重试；没确认的改动下次打开时从网易云重拉这张歌单并提示。
// 录制见 tests/fixtures/netease/README.md 的验证关卡②和 #33 一条
const LIKED_ID = 900000001
const JAZZ = { id: 900000002, name: 'jazz' }
const JAZZ_TRACKS = [2066710146, 1828149330]
const COLLECTED_ID = 3200013727
/** 新建隐私歌单「Campanula 测试 · 可删除」，和紧接着读的详情（#33 录的） */
const CREATED = { id: 900000023, create: 'playlist-edit/create/001-playlist_create.json.gz', detail: 'playlist-edit/create/002-playlist_detail.json.gz' }
/** 加 3 首、移除（验证关卡②录的）；移除时歌单已经被删掉（404）；加歌时歌单已经被删掉（404） */
const ADD = 'playlist-edit/playlist_tracks.add.json'
const ADD_9000 = 'playlist-edit/playlist_tracks.add-9000.json'
const REMOVE = 'playlist-edit/playlist_tracks.del.json'
const REMOVE_MISSING = 'playlist-edit/playlist_tracks.del-deleted-playlist.json'
const ADD_MISSING = 'playlist-edit/playlist_tracks.add-deleted-playlist.json'
/** 网易云拒绝移除：拿加歌时“歌单内歌曲重复”的 502 当一次失败返回 */
const REMOVE_REJECTED = 'playlist-edit/playlist_tracks.add-duplicate.json'
/** 批量加入时网易云拒绝（构造：普通 502，不是“歌曲重复”那种会被服务端当成加好的 502） */
const ADD_REJECTED = 'playlist-edit/playlist_tracks.add-rejected.constructed.json'
/** 「真夜中」的单曲第一页（#32 录制，30 首） */
const SEARCH_SONGS = 'search/results/001-cloudsearch.json.gz'

/** 显示着的首数：jazz 的两首歌没有录制歌曲信息，列表里只有编号，所以看首数、看本机副本里的顺序 */
function totalOf(app: App, playlistId: number): number | null {
  return app.state.library?.songsOf(playlistId)?.total ?? null
}

const removeRequests = (device: Device) => device.requests.filter(request => request.path.endsWith('/tracks/remove'))
const addRequests = (device: Device) => device.requests.filter(request => request.method === 'POST' && request.path.endsWith('/tracks'))

/** 造几首歌：批量加入时由界面从搜索或我喜欢的音乐里给（App 只收 Song） */
function songsFrom(count: number, firstId = 2_000_000_000): Song[] {
  return Array.from({ length: count }, (_, index) => ({
    id: firstId + index,
    name: `测试歌曲 ${index + 1}`,
    artists: [{ id: 0, name: '测试歌手' }],
    album: { id: 0, name: '测试专辑', coverUrl: 'https://p1.music.126.net/placeholder/cover.jpg' },
    duration: 180_000,
    availability: 'full',
  }))
}

describe('批量移除：5 秒撤销与晚一点提交', () => {
  it('先从本地拿掉；5 秒内撤销就放回原位、什么都不提交；过了 5 秒才提交，成功后写进本机副本', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })
    expect(totalOf(app, JAZZ.id)).toBe(2)

    app.removeFromPlaylist(JAZZ.id, [JAZZ_TRACKS[0]!])
    expect(totalOf(app, JAZZ.id)).toBe(1)
    expect(app.state.library?.notice).toMatchObject({ kind: 'removed', playlist: { id: JAZZ.id }, count: 1 })

    await world.clock.advance(4999)
    expect(removeRequests(device)).toHaveLength(0)

    app.undoRemove()
    expect(totalOf(app, JAZZ.id)).toBe(2)
    expect(app.state.library?.notice).toBeNull()
    await world.clock.advance(1000)
    expect(removeRequests(device)).toHaveLength(0)

    await world.netease.reply(REMOVE)
    app.removeFromPlaylist(JAZZ.id, [JAZZ_TRACKS[0]!])
    await world.clock.advance(5000)

    expect(removeRequests(device)).toEqual([
      { method: 'POST', path: `/api/playlists/${JAZZ.id}/tracks/remove`, body: { songIds: [JAZZ_TRACKS[0]!] } },
    ])
    expect(world.netease.calls.filter(call => call.module === 'playlist_tracks').at(-1)).toMatchObject({ query: { op: 'del', pid: JAZZ.id, tracks: String(JAZZ_TRACKS[0]) } })
    expect(await storedTrackIds(device, JAZZ.id)).toEqual([JAZZ_TRACKS[1]!])
    expect(totalOf(app, JAZZ.id)).toBe(1)
    expect(app.state.library?.notice).toBeNull()
  })

  it('5 秒内连着移除两批：合成一条提示，撤销把两批都放回、什么都不提交', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })

    app.removeFromPlaylist(JAZZ.id, [JAZZ_TRACKS[0]!])
    app.removeFromPlaylist(JAZZ.id, [JAZZ_TRACKS[1]!])
    expect(totalOf(app, JAZZ.id)).toBe(0)
    expect(app.state.library?.notice).toMatchObject({ kind: 'removed', playlist: { id: JAZZ.id }, count: 2 })

    app.undoRemove()
    expect(totalOf(app, JAZZ.id)).toBe(2)
    await world.clock.advance(6000)
    expect(removeRequests(device)).toHaveLength(0)
    expect(await storedTrackIds(device, JAZZ.id)).toEqual(JAZZ_TRACKS)
  })

  it('5 秒内把移除的一首加回来：撤掉这一首、不发加入请求，剩下的照常提交', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })

    app.removeFromPlaylist(JAZZ.id, JAZZ_TRACKS)
    expect(totalOf(app, JAZZ.id)).toBe(0)
    const sent = device.requests.length

    const [first] = songsFrom(1, JAZZ_TRACKS[0])
    expect(await app.addSongsToPlaylist(JAZZ.id, [first!])).toEqual({ ok: true, added: 0 })
    expect(device.requests.length).toBe(sent)
    expect(totalOf(app, JAZZ.id)).toBe(1)

    await world.netease.reply(REMOVE)
    await world.clock.advance(5000)

    expect(removeRequests(device).at(-1)?.body).toEqual({ songIds: [JAZZ_TRACKS[1]] })
    expect(await storedTrackIds(device, JAZZ.id)).toEqual([JAZZ_TRACKS[0]])
    expect(totalOf(app, JAZZ.id)).toBe(1)
  })

  it('离开歌单也立即提交，不等 5 秒', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })
    await world.netease.reply(REMOVE)

    app.removeFromPlaylist(JAZZ.id, [JAZZ_TRACKS[0]!])
    await world.settle()
    expect(removeRequests(device)).toHaveLength(0)

    await app.flushPlaylist(JAZZ.id)
    await world.settle()

    expect(removeRequests(device)).toEqual([
      { method: 'POST', path: `/api/playlists/${JAZZ.id}/tracks/remove`, body: { songIds: [JAZZ_TRACKS[0]!] }, keepalive: true },
    ])
    expect(await storedTrackIds(device, JAZZ.id)).toEqual([JAZZ_TRACKS[1]!])
  })

  it('页面一被隐藏就立即提交，不等 5 秒；请求带 keepalive', async () => {
    const device = world.device()
    const tab = await signInAtLikedTracks(device)
    const { app } = tab
    await openJazz(app, { songsHeld: false })
    await world.netease.reply(REMOVE)

    app.removeFromPlaylist(JAZZ.id, [JAZZ_TRACKS[0]!])
    await world.settle()
    expect(removeRequests(device)).toHaveLength(0)

    tab.hide()
    await world.settle()

    expect(removeRequests(device)).toEqual([
      { method: 'POST', path: `/api/playlists/${JAZZ.id}/tracks/remove`, body: { songIds: [JAZZ_TRACKS[0]!] }, keepalive: true },
    ])
    expect(await storedTrackIds(device, JAZZ.id)).toEqual([JAZZ_TRACKS[1]!])
  })

  it('请求体超过 64 KiB 时不用 keepalive，改用普通请求', async () => {
    const device = world.device()
    const tab = await signInAtLikedTracks(device)
    const { app } = tab
    await world.netease.reply(CREATED.create)
    await world.netease.reply(CREATED.detail, { when: { id: CREATED.id } })
    await app.createPlaylist({ name: '批量测试', private: true })
    const songs = songsFrom(6000)
    await world.netease.reply(ADD_9000)
    expect(await app.addSongsToPlaylist(CREATED.id, songs)).toEqual({ ok: true, added: 6000 })
    expect(await storedTrackIds(device, CREATED.id)).toHaveLength(6000)

    await world.netease.reply(REMOVE)
    app.removeFromPlaylist(CREATED.id, songs.map(song => song.id))
    await world.settle()
    tab.hide()
    await world.settle()

    const request = removeRequests(device).at(-1)
    expect(request?.keepalive).toBeUndefined()
    expect(JSON.stringify(request?.body).length).toBeGreaterThan(64 * 1024)
    expect((request?.body as { songIds: number[] }).songIds).toHaveLength(6000)
    expect(await storedTrackIds(device, CREATED.id)).toEqual([])
  })

  it('提交失败：这几首放回原位，提示里可以重试；重试成功后提交', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })
    await world.netease.reply(REMOVE_REJECTED)

    app.removeFromPlaylist(JAZZ.id, JAZZ_TRACKS)
    await world.clock.advance(5000)

    expect(totalOf(app, JAZZ.id)).toBe(2)
    expect(await storedTrackIds(device, JAZZ.id)).toEqual(JAZZ_TRACKS)
    expect(app.state.library?.notice).toMatchObject({ kind: 'removeFailed', playlist: { id: JAZZ.id }, count: 2, failure: { kind: 'rejected', code: 502 } })

    await world.netease.reply(REMOVE)
    await app.retryRemove()
    await world.settle()

    expect(totalOf(app, JAZZ.id)).toBe(0)
    expect(await storedTrackIds(device, JAZZ.id)).toEqual([])
    expect(app.state.library?.notice).toBeNull()
    expect(world.netease.calls.filter(call => call.module === 'playlist_tracks' && (call.query as { op?: string }).op === 'del')).toHaveLength(2)
  })

  it('网易云说这张歌单已经不在了：放回原位，说明原因，马上同步一次曲库', async () => {
    const device = world.device()
    const { app } = await signInSynced(device)
    const heartsBefore = device.requests.filter(request => request.path.startsWith('/api/hearts')).length

    await world.netease.reply(REMOVE_MISSING)
    await replyLibrary({ until: never() })

    app.removeFromPlaylist(JAZZ.id, [JAZZ_TRACKS[0]!])
    await world.clock.advance(5000)

    expect(totalOf(app, JAZZ.id)).toBe(2)
    expect(app.state.library?.notice).toMatchObject({ kind: 'playlistMissing', change: { kind: 'remove', playlist: { id: JAZZ.id } } })
    expect(device.requests.filter(request => request.path.startsWith('/api/hearts'))).toHaveLength(heartsBefore + 1)
  })

  it('断网时移除：不改本地、不发请求，直接说没改成（规则⑨）', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })
    const sent = device.requests.length

    device.setOnline(false)
    app.removeFromPlaylist(JAZZ.id, [JAZZ_TRACKS[0]!])

    expect(totalOf(app, JAZZ.id)).toBe(2)
    expect(app.state.library?.notice).toMatchObject({ kind: 'removeFailed', failure: { kind: 'offline' } })
    expect(device.requests.length).toBe(sent)
    expect(await storedTrackIds(device, JAZZ.id)).toEqual(JAZZ_TRACKS)
  })
})

describe('没确认的改动下次打开时恢复', () => {
  it('提交没回来就关掉：再打开这张歌单时从网易云重拉、丢掉本地改动，并提示“已恢复原样”', async () => {
    const device = world.device()
    const tab = await signInAtLikedTracks(device)
    const { app } = tab
    await openJazz(app, { songsHeld: false })

    const pending = held()
    await world.netease.reply(REMOVE, { until: pending.until })
    app.removeFromPlaylist(JAZZ.id, [JAZZ_TRACKS[0]!])
    await world.settle()
    tab.hide()
    await world.settle()
    tab.close()
    expect(removeRequests(device)).toHaveLength(1)

    await world.netease.reply('login/user_account.vip.json')
    await replyLibrary({ through: 'artists' })
    await world.netease.reply(JAZZ_DETAIL)
    await world.netease.reply(SOME_SONGS)
    await replyLibrary({ from: 'likedTracks', through: 'likedTracks', until: never() })
    const second = await device.open()
    await world.settle()

    expect(second.app.state.library?.notice).toEqual({ kind: 'recovered' })
    expect(totalOf(second.app, JAZZ.id)).toBe(2)
    expect(await storedTrackIds(device, JAZZ.id)).toEqual(JAZZ_TRACKS)
    // 已经恢复过：本机不再留着这张歌单的未确认标记
    expect((await device.stored()).library.find(([key]) => key === 'pendingChanges')).toBeUndefined()
  })
})

describe('批量加入歌单', () => {
  it('目标只有其他自建歌单：当前歌单、收藏的歌单、我喜欢的音乐都不在里面', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const targets = app.addTargets(JAZZ.id)
    expect(targets).not.toBeNull()
    expect(targets!.every(playlist => playlist.kind === 'own' && playlist.id !== JAZZ.id)).toBe(true)
    expect(targets!.map(playlist => playlist.id)).not.toContain(LIKED_ID)
    expect(targets!.map(playlist => playlist.id)).not.toContain(COLLECTED_ID)
  })

  it('我喜欢的音乐、收藏的歌单没有移除：不提交、曲库照旧', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const sent = device.requests.length

    expect(() => app.removeFromPlaylist(LIKED_ID, [1])).toThrow()
    expect(() => app.removeFromPlaylist(COLLECTED_ID, [1])).toThrow()

    expect(device.requests.length).toBe(sent)
    expect(app.state.library?.songsOf(LIKED_ID)).not.toBeNull()
  })

  it('勾几首一次提交、只发一个请求；已经在歌单里的不再提交；全都有时什么都不发', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })
    await world.netease.reply(SEARCH_SONGS)
    const found = await app.searchSongs('真夜中')
    if (!found.ok)
      throw new Error(`搜索没成功：${JSON.stringify(found)}`)
    const [first, second, third] = found.value
    expect(first && second && third).toBeTruthy()

    await world.netease.reply(ADD)
    expect(await app.addSongsToPlaylist(JAZZ.id, [first!, second!])).toEqual({ ok: true, added: 2 })
    expect(addRequests(device).at(-1)).toEqual({
      method: 'POST',
      path: `/api/playlists/${JAZZ.id}/tracks`,
      body: { songIds: [first!.id, second!.id] },
    })
    expect(await storedTrackIds(device, JAZZ.id)).toEqual([first!.id, second!.id, ...JAZZ_TRACKS])
    expect(app.state.library?.notice).toMatchObject({ kind: 'added', change: { kind: 'addMany', playlist: { id: JAZZ.id } } })

    const sent = device.requests.length
    expect(await app.addSongsToPlaylist(JAZZ.id, [first!, second!])).toEqual({ ok: true, added: 0 })
    expect(device.requests.length).toBe(sent)
    expect(app.state.library?.notice).toMatchObject({ kind: 'alreadyAdded', playlist: { id: JAZZ.id } })

    await world.netease.reply(ADD)
    expect(await app.addSongsToPlaylist(JAZZ.id, [first!, third!])).toEqual({ ok: true, added: 1 })
    expect(addRequests(device).at(-1)?.body).toEqual({ songIds: [third!.id] })
  })

  it('一次超过 9,000 首：不发请求，说明原因（服务端上限）', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })
    const sent = device.requests.length

    expect(await app.addSongsToPlaylist(JAZZ.id, songsFrom(9001))).toMatchObject({ ok: false, failure: { kind: 'invalid', problem: 'tooManySongs' } })
    expect(device.requests.length).toBe(sent)
    expect(await storedTrackIds(device, JAZZ.id)).toEqual(JAZZ_TRACKS)
    expect(app.state.library?.notice).toMatchObject({ kind: 'notChanged', failure: { kind: 'invalid', problem: 'tooManySongs' } })
  })

  it('断网时加入：不改本地、不发请求；网易云说歌单不在了：改回原样并马上同步', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })
    await world.netease.reply(SEARCH_SONGS)
    const found = await app.searchSongs('真夜中')
    if (!found.ok)
      throw new Error(`搜索没成功：${JSON.stringify(found)}`)
    const [first, second] = found.value
    const sent = device.requests.length

    device.setOnline(false)
    expect(await app.addSongsToPlaylist(JAZZ.id, [first!])).toMatchObject({ ok: false, failure: { kind: 'offline' } })
    expect(device.requests.length).toBe(sent)
    expect(await storedTrackIds(device, JAZZ.id)).toEqual(JAZZ_TRACKS)
    expect(app.state.library?.notice).toMatchObject({ kind: 'notChanged', failure: { kind: 'offline' } })
    device.setOnline(true)

    await world.netease.reply(ADD_MISSING)
    expect(await app.addSongsToPlaylist(JAZZ.id, [second!])).toMatchObject({ ok: false, failure: { kind: 'missing' } })
    expect(await storedTrackIds(device, JAZZ.id)).toEqual(JAZZ_TRACKS)
    expect(app.state.library?.notice).toMatchObject({ kind: 'playlistMissing', change: { kind: 'addMany', playlist: { id: JAZZ.id } } })
  })

  it('选择器搜索只要单曲第一页，不动全局搜索的结果', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    expect(app.state.search.results).toBeNull()

    await world.netease.reply(SEARCH_SONGS)
    const found = await app.searchSongs('真夜中')
    expect(found.ok).toBe(true)
    if (found.ok)
      expect(found.value).toHaveLength(30)
    expect(device.requests.at(-1)).toEqual({ method: 'GET', path: '/api/search/songs?keywords=%E7%9C%9F%E5%A4%9C%E4%B8%AD&offset=0' })
    expect(app.state.search.results).toBeNull()
  })
})

describe('批量加入与移除的边界（#66 返工）', () => {
  it('批量加入被网易云拒绝：本地不改、说明没改成、没有部分写入', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })
    const songs = songsFrom(2)
    const sent = addRequests(device).length

    await world.netease.reply(ADD_REJECTED)
    expect(await app.addSongsToPlaylist(JAZZ.id, songs)).toMatchObject({ ok: false, failure: { kind: 'rejected', code: 502 } })

    expect(addRequests(device)).toHaveLength(sent + 1)
    expect(addRequests(device).at(-1)?.body).toEqual({ songIds: songs.map(song => song.id) })
    expect(totalOf(app, JAZZ.id)).toBe(2)
    expect(await storedTrackIds(device, JAZZ.id)).toEqual(JAZZ_TRACKS)
    expect(app.state.library?.notice).toMatchObject({
      kind: 'notChanged',
      change: { kind: 'addMany', playlist: { id: JAZZ.id } },
      failure: { kind: 'rejected', code: 502 },
    })
  })

  it('移除时忽略歌单里已经不在的编号：只提交还在的，本地和请求都不含别的', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })
    await world.netease.reply(REMOVE)

    app.removeFromPlaylist(JAZZ.id, [JAZZ_TRACKS[0]!, 999_999_999])
    expect(totalOf(app, JAZZ.id)).toBe(1)
    expect(app.state.library?.notice).toMatchObject({ kind: 'removed', count: 1 })

    await world.clock.advance(5000)
    expect(removeRequests(device).at(-1)?.body).toEqual({ songIds: [JAZZ_TRACKS[0]!] })
    expect(await storedTrackIds(device, JAZZ.id)).toEqual([JAZZ_TRACKS[1]!])
    expect(totalOf(app, JAZZ.id)).toBe(1)
  })

  it('5 秒内移除两张歌单：先提交上一张，再计时提交这一张', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })
    await world.netease.reply(CREATED.create)
    await world.netease.reply(CREATED.detail, { when: { id: CREATED.id } })
    expect(await app.createPlaylist({ name: '连续移除', private: true })).toEqual({ ok: true, playlistId: CREATED.id })
    await world.netease.reply(ADD)
    expect(await app.addSongsToPlaylist(CREATED.id, songsFrom(2))).toMatchObject({ ok: true })
    const createdTracks = await storedTrackIds(device, CREATED.id)
    if (!createdTracks)
      throw new Error('新建歌单没有写进本机副本')
    expect(createdTracks.length).toBeGreaterThan(0)

    await world.netease.reply(REMOVE)
    await world.netease.reply(REMOVE)
    app.removeFromPlaylist(JAZZ.id, [JAZZ_TRACKS[0]!])
    app.removeFromPlaylist(CREATED.id, [createdTracks[0]!])
    await world.settle()

    expect(removeRequests(device)).toEqual([
      { method: 'POST', path: `/api/playlists/${JAZZ.id}/tracks/remove`, body: { songIds: [JAZZ_TRACKS[0]!] } },
    ])
    expect(totalOf(app, JAZZ.id)).toBe(1)

    await world.clock.advance(5000)
    expect(removeRequests(device).at(-1)).toEqual({
      method: 'POST',
      path: `/api/playlists/${CREATED.id}/tracks/remove`,
      body: { songIds: [createdTracks[0]!] },
    })
    expect(await storedTrackIds(device, CREATED.id)).not.toContain(createdTracks[0])
    expect(totalOf(app, JAZZ.id)).toBe(1)
  })

  it('移除最后几首：本地清空、请求带上全部、成功后本机副本也为空', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })
    await world.netease.reply(REMOVE)

    app.removeFromPlaylist(JAZZ.id, JAZZ_TRACKS)
    expect(totalOf(app, JAZZ.id)).toBe(0)
    expect(app.state.library?.notice).toMatchObject({ kind: 'removed', count: 2 })

    await world.clock.advance(5000)
    expect(removeRequests(device).at(-1)?.body).toEqual({ songIds: JAZZ_TRACKS })
    expect(await storedTrackIds(device, JAZZ.id)).toEqual([])
    expect(totalOf(app, JAZZ.id)).toBe(0)
    expect(app.state.library?.notice).toBeNull()
  })
})
