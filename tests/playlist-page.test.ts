import { describe, expect, it } from 'vitest'

import type { Playlist } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'
import type { PlaylistPage } from '#lib/app/library.js'
import { syncNoticeFor } from '#lib/app/library.js'
import { likedFailure } from '#lib/components/library/liked-failure.js'
import { playlistHeader } from '#lib/components/library/view.js'

import type { Device } from './harness/device'
import { DAILY, likedPage, listener, PLAYLISTS_WITH_POEMS, recordedBatch } from './harness/listener'
import { signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInAtHearts, signInAtLikedTracks, signInSynced, replyLibrary, replyPlaylists } = listener(world, { playlists: PLAYLISTS_WITH_POEMS })

// “这一页歌单”的答案（#72）：在不在曲库、加载 / 失败 / 不可用 / 还有更多、首数、哪种失败显示在哪、能做什么，都由 library.playlistPage 给出；页面只报告“听众在看哪一页”（App 的 viewing），什么时候拉由 App 决定。录制沿用已有的 #22、#23、#29、#32、#56、#30 数据，不新录也不连真账号。

/** 搜“真夜中”的歌单结果里的一张，81 首（#56 录制） */
const SMALL = { id: 95050200, detail: 'library/netease-playlist/001-playlist_detail.json.gz', songs: 'library/netease-playlist/002-song_detail.json.gz' }
/** 不存在的歌单：网易云回 404“歌单不存在”（#56 录制） */
const MISSING = { id: 99999999999, detail: 'library/netease-playlist/006-playlist_detail.json.gz' }
const COLLECT = 'like-collect/playlist_subscribe.subscribe-token.json'
const UNCOLLECT = 'like-collect/playlist_subscribe.unsubscribe.json'
/** 网易云回 502、SDK 认不出（“这一页没取到”，tests/library.test.ts 同一条录制） */
const REJECTED_PAGE = 'library/song_detail.liked-page4.502-null-artist.json.gz'
const BANG_DREAM_ID = 4943170241
const BEFORE = await recordedBatch('before')

/** 没收藏的专辑 THE BOOK for,（#23 录制） */
const THE_BOOK = 379547126
const ALBUM = 'library/album-artist/010-album.json.gz'
/** 收藏了的歌手 YOASOBI（#23 录制） */
const YOASOBI = { id: 33927412, songs: 'library/album-artist/003-artist_top_song.json.gz', albums: 'library/album-artist/004-artist_album.json.gz' }
/** 搜“真夜中”的歌单、歌手、专辑（#32 录制）：每类结果是网易云 cloudsearch 的哪个 type */
const SEARCH = {
  songs: { fixture: 'search/results/001-cloudsearch.json.gz', type: 1 },
  playlists: { fixture: 'search/results/003-cloudsearch.json.gz', type: 1000 },
  artists: { fixture: 'search/results/005-cloudsearch.json.gz', type: 100 },
  albums: { fixture: 'search/results/006-cloudsearch.json.gz', type: 10 },
}

const removeRequests = (device: Device) => device.requests.filter(request => request.path.endsWith('/tracks/remove'))
/** 打开 SMALL 这张歌单的网易云调用（不含后台同步那张我喜欢的音乐） */
const detailCalls = () => world.netease.calls.filter(call => call.module === 'playlist_detail' && (call.query as { id: number }).id === SMALL.id)

/** 登录并同步整个曲库，只有 Bang Dream 合集的第 2 页 SDK 认不出：同步最后停在“没能同步” */
const syncWithRejectedPage = async (device: Device): Promise<App> => {
  const { app } = await device.open()
  await replyLibrary()
  for (const page of [1, 2, 3, 4, 5] as const)
    await world.netease.reply(likedPage(page))
  const bangDream = BEFORE.playlists.find(item => item.id === BANG_DREAM_ID)!
  await replyPlaylists(BEFORE.playlists, { rejected: bangDream.pages[1]!.fixture, rejection: REJECTED_PAGE })
  await signIn(world, app)
  await device.idle()
  return app
}

/** 登录，我喜欢的音乐取到第 3 页；第 4 页没有录制，后台同步在那里出错停下：liked 已经有 3,000 首、没取全 */
const syncWithPartialLiked = async (device: Device): Promise<App> => {
  const { app } = await device.open()
  await replyLibrary()
  for (const page of [1, 2, 3] as const)
    await world.netease.reply(likedPage(page))
  await signIn(world, app)
  await device.idle()
  return app
}

describe('这一页歌单的答案', () => {
  it('在不在曲库、能做什么都直接给：自建能编辑和排序，收藏的能收藏，我喜欢的音乐能排序', async () => {
    const { app } = await signInSynced(world.device())
    const library = app.state.library!
    const find = (kind: Playlist['kind']) => library.playlists!.find(playlist => playlist.kind === kind)!

    const liked = library.playlistPage(find('liked').id)
    expect(liked).toMatchObject({
      inLibrary: true,
      kind: 'liked',
      info: { id: find('liked').id },
      songs: { kind: 'songs' },
      can: { edit: false, sort: true, collect: false },
    })
    expect(liked.count).not.toBeNull()
    expect(liked.count!.loaded).toBe(liked.count!.total)

    const own = library.playlistPage(find('own').id)
    expect(own).toMatchObject({
      inLibrary: true,
      kind: 'own',
      can: { edit: true, sort: true, collect: false },
    })

    const collected = library.playlistPage(find('collected').id)
    expect(collected).toMatchObject({
      inLibrary: true,
      kind: 'collected',
      can: { edit: false, sort: false, collect: true },
    })
  })

  it('歌单列表还没到：答案说还不知道在不在曲库，不是“不在曲库”', async () => {
    const { app } = await signInAtHearts(world.device())
    expect(app.state.library!.playlistPage(SMALL.id)).toMatchObject({
      inLibrary: null,
      kind: null,
      info: null,
      songs: { kind: 'loading' },
      failure: null,
      count: null,
      can: { edit: false, sort: false, collect: false },
    })
  })

  it('“不在曲库里”只有一种定义：歌单列表里没有它；列表里有就是在曲库里，打开后头部来自联网取到的那一份', async () => {
    const { app } = await signInSynced(world.device())
    const library = () => app.state.library!
    const collected = library().playlists!.find(playlist => playlist.kind === 'collected')!
    expect(library().playlistPage(collected.id).inLibrary).toBe(true)

    expect(library().playlistPage(SMALL.id)).toMatchObject({
      inLibrary: false,
      info: null,
      songs: { kind: 'loading' },
      can: { collect: false },
    })

    await world.netease.reply(SMALL.detail)
    await world.netease.reply(SMALL.songs)
    await app.openPlaylist(SMALL.id)
    expect(library().playlistPage(SMALL.id)).toMatchObject({
      inLibrary: false,
      kind: null,
      info: { id: SMALL.id },
      songs: { kind: 'songs', total: 81, complete: true },
      can: { edit: false, sort: false, collect: true },
    })
  })

  it('不在曲库里的歌单打开失败：整块列表说打开没成，source 是 open', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    device.setOnline(false)
    await app.openPlaylist(SMALL.id)
    expect(app.state.library!.playlistPage(SMALL.id)).toMatchObject({
      inLibrary: false,
      info: null,
      songs: { kind: 'loading' },
      failure: {
        where: 'list',
        failure: { kind: 'offline' },
        source: 'open',
        retry: 'open',
      },
      count: null,
      can: { edit: false, sort: false, collect: false },
    })
  })

  it('打不开的歌单：答案说 unavailable，不是“没能打开”', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await world.netease.reply(MISSING.detail)
    await app.openPlaylist(MISSING.id)
    expect(app.state.library!.playlistPage(MISSING.id)).toEqual({
      inLibrary: false,
      kind: null,
      info: null,
      private: false,
      content: null,
      songs: { kind: 'unavailable', reason: 'missing' },
      more: null,
      failure: null,
      count: null,
      can: { edit: false, sort: false, collect: false },
    })
  })

  it('打开失败优先于同步失败：答案说打开的那次没成，不是后台同步停下的原因', async () => {
    const device = world.device()
    const app = await syncWithRejectedPage(device)
    expect(app.state.library!.sync).toMatchObject({
      status: 'failed',
      failure: { kind: 'upstreamChanged' },
    })
    const before = app.state.library!.playlistPage(BANG_DREAM_ID)
    expect(before.songs).toMatchObject({ kind: 'songs', complete: false })
    expect(before.failure).toBeNull()
    expect(before.more).toBeNull()

    device.setOnline(false)
    await app.openPlaylist(BANG_DREAM_ID)
    expect(app.state.library!.playlistPage(BANG_DREAM_ID)).toMatchObject({
      inLibrary: true,
      songs: { kind: 'songs', complete: false },
      failure: {
        where: 'more',
        failure: { kind: 'offline' },
        source: 'open',
        retry: 'open',
      },
    })
    expect(app.state.library!.sync).toMatchObject({
      status: 'failed',
      failure: { kind: 'upstreamChanged' },
    })
  })

  it('我喜欢的音乐已经有一部分、后台同步又失败：这一页不重复说失败，同步条说并可重试', async () => {
    const device = world.device()
    const app = await syncWithPartialLiked(device)
    const library = app.state.library!
    const likedId = library.playlists!.find(playlist => playlist.kind === 'liked')!.id
    const page = library.playlistPage(likedId)
    expect(page.songs).toMatchObject({ kind: 'songs', complete: false })
    if (page.songs.kind !== 'songs')
      throw new Error(`我喜欢的音乐应该已经有一部分歌：${page.songs.kind}`)
    expect(page.songs.songs).toHaveLength(3000)
    expect(page.more).toBeNull()
    expect(page.failure).toBeNull()
    expect(library.syncNotice).toMatchObject({
      kind: 'failed',
      failure: { kind: 'serverError' },
    })
    expect(syncNoticeFor(library, page.failure?.where === 'list')).toMatchObject({ kind: 'failed' })

    device.setOnline(false)
    app.retrySync()
    await world.settle()
    expect(app.state.library!.syncNotice).toMatchObject({ kind: 'offline' })
  })

  it('同步条的进度由 App 算好：首次同步时是已同步 / 一共几首，同步完了就不显示', async () => {
    const { app } = await signInAtLikedTracks(world.device())
    const notice = app.state.library!.syncNotice
    expect(notice).toMatchObject({
      kind: 'syncing',
      progress: { done: 0 },
    })
    if (notice?.kind !== 'syncing')
      throw new Error(`首次同步应该显示进度：${JSON.stringify(notice)}`)
    expect(notice.progress!.total).toBeGreaterThan(0)

    const synced = await signInSynced(world.device())
    expect(synced.app.state.library!.syncNotice).toBeNull()
  })

  it('同步条：整块列表已经说明失败时不再重复，同步中 / 暂停 / 断网不受影响', () => {
    const failed = {
      syncNotice: {
        kind: 'failed',
        failure: { kind: 'upstreamChanged' },
      },
    } as const
    expect(syncNoticeFor(failed, false)).toEqual(failed.syncNotice)
    expect(syncNoticeFor(failed, true)).toBeNull()

    for (const notice of [
      { kind: 'syncing', progress: null },
      { kind: 'rateLimited' },
      { kind: 'offline' },
    ] as const)
      expect(syncNoticeFor({ syncNotice: notice }, true)).toEqual(notice)
  })

  it('我喜欢的音乐整块失败：同步失败说“没能同步”并重新同步，打开失败说“没能加载”并重开', () => {
    const base = {
      where: 'list' as const,
      failure: { kind: 'offline' as const },
      retry: 'open' as const,
    }
    expect(likedFailure({ ...base, source: 'sync' })).toEqual({ title: '我喜欢的音乐没能同步', retry: 'sync' })
    expect(likedFailure({ ...base, source: 'open' })).toEqual({ title: '我喜欢的音乐没能加载', retry: 'open' })
  })

  it('头部：还没同步完时写“N / N 首”，同步完只写“N 首”', () => {
    const page = (complete: boolean): PlaylistPage => ({
      inLibrary: true,
      kind: 'own',
      info: {
        id: 1,
        name: '测试歌单',
        coverUrl: '',
        creator: '测试听众',
        playCount: 0,
        description: null,
        tags: [],
      },
      private: false,
      content: null,
      songs: {
        kind: 'songs',
        songs: [],
        total: 10,
        complete,
      },
      more: null,
      failure: null,
      count: { loaded: 10, total: 10 },
      can: { edit: true, sort: true, collect: false },
    })
    expect(playlistHeader(page(false))?.meta).toContain('10 / 10 首')
    expect(playlistHeader(page(true))?.meta).toContain('10 首')
  })
})

describe('听众正在看 X / 离开了 X', () => {
  it('看着一张不在曲库里的歌单：一次调用就取；收藏后自己切到曲库、不再联网取；取消收藏后又改回联网取', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await world.netease.reply(SMALL.detail)
    await world.netease.reply(SMALL.songs)

    const leave = app.viewing({ kind: 'playlist', id: SMALL.id })
    await world.settle()
    expect(app.state.library!.playlistPage(SMALL.id)).toMatchObject({
      inLibrary: false,
      info: { id: SMALL.id },
      songs: { kind: 'songs', total: 81, complete: true },
    })
    const opened = detailCalls().length

    await world.netease.reply(COLLECT)
    await app.collect({ kind: 'playlist', id: SMALL.id }, true)
    await world.settle()
    expect(app.state.library!.playlistPage(SMALL.id)).toMatchObject({
      inLibrary: true,
      kind: 'collected',
      songs: { kind: 'songs', total: 81, complete: true },
    })
    expect(detailCalls()).toHaveLength(opened)

    await world.netease.reply(SMALL.detail)
    await world.netease.reply(UNCOLLECT)
    await app.collect({ kind: 'playlist', id: SMALL.id }, false)
    await world.settle()
    expect(app.state.library!.playlistPage(SMALL.id)).toMatchObject({
      inLibrary: false,
      info: { id: SMALL.id },
      songs: { kind: 'songs', total: 81, complete: true },
    })
    expect(detailCalls()).toHaveLength(opened + 1)
    leave()
  })

  it('专辑、歌手、每日推荐、搜索结果页只报告在看什么：App 自己去拉', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    await world.netease.reply(ALBUM)
    app.viewing({ kind: 'album', id: THE_BOOK })
    await world.settle()
    expect(app.state.library!.albumPage(THE_BOOK)).toMatchObject({ status: 'shown' })

    await world.netease.reply(YOASOBI.songs)
    await world.netease.reply(YOASOBI.albums)
    app.viewing({ kind: 'artist', id: YOASOBI.id })
    await world.settle()
    expect(app.state.library!.artistPage(YOASOBI.id)).toMatchObject({ status: 'shown' })

    await world.netease.reply(DAILY)
    app.viewing({ kind: 'daily' })
    await world.settle()
    expect(app.state.daily).toMatchObject({ status: 'shown' })

    for (const { fixture, type } of Object.values(SEARCH)) {
      await world.netease.reply(fixture, {
        when: { type },
      })
    }
    app.viewing({ kind: 'search', keyword: '真夜中' })
    await world.settle()
    expect(app.state.search.results).toMatchObject({
      keyword: '真夜中',
      songs: { status: 'shown' },
    })
  })

  it('离开歌单：还没提交的移除立即提交，不等 5 秒', async () => {
    const device = world.device()
    const { app } = await signInSynced(device)
    const JAZZ_ID = 900000002
    const page = app.state.library!.playlistPage(JAZZ_ID)
    if (page.songs.kind !== 'songs' || page.songs.songs.length === 0)
      throw new Error(`jazz 没同步到歌：${page.songs.kind}`)
    const songId = page.songs.songs[0]!.id

    await world.netease.reply('playlist-edit/playlist_tracks.del.json')
    const leave = app.viewing({ kind: 'playlist', id: JAZZ_ID })
    await world.settle()

    app.removeFromPlaylist(JAZZ_ID, [songId])
    await world.settle()
    expect(removeRequests(device)).toHaveLength(0)

    leave()
    await world.settle()
    expect(removeRequests(device)).toEqual([
      {
        method: 'POST',
        path: `/api/playlists/${JAZZ_ID}/tracks/remove`,
        body: {
          songIds: [songId],
        },
        keepalive: true,
      },
    ])
  })
})
