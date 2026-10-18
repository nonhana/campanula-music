import type { Account } from '#lib/api/account.js'
import type { AlbumResponse, ArtistAlbum, ArtistAlbumsResponse, ArtistResponse, CollectedAlbum, CollectedAlbumsResponse, CollectedArtist, CollectedArtistsResponse, HeartsResponse, Playlist, PlaylistInfo, PlaylistPageResponse, PlaylistsResponse, PlaylistUnavailable, Song, SongsRequest, SongsResponse, TrackIdsResponse } from '#lib/api/library.js'
import type { Api, RequestFailure, Result } from './api'
import type { LocalDb, PlaylistTracks, Replica } from './local'
import type { BackgroundLane, Waiting } from './pacing'
import { SONGS_PER_REQUEST } from '#lib/api/library.js'

// 曲库副本和同步（Spec #11“客户端：曲库副本”，ADR-0007）：登录后先显示本机副本，再在后台和网易云同步。
// 同步一步一步来：红心 → 歌单列表 → 收藏的专辑 → 收藏的歌手 → 每张歌单（我喜欢的音乐在最前，然后按歌单列表的顺序）。
// 一张歌单：更新时间和本机的对不上才重拉全部曲目编号，再一页一页（每页最多 1,000 首）取还没有的歌曲信息。
// 后台同步同时只有一个请求在路上，同一页不会同时请求两次。
// 听众打开一张还没同步全的歌单时，拉这张歌单的请求马上发（前台请求，不经过后台的节奏）；
// 同一张歌单同时只有一处在拉，后台同步轮到它时等那边拉完，不重拉。
// 在网易云里删掉的歌单，拿到歌单列表时就从本机副本里删掉。
// 专辑页、歌手页是听众打开时用前台请求拉的（#23 留言）：专辑页一张一个请求，连着取会被网易云说操作频繁，所以不在后台整批同步；
// 收藏的专辑打开过就存进本机副本，断网也能看，不再收藏时删掉。歌手页是网易云对这位歌手的介绍，不是曲库，只在这次登录期间记着。
// 不在曲库里的歌单（别人的歌单，#56）每次打开都联网取，不存进本机副本，收藏了才进（ADR-0007）：打开过的只在这次登录期间记着。

/** 同步没成功的原因（需要登录另外处理：整个 App 变成登录失效） */
export type SyncFailure = Exclude<RequestFailure, { kind: 'needsLogin' | 'rateLimited' | 'offline' }>

/** 打开歌单时没拉成的原因：前台请求不等，断网、操作频繁都直接说 */
export type OpenFailure = Exclude<RequestFailure, { kind: 'needsLogin' }>

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

/** 一张歌单在本机的样子；不在曲库里的歌单（P 是 PlaylistInfo）是打开时联网取到的样子 */
export interface PlaylistSongs<P = Playlist> {
  playlist: P
  /** 已经有歌曲信息的歌，按歌单里的顺序；同步时一页一页地多起来 */
  songs: readonly Song[]
  /** 一共几首：拿到曲目编号后是编号数，之前是网易云写的歌曲数（我喜欢的音乐的会少几首，#21 留言） */
  total: number
  /** 每首歌的信息都取过一遍了：网易云没给的歌（比如已经下架）不在 songs 里，所以 songs 可能比 total 少几首 */
  complete: boolean
}

/** 听众打开的歌单还没同步全：正在用前台请求拉，或者没拉成 */
export type PlaylistOpening
  = | { status: 'loading' }
    | { status: 'failed', failure: OpenFailure }

/** 专辑页、歌手页拉到哪了 */
export type PageState<T>
  = | { status: 'loading' }
  /** 一点内容都还没有就没拉成：说明原因，再打开一次就是重试 */
    | { status: 'failed', failure: OpenFailure }
    | { status: 'shown', content: T }

/** 歌手页后面还有专辑：还没取、正在取、没取成（再取一次就是重试） */
export type MoreAlbums
  = | { status: 'notLoaded' }
    | { status: 'loading' }
    | { status: 'failed', failure: OpenFailure }

export interface ArtistPage {
  artist: ArtistResponse['artist']
  hotSongs: readonly Song[]
  /** 已经取到的专辑，新的在前 */
  albums: readonly ArtistAlbum[]
  /** 后面的专辑；都取到了是 null */
  moreAlbums: MoreAlbums | null
}

/** 不在曲库里的歌单（界面上的类别写“网易云歌单”）：已经取到的歌，和其余的歌取到哪了 */
export interface NeteasePlaylistSongs extends PlaylistSongs<PlaylistInfo> {
  /** 其余的歌正在取、或者没取成（再打开一次就是重试）；都取过了是 null */
  more: PlaylistOpening | null
}

/** 不在曲库里的歌单拉到哪了；打不开（已删除、不存在、别人的隐私歌单）时说明原因 */
export type NeteasePlaylistPage = PageState<NeteasePlaylistSongs> | { status: 'unavailable', reason: PlaylistUnavailable }

/** 界面看到的曲库 */
export interface LibraryState {
  /** 歌单列表：首次同步还没拿到时是 null */
  playlists: readonly Playlist[] | null
  /** 红心了的歌：首次同步还没拿到时是 null */
  hearts: ReadonlySet<number> | null
  /** 我喜欢的音乐；歌单列表还没拿到时是 null */
  liked: PlaylistSongs | null
  /** 收藏的专辑：首次同步还没拿到时是 null */
  albums: readonly CollectedAlbum[] | null
  /** 收藏的歌手：首次同步还没拿到时是 null */
  artists: readonly CollectedArtist[] | null
  /** 歌单列表里的这张歌单；不在列表里（还没拿到列表、在网易云里删掉了）时是 null。按调用时的本机副本算 */
  songsOf: (playlistId: number) => PlaylistSongs | null
  /** 听众打开的、还没同步全的歌单拉到哪了；拉完了就不在里面 */
  opening: ReadonlyMap<number, PlaylistOpening>
  /** 专辑页：收藏的专辑打开过就在本机副本里（断网也能看），别的专辑只在这次登录期间记着；没打开过是 null */
  albumPage: (albumId: number) => PageState<AlbumResponse> | null
  /** 歌手页：只在这次登录期间记着，不存在本机；没打开过是 null */
  artistPage: (artistId: number) => PageState<ArtistPage> | null
  /** 不在曲库里的歌单：打开过的只在这次登录期间记着，不存在本机；没打开过是 null */
  neteasePlaylist: (playlistId: number) => NeteasePlaylistPage | null
  sync: SyncStatus
}

/** 歌单内搜索的结果 */
export interface PlaylistSearch {
  /** 歌名、歌手或专辑里有搜索词的歌，按歌单里的顺序 */
  songs: readonly Song[]
  /** 歌单还没同步全：还没同步到的歌里可能也有，结果可能不全 */
  incomplete: boolean
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
  /**
   * 听众打开一张歌单：本机还没有它最新、完整的曲目，就马上用前台请求拉；没拉成时再调一次就是重试。
   * 歌单列表里没有的（不在曲库里的歌单）每次打开都联网取，见 openNetease
   */
  open: (playlistId: number) => Promise<void>
  /**
   * 听众打开一张专辑：这次登录还没拉过就用前台请求拉。收藏的专辑打开过就存在本机：
   * 歌曲数和收藏的专辑列表里的一样就直接显示存着的、不拉；不一样就先显示存着的，拉到了换成新的，没拉成也照样显示存着的。
   * 没拉成时再调一次就是重试
   */
  openAlbum: (albumId: number) => Promise<void>
  /** 听众打开一位歌手：这次登录还没拉过就用前台请求拉头部、热门歌曲和第一页专辑。没拉成时再调一次就是重试 */
  openArtist: (artistId: number) => Promise<void>
  /** 歌手页取后面的一页专辑；没取成时再调一次就是重试 */
  moreArtistAlbums: (artistId: number) => Promise<void>
  /** 退出、登录失效：停下同步。本机副本留着，退出时由 App 另外删 */
  leave: () => void
}

/** 一个同步请求的结果；null：这一轮已经作废（退出、登录失效、换账号），什么都不用做 */
type Outcome<T, F> = { ok: true, value: T } | { ok: false, failure: F } | null

/** 拉一张歌单的结果 */
type Pulled = Outcome<void, OpenFailure>

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))
}

/** 本机已经有这张歌单最新、完整的曲目 */
function upToDate(replica: Replica, playlist: Playlist): boolean {
  const tracks = replica.tracks.get(playlist.id)
  return tracks?.version === playlist.tracksUpdatedAt && tracks.complete
}

/** 后台请求经过后台通道，断网、操作频繁在那里等过、重发过；只有前台请求会因为它们失败 */
function isSyncFailure(failure: OpenFailure): failure is SyncFailure {
  return failure.kind !== 'offline' && failure.kind !== 'rateLimited'
}

/** 同步时内容网易云不认、SDK 认不出：跳过这一项接着同步别的，最后说没同步完；连不上、出错就停下 */
function skippable(failure: SyncFailure): boolean {
  switch (failure.kind) {
    case 'upstreamChanged':
    case 'rejected':
      return true
    case 'unreachable':
    case 'serverError':
    case 'neteaseUnavailable':
    case 'cookieSecretMissing':
      return false
    default: {
      const unhandled: never = failure
      throw new Error(`不认识的同步失败：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 这次登录打开过的专辑页、歌手页、不在曲库里的歌单 */
interface Pages {
  albums: ReadonlyMap<number, PageState<AlbumResponse>>
  artists: ReadonlyMap<number, PageState<ArtistPage>>
  playlists: ReadonlyMap<number, NeteasePlaylistPage>
}

function songsOf(replica: Replica, playlist: Playlist): PlaylistSongs {
  const tracks = replica.tracks.get(playlist.id)
  return {
    playlist,
    songs: tracks ? tracks.trackIds.flatMap(id => replica.songs.get(id) ?? []) : [],
    total: tracks ? tracks.trackIds.length : playlist.trackCount,
    complete: tracks?.complete ?? false,
  }
}

function stateOf(replica: Replica, sync: SyncStatus, opening: ReadonlyMap<number, PlaylistOpening>, pages: Pages): LibraryState {
  const playlists = new Map(replica.playlists?.map(playlist => [playlist.id, playlist]))
  // 几十张歌单、上万首：界面看哪张才算哪张
  const computed = new Map<number, PlaylistSongs | null>()
  const songsOfPlaylist = (playlistId: number): PlaylistSongs | null => {
    if (!computed.has(playlistId)) {
      const playlist = playlists.get(playlistId)
      computed.set(playlistId, playlist ? songsOf(replica, playlist) : null)
    }
    return computed.get(playlistId) ?? null
  }
  const liked = replica.playlists?.find(playlist => playlist.kind === 'liked')
  const stored = new Map(replica.albumPages)
  const albumPages = new Map(pages.albums)
  const artistPages = new Map(pages.artists)
  const neteasePages = new Map(pages.playlists)
  return {
    playlists: replica.playlists,
    hearts: replica.hearts && new Set(replica.hearts),
    liked: liked ? songsOfPlaylist(liked.id) : null,
    albums: replica.albums,
    artists: replica.artists,
    songsOf: songsOfPlaylist,
    opening: new Map(opening),
    albumPage: (albumId) => {
      const content = stored.get(albumId)
      return albumPages.get(albumId) ?? (content ? { status: 'shown', content } : null)
    },
    artistPage: artistId => artistPages.get(artistId) ?? null,
    neteasePlaylist: playlistId => neteasePages.get(playlistId) ?? null,
    sync,
  }
}

/** 搜索时不分大小写和全角半角：“ＤＪ”和“dj”一样 */
function folded(text: string): string {
  return text.normalize('NFKC').toLowerCase()
}

/** 歌单内搜索：在本机副本（不在曲库里的歌单是打开时取到的歌）里即时完成 */
export function searchPlaylist(playlist: PlaylistSongs<unknown>, query: string): PlaylistSearch {
  const term = folded(query.trim())
  const matches = (text: string | null) => text !== null && folded(text).includes(term)
  return {
    songs: playlist.songs.filter(song => matches(song.name) || matches(song.album.name) || song.artists.some(artist => matches(artist.name))),
    incomplete: !playlist.complete,
  }
}

/** 点歌、歌单内搜索、补上还没同步的歌（规则⑫）时的这张歌单：曲库里的看本机副本，不在曲库里的看打开时取到的；都还没有是 null */
export function playlistSongsOf(library: LibraryState, playlistId: number): PlaylistSongs<PlaylistInfo> | null {
  const page = library.neteasePlaylist(playlistId)
  return library.songsOf(playlistId) ?? (page?.status === 'shown' ? page.content : null)
}

function waitingStatus(waiting: Waiting): SyncStatus {
  switch (waiting.reason) {
    case 'rateLimited':
      return { status: 'rateLimited', until: waiting.until }
    case 'offline':
      return { status: 'offline' }
    default: {
      const unhandled: never = waiting
      throw new Error(`不认识的等待原因：${JSON.stringify(unhandled)}`)
    }
  }
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
  /**
   * 正在拉的歌单：拉的是哪个版本（tracksUpdatedAt）、拉完的结果。同一张歌单同时只有一处在拉，后台同步和听众打开共用；
   * 打开时用的可能是本机旧的歌单列表，版本不同的要等它拉完再拉
   */
  const pulling = new Map<number, { version: number, job: Promise<Pulled> }>()
  /** 听众打开着、要马上拉的歌单：拉它的请求不经过后台的节奏 */
  const urgent = new Set<number>()
  /** 拉歌单时正在后台通道里等着的请求：听众打开这张歌单时叫它别等了，改成前台请求马上发 */
  const waiting = new Map<number, AbortController>()
  let opening = new Map<number, PlaylistOpening>()
  /** 这次登录打开过的专辑页（本机存着、这次还没拉的不在这里）、歌手页、不在曲库里的歌单 */
  const pages = { albums: new Map<number, PageState<AlbumResponse>>(), artists: new Map<number, PageState<ArtistPage>>(), playlists: new Map<number, NeteasePlaylistPage>() }
  /** 正在拉的专辑页：本机存着的专辑页拉的时候照常显示存着的，不记成加载中，所以另外记 */
  const fetchingAlbums = new Set<number>()
  /** 正在联网取的不在曲库里的歌单：打开过的再打开时照常显示记着的，所以另外记 */
  const fetchingPlaylists = new Set<number>()
  /** 不在曲库里的歌单取到的歌曲信息：这次登录期间记着（不存本机），再打开时只取还没有的 */
  const neteaseSongs = new Map<number, Song>()

  function publish(next: SyncStatus = status): void {
    status = next
    if (replica)
      context.write(stateOf(replica, status, opening, pages))
  }

  /** 请求回来了：这一轮已经作废时不要结果；网易云说需要登录（续期也没成功）时整个 App 变成登录失效 */
  function settle<T, F extends RequestFailure>(mine: number, result: { ok: true, value: T } | { ok: false, failure: F }): Outcome<T, Exclude<F, { kind: 'needsLogin' }>> {
    if (mine !== generation)
      return null
    if (result.ok)
      return result
    if (result.failure.kind === 'needsLogin') {
      context.loginExpired()
      return null
    }
    return { ok: false, failure: result.failure as Exclude<F, { kind: 'needsLogin' }> }
  }

  /** 发一个后台请求：经过后台通道（操作频繁、断网时等着再发）。giveUp 了就不发，返回 'gaveUp' */
  async function background<T>(mine: number, send: () => Promise<Result<T>>, giveUp?: AbortSignal): Promise<Outcome<T, SyncFailure> | 'gaveUp'> {
    const result = await lane.send(send, (waitingFor) => {
      if (mine === generation)
        publish(waitingFor ? waitingStatus(waitingFor) : { status: 'syncing' })
    }, giveUp)
    return result ? settle(mine, result) : 'gaveUp'
  }

  /**
   * 拉歌单时的一个请求：听众打开着这张歌单就马上发（前台请求）；否则是后台请求，
   * 在后台通道里等着的时候听众打开了它，就不再等，改成马上发
   */
  async function playlistRequest<T>(mine: number, playlistId: number, send: () => Promise<Result<T>>): Promise<Outcome<T, OpenFailure>> {
    if (!urgent.has(playlistId)) {
      const giveUp = new AbortController()
      waiting.set(playlistId, giveUp)
      const result = await background(mine, send, giveUp.signal).finally(() => waiting.delete(playlistId))
      if (result !== 'gaveUp')
        return result
      if (mine !== generation)
        return null
    }
    return settle(mine, await send())
  }

  /**
   * 这一轮同步还算数时，先写进本机副本，再改显示着的；作废了（退出、登录失效、换账号）就什么都不写。
   * 检查和开事务在同一步里（数据库打开后 LocalDb 当场开事务），本标签页退出时删副本的事务一定排在后面。
   * 别的标签页退出删了副本、或换了账号时，LocalDb 在写的事务里核对副本的主人，对不上就不写：这一轮停下，
   * 退出的那个标签页会广播过来（App 跟着变成未登录）
   */
  async function save(mine: number, write: () => Promise<boolean>, apply: () => void): Promise<boolean> {
    if (mine !== generation || !await write() || mine !== generation)
      return false
    apply()
    publish()
    return true
  }

  /** 把一张歌单拉到和网易云一致：更新时间变了才重拉曲目编号，再取还没有的歌曲信息 */
  async function pull(mine: number, current: Replica, playlist: Playlist): Promise<Pulled> {
    const { id } = playlist
    /** 拉的时候新的歌单列表到了，这张已经在网易云里删掉：不再往本机写它的曲目（列表到的时候已经删过了） */
    const deleted = () => current.playlists !== null && !current.playlists.some(item => item.id === id)
    const saveTracks = (tracks: PlaylistTracks) => save(mine, () => local.saveTracks(current.owner, id, tracks), () => {
      current.tracks.set(id, tracks)
      // 拉完了：之前打开时没拉成的说明不再显示
      if (tracks.complete)
        opening.delete(id)
    })

    let tracks = current.tracks.get(id)
    if (tracks?.version !== playlist.tracksUpdatedAt) {
      const fetched = await playlistRequest(mine, id, () => api.get<TrackIdsResponse>(`/api/playlists/${id}/track-ids`))
      if (!fetched?.ok)
        return fetched
      const next: PlaylistTracks = { version: playlist.tracksUpdatedAt, trackIds: fetched.value.trackIds, complete: false }
      if (deleted())
        return { ok: true, value: undefined }
      if (!await saveTracks(next))
        return null
      tracks = next
    }
    if (tracks.complete)
      return { ok: true, value: undefined }
    const missing = tracks.trackIds.filter(songId => !current.songs.has(songId))
    for (const ids of chunks(missing, SONGS_PER_REQUEST)) {
      const page = await playlistRequest(mine, id, () => api.post<SongsResponse>('/api/songs', { ids } satisfies SongsRequest))
      if (!page?.ok)
        return page
      if (!await save(mine, () => local.saveSongs(current.owner, page.value.songs), () => page.value.songs.forEach(song => current.songs.set(song.id, song))))
        return null
    }
    if (deleted())
      return { ok: true, value: undefined }
    return await saveTracks({ ...tracks, complete: true }) ? { ok: true, value: undefined } : null
  }

  /** 拉一张歌单；同一个版本已经有一处在拉（后台同步、听众打开）就等它，不重拉；拉的是别的版本就等它拉完再拉这个 */
  function load(mine: number, current: Replica, playlist: Playlist): Promise<Pulled> {
    const { id, tracksUpdatedAt: version } = playlist
    const existing = pulling.get(id)
    if (existing?.version === version)
      return existing.job
    const before = existing?.job.catch(() => null) ?? Promise.resolve(null)
    const job: Promise<Pulled> = before.then(() => pull(mine, current, playlist)).finally(() => {
      // 退出、换账号时已经清掉了，那之后开始的拉取不归它管
      if (pulling.get(id)?.job === job) {
        pulling.delete(id)
        urgent.delete(id)
      }
    })
    pulling.set(id, { version, job })
    return job
  }

  /** 后台同步一张歌单。听众打开它时前台请求没拉成（断网、操作频繁）：后台照常排队，等联网、等到时间再拉 */
  async function syncPlaylist(mine: number, current: Replica, playlist: Playlist): Promise<Outcome<void, SyncFailure>> {
    for (;;) {
      const result = await load(mine, current, playlist)
      if (!result || result.ok)
        return result
      if (isSyncFailure(result.failure))
        return { ok: false, failure: result.failure }
    }
  }

  /**
   * 同步收藏的专辑或歌手的列表：一个请求拿全，存进本机副本。返回 'synced'：存好了；
   * 返回同步失败：内容网易云不认、SDK 认不出，跳过它接着同步别的；null：这一轮作废了，或者停下了（已经说明了原因）
   */
  async function syncCollected<T>(mine: number, path: string, write: (value: T) => Promise<boolean>, apply: (value: T) => void): Promise<'synced' | SyncFailure | null> {
    const fetched = await background(mine, () => api.get<T>(path))
    if (!fetched || fetched === 'gaveUp')
      return null
    if (fetched.ok)
      return await save(mine, () => write(fetched.value), () => apply(fetched.value)) ? 'synced' : null
    if (skippable(fetched.failure))
      return fetched.failure
    publish({ status: 'failed', failure: fetched.failure })
    return null
  }

  async function run(mine: number): Promise<void> {
    const current = replica
    if (mine !== generation || !current)
      return
    publish({ status: 'syncing' })
    const hearts = await background(mine, () => api.get<HeartsResponse>(`/api/hearts?uid=${current.owner}`))
    if (!hearts || hearts === 'gaveUp')
      return
    if (!hearts.ok)
      return publish({ status: 'failed', failure: hearts.failure })
    if (!await save(mine, () => local.saveHearts(current.owner, hearts.value.songIds), () => (current.hearts = hearts.value.songIds)))
      return
    const list = await background(mine, () => api.get<PlaylistsResponse>(`/api/playlists?uid=${current.owner}`))
    if (!list || list === 'gaveUp')
      return
    if (!list.ok)
      return publish({ status: 'failed', failure: list.failure })
    const { playlists } = list.value
    const kept = new Set(playlists.map(playlist => playlist.id))
    const removeDeleted = () => {
      current.playlists = playlists
      for (const map of [current.tracks, opening]) {
        for (const id of map.keys()) {
          if (!kept.has(id))
            map.delete(id)
        }
      }
    }
    if (!await save(mine, () => local.savePlaylists(current.owner, playlists), removeDeleted))
      return

    const albums = await syncCollected<CollectedAlbumsResponse>(mine, '/api/albums', value => local.saveCollectedAlbums(current.owner, value.albums), (value) => {
      current.albums = value.albums
      // 不再收藏的专辑：存着的专辑页一起删（本机数据库在同一个事务里删了）
      const collected = new Set(value.albums.map(album => album.id))
      for (const id of current.albumPages.keys()) {
        if (!collected.has(id))
          current.albumPages.delete(id)
      }
    })
    if (!albums)
      return
    const artists = await syncCollected<CollectedArtistsResponse>(mine, '/api/artists', value => local.saveCollectedArtists(current.owner, value.artists), value => (current.artists = value.artists))
    if (!artists)
      return

    // 跳过了的（skippable）：别的照常同步，最后说没同步完
    let skipped = [albums, artists].find((result): result is SyncFailure => result !== 'synced') ?? null
    for (const playlist of playlists) {
      const result = await syncPlaylist(mine, current, playlist)
      if (!result)
        return
      if (result.ok)
        continue
      if (!skippable(result.failure))
        return publish({ status: 'failed', failure: result.failure })
      skipped ??= result.failure
    }
    publish(skipped ? { status: 'failed', failure: skipped } : { status: 'synced' })
  }

  function start(): void {
    const mine = generation
    running = running.then(() => run(mine))
  }

  /**
   * 打开不在曲库里的歌单：每次打开都联网取头部和全部曲目编号，再按页取还没有的歌曲信息，取到一页就显示一页。
   * 打开过的再打开时先显示记着的，取到了换成新的；没取成也照样显示记着的，歌还没取全时说没取成。
   * 重取的这一会儿，记着的那一版取全了就照样算取全：这时点歌放的是听众看到的这一版（和曲库里的歌单一样），重取到的新歌不补进播放队列。
   * 上一次打开还在取（取几千首的歌曲信息要几秒）：它就是刚联网取的，不再取一遍。
   * 已删除、不存在、别人的隐私歌单说明打不开的原因
   */
  async function openNetease(playlistId: number): Promise<void> {
    if (fetchingPlaylists.has(playlistId))
      return
    const mine = generation
    fetchingPlaylists.add(playlistId)
    const show = (page: NeteasePlaylistPage) => {
      pages.playlists.set(playlistId, page)
      publish()
    }
    const before = pages.playlists.get(playlistId)
    const shown = before?.status === 'shown' ? before.content : null
    if (!shown)
      show({ status: 'loading' })
    else if (shown.more)
      show({ status: 'shown', content: { ...shown, more: { status: 'loading' } } })

    const fetched = settle(mine, await api.get<PlaylistPageResponse>(`/api/playlists/${playlistId}`))
    if (!fetched)
      return
    if (!fetched.ok) {
      fetchingPlaylists.delete(playlistId)
      if (!shown)
        show({ status: 'failed', failure: fetched.failure })
      else if (!shown.complete)
        show({ status: 'shown', content: { ...shown, more: { status: 'failed', failure: fetched.failure } } })
      return
    }
    const page = fetched.value
    if (page.kind === 'unavailable') {
      fetchingPlaylists.delete(playlistId)
      return show({ status: 'unavailable', reason: page.reason })
    }
    const { playlist, trackIds } = page
    const contentOf = (more: PlaylistOpening | null): NeteasePlaylistSongs => ({
      playlist,
      songs: trackIds.flatMap(id => neteaseSongs.get(id) ?? []),
      total: trackIds.length,
      complete: more === null,
      more,
    })
    for (const ids of chunks(trackIds.filter(id => !neteaseSongs.has(id)), SONGS_PER_REQUEST)) {
      show({ status: 'shown', content: contentOf({ status: 'loading' }) })
      const songs = settle(mine, await api.post<SongsResponse>('/api/songs', { ids } satisfies SongsRequest))
      if (!songs)
        return
      if (!songs.ok) {
        fetchingPlaylists.delete(playlistId)
        return show({ status: 'shown', content: contentOf({ status: 'failed', failure: songs.failure }) })
      }
      for (const song of songs.value.songs)
        neteaseSongs.set(song.id, song)
    }
    fetchingPlaylists.delete(playlistId)
    show({ status: 'shown', content: contentOf(null) })
  }

  /** 换了一轮（登录、退出、登录失效）：上一轮打开、正在拉的都不算了 */
  function forget(): void {
    pulling.clear()
    urgent.clear()
    waiting.clear()
    opening = new Map()
    pages.albums.clear()
    pages.artists.clear()
    pages.playlists.clear()
    fetchingAlbums.clear()
    fetchingPlaylists.clear()
    neteaseSongs.clear()
  }

  return {
    async enter(account) {
      generation += 1
      forget()
      const mine = generation
      const stored = await local.readLibrary()
      const shown: Replica = stored?.owner === account.id
        ? stored
        : { owner: account.id, hearts: null, playlists: null, tracks: new Map(), songs: new Map(), albums: null, artists: null, albumPages: new Map() }
      if (shown !== stored && mine === generation)
        await local.resetLibrary(account.id)
      if (mine === generation) {
        replica = shown
        status = { status: 'syncing' }
        lane.resume()
      }
      return stateOf(shown, status, opening, pages)
    },
    sync: start,
    retry() {
      if (status.status !== 'failed')
        return
      publish({ status: 'syncing' })
      start()
    },
    async open(playlistId) {
      const current = replica
      if (!current?.playlists)
        return
      const playlist = current.playlists.find(item => item.id === playlistId)
      if (!playlist)
        return openNetease(playlistId)
      if (upToDate(current, playlist))
        return
      const mine = generation
      urgent.add(playlistId)
      waiting.get(playlistId)?.abort()
      opening.set(playlistId, { status: 'loading' })
      publish()
      const result = await load(mine, current, playlist)
      if (!result || mine !== generation)
        return
      if (result.ok)
        opening.delete(playlistId)
      else
        opening.set(playlistId, { status: 'failed', failure: result.failure })
      publish()
    },
    async openAlbum(albumId) {
      const current = replica
      if (!current || fetchingAlbums.has(albumId) || pages.albums.get(albumId)?.status === 'shown')
        return
      const mine = generation
      const stored = current.albumPages.get(albumId)
      // 存着的就是现在的样子（收藏的专辑列表每次同步都拿新的）：不拉
      if (stored && stored.album.songCount === current.albums?.find(album => album.id === albumId)?.songCount)
        return
      fetchingAlbums.add(albumId)
      if (!stored) {
        pages.albums.set(albumId, { status: 'loading' })
        publish()
      }
      const result = settle(mine, await api.get<AlbumResponse>(`/api/albums/${albumId}`))
      if (!result)
        return
      fetchingAlbums.delete(albumId)
      if (!result.ok) {
        // 本机存着的照常显示，不说没拉成
        if (!stored) {
          pages.albums.set(albumId, { status: 'failed', failure: result.failure })
          publish()
        }
        return
      }
      const page = result.value
      pages.albums.set(albumId, { status: 'shown', content: page })
      publish()
      if (current.albums?.some(album => album.id === albumId))
        await save(mine, () => local.saveAlbumPage(current.owner, page), () => current.albumPages.set(albumId, page))
    },
    async openArtist(artistId) {
      const shown = pages.artists.get(artistId)
      if (!replica || shown?.status === 'loading' || shown?.status === 'shown')
        return
      const mine = generation
      pages.artists.set(artistId, { status: 'loading' })
      publish()
      const result = settle(mine, await api.get<ArtistResponse>(`/api/artists/${artistId}`))
      if (!result)
        return
      if (result.ok) {
        const { artist, hotSongs, albums, moreAlbums } = result.value
        pages.artists.set(artistId, { status: 'shown', content: { artist, hotSongs, albums, moreAlbums: moreAlbums ? { status: 'notLoaded' } : null } })
      }
      else {
        pages.artists.set(artistId, { status: 'failed', failure: result.failure })
      }
      publish()
    },
    async moreArtistAlbums(artistId) {
      const shown = pages.artists.get(artistId)
      if (shown?.status !== 'shown' || !shown.content.moreAlbums || shown.content.moreAlbums.status === 'loading')
        return
      const mine = generation
      const page = shown.content
      const show = (content: ArtistPage) => {
        pages.artists.set(artistId, { status: 'shown', content })
        publish()
      }
      show({ ...page, moreAlbums: { status: 'loading' } })
      const result = settle(mine, await api.get<ArtistAlbumsResponse>(`/api/artists/${artistId}/albums?offset=${page.albums.length}`))
      if (!result)
        return
      if (result.ok)
        show({ ...page, albums: [...page.albums, ...result.value.albums], moreAlbums: result.value.more ? { status: 'notLoaded' } : null })
      else
        show({ ...page, moreAlbums: { status: 'failed', failure: result.failure } })
    },
    leave() {
      generation += 1
      forget()
      replica = null
      lane.stop()
    },
  }
}
