import { describe, expect, it, vi } from 'vitest'

import type { ArtistSongOrder, Song } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'

import type { Device } from './harness/device'
import { never } from './harness/hold'
import { COLLECTED_ALBUMS, listener, PLAYLISTS_WITH_POEMS } from './harness/listener'
import { signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInAtLikedTracks, reopen, replyLibrary } = listener(world, { playlists: PLAYLISTS_WITH_POEMS })

// 专辑页、歌手页（#23、#83）：听众打开时用前台请求拉。收藏的专辑打开过就存进本机副本，别的只在这次登录期间记着。录制见 tests/fixtures/netease/README.md 的 #23、#83 两条
const DIR = 'library/album-artist'
/** 收藏的专辑里多了 THE BOOK for,（录制时成对地收藏、马上取消收藏） */
const COLLECTED_ALBUMS_WITH_THE_BOOK = `${DIR}/011-album_sublist.json.gz`
const KEEP_THE_VILLAGE_ALIVE = { id: 3149073, fixture: `${DIR}/008-album.json.gz` }
/** 收藏的专辑，没有简介（nonhana/hana-music-api#59） */
const SOUNDTRACK = { id: 3154337, fixture: `${DIR}/009-album.json.gz` }
/** 没收藏的专辑 */
const THE_BOOK = { id: 379547126, fixture: `${DIR}/010-album.json.gz` }
/** 别的歌的播放地址：压着不回，只看播放队列和取了哪首的地址 */
const SOME_PLAY_URL = 'playback/liked/001-song_url_v1.json.gz'
/** 专辑一页就取完的歌手（65 张）；歌曲两种排法各两页取完（100 + 49 首） */
const YOASOBI = {
  id: 33927412,
  hot: [`${DIR}/012-artist_songs.json.gz`, `${DIR}/013-artist_songs.json.gz`],
  time: [`${DIR}/014-artist_songs.json.gz`, `${DIR}/015-artist_songs.json.gz`],
  intro: `${DIR}/016-artist_desc.json.gz`,
  albums: `${DIR}/004-artist_album.json.gz`,
}
/** 专辑超过一页的歌手（101 张） */
const MARASY = {
  id: 14786,
  hot: `${DIR}/017-artist_songs.json.gz`,
  intro: `${DIR}/019-artist_desc.json.gz`,
  albums: [`${DIR}/006-artist_album.json.gz`, `${DIR}/007-artist_album.json.gz`],
}

/** 歌手页一种排法已经显示的歌；还没显示时是空的 */
const shownSongs = (app: App, artistId: number, order: ArtistSongOrder): readonly Song[] => {
  const page = app.state.library?.artistPage(artistId)
  const songs = page?.status === 'shown'
    ? page.content.songs[order]
    : null
  return songs?.status === 'shown'
    ? songs.content.songs
    : []
}

/** 一种排法的歌曲那一块：还没取过是 null */
const songsState = (app: App, artistId: number, order: ArtistSongOrder) => {
  const page = app.state.library?.artistPage(artistId)
  return page?.status === 'shown'
    ? page.content.songs[order]
    : undefined
}

/** 登录、等收藏的歌手同步到，再打开 YOASOBI 的歌手页（热门第一页、第一页专辑） */
const openYoasobi = async (device: Device): Promise<App> => {
  const app = (await signInAtLikedTracks(device)).app
  await vi.waitFor(() => expect(app.state.library?.artists).not.toBeNull())
  await world.netease.reply(YOASOBI.hot[0])
  await world.netease.reply(YOASOBI.albums)
  await app.openArtist(YOASOBI.id)
  return app
}

describe('专辑页', () => {
  it('打开收藏的专辑：用前台请求拉曲目、简介和发行时间，存进本机副本；再次打开 App 后歌曲数没变就不再拉，断网也能看', async () => {
    const device = world.device()
    const app = (await signInAtLikedTracks(device)).app
    await vi.waitFor(() => expect(app.state.library?.artists).not.toBeNull())

    await world.netease.reply(KEEP_THE_VILLAGE_ALIVE.fixture)
    await app.openAlbum(KEEP_THE_VILLAGE_ALIVE.id)

    expect(world.netease.calls.findLast(call => call.module === 'album')).toMatchObject({
      query: { id: KEEP_THE_VILLAGE_ALIVE.id },
    })
    const page = app.state.library?.albumPage(KEEP_THE_VILLAGE_ALIVE.id)
    expect(page).toMatchObject({
      status: 'shown',
      content: {
        album: {
          id: KEEP_THE_VILLAGE_ALIVE.id,
          name: 'Keep The Village Alive',
          coverUrl: 'https://p4.music.126.net/GdQ9aQ3f3pscKhOpmIV4eA==/18345351510219723.jpg',
          artist: { id: 99995, name: 'Stereophonics' },
          publishedAt: 1441900800000,
          description: expect.stringMatching(/^＊顶著‘英伦摇滚超级救世主乐团’/),
          songCount: 10,
          company: '华纳音乐',
        },
      },
    })
    if (page?.status !== 'shown')
      throw new Error('专辑页没显示')
    expect(page.content.songs).toHaveLength(10)
    expect(page.content.songs[0]).toEqual({
      id: 32019373,
      name: 'C\'est La Vie',
      artists: [
        { id: 99995, name: 'Stereophonics' },
      ],
      album: { id: KEEP_THE_VILLAGE_ALIVE.id, name: 'Keep The Village Alive', coverUrl: 'https://p3.music.126.net/GdQ9aQ3f3pscKhOpmIV4eA==/18345351510219723.jpg' },
      duration: 220320,
      downloadSize: 8815848,
      availability: 'full',
      trackNumber: 1,
      disc: '1',
      aliases: [],
      translations: [],
      publishedAt: null,
    })

    const reopened = (await reopen(device)).app
    const calls = world.netease.calls.length
    await reopened.openAlbum(KEEP_THE_VILLAGE_ALIVE.id)
    expect(world.netease.calls).toHaveLength(calls)
    expect(reopened.state.library?.albumPage(KEEP_THE_VILLAGE_ALIVE.id)).toEqual(page)

    device.setOnline(false)
    await reopened.openAlbum(KEEP_THE_VILLAGE_ALIVE.id)
    expect(reopened.state.library?.albumPage(KEEP_THE_VILLAGE_ALIVE.id)).toEqual(page)
  })

  it('没有简介的专辑照常打开，简介是空的', async () => {
    const device = world.device()
    const app = (await signInAtLikedTracks(device)).app
    await vi.waitFor(() => expect(app.state.library?.artists).not.toBeNull())

    await world.netease.reply(SOUNDTRACK.fixture)
    await app.openAlbum(SOUNDTRACK.id)

    const page = app.state.library?.albumPage(SOUNDTRACK.id)
    expect(page).toMatchObject({
      status: 'shown',
      content: {
        album: { name: '月に寄りそう乙女の作法2 COMPLETE SOUNDTRACK', description: null },
      },
    })
    expect(page?.status === 'shown' && page.content.songs).toHaveLength(37)
  })

  it('打开没收藏的专辑：这次登录再打开不再拉，但不存进本机；再次打开 App 后断网就说没拉成', async () => {
    const device = world.device()
    const app = (await signInAtLikedTracks(device)).app
    await vi.waitFor(() => expect(app.state.library?.artists).not.toBeNull())

    await world.netease.reply(THE_BOOK.fixture)
    await app.openAlbum(THE_BOOK.id)
    expect(app.state.library?.albumPage(THE_BOOK.id)).toMatchObject({
      status: 'shown',
      content: {
        album: {
          name: 'THE BOOK for,',
          artist: { name: 'YOASOBI' },
        },
      },
    })
    const calls = world.netease.calls.length
    await app.openAlbum(THE_BOOK.id)
    expect(world.netease.calls).toHaveLength(calls)
    expect((await device.stored()).albumPages).toEqual([])

    const reopened = (await reopen(device)).app
    expect(reopened.state.library?.albumPage(THE_BOOK.id)).toBeNull()
    device.setOnline(false)
    await reopened.openAlbum(THE_BOOK.id)

    expect(reopened.state.library?.albumPage(THE_BOOK.id)).toEqual({
      status: 'failed',
      failure: { kind: 'offline' },
    })
  })

  it('在官方 App 里取消收藏的专辑：同步拿到收藏的专辑后，本机存着的专辑页也删掉', async () => {
    const device = world.device()
    const app = (await signInAtLikedTracks(device, { albums: COLLECTED_ALBUMS_WITH_THE_BOOK })).app
    await vi.waitFor(() => expect(app.state.library?.artists).not.toBeNull())
    await world.netease.reply(THE_BOOK.fixture)
    await app.openAlbum(THE_BOOK.id)
    expect((await device.stored()).albumPages.map(([id]) => id)).toEqual([THE_BOOK.id])

    const reopened = (await reopen(device, undefined, {
      albums: COLLECTED_ALBUMS,
      through: 'likedTracks',
      until: never(),
    })).app
    expect(reopened.state.library?.albumPage(THE_BOOK.id)).toMatchObject({ status: 'shown' })
    await vi.waitFor(() => expect(reopened.state.library?.albums).toHaveLength(55))

    expect(reopened.state.library?.albumPage(THE_BOOK.id)).toBeNull()
    expect((await device.stored()).albumPages).toEqual([])
  })

  it('退出登录：存着的专辑页一起删掉；换账号登录后看不到上一个账号打开过的专辑页和歌手页', async () => {
    const device = world.device()
    const app = (await signInAtLikedTracks(device)).app
    await vi.waitFor(() => expect(app.state.library?.artists).not.toBeNull())
    await world.netease.reply(KEEP_THE_VILLAGE_ALIVE.fixture)
    await app.openAlbum(KEEP_THE_VILLAGE_ALIVE.id)
    await world.netease.reply(YOASOBI.hot[0])
    await world.netease.reply(YOASOBI.albums)
    await app.openArtist(YOASOBI.id)
    expect((await device.stored()).albumPages).toHaveLength(1)

    await world.netease.reply('login/logout.json')
    await app.logout()
    expect((await device.stored()).albumPages).toEqual([])

    await replyLibrary({
      through: 'hearts',
      until: never(),
    })
    await signIn(world, app, { another: true })

    expect(app.state.library?.albumPage(KEEP_THE_VILLAGE_ALIVE.id)).toBeNull()
    expect(app.state.library?.artistPage(YOASOBI.id)).toBeNull()
  })
})

describe('歌手页', () => {
  it('打开歌手：用前台请求拉头部、热门排法的第一页歌曲（100 首）和第一页专辑（新的在前），不调热门 50 首；不存进本机，再次打开 App 后断网就说没拉成', async () => {
    const device = world.device()
    const app = (await signInAtLikedTracks(device)).app
    await vi.waitFor(() => expect(app.state.library?.artists).not.toBeNull())

    await world.netease.reply(YOASOBI.hot[0])
    await world.netease.reply(YOASOBI.albums)
    await app.openArtist(YOASOBI.id)

    const sent = world.netease.calls.slice(-2).map(({ module, query }) => ({ module, query }))
    expect(sent).toHaveLength(2)
    expect(sent).toEqual(expect.arrayContaining([
      {
        module: 'artist_songs',
        query: {
          id: YOASOBI.id,
          order: 'hot',
          limit: 100,
          offset: 0,
        },
      },
      {
        module: 'artist_album',
        query: { id: YOASOBI.id, limit: 100, offset: 0 },
      },
    ]))
    const page = app.state.library?.artistPage(YOASOBI.id)
    expect(page).toMatchObject({
      status: 'shown',
      content: {
        artist: {
          id: YOASOBI.id,
          name: 'YOASOBI',
          avatarUrl: 'https://p4.music.126.net/1f_5IU9FLWRZjAJVXu-ipA==/109951172064233940.jpg',
          songCount: 148,
          albumCount: 65,
        },
        order: 'hot',
        songs: {
          hot: {
            status: 'shown',
            content: {
              total: 149,
              more: { status: 'notLoaded' },
            },
          },
          time: null,
        },
        moreAlbums: null,
        intro: null,
      },
    })
    expect(shownSongs(app, YOASOBI.id, 'hot')).toHaveLength(100)
    expect(shownSongs(app, YOASOBI.id, 'hot')[0]).toEqual({
      id: 1472480890,
      name: '群青',
      artists: [
        { id: YOASOBI.id, name: 'YOASOBI' },
      ],
      album: { id: 94214994, name: '群青', coverUrl: 'https://p4.music.126.net/sF9I_mKMVNtsCD-ZXzfV_A==/109951165251958014.jpg' },
      duration: 248444,
      downloadSize: 9939885,
      availability: 'full',
      trackNumber: 1,
      disc: '01',
      aliases: [],
      translations: [],
      publishedAt: null,
    })
    if (page?.status !== 'shown')
      throw new Error('歌手页没显示')
    expect(page.content.albums).toHaveLength(65)
    expect(page.content.albums[0]).toEqual({
      id: 397364476,
      name: 'オリオン (PSYQUI Remix)',
      coverUrl: 'https://p4.music.126.net/-uZkjczBHO7g5J4NvBnlKg==/109951173908849364.jpg',
      publishedAt: 1789315200000,
    })

    const reopened = (await reopen(device)).app
    expect(reopened.state.library?.artistPage(YOASOBI.id)).toBeNull()
    device.setOnline(false)
    await reopened.openArtist(YOASOBI.id)

    expect(reopened.state.library?.artistPage(YOASOBI.id)).toEqual({
      status: 'failed',
      failure: { kind: 'offline' },
    })
  })

  it('显示更多歌曲：热门第 2 页从第 101 首接在后面，取完就没有更多了；没取成时说明原因，已经显示的不动，再按一次就是重试', async () => {
    const device = world.device()
    const app = await openYoasobi(device)

    device.setOnline(false)
    await app.moreArtistSongs(YOASOBI.id, 'hot')
    expect(songsState(app, YOASOBI.id, 'hot')).toMatchObject({
      status: 'shown',
      content: {
        more: {
          status: 'failed',
          failure: { kind: 'offline' },
        },
      },
    })
    expect(shownSongs(app, YOASOBI.id, 'hot')).toHaveLength(100)

    device.setOnline(true)
    await world.netease.reply(YOASOBI.hot[1])
    await app.moreArtistSongs(YOASOBI.id, 'hot')

    expect(device.requests.at(-1)?.path).toBe(`/api/artists/${YOASOBI.id}/songs?order=hot&offset=100`)
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'artist_songs',
      query: {
        id: YOASOBI.id,
        order: 'hot',
        limit: 100,
        offset: 100,
      },
    })
    expect(songsState(app, YOASOBI.id, 'hot')).toMatchObject({
      status: 'shown',
      content: { total: 149, more: null },
    })
    const songs = shownSongs(app, YOASOBI.id, 'hot')
    expect(songs).toHaveLength(149)
    expect(songs[0]).toMatchObject({ id: 1472480890, name: '群青' })
    expect(songs[100]).toMatchObject({ id: 3389005332, name: 'HEART BEAT' })
  })

  it('切到最新：第一次切过去才取第一页，没取成只在最新那一份里说明原因、不自动重试，能重试；两种排法各自留着已经显示的，来回切不再取', async () => {
    const device = world.device()
    const app = await openYoasobi(device)
    app.viewing({
      kind: 'artist',
      id: YOASOBI.id,
      tab: 'songs',
      order: 'hot',
    })
    await world.settle()
    expect(songsState(app, YOASOBI.id, 'time')).toBeNull()

    device.setOnline(false)
    app.viewing({
      kind: 'artist',
      id: YOASOBI.id,
      tab: 'songs',
      order: 'time',
    })
    await world.settle()
    expect(songsState(app, YOASOBI.id, 'time')).toEqual({
      status: 'failed',
      failure: { kind: 'offline' },
    })
    expect(app.state.library?.artistPage(YOASOBI.id)?.status).toBe('shown')
    expect(shownSongs(app, YOASOBI.id, 'hot')).toHaveLength(100)

    device.setOnline(true)
    await world.settle()
    expect(songsState(app, YOASOBI.id, 'time')).toEqual({
      status: 'failed',
      failure: { kind: 'offline' },
    })

    await world.netease.reply(YOASOBI.time[0])
    await app.openArtistSongs(YOASOBI.id, 'time')
    expect(device.requests.at(-1)?.path).toBe(`/api/artists/${YOASOBI.id}/songs?order=time&offset=0`)
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'artist_songs',
      query: {
        id: YOASOBI.id,
        order: 'time',
        limit: 100,
        offset: 0,
      },
    })
    expect(songsState(app, YOASOBI.id, 'time')).toMatchObject({
      status: 'shown',
      content: {
        total: 149,
        more: { status: 'notLoaded' },
      },
    })
    expect(shownSongs(app, YOASOBI.id, 'time')[0]).toMatchObject({ id: 3442644155, name: '咲き誇れ' })

    const calls = world.netease.calls.length
    app.viewing({
      kind: 'artist',
      id: YOASOBI.id,
      tab: 'songs',
      order: 'hot',
    })
    await world.settle()
    app.viewing({
      kind: 'artist',
      id: YOASOBI.id,
      tab: 'songs',
      order: 'time',
    })
    await world.settle()
    expect(world.netease.calls).toHaveLength(calls)
    expect(shownSongs(app, YOASOBI.id, 'hot')[0]).toMatchObject({ id: 1472480890, name: '群青' })
    expect(shownSongs(app, YOASOBI.id, 'time')).toHaveLength(100)
  })

  it('点歌、播放全部：播放队列是当前排法已经显示的歌（不补后面的），播放来源是这位歌手；切排法后已经在放的播放队列不变', async () => {
    const device = world.device()
    const app = await openYoasobi(device)
    await world.netease.reply(YOASOBI.time[0])
    app.viewing({
      kind: 'artist',
      id: YOASOBI.id,
      tab: 'songs',
      order: 'time',
    })
    await world.settle()
    const time = shownSongs(app, YOASOBI.id, 'time')

    await world.netease.reply(SOME_PLAY_URL, {
      until: never(),
    })
    app.play({ kind: 'artist', id: YOASOBI.id }, time[2].id)
    await world.settle()
    expect(app.state.player.queue.map(entry => entry.song.id)).toEqual(time.map(song => song.id))
    expect(app.state.player.queue.every(entry => entry.source.kind === 'artist' && entry.source.id === YOASOBI.id)).toBe(true)
    expect(app.state.player.current).toBe(2)

    app.viewing({
      kind: 'artist',
      id: YOASOBI.id,
      tab: 'albums',
      order: 'hot',
    })
    await world.settle()
    expect(app.state.player.queue.map(entry => entry.song.id)).toEqual(time.map(song => song.id))
    expect(app.state.player.current).toBe(2)

    await world.netease.reply(SOME_PLAY_URL, {
      until: never(),
    })
    app.playAll({ kind: 'artist', id: YOASOBI.id })
    await world.settle()
    const hot = shownSongs(app, YOASOBI.id, 'hot')
    expect(hot).toHaveLength(100)
    expect(app.state.player.queue.map(entry => entry.song.id)).toEqual(hot.map(song => song.id))
    expect(app.state.player.current).toBe(0)
    expect(device.requests.at(-1)?.path).toBe('/api/songs/1472480890/play-url?quality=exhigh')
  })

  it('简介：第一次切到简介标签才取，简介在前、分段带标题；没取成能重试，取到了这次登录里不再取', async () => {
    const device = world.device()
    const app = (await signInAtLikedTracks(device)).app
    await vi.waitFor(() => expect(app.state.library?.artists).not.toBeNull())
    await world.netease.reply(MARASY.hot)
    await world.netease.reply(MARASY.albums[0])
    app.viewing({
      kind: 'artist',
      id: MARASY.id,
      tab: 'albums',
      order: 'hot',
    })
    await world.settle()
    const intro = () => {
      const page = app.state.library?.artistPage(MARASY.id)
      return page?.status === 'shown'
        ? page.content.intro
        : undefined
    }
    expect(intro()).toBeNull()
    expect(world.netease.calls.some(call => call.module === 'artist_desc')).toBe(false)

    device.setOnline(false)
    app.viewing({
      kind: 'artist',
      id: MARASY.id,
      tab: 'intro',
      order: 'hot',
    })
    await world.settle()
    expect(intro()).toEqual({
      status: 'failed',
      failure: { kind: 'offline' },
    })

    device.setOnline(true)
    await world.netease.reply(MARASY.intro)
    await app.openArtistIntro(MARASY.id)
    expect(device.requests.at(-1)?.path).toBe(`/api/artists/${MARASY.id}/intro`)
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'artist_desc',
      query: { id: MARASY.id },
    })
    expect(intro()).toEqual({
      status: 'shown',
      content: {
        brief: '触手猴（まらしぃ）是日本钢琴演奏家、词作家、作曲家。因在YouTube和niconico动画投稿而为人们所知。',
        sections: [
          {
            title: '传记',
            text: expect.stringMatching(/^1990年3月10日出生于爱知县名古屋市。[\s\S]*此外，预计每年秋天都会有全国巡回演奏会。$/),
          },
        ],
      },
    })

    const calls = world.netease.calls.length
    app.viewing({
      kind: 'artist',
      id: MARASY.id,
      tab: 'songs',
      order: 'hot',
    })
    await world.settle()
    app.viewing({
      kind: 'artist',
      id: MARASY.id,
      tab: 'intro',
      order: 'hot',
    })
    await world.settle()
    expect(world.netease.calls).toHaveLength(calls)
  })

  it('专辑超过一页的歌手：先显示前 100 张；再取一页从第 101 张接着取，取完就没有更多了', async () => {
    const device = world.device()
    const app = (await signInAtLikedTracks(device)).app
    await vi.waitFor(() => expect(app.state.library?.artists).not.toBeNull())
    await world.netease.reply(MARASY.hot)
    await world.netease.reply(MARASY.albums[0])
    await app.openArtist(MARASY.id)
    expect(app.state.library?.artistPage(MARASY.id)).toMatchObject({
      status: 'shown',
      content: {
        artist: { albumCount: 101 },
        moreAlbums: { status: 'notLoaded' },
      },
    })

    await world.netease.reply(MARASY.albums[1])
    await app.moreArtistAlbums(MARASY.id)

    expect(device.requests.map(request => request.path)).toContain(`/api/artists/${MARASY.id}/albums?offset=100`)
    expect(world.netease.calls.findLast(call => call.module === 'artist_album')).toMatchObject({
      query: { id: MARASY.id, limit: 100, offset: 100 },
    })
    const page = app.state.library?.artistPage(MARASY.id)
    expect(page).toMatchObject({
      status: 'shown',
      content: { moreAlbums: null },
    })
    const albums = page?.status === 'shown'
      ? page.content.albums
      : []
    expect(albums).toHaveLength(101)
    expect(albums.at(-1)).toMatchObject({ id: 45538, name: '幻想游戯~Museum of marasy' })
  })
})
