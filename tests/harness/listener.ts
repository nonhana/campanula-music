import { readdir } from 'node:fs/promises'

import type { Playlist, Song } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'

import type { Device, SentRequest, Tab } from './device'
import { loadFixture } from './fixtures'
import { never } from './hold'
import { LIBRARY_SYNC_MODULES, signIn } from './sign-in'
import type { World } from './world'

// 听众场景仍走 World / Device / Tab 的整个 App 接入点，不替换 App 内部。
// 写新测试先选同步停点；下面的录制有不同含义，不能为了共用准备把 before 换成 deleted。
export const HEARTS = 'library/likelist.json'
/** #22：刚建好临时歌单 poems（2 首），54 张歌单。 */
export const PLAYLISTS_WITH_POEMS = 'library/sync/before/001-user_playlist.json.gz'
/** #22：已删掉 poems，53 张歌单，自建的都是公开的。 */
const PLAYLISTS_WITHOUT_POEMS = 'library/sync/deleted/001-user_playlist.json.gz'
export const COLLECTED_ALBUMS = 'library/album-artist/001-album_sublist.json.gz'
export const COLLECTED_ARTISTS = 'library/album-artist/002-artist_sublist.json.gz'
export const LIKED_TRACK_IDS = 'library/playlist_detail.liked-full.json.gz'
export const likedPage = (page: number) => `library/song_detail.liked-page${page}.json.gz`
export const DAILY = 'discover/daily/001-recommend_songs.json.gz'
export const JAZZ_DETAIL = 'library/sync/before/004-playlist_detail.json.gz'
/** 不是 jazz 的歌曲信息：原测试只看编号/首数，不把它说成 jazz 的真实歌曲。 */
export const SOME_SONGS = 'library/sync/before/003-song_detail.json.gz'

export interface RecordedPlaylist {
  id: number
  detail: string
  trackIds: number[]
  pages: { fixture: string, ids: number[] }[]
}

/** #22 的批次：before 是完整曲库（不含已用 #21 录过的我喜欢的音乐），after/deleted 只录变了的歌单。 */
export const recordedBatch = async (name: 'before' | 'after' | 'deleted'): Promise<{ list: string, playlists: RecordedPlaylist[] }> => {
  const dir = `library/sync/${name}`
  const files = (await readdir(new URL(`../fixtures/netease/${dir}`, import.meta.url))).sort().map(file => `${dir}/${file}`)
  const playlists: RecordedPlaylist[] = []
  for (const fixture of files.slice(1)) {
    const { module, query, outcome } = await loadFixture(fixture)
    if (module === 'playlist_detail') {
      const body = outcome.response.body as { playlist: { trackIds: { id: number }[] } }
      playlists.push({
        id: query.id as number,
        detail: fixture,
        trackIds: body.playlist.trackIds.map(track => track.id),
        pages: [],
      })
    }
    else {
      playlists.at(-1)!.pages.push({
        fixture,
        ids: (query.ids as string).split(',').map(Number),
      })
    }
  }
  return { list: files[0], playlists }
}

export const recordedTrackIds = async (): Promise<number[]> => {
  const { outcome } = await loadFixture(LIKED_TRACK_IDS)
  return (outcome.response.body as { playlist: { trackIds: { id: number }[] } }).playlist.trackIds.map(track => track.id)
}

type SyncStep = 'hearts' | 'playlists' | 'albums' | 'artists' | 'likedTracks'
interface SyncOptions {
  from?: SyncStep
  through?: SyncStep
  /** 最后一步压着，前面的照常返回；不给就是全部放出。 */
  until?: Promise<void>
  /** 同步途中释放后还要停在另一处，或同模块的前后台请求需要按参数区分。 */
  holds?: Partial<Record<SyncStep, { until: Promise<void>, when?: Record<string, unknown> }>>
  playlists?: string
  albums?: string
}

/** 每个测试文件绑定自己的世界和原来的歌单录制；同步的准备顺序只在 replyLibrary 写一份。 */
export const listener = (world: World, { playlists = PLAYLISTS_WITHOUT_POEMS } = {}) => {
  /** 从第 since 次调用起调过的网易云，不算后台同步曲库的。 */
  const sessionCalls = (since = 0) => world.netease.calls.slice(since).filter(call => !LIBRARY_SYNC_MODULES.has(call.module))
  const sessionModules = () => sessionCalls().map(call => call.module)

  const replyLibrary = async ({ from = 'hearts', through = 'likedTracks', until, holds = {}, playlists: list = playlists, albums = COLLECTED_ALBUMS }: SyncOptions = {}): Promise<void> => {
    const steps: [SyncStep, string][] = [
      ['hearts', HEARTS],
      ['playlists', list],
      ['albums', albums],
      ['artists', COLLECTED_ARTISTS],
      ['likedTracks', LIKED_TRACK_IDS],
    ]
    const first = steps.findIndex(([step]) => step === from)
    const last = steps.findIndex(([step]) => step === through)
    for (const [step, fixture] of steps.slice(first, last + 1)) {
      await world.netease.reply(fixture, holds[step] ?? {
        until: step === through
          ? until
          : undefined,
      })
    }
  }

  const replyLikedSongs = async (): Promise<void> => {
    for (const page of [1, 2, 3, 4, 5])
      await world.netease.reply(likedPage(page))
  }

  const replyPlaylists = async (recordings: readonly RecordedPlaylist[], { rejected, rejection }: { rejected?: string, rejection?: string } = {}): Promise<void> => {
    for (const playlist of recordings) {
      await world.netease.reply(playlist.detail)
      for (const page of playlist.pages) {
        await world.netease.reply(page.fixture === rejected
          ? rejection!
          : page.fixture)
      }
    }
  }

  /** 登录，第一步红心还在路上（不需要曲库的歌词、每日推荐、搜索）。 */
  const signInAtHearts = async (device: Device): Promise<Tab> => {
    const tab = await device.open()
    await replyLibrary({
      through: 'hearts',
      until: never(),
    })
    await signIn(world, tab.app)
    return tab
  }

  /** 红心、歌单列表、收藏已显示；我喜欢的音乐的编号仍在路上。 */
  const signInAtLikedTracks = async (device: Device, { albums = COLLECTED_ALBUMS, until = never() } = {}): Promise<Tab> => {
    const tab = await device.open()
    await replyLibrary({ albums, until })
    await signIn(world, tab.app)
    await world.settle()
    return tab
  }

  /** 我喜欢的音乐已取全，下一张歌单的编号仍在路上。 */
  const signInWithLiked = async (device: Device): Promise<Tab> => {
    const tab = await device.open()
    await replyLibrary()
    await replyLikedSongs()
    await world.netease.reply(LIKED_TRACK_IDS, {
      until: never(),
    })
    await signIn(world, tab.app)
    await world.settle()
    if (!tab.app.state.library?.liked?.complete)
      throw new Error('我喜欢的音乐没同步完')
    return tab
  }

  /** 整个曲库已同步；按原列表挑 before 的详情，不把 deleted 的列表换成 before。 */
  const signInSynced = async (device: Device): Promise<Tab> => {
    const tab = await device.open()
    await replyLibrary()
    await replyLikedSongs()
    const { outcome } = await loadFixture(playlists)
    const list = (outcome.response.body as { playlist: { id: number }[] }).playlist
    const before = await recordedBatch('before')
    await replyPlaylists(list.flatMap(({ id }) => before.playlists.find(item => item.id === id) ?? []))
    await signIn(world, tab.app)
    await world.settle()
    if (tab.app.state.library?.sync.status !== 'synced')
      throw new Error(`曲库没同步完：${JSON.stringify(tab.app.state.library?.sync)}`)
    return tab
  }

  /** 同一账号再打开；给了旧 tab 就先关掉，否则是另开一个标签页。红心压着，只看本机副本。 */
  const reopen = async (device: Device, tab?: Tab, options: Omit<SyncOptions, 'from'> = {}): Promise<Tab> => {
    if (tab) {
      await world.settle()
      tab.close()
    }
    await world.netease.reply('login/user_account.vip.json')
    await replyLibrary({
      through: 'hearts',
      until: never(),
      ...options,
    })
    const opened = await device.open()
    return opened
  }

  /** 每日推荐里的 31 首歌：拿来播放、红心、加入歌单。 */
  const dailySongs = async (app: App): Promise<readonly Song[]> => {
    await world.netease.reply(DAILY)
    await app.openDaily()
    const daily = app.state.daily
    if (daily?.status !== 'shown')
      throw new Error(`每日推荐没显示：${JSON.stringify(daily)}`)
    return daily.songs
  }

  /** 原测试的 jazz 准备：只看编号/首数；是否放出那份别的歌曲信息必须由调用者明确选择。 */
  const openJazz = async (app: App, { songsHeld }: { songsHeld: boolean }): Promise<void> => {
    await world.netease.reply(JAZZ_DETAIL)
    await world.netease.reply(SOME_SONGS, {
      until: songsHeld
        ? never()
        : undefined,
    })
    const opening = app.openPlaylist(900000002)
    if (!songsHeld)
      await opening
    await world.settle()
  }

  return {
    replyLibrary,
    replyLikedSongs,
    replyPlaylists,
    signInAtHearts,
    signInAtLikedTracks,
    signInWithLiked,
    signInSynced,
    reopen,
    dailySongs,
    openJazz,
    sessionCalls,
    sessionModules,
  }
}

/** 本机副本的一项；不是 App 内部读法，是 Device.stored 的可观察结果。 */
export const storedLibrary = async (device: Device, key: string): Promise<unknown> => (await device.stored()).library.find(([name]) => name === key)?.[1]

export const storedTrackIds = async (device: Device, playlistId: number): Promise<number[] | undefined> => {
  const tracks = (await device.stored()).tracks.find(([id]) => id === playlistId)?.[1] as { trackIds: number[] } | undefined
  return tracks?.trackIds
}

export const storedPlaylistIds = async (device: Device): Promise<number[]> => {
  const playlists = await storedLibrary(device, 'playlists') as Playlist[]
  return playlists.map(playlist => playlist.id)
}

export const storedCheckIns = async (device: Device): Promise<unknown[]> => {
  const { checkIns = [] } = await device.stored()
  return checkIns.map(([, value]) => value)
}

export const checkIns = (device: Device): { songId: number, body: unknown }[] => device.requests.flatMap((request) => {
  const match = /^\/api\/songs\/(\d+)\/check-in$/.exec(request.path)
  return match
    ? [
        {
          songId: Number(match[1]),
          body: request.body,
        },
      ]
    : []
})

export const playUrlRequests = (device: Device): string[] => device.requests.flatMap(request => request.path.includes('/play-url')
  ? [request.path]
  : [])

export const current = (app: App): number | null => {
  const { queue, current } = app.state.player
  return current === null
    ? null
    : queue[current].song.id
}

export const likedSong = (app: App, id: number): Song => {
  const song = app.state.library?.liked?.songs.find(each => each.id === id)
  if (!song)
    throw new Error(`我喜欢的音乐里没有 ${id}`)
  return song
}

export const queueIds = (app: App) => app.state.player.queue.map(entry => entry.song.id)

/** 同步请求，不含登录、账号和专辑/歌手页。 */
export const isSync = (request: SentRequest) => ['/api/albums', '/api/artists'].includes(request.path) || ['/api/hearts', '/api/playlists', '/api/songs'].some(path => request.path.startsWith(path))
export const syncRequests = (device: Device) => device.requests.filter(isSync)
export const songPages = (device: Device) => syncRequests(device).filter(request => request.path === '/api/songs').map(request => (request.body as { ids: number[] }).ids)
export const trackIdRequests = (device: Device) => syncRequests(device).flatMap(request => request.path.match(/^\/api\/playlists\/(\d+)\/track-ids$/)?.[1] ?? []).map(Number)
