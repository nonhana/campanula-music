import type { Account } from '$lib/api/account'
import type { HeartsResponse, Playlist, PlaylistsResponse, Song, SongsRequest, SongsResponse, TrackIdsResponse } from '$lib/api/library'
import type { Api, RequestFailure, Result } from './api'
import type { LocalDb, Replica } from './local'
import type { BackgroundLane, Waiting } from './pacing'
import { SONGS_PER_REQUEST } from '$lib/api/library'

// 曲库副本和同步（Spec #11“客户端：曲库副本”，ADR-0007）：登录后先显示本机副本，再在后台和网易云同步。
// 这一版同步红心状态、歌单列表和我喜欢的音乐；其他歌单的曲目由 #22 加上。
// 同步一步一步来：红心 → 歌单列表 → 我喜欢的音乐的曲目编号 → 歌曲信息一页一页（每页最多 1,000 首），
// 同时只有一个同步请求在路上，同一页不会同时请求两次

/** 同步没成功的原因（需要登录另外处理：整个 App 变成登录失效） */
export type SyncFailure = Exclude<RequestFailure, { kind: 'needsLogin' | 'rateLimited' | 'offline' }>

export type SyncStatus
  /** 有一个同步请求在路上 */
  = | { status: 'syncing' }
  /** 网易云说操作频繁：到 until（毫秒）再接着同步 */
    | { status: 'rateLimited', until: number }
  /** 断网了：联网后接着同步 */
    | { status: 'offline' }
  /** 没同步完，停下了：已经同步的部分照常显示，可以重试 */
    | { status: 'failed', failure: SyncFailure }
  /** 和网易云一致了 */
    | { status: 'synced' }

/** 我喜欢的音乐 */
export interface LikedMusic {
  playlist: Playlist
  /** 已经有歌曲信息的歌，按歌单里的顺序；首次同步时一页一页地多起来 */
  songs: readonly Song[]
  /** 一共几首：拿到曲目编号后是编号数，之前是网易云写的歌曲数（会少几首，#21 留言） */
  total: number
}

/** 界面看到的曲库 */
export interface LibraryState {
  /** 歌单列表：首次同步还没拿到时是 null */
  playlists: readonly Playlist[] | null
  /** 红心了的歌：首次同步还没拿到时是 null */
  hearts: ReadonlySet<number> | null
  /** 歌单列表还没拿到时是 null */
  liked: LikedMusic | null
  sync: SyncStatus
}

export interface LibraryContext {
  api: Api
  lane: BackgroundLane
  local: LocalDb
  /** 曲库变了（同步拿到了新的部分、同步的状态变了） */
  write: (library: LibraryState) => void
  /** 同步时网易云说需要登录，续期也没成功 */
  loginExpired: () => void
}

export interface Library {
  /** 登录了：拿出这个账号的本机副本（别的账号的清掉）。返回要显示的曲库，然后调 sync() */
  enter: (account: Account) => Promise<LibraryState>
  /** 在后台和网易云同步 */
  sync: () => void
  /** 同步没成功时重试：从停下的地方接着来 */
  retry: () => void
  /** 退出、登录失效：停下同步。本机副本留着，退出时由 App 另外删 */
  leave: () => void
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))
}

function stateOf(replica: Replica, sync: SyncStatus): LibraryState {
  const playlist = replica.playlists?.find(item => item.kind === 'liked')
  const tracks = playlist && replica.tracks.get(playlist.id)
  return {
    playlists: replica.playlists,
    hearts: replica.hearts && new Set(replica.hearts),
    liked: playlist
      ? {
          playlist,
          songs: tracks ? tracks.trackIds.flatMap(id => replica.songs.get(id) ?? []) : [],
          total: tracks ? tracks.trackIds.length : playlist.trackCount,
        }
      : null,
    sync,
  }
}

function waitingStatus(waiting: Waiting): SyncStatus {
  return waiting.reason === 'rateLimited' ? { status: 'rateLimited', until: waiting.until } : { status: 'offline' }
}

export function createLibrary(context: LibraryContext): Library {
  const { api, lane, local } = context
  /** 显示着的副本；没登录时是 null */
  let replica: Replica | null = null
  let status: SyncStatus = { status: 'synced' }
  /** 每进出一次就加一：上一轮同步回来的结果，代数对不上就不要 */
  let generation = 0
  /** 正在跑的同步。新的一轮等上一轮了结再开始，所以同一时间只有一轮在发请求 */
  let running: Promise<void> = Promise.resolve()

  function publish(next: SyncStatus = status): void {
    status = next
    if (replica)
      context.write(stateOf(replica, status))
  }

  /** 发一个同步请求。没成功就停下同步、返回 null；这一轮同步已经作废时也返回 null */
  async function request<T>(mine: number, send: () => Promise<Result<T>>): Promise<T | null> {
    const result = await lane.send(send, (waiting) => {
      if (mine === generation)
        publish(waiting ? waitingStatus(waiting) : { status: 'syncing' })
    })
    if (mine !== generation)
      return null
    if (result.ok)
      return result.value
    if (result.failure.kind === 'needsLogin')
      context.loginExpired()
    else
      publish({ status: 'failed', failure: result.failure })
    return null
  }

  /**
   * 这一轮同步还算数时，先写进本机副本，再改显示着的；作废了（退出、登录失效、换账号）就什么都不写。
   * 检查和开事务在同一步里（数据库打开后 LocalDb 当场开事务），退出时删副本的事务一定排在后面，不会被它写回去
   */
  async function save(mine: number, write: () => Promise<void>, apply: () => void): Promise<boolean> {
    if (mine !== generation)
      return false
    await write()
    if (mine !== generation)
      return false
    apply()
    publish()
    return true
  }

  async function syncLiked(mine: number, current: Replica, playlist: Playlist): Promise<boolean> {
    let tracks = current.tracks.get(playlist.id)
    if (tracks?.version !== playlist.tracksUpdatedAt) {
      const fetched = await request(mine, () => api.get<TrackIdsResponse>(`/api/playlists/${playlist.id}/track-ids`))
      const next = fetched && { version: playlist.tracksUpdatedAt, trackIds: fetched.trackIds, complete: false }
      if (!next || !await save(mine, () => local.saveTracks(playlist.id, next), () => current.tracks.set(playlist.id, next)))
        return false
      tracks = next
    }
    if (tracks.complete)
      return true
    const missing = tracks.trackIds.filter(id => !current.songs.has(id))
    for (const ids of chunks(missing, SONGS_PER_REQUEST)) {
      const page = await request(mine, () => api.post<SongsResponse>('/api/songs', { ids } satisfies SongsRequest))
      if (!page || !await save(mine, () => local.saveSongs(page.songs), () => page.songs.forEach(song => current.songs.set(song.id, song))))
        return false
    }
    const done = { ...tracks, complete: true }
    return save(mine, () => local.saveTracks(playlist.id, done), () => current.tracks.set(playlist.id, done))
  }

  async function run(mine: number): Promise<void> {
    const current = replica
    if (mine !== generation || !current)
      return
    publish({ status: 'syncing' })
    const hearts = await request(mine, () => api.get<HeartsResponse>(`/api/hearts?uid=${current.owner}`))
    if (!hearts || !await save(mine, () => local.saveHearts(hearts.songIds), () => (current.hearts = hearts.songIds)))
      return
    const list = await request(mine, () => api.get<PlaylistsResponse>(`/api/playlists?uid=${current.owner}`))
    if (!list || !await save(mine, () => local.savePlaylists(list.playlists), () => (current.playlists = list.playlists)))
      return
    const liked = list.playlists.find(playlist => playlist.kind === 'liked')
    if (liked && !await syncLiked(mine, current, liked))
      return
    publish({ status: 'synced' })
  }

  function start(): void {
    const mine = generation
    running = running.then(() => run(mine))
  }

  return {
    async enter(account) {
      generation += 1
      const mine = generation
      const stored = await local.readLibrary()
      const shown: Replica = stored?.owner === account.id
        ? stored
        : { owner: account.id, hearts: null, playlists: null, tracks: new Map(), songs: new Map() }
      if (shown !== stored && mine === generation)
        await local.resetLibrary(account.id)
      if (mine === generation) {
        replica = shown
        status = { status: 'syncing' }
        lane.resume()
      }
      return stateOf(shown, status)
    },
    sync: start,
    retry() {
      if (status.status !== 'failed')
        return
      publish({ status: 'syncing' })
      start()
    },
    leave() {
      generation += 1
      replica = null
      lane.stop()
    },
  }
}
