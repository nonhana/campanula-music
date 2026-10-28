import { describe, expect, it } from 'vitest'

import type { App } from '#lib/app/app.js'

import type { Device } from './harness/device'
import { held, never } from './harness/hold'
import { JAZZ_DETAIL, listener, noticeEntry, noticeOf, SOME_SONGS, storedLibrary, storedTrackIds } from './harness/listener'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInAtLikedTracks, dailySongs, openJazz, replyLibrary } = listener(world)

// 红心、加入歌单、收藏（#30，Spec #11“客户端：曲库副本”，ADR-0007）：先改本地、立即生效，再提交给网易云；网易云拒绝时改回来并说明原因。
// 录制见 tests/fixtures/netease/README.md 的验证关卡②和 #30 一条
const LIKE = 'like-collect/like.like.json'
const UNLIKE = 'like-collect/like.unlike.json'
/** 往自建歌单加歌：加好了；整批都已经在歌单里（网易云回 502“歌单内歌曲重复”，SDK 1.4.0 录的，测试替身照 2.x 取里层） */
const ADD = 'playlist-edit/playlist_tracks.add.json'
const ADD_DUPLICATE = 'playlist-edit/playlist_tracks.add-duplicate.json'
const ALBUM_COLLECT = 'like-collect/album_sub.subscribe.json'
/** 已经取消收藏的专辑再取消：网易云回 404“用户未收藏此专辑” */
const ALBUM_UNCOLLECT_AGAIN = 'like-collect/album_sub.unsubscribe-again.json'
const ARTIST_COLLECT = 'like-collect/artist_sub.subscribe.json'
const ARTIST_UNCOLLECT = 'like-collect/artist_sub.unsubscribe.json'
/** 收藏歌单：带反作弊令牌收藏成功、取消成功（hana-music-api#77 真账号上录的） */
const PLAYLIST_COLLECT = 'like-collect/playlist_subscribe.subscribe-token.json'
const PLAYLIST_UNCOLLECT = 'like-collect/playlist_subscribe.unsubscribe.json'
/** 网易云拒绝收藏歌单：401“歌单创建者已设置隐私” */
const PLAYLIST_REJECTED = 'like-collect/playlist_subscribe.own-private.json'
const RATE_LIMITED = 'like-collect/playlist_subscribe.405.json'

/** 作者的自建歌单 jazz：2 首（#22 录制） */
const JAZZ = { id: 900000002, detail: JAZZ_DETAIL }
const LIKED_ID = 900000001
/** 不在曲库里的歌单：搜“真夜中”的歌单结果里的一张，81 首（#56 录制） */
const NETEASE_PLAYLIST = { id: 95050200, detail: 'library/netease-playlist/001-playlist_detail.json.gz', songs: 'library/netease-playlist/002-song_detail.json.gz' }
/** 没收藏的专辑 THE BOOK for,；收藏了的专辑 Keep The Village Alive（#23 录制） */
const THE_BOOK = { id: 379547126, fixture: 'library/album-artist/010-album.json.gz' }
const KEEP_THE_VILLAGE_ALIVE = 3149073
/** 收藏了的歌手 YOASOBI（#23 录制） */
const YOASOBI = { id: 33927412, songs: 'library/album-artist/003-artist_top_song.json.gz', albums: 'library/album-artist/004-artist_album.json.gz' }
/** 搜“真夜中”的歌单、歌手、专辑（#32 录制）。每类结果是网易云 cloudsearch 的哪个 type */
const SEARCH = {
  songs: { fixture: 'search/results/001-cloudsearch.json.gz', type: 1 },
  playlists: { fixture: 'search/results/003-cloudsearch.json.gz', type: 1000 },
  artists: { fixture: 'search/results/005-cloudsearch.json.gz', type: 100 },
  albums: { fixture: 'search/results/006-cloudsearch.json.gz', type: 10 },
}

const hearted = (app: App, songId: number) => app.state.library?.hearts?.has(songId) ?? false

describe('红心', () => {
  it('红心一首歌：马上显示成已红心，提交给网易云，网易云说好了才存进本机副本', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const [song] = await dailySongs(app)
    expect(hearted(app, song.id)).toBe(false)

    const reply = held()
    await world.netease.reply(LIKE, { until: reply.until })
    const hearting = app.heart(song, true)
    expect(hearted(app, song.id)).toBe(true)
    await world.settle()
    expect(device.requests.at(-1)).toEqual({
      method: 'POST',
      path: '/api/hearts',
      body: { songId: song.id, hearted: true },
    })
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'like',
      query: { id: song.id, like: true },
    })
    expect(await storedLibrary(device, 'hearts')).not.toContain(song.id)

    reply.release()
    await hearting
    expect(hearted(app, song.id)).toBe(true)
    expect(noticeOf(app)).toBeNull()
    expect(await storedLibrary(device, 'hearts')).toContain(song.id)
  })

  it('取消红心：马上显示成没红心，网易云说好了从本机副本里拿掉', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const [song] = await dailySongs(app)
    await world.netease.reply(LIKE)
    await app.heart(song, true)

    const reply = held()
    await world.netease.reply(UNLIKE, { until: reply.until })
    const unhearting = app.heart(song, false)
    expect(hearted(app, song.id)).toBe(false)
    await world.settle()
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'like',
      query: { id: song.id, like: false },
    })
    expect(await storedLibrary(device, 'hearts')).toContain(song.id)

    reply.release()
    await unhearting
    expect(hearted(app, song.id)).toBe(false)
    expect(await storedLibrary(device, 'hearts')).not.toContain(song.id)
  })

  it('断网时红心：不改，直接说没改成（规则⑨），不发请求', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const [song] = await dailySongs(app)
    const sent = device.requests.length

    device.setOnline(false)
    await app.heart(song, true)

    expect(hearted(app, song.id)).toBe(false)
    expect(noticeOf(app)).toEqual({
      kind: 'notChanged',
      change: { kind: 'heart', song, hearted: true },
      failure: { kind: 'offline' },
    })
    expect(device.requests.length).toBe(sent)
    expect(await storedLibrary(device, 'hearts')).not.toContain(song.id)

    await app.noticeAction(noticeEntry(app)!.id, 'dismiss')
    expect(noticeOf(app)).toBeNull()
  })

  it('连点两下（红心、马上又取消）：等网易云回了第一下才提交第二下，到网易云的先后不会颠倒', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const [song] = await dailySongs(app)

    const first = held()
    await world.netease.reply(LIKE, { until: first.until })
    await world.netease.reply(UNLIKE)
    const hearting = app.heart(song, true)
    const unhearting = app.heart(song, false)
    await world.settle()
    expect(hearted(app, song.id)).toBe(false)
    expect(world.netease.calls.filter(call => call.module === 'like').map(call => call.query)).toEqual([
      { id: song.id, like: true },
    ])

    first.release()
    await Promise.all([hearting, unhearting])
    expect(world.netease.calls.filter(call => call.module === 'like').map(call => call.query)).toEqual([
      { id: song.id, like: true },
      { id: song.id, like: false },
    ])
    expect(hearted(app, song.id)).toBe(false)
    expect(await storedLibrary(device, 'hearts')).not.toContain(song.id)
  })

  it('排着队的修改还没提交就退出了登录：不再提交（不会带着别的登录发出去）', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const [song] = await dailySongs(app)

    const first = held()
    await world.netease.reply(LIKE, { until: first.until })
    const hearting = app.heart(song, true)
    const unhearting = app.heart(song, false)
    await world.settle()
    await world.netease.reply('login/logout.json')
    await app.logout()
    first.release()
    await Promise.all([hearting, unhearting])

    expect(world.netease.calls.filter(call => call.module === 'like').map(call => call.query)).toEqual([
      { id: song.id, like: true },
    ])
    expect(device.requests.filter(request => request.method === 'POST' && request.path === '/api/hearts')).toHaveLength(1)
  })

  it('红心时服务端说需要登录（登录 Cookie 没了）：整个 App 变成登录失效，红心不存进本机副本', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const [song] = await dailySongs(app)

    await device.setCookie('campanula_login=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict')
    await app.heart(song, true)

    expect(app.state.session.status).toBe('loginExpired')
    expect(app.state.library).toBeNull()
    expect(await storedLibrary(device, 'hearts')).not.toContain(song.id)
  })
})

describe('加入歌单', () => {
  it('加入自建歌单：马上排在最前，提交给网易云，成了存进本机副本并提示一句', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const [song] = await dailySongs(app)
    await openJazz(app, { songsHeld: true })
    const before = await storedTrackIds(device, JAZZ.id)
    expect(before).toHaveLength(2)

    const reply = held()
    await world.netease.reply(ADD, { until: reply.until })
    const adding = app.addToPlaylist(JAZZ.id, song)
    expect(app.state.library?.songsOf(JAZZ.id)).toMatchObject({
      songs: [song],
      total: 3,
    })
    await world.settle()
    expect(device.requests.at(-1)).toEqual({
      method: 'POST',
      path: `/api/playlists/${JAZZ.id}/tracks`,
      body: {
        songIds: [song.id],
      },
    })
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'playlist_tracks',
      query: {
        op: 'add',
        pid: JAZZ.id,
        tracks: String(song.id),
      },
    })
    expect(await storedTrackIds(device, JAZZ.id)).toEqual(before)

    reply.release()
    await adding
    expect(app.state.library?.songsOf(JAZZ.id)).toMatchObject({
      songs: [song],
      total: 3,
    })
    expect(await storedTrackIds(device, JAZZ.id)).toEqual([song.id, ...before!])
    expect(noticeOf(app)).toMatchObject({
      kind: 'added',
      change: {
        kind: 'add',
        playlist: { id: JAZZ.id },
        song,
      },
    })
  })

  it('这首已经在歌单里（网易云说“歌单内歌曲重复”）：也算加好了，不改回去', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const [song] = await dailySongs(app)
    await openJazz(app, { songsHeld: true })

    await world.netease.reply(ADD_DUPLICATE)
    await app.addToPlaylist(JAZZ.id, song)

    expect(app.state.library?.songsOf(JAZZ.id)?.total).toBe(3)
    expect(noticeOf(app)).toMatchObject({ kind: 'added' })
  })

  it('加入我喜欢的音乐等于红心：提交的是红心，成了也提示一句', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const [song] = await dailySongs(app)

    await world.netease.reply(LIKE)
    const adding = app.addToPlaylist(LIKED_ID, song)
    expect(hearted(app, song.id)).toBe(true)
    await adding

    expect(device.requests.at(-1)).toEqual({
      method: 'POST',
      path: '/api/hearts',
      body: { songId: song.id, hearted: true },
    })
    expect(await storedLibrary(device, 'hearts')).toContain(song.id)
    expect(noticeOf(app)).toMatchObject({
      kind: 'added',
      change: {
        playlist: { id: LIKED_ID },
      },
    })
  })

  it('加歌时这张歌单的曲目编号正在拉、在加歌确认之前发出：拉回来的里面没有刚加的歌，叠回去，不让它从界面上消失', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const [song] = await dailySongs(app)

    const trackIds = held()
    await world.netease.reply(JAZZ.detail, { until: trackIds.until })
    await world.netease.reply(SOME_SONGS, {
      until: never(),
    })
    void app.openPlaylist(JAZZ.id)
    await world.settle()
    await world.netease.reply(ADD)
    await app.addToPlaylist(JAZZ.id, song)

    trackIds.release()
    await world.settle()
    const shown = app.state.library?.songsOf(JAZZ.id)
    expect(shown?.songs[0]).toEqual(song)
    expect(shown?.total).toBe(3)
    expect((await storedTrackIds(device, JAZZ.id))?.[0]).toBe(song.id)
  })
})

describe('收藏', () => {
  it('在专辑页收藏专辑：马上进收藏的专辑（最前），成了连同专辑页存进本机副本', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await world.netease.reply(THE_BOOK.fixture)
    await app.openAlbum(THE_BOOK.id)

    await world.netease.reply(ALBUM_COLLECT)
    const collecting = app.collect({ kind: 'album', id: THE_BOOK.id }, true)
    expect(app.state.library?.albums?.[0]).toMatchObject({ id: THE_BOOK.id, name: 'THE BOOK for,' })
    await collecting

    expect(device.requests.at(-1)).toEqual({
      method: 'POST',
      path: `/api/albums/${THE_BOOK.id}/collect`,
      body: { collected: true },
    })
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'album_sub',
      query: { id: THE_BOOK.id, t: 1 },
    })
    expect((await storedLibrary(device, 'collectedAlbums') as { id: number }[])[0].id).toBe(THE_BOOK.id)
    expect((await device.stored()).albumPages.map(([id]) => id)).toContain(THE_BOOK.id)
  })

  it('取消收藏专辑时它其实已经不在收藏里了（网易云回 404“用户未收藏此专辑”）：也算取消好了', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    await world.netease.reply(ALBUM_UNCOLLECT_AGAIN)
    await app.collect({ kind: 'album', id: KEEP_THE_VILLAGE_ALIVE }, false)

    expect(app.state.library?.albums?.map(album => album.id)).not.toContain(KEEP_THE_VILLAGE_ALIVE)
    expect(noticeOf(app)).toBeNull()
    expect((await storedLibrary(device, 'collectedAlbums') as { id: number }[]).map(album => album.id)).not.toContain(KEEP_THE_VILLAGE_ALIVE)
  })

  it('在歌手页取消收藏、再收藏歌手', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await world.netease.reply(YOASOBI.songs)
    await world.netease.reply(YOASOBI.albums)
    await app.openArtist(YOASOBI.id)
    expect(app.state.library?.artists?.map(artist => artist.id)).toContain(YOASOBI.id)

    await world.netease.reply(ARTIST_UNCOLLECT)
    await app.collect({ kind: 'artist', id: YOASOBI.id }, false)
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'artist_sub',
      query: { id: YOASOBI.id, t: 0 },
    })
    expect(app.state.library?.artists?.map(artist => artist.id)).not.toContain(YOASOBI.id)

    await world.netease.reply(ARTIST_COLLECT)
    await app.collect({ kind: 'artist', id: YOASOBI.id }, true)
    expect(app.state.library?.artists?.[0]).toMatchObject({ id: YOASOBI.id, name: 'YOASOBI' })
    expect((await storedLibrary(device, 'collectedArtists') as { id: number }[])[0].id).toBe(YOASOBI.id)
  })

  it('收藏打开着的不在曲库里的歌单：带上现取的反作弊令牌，它连同已经取到的曲目进曲库，不再拉一遍；取消收藏后照常显示刚才的样子', async () => {
    const device = world.device()
    const tab = await signInAtLikedTracks(device)
    const { app } = tab
    await world.netease.reply(NETEASE_PLAYLIST.detail)
    await world.netease.reply(NETEASE_PLAYLIST.songs)
    const leave = app.viewing({ kind: 'playlist', id: NETEASE_PLAYLIST.id })
    await world.settle()

    await world.netease.reply(PLAYLIST_COLLECT)
    const sent = device.requests.length
    const collecting = app.collect({ kind: 'playlist', id: NETEASE_PLAYLIST.id }, true)
    expect(app.state.library?.songsOf(NETEASE_PLAYLIST.id)).toMatchObject({
      playlist: { kind: 'collected' },
      total: 81,
      complete: true,
    })
    await collecting
    await world.settle()
    const [token] = tab.watchman.issued
    expect(device.requests.slice(sent)).toEqual([
      {
        method: 'POST',
        path: `/api/playlists/${NETEASE_PLAYLIST.id}/collect`,
        body: { collected: true, checkToken: token },
      },
    ])
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'playlist_subscribe',
      query: { id: NETEASE_PLAYLIST.id, t: 1 },
      config: { checkToken: token },
    })
    expect(app.state.library?.songsOf(NETEASE_PLAYLIST.id)?.songs).toHaveLength(81)
    expect((await storedLibrary(device, 'playlists') as { id: number }[]).map(playlist => playlist.id)).toContain(NETEASE_PLAYLIST.id)
    expect(await storedTrackIds(device, NETEASE_PLAYLIST.id)).toHaveLength(81)

    leave()
    await world.netease.reply(PLAYLIST_UNCOLLECT)
    await app.collect({ kind: 'playlist', id: NETEASE_PLAYLIST.id }, false)
    const call = world.netease.calls.at(-1)
    expect(call).toMatchObject({
      module: 'playlist_subscribe',
      query: { id: NETEASE_PLAYLIST.id, t: 0 },
    })
    expect(call?.config).not.toHaveProperty('checkToken')
    expect(app.state.library?.songsOf(NETEASE_PLAYLIST.id)).toBeNull()
    expect(app.state.library?.neteasePlaylist(NETEASE_PLAYLIST.id)).toMatchObject({
      status: 'shown',
      content: { total: 81, complete: true },
    })
    expect(await storedTrackIds(device, NETEASE_PLAYLIST.id)).toBeUndefined()
  })

  it('网易云拒绝收藏歌单：改回原样，说明网易云给的原因', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await world.netease.reply(NETEASE_PLAYLIST.detail)
    await world.netease.reply(NETEASE_PLAYLIST.songs)
    await app.openPlaylist(NETEASE_PLAYLIST.id)

    await world.netease.reply(PLAYLIST_REJECTED)
    await app.collect({ kind: 'playlist', id: NETEASE_PLAYLIST.id }, true)

    expect(app.state.library?.songsOf(NETEASE_PLAYLIST.id)).toBeNull()
    expect(noticeOf(app)).toMatchObject({
      kind: 'notChanged',
      change: {
        kind: 'collectPlaylist',
        playlist: { id: NETEASE_PLAYLIST.id },
        collected: true,
      },
      failure: { kind: 'rejected', code: 401, message: '歌单创建者已设置隐私' },
    })
    expect((await storedLibrary(device, 'playlists') as { id: number }[]).map(playlist => playlist.id)).not.toContain(NETEASE_PLAYLIST.id)
  })

  it('网易云说操作频繁：改回原样，提示稍后再试，不自动重试', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await world.netease.reply(NETEASE_PLAYLIST.detail)
    await world.netease.reply(NETEASE_PLAYLIST.songs)
    await app.openPlaylist(NETEASE_PLAYLIST.id)

    await world.netease.reply(RATE_LIMITED)
    await app.collect({ kind: 'playlist', id: NETEASE_PLAYLIST.id }, true)
    await world.clock.advance(60_000)

    expect(app.state.library?.songsOf(NETEASE_PLAYLIST.id)).toBeNull()
    expect(noticeOf(app)).toMatchObject({
      kind: 'notChanged',
      failure: { kind: 'rateLimited' },
    })
    expect(world.netease.calls.filter(call => call.module === 'playlist_subscribe')).toHaveLength(1)
  })

  it('收藏歌单前没取到反作弊令牌（Watchman 没加载出来）：不提交，说明原因', async () => {
    const device = world.device()
    const tab = await signInAtLikedTracks(device)
    const { app } = tab
    await world.netease.reply(NETEASE_PLAYLIST.detail)
    await world.netease.reply(NETEASE_PLAYLIST.songs)
    await app.openPlaylist(NETEASE_PLAYLIST.id)
    const sent = device.requests.length

    tab.watchman.available = false
    await app.collect({ kind: 'playlist', id: NETEASE_PLAYLIST.id }, true)

    expect(device.requests.length).toBe(sent)
    expect(app.state.library?.songsOf(NETEASE_PLAYLIST.id)).toBeNull()
    expect(noticeOf(app)).toMatchObject({
      kind: 'notChanged',
      failure: { kind: 'checkTokenUnavailable' },
    })
  })

  it('在搜索结果里收藏歌单、歌手、专辑：进曲库的是结果里有的那些（搜索结果里没有的先空着，下一次同步拿到真的）', async () => {
    const device = world.device()
    const tab = await signInAtLikedTracks(device)
    const { app } = tab
    for (const { fixture, type } of Object.values(SEARCH)) {
      await world.netease.reply(fixture, {
        when: { type },
      })
    }
    await app.openSearch('真夜中')

    await world.netease.reply(PLAYLIST_COLLECT)
    await app.collect({ kind: 'playlist', id: 8668352551 }, true)
    expect(app.state.library?.playlists?.find(playlist => playlist.id === 8668352551)).toEqual({
      id: 8668352551,
      name: '听·ずっと真夜中でいいのに。热门精选|あいつら全員同窓会',
      coverUrl: expect.any(String),
      creator: '用户332',
      creatorAvatarUrl: null,
      playCount: 912449,
      trackCount: 30,
      description: null,
      tags: [],
      kind: 'collected',
      private: false,
      tracksUpdatedAt: 0,
    })
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'playlist_subscribe',
      config: { checkToken: tab.watchman.issued[0] },
    })

    // 第 2 位歌手没有头像
    await world.netease.reply(ARTIST_COLLECT)
    await app.collect({ kind: 'artist', id: 57866432 }, true)
    expect(app.state.library?.artists?.[0]).toEqual({ id: 57866432, name: 'ずっと真夜中だと光合成できない', avatarUrl: null })

    await world.netease.reply(ALBUM_COLLECT)
    await app.collect({ kind: 'album', id: 82815921 }, true)
    expect(app.state.library?.albums?.[0]).toMatchObject({ id: 82815921, name: '潜潜話', songCount: 0 })
  })
})

describe('同步拿回来的旧数据', () => {
  /** 同一台设备再开一个标签页：后台同步的红心压着（返回 release 放出），歌单列表压着不回 */
  const reopenWithHeartsHeld = async (device: Device): Promise<{ app: App, releaseHearts: () => void }> => {
    await world.netease.reply('login/user_account.vip.json')
    const hearts = held()
    await replyLibrary({
      through: 'playlists',
      holds: {
        hearts: { until: hearts.until },
        playlists: {
          until: never(),
        },
      },
    })
    const { app } = await device.open()
    await world.settle()
    return { app, releaseHearts: hearts.release }
  }

  it('红心的请求在同步拿红心之后才确认：同步拿回来的红心里没有这首，叠回去，本机副本里也留着', async () => {
    const device = world.device()
    const first = await signInAtLikedTracks(device)
    const [song] = await dailySongs(first.app)
    const { app, releaseHearts } = await reopenWithHeartsHeld(device)

    await world.netease.reply(LIKE)
    await app.heart(song, true)
    releaseHearts()
    await world.settle()

    expect(world.netease.calls.filter(call => call.module === 'likelist')).toHaveLength(2)
    expect(hearted(app, song.id)).toBe(true)
    expect(await storedLibrary(device, 'hearts')).toContain(song.id)
  })

  it('同步拿回红心时，红心还没确认：照样显示成已红心但不存；确认了再存', async () => {
    const device = world.device()
    const first = await signInAtLikedTracks(device)
    const [song] = await dailySongs(first.app)
    const { app, releaseHearts } = await reopenWithHeartsHeld(device)

    const reply = held()
    await world.netease.reply(LIKE, { until: reply.until })
    const hearting = app.heart(song, true)
    releaseHearts()
    await world.settle()
    expect(hearted(app, song.id)).toBe(true)
    expect(await storedLibrary(device, 'hearts')).not.toContain(song.id)

    reply.release()
    await hearting
    expect(hearted(app, song.id)).toBe(true)
    expect(await storedLibrary(device, 'hearts')).toContain(song.id)
  })
})

describe('红心的提示', () => {
  it('“更多”菜单红心有提示，行内心形不提示', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const [song] = await dailySongs(app)

    await world.netease.reply(LIKE)
    await app.heart(song, true)
    expect(noticeOf(app)).toBeNull()

    await world.netease.reply(UNLIKE)
    await app.heart(song, false, { notify: true })
    expect(noticeOf(app)).toEqual({
      kind: 'hearted',
      song,
      hearted: false,
    })
  })
})
