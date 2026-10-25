import { describe, expect, it } from 'vitest'

import type { Song } from '#lib/api/library.js'

import { loadFixture } from './harness/fixtures'
import { held, never } from './harness/hold'
import { listener, PLAYLISTS_WITH_POEMS } from './harness/listener'
import { RECORDED_ACCOUNT } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInAtHearts, reopen, replyLibrary, replyLikedSongs } = listener(world, { playlists: PLAYLISTS_WITH_POEMS })

// v9 的存储区、键和内容格式取自 d79cf95:src/lib/app/local.ts / player.ts / downloads.ts，独立建立旧库，不调用当前 createLocalDb 或 upgrade。
// v9 的歌曲信息还没有第几首、碟号、别名、译名、发行时间（#79），下载还没有专辑信息，歌词还没有逐字歌词、音译的原文。

type SongIn9 = Omit<Song, 'trackNumber' | 'disc' | 'aliases' | 'translations' | 'publishedAt'>

/** #79 加的几项在旧数据里没有：读出来是“网易云没给” */
const NOT_GIVEN = {
  trackNumber: null,
  disc: null,
  aliases: [],
  translations: [],
  publishedAt: null,
}

const savedSong: SongIn9 = {
  id: 3433267939,
  name: '旧版存着的歌',
  artists: [
    { id: 1, name: '旧版存着的歌手' },
  ],
  album: { id: 1, name: '旧版存着的专辑', coverUrl: 'https://p1.music.126.net/placeholder/cover.jpg' },
  duration: 192648,
  availability: 'full',
}

const downloadedSong: SongIn9 = {
  id: 2662577181,
  name: '旧版下载的歌',
  artists: [
    { id: 2, name: '旧版下载的歌手' },
  ],
  album: { id: 2, name: '旧版下载的专辑', coverUrl: null },
  duration: 240413,
  availability: 'full',
}

describe('本机数据库升级', () => {
  it('v9 → v10：不用重新登录，曲库、播放队列和进度、设置、下载仍在；歌曲信息重新取（带上第几首等），旧的下载和播放队列里的歌补上“网易云没给”', async () => {
    // 由真服务端签发登录 Cookie，再交给装着旧版数据库的设备；不手造密文。
    const signedIn = world.device()
    const login = await signInAtHearts(signedIn)
    await world.settle()
    login.close()

    const device = world.device()
    for (const cookie of await signedIn.cookies())
      await device.setCookie(cookie.toString())
    await device.preload(9, (database) => {
      database.createObjectStore('session')
      const library = database.createObjectStore('library')
      library.put(10000001, 'owner')
      library.put([3433267939], 'hearts')
      library.put([
        {
          id: 900000001,
          name: '我喜欢的音乐',
          kind: 'liked',
          private: false,
          coverUrl: 'https://p1.music.126.net/placeholder/cover.jpg',
          creator: '测试听众',
          playCount: 0,
          description: null,
          tags: [],
          trackCount: 2,
          tracksUpdatedAt: 1,
        },
      ], 'playlists')
      library.put([], 'collectedAlbums')
      library.put([], 'collectedArtists')
      database.createObjectStore('tracks').put({
        version: 1,
        trackIds: [3433267939, 2662577181],
        complete: true,
      }, 900000001)
      database.createObjectStore('songs', { keyPath: 'id' }).put(savedSong)
      database.createObjectStore('albumPages')
      const player = database.createObjectStore('player')
      player.put({
        owner: 10000001,
        entries: [
          {
            song: savedSong,
            source: { kind: 'playlist', id: 900000001 },
          },
        ],
        mode: 'one',
        order: null,
        upNext: [],
        filling: null,
      }, 'queue')
      player.put({
        songId: 3433267939,
        position: 42,
        duration: 192.648,
        trial: false,
        listened: 12,
      }, 'progress')
      const settings = database.createObjectStore('settings')
      settings.put('lossless', 'playQuality')
      settings.put(['夜に駆ける'], 'searchHistory')
      database.createObjectStore('checkIns', { autoIncrement: true })
      database.createObjectStore('downloads').put({
        song: downloadedSong,
        audio: new Blob([
          new Uint8Array(1000),
        ], { type: 'audio/mpeg' }),
        cover: null,
        lyrics: {
          kind: 'line',
          lines: [
            {
              start: 1,
              text: '旧版存着的歌词',
              words: null,
              translation: null,
              romanization: null,
            },
          ],
          translated: false,
          romanized: false,
        },
        downloadedAt: 1,
      }, 2662577181)
    })

    const hearts = held()
    const tab = await reopen(device, undefined, { until: hearts.until })
    const { app } = tab
    await world.settle()
    expect(app.state.session).toMatchObject({ status: 'signedIn', account: RECORDED_ACCOUNT })
    expect(app.state.library?.playlists?.map(playlist => playlist.id)).toEqual([900000001])
    expect(app.state.library?.hearts?.has(3433267939)).toBe(true)
    expect(app.state.library?.liked).toMatchObject({ total: 2, complete: false })
    expect(app.state.player).toMatchObject({
      current: 0,
      position: 42,
      duration: 192.648,
      status: 'paused',
      mode: 'one',
      quality: 'lossless',
    })
    expect(app.state.player.queue).toEqual([
      {
        song: {
          ...savedSong,
          ...NOT_GIVEN,
        },
        source: { kind: 'playlist', id: 900000001 },
      },
    ])
    expect(app.state.search.history).toEqual(['夜に駆ける'])
    expect(app.state.downloads.songs).toEqual([
      {
        ...downloadedSong,
        ...NOT_GIVEN,
      },
    ])
    expect(device.requests.some(request => request.path.includes('/login/'))).toBe(false)

    // v10 使存着的歌曲信息失效：按网易云的版本与曲目重新取，带上第几首、碟号这些
    await replyLibrary({ from: 'playlists' })
    await replyLikedSongs()
    await replyLibrary({
      from: 'likedTracks',
      until: never(),
    })
    hearts.release()
    await world.settle()
    expect(app.state.library?.liked).toMatchObject({ total: 4984, complete: true })
    expect(device.requests.some(request => request.path === '/api/songs')).toBe(true)
    expect((await device.stored()).songs.find(([id]) => id === 3433267939)?.[1]).toMatchObject({
      name: '夏に溶ける (feat. 鏡音リン)',
      trackNumber: 1,
      disc: '01',
      publishedAt: 1789315200000,
    })

    const song = app.state.library!.liked!.songs.find(liked => liked.id === 3433267939)!
    const fixture = 'playback/downloads/002-song_download_url_v1.json.gz'
    const { outcome } = await loadFixture(fixture)
    const { data } = outcome.response.body as { data: { url: string, size: number } }
    device.files.put(data.url.replace(/^http:/, 'https:'), { bytes: data.size, type: 'audio/mpeg' })
    device.files.put(`${song.album.coverUrl!.replace(/^http:/, 'https:')}?param=512y512`, { bytes: 100, type: 'image/jpeg' })
    await world.netease.reply(fixture)
    await world.netease.reply('playback/lyric_new.all-forms.json')
    await world.netease.reply('playback/export/003-album.json.gz')
    app.download(song)
    await world.settle()
    expect(app.state.downloads.has(3433267939)).toBe(true)

    tab.close()
    const reopened = await reopen(device)
    expect(reopened.app.state.downloads.songs).toEqual([
      song,
      {
        ...downloadedSong,
        ...NOT_GIVEN,
      },
    ])
    expect(reopened.app.state.player.position).toBe(42)
  })
})
