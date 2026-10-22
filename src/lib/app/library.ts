import type { Account } from '#lib/api/account.js'
import type { AddTracksRequest, AddTracksResponse, AlbumResponse, ArtistAlbum, ArtistAlbumsResponse, ArtistResponse, CollectedAlbum, CollectedAlbumsResponse, CollectedArtist, CollectedArtistsResponse, CollectRequest, CollectResponse, CreatePlaylistRequest, CreatePlaylistResponse, DescribePlaylistRequest, HeartRequest, HeartResponse, HeartsResponse, Playlist, PlaylistChangeResponse, PlaylistCollectRequest, PlaylistCollectResponse, PlaylistEditProblem, PlaylistInfo, PlaylistOrderRequest, PlaylistOrderResponse, PlaylistPageResponse, PlaylistsResponse, PlaylistTagGroup, PlaylistTagsResponse, PlaylistUnavailable, RemoveTracksRequest, RemoveTracksResponse, RenamePlaylistRequest, Song, SongOrderRequest, SongOrderResponse, SongsRequest, SongsResponse, TagPlaylistRequest, TrackIdsResponse } from '#lib/api/library.js'
import type { Api, RequestFailure, Result } from './api'
import type { Clock } from './browser'
import type { Change, ConfirmedChange } from './changes'
import type { DownloadNotice } from './downloads'
import type { LibraryPatch, LocalDb, PlaylistTracks, Replica } from './local'
import type { BackgroundLane, Waiting } from './pacing'
import { canSortPlaylist, nameProblem, reorderSortable, SONGS_PER_REQUEST, TRACKS_PER_CHANGE } from '#lib/api/library.js'
import { changePatch, changeProblem, heartOf, targetOf } from './changes'
import { emptyPatch, patched } from './local'

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
// 听众改曲库（红心、加入歌单、收藏，#30；删除歌单，改名称、简介、标签，改公开，#33）：先叠在显示着的副本上、立即生效，
// 再用前台请求提交给网易云；网易云确认了才写进副本，没成就改回原样并说明原因（提示）。断网时不改、直接说没改成（规则⑨）。
// 新建歌单等网易云建好、给了编号才进副本（#33）。同步拿回来的数据是请求发出那一刻的网易云，
// 比那一刻晚确认的修改要叠回去，不然刚加进歌单的歌会从界面上消失（逻辑原型证明必须这样做）

/** 同步没成功的原因（需要登录另外处理：整个 App 变成登录失效） */
export type SyncFailure = Exclude<RequestFailure, { kind: 'needsLogin' | 'rateLimited' | 'offline' }>

/** 打开歌单时没拉成的原因：前台请求不等，断网、操作频繁都直接说 */
export type OpenFailure = Exclude<RequestFailure, { kind: 'needsLogin' }>

/**
 * 改曲库没改成的原因：请求没成功；收藏歌单前没取到网易云的反作弊令牌（Watchman 没加载出来，可能被浏览器插件拦了）；
 * 歌单的名称、简介、标签不合规（界面先拦了，到这里是兜底）
 */
export type ChangeFailure = OpenFailure | { kind: 'checkTokenUnavailable' } | { kind: 'invalid', problem: PlaylistEditProblem }

/** 新建歌单的结果：建好了，或者没建成的原因 */
export type CreateOutcome = { ok: true, playlistId: number } | { ok: false, failure: ChangeFailure }

/** 批量加入歌单的结果：加了几首；一首都没加（都已经在歌单里了）也算成功。null：这一轮已经作废（退出、登录失效） */
export type AddSongsOutcome
  = | { ok: true, added: number }
    | { ok: false, failure: ChangeFailure | { kind: 'missing' } }
    | null

/** 改曲库、下载（#38，和改曲库共用一条提示条）后要告诉听众的事 */
export type LibraryNotice
  /** 没改成，已经改回原样 */
  = | { kind: 'notChanged', change: Change, failure: ChangeFailure }
  /** 要加歌、要排序、要收藏的歌单在网易云里已经不在了（在别处删掉了）：改回原样，马上同步一次曲库 */
    | { kind: 'playlistMissing', change: Extract<Change, { kind: 'add' | 'addMany' | 'remove' | 'order' | 'collectPlaylist' }> }
  /** 加入歌单成功（含一次加入几首） */
    | { kind: 'added', change: Extract<Change, { kind: 'add' | 'addMany' }> }
  /** 要加的歌都已经在歌单里了：什么都不发 */
    | { kind: 'alreadyAdded', playlist: Playlist }
  /** 多选移除：先从本地拿掉，5 秒内可以撤销 */
    | { kind: 'removed', playlist: Playlist, count: number }
  /** 移除没成功：已经从本地拿掉的放回原位（断网、超过上限时根本没拿掉）。retryable 为 false 时提示里没有“重试” */
    | { kind: 'removeFailed', playlist: Playlist, count: number, failure: ChangeFailure, retryable?: boolean }
  /**
   * 排序没保存成功：本地已经改回原来的顺序（断网时根本没改本地）。提示里可以重试。
   * failure 是 null：网易云回 -1、重读也不是新顺序，说不出原因
   */
    | { kind: 'orderFailed', playlist: Playlist, songIds: readonly number[], failure: ChangeFailure | null }
  /** 自建歌单之间的顺序没保存成功：本地已经改回原来的顺序（断网时根本没改本地）。提示里可以重试 */
    | { kind: 'playlistOrderFailed', playlistIds: readonly number[], failure: ChangeFailure }
  /** 上次关闭前的修改没保存成功：已经从网易云重拉这张歌单、恢复原样 */
    | { kind: 'recovered' }
    | DownloadNotice

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
  /** 全部曲目编号（按歌单里的顺序）：歌曲信息还没全部取到时，用它判断某首歌在不在歌单里、多选勾了哪些 */
  trackIds: readonly number[]
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

/** 不在曲库里的歌单（别人的、没收藏的）：已经取到的歌，和其余的歌取到哪了 */
export interface NeteasePlaylistSongs extends PlaylistSongs<PlaylistInfo> {
  /** 其余的歌正在取、或者没取成（再打开一次就是重试）；都取过了是 null */
  more: PlaylistOpening | null
  /** 全部曲目编号和曲目最后一次变动的时间：收藏后它进了曲库，曲目照这一份进本机副本，不用再拉一遍 */
  trackIds: readonly number[]
  tracksUpdatedAt: number
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
  /** 网易云的歌单标签库（编辑歌单信息时取）：只在这次登录期间记着；没取过是 null */
  playlistTags: PageState<PlaylistTagGroup[]> | null
  sync: SyncStatus
  /** 改曲库（红心、加入歌单、收藏）后要告诉听众的事；关掉或有了新的就换掉 */
  notice: LibraryNotice | null
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
  clock: Clock
  /** 曲库变了（同步拿到了新的部分、同步的状态变了） */
  write: (library: LibraryState) => void
  /** 同步时网易云说需要登录，续期也没成功 */
  loginExpired: () => void
  /** 浏览器觉得联网着（navigator.onLine）：断网时改曲库直接说没改成（规则⑨） */
  online: () => boolean
  /** 收藏歌单前现取一枚网易云的反作弊令牌（BrowserCapabilities.checkToken） */
  checkToken: () => Promise<string>
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
  /** 取网易云的歌单标签库：这次登录还没取到过就用前台请求取；没取成时再调一次就是重试 */
  openPlaylistTags: () => Promise<void>
  /**
   * 改曲库（红心、加入歌单、收藏）：先改显示着的、立即生效，再提交给网易云；成了写进本机副本，没成改回原样并说明原因（state.notice）。
   * 网易云说要加歌的歌单已经不在了：改回原样，马上同步一次
   */
  change: (change: Change) => Promise<void>
  /**
   * 一次把几首加入自建歌单（多选、添加歌曲选择器）：先改本地、立即生效，再一个请求提交；
   * 已经在歌单里的不再提交，全都已经在里面时什么都不发。网易云拒绝时改回原样并说明
   */
  addSongs: (playlist: Playlist, songs: readonly Song[]) => Promise<AddSongsOutcome>
  /**
   * 从自建歌单移除几首（#35）：先从本地拿掉，提示条留 5 秒撤销，没撤销才提交。
   * 提交失败放回原位并说明、可以重试；页面隐藏、离开歌单时由 flush 立即提交（带 keepalive，请求体不超过 64 KiB）
   */
  removeSongs: (playlist: Playlist, songIds: readonly number[]) => void
  /** 撤销刚才的移除：放回原位，什么都不提交 */
  undoRemove: () => void
  /**
   * 5 秒撤销窗口里把这些歌重新加入同一张歌单：把待提交的移除里这几首拿掉、放回原位，返回拿掉的那几首。
   * 它们还在网易云上，再发一次加入没有意义；调用方把它们从“要加的”里过滤掉
   */
  restorePending: (playlistId: number, songIds: readonly number[]) => Set<number>
  /** 重试刚才没成功的移除：重新从本地拿掉，马上提交 */
  retryRemove: () => Promise<void>
  /**
   * 多选里的拖动排序（#36）：把 songIds 挪到 before 那一首前面（null 是最后）。勾选的几首按列表里的先后一起挪。
   * 先改本地、立即生效，停手 2 秒才把整张歌单的新顺序一次提交；页面隐藏、离开歌单时由 flush 立即提交。
   * 能排序的只有自建歌单和我喜欢的音乐；断网时不改本地、直接说没改成（规则⑨）。返回顺序有没有改
   */
  moveSongs: (playlistId: number, songIds: readonly number[], before: number | null) => boolean
  /** 重试刚才没保存成功的排序：先恢复刚才的顺序，再马上提交 */
  retryOrder: () => Promise<void>
  /**
   * 曲库里自建歌单之间的排序（#37）：playlistIds 是我喜欢的音乐和全部自建歌单的新先后，我喜欢的音乐必须在最前，
   * 收藏的歌单不传。先改本地、立即生效，停手 2 秒才一次提交；页面隐藏时由 flush 立即提交。
   * 断网时不改本地、直接说没改成（规则⑨）。返回顺序有没有改
   */
  orderPlaylists: (playlistIds: readonly number[]) => boolean
  /** 重试刚才没保存成功的自建歌单顺序：先恢复刚才的顺序，再马上提交 */
  retryPlaylistOrder: () => Promise<void>
  /** 页面被隐藏（切到后台、锁屏、关页面）或离开歌单：把还没提交的移除、排序立即提交；给了 playlistId 只提交这一张的 */
  flush: (playlistId?: number) => Promise<void>
  /**
   * 批量“加入歌单”的目标：除了当前歌单以外的自建歌单（我喜欢的音乐、收藏的歌单不出现，不做批量红心）。
   * 歌单列表还没拿到时是 null
   */
  addTargets: (currentPlaylistId: number) => Playlist[] | null
  /** 换封面成功：用网易云返回的封面地址写进副本（马上显示）；同步拿回来的旧数据上也会叠回去 */
  setCover: (playlistId: number, coverUrl: string) => Promise<void>
  /**
   * 新建自建歌单：名称去掉首尾空白，不合规、断网时不提交。等网易云建好（给了编号）才进曲库，排在我喜欢的音乐后面；
   * 带着 songs（从加入歌单、多选里新建）时建好接着一次加入这几首（和 change 的加入歌单一样）。
   * 这一轮作废了（退出、登录失效）是 null
   */
  create: (draft: CreatePlaylistRequest, songs?: readonly Song[]) => Promise<CreateOutcome | null>
  dismissNotice: () => void
  /** 下载（#38）要告诉听众的事：放进同一条提示条，换掉之前的提示。没登录时没有提示条，不显示 */
  notify: (notice: DownloadNotice) => void
  /** 退出、登录失效：停下同步。本机副本留着，退出时由 App 另外删 */
  leave: () => void
}

/** 一个同步请求的结果；null：这一轮已经作废（退出、登录失效、换账号），什么都不用做 */
type Outcome<T, F> = { ok: true, value: T } | { ok: false, failure: F } | null

/** 拉一张歌单的结果 */
type Pulled = Outcome<void, OpenFailure>

/** 写进副本的一个修改（听众做的，或者网易云建好的新歌单）：网易云确认的那一刻（还没确认是 null），写进副本了没有 */
interface PendingChange {
  change: ConfirmedChange
  confirmedAt: number | null
  saved: boolean
}

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

/** 这次登录打开过的专辑页、歌手页、不在曲库里的歌单，取过的标签库 */
interface Pages {
  albums: ReadonlyMap<number, PageState<AlbumResponse>>
  artists: ReadonlyMap<number, PageState<ArtistPage>>
  playlists: ReadonlyMap<number, NeteasePlaylistPage>
  tags: PageState<PlaylistTagGroup[]> | null
}

function songsOf(replica: Replica, playlist: Playlist): PlaylistSongs {
  const tracks = replica.tracks.get(playlist.id)
  return {
    playlist,
    songs: tracks ? tracks.trackIds.flatMap(id => replica.songs.get(id) ?? []) : [],
    trackIds: tracks ? tracks.trackIds : [],
    total: tracks ? tracks.trackIds.length : playlist.trackCount,
    complete: tracks?.complete ?? false,
  }
}

function stateOf(replica: Replica, sync: SyncStatus, opening: ReadonlyMap<number, PlaylistOpening>, pages: Pages, notice: LibraryNotice | null): LibraryState {
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
    playlistTags: pages.tags,
    sync,
    notice,
  }
}

/** 搜索时不分大小写和全角半角：“ＤＪ”和“dj”一样 */
function folded(text: string): string {
  return text.normalize('NFKC').toLowerCase()
}

/** 在一串歌里搜索：歌名、歌手、专辑里有搜索词的，按原来的先后；不分大小写和全角半角。搜索词是空的就是全部 */
export function searchSongs(songs: readonly Song[], query: string): Song[] {
  const term = folded(query.trim())
  const matches = (text: string | null) => text !== null && folded(text).includes(term)
  return songs.filter(song => matches(song.name) || matches(song.album.name) || song.artists.some(artist => matches(artist.name)))
}

/** 歌单内搜索：在本机副本（不在曲库里的歌单是打开时取到的歌）里即时完成 */
export function searchPlaylist(playlist: PlaylistSongs<unknown>, query: string): PlaylistSearch {
  return { songs: searchSongs(playlist.songs, query), incomplete: !playlist.complete }
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

/** 多选移除的提示条留多久（毫秒）：这之内可以撤销，过了才提交 */
const REMOVE_UNDO_MS = 5000
/** 拖动排序停手多久（毫秒）以后才提交：这之内再拖，合并成一次 */
const ORDER_MERGE_MS = 2000
/** 带 keepalive 的请求体最多这么大（字节）：浏览器只给 64 KiB，更大的只能用普通请求 */
const KEEPALIVE_MAX_BYTES = 64 * 1024

/** 一份还没提交的移除：本地已经拿掉，提示条里可以撤销，计时到了或者页面隐藏时提交 */
interface DeferredRemoval {
  playlist: Playlist
  songIds: readonly number[]
  change: Extract<Change, { kind: 'remove' }>
  entry: PendingChange
  /** 撤销、提交成功后取消计时 */
  cancelTimer: () => void
  /** 已经开始提交：同一份不重复发 */
  sending: Promise<void> | null
  /** 撤销了、或者已经处理完：不再提交 */
  settled: boolean
}

/** 一份还没提交的排序：本地已经改了，停手 2 秒后提交；提交中又拖了，等这一份回来再发最新的那一份 */
interface DeferredOrder {
  playlist: Playlist
  /** 最新要提交的顺序 */
  songIds: number[]
  /** 显示着的这一份修改；提交中又拖了时会换一份新的 */
  entry: PendingChange
  /** 正在提交的那一份修改 */
  sendingEntry: PendingChange | null
  /** 取消计时 */
  cancelTimer: () => void
  /** 已经开始提交：同一份不重复发 */
  sending: Promise<void> | null
  /** 处理完了（提交成功、失败退回了、这一轮作废了）：不再提交 */
  settled: boolean
}

/** 一份还没提交的自建歌单顺序（#37）：本地已经改了，停手 2 秒后提交；提交中又拖了，等这一份回来再发最新的那一份 */
interface DeferredPlaylistOrder {
  /** 最新要提交的顺序：我喜欢的音乐在最前，然后是自建歌单 */
  playlistIds: number[]
  /** 显示着的这一份修改；提交中又拖了时会换一份新的 */
  entry: PendingChange
  /** 正在提交的那一份修改 */
  sendingEntry: PendingChange | null
  /** 取消计时 */
  cancelTimer: () => void
  /** 已经开始提交：同一份不重复发 */
  sending: Promise<void> | null
  /** 处理完了（提交成功、失败退回了、这一轮作废了）：不再提交 */
  settled: boolean
}

export function createLibrary(context: LibraryContext): Library {
  const { api, lane, local, clock } = context
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
  const pulling = new Map<number, { version: number, force: boolean, job: Promise<Pulled> }>()
  /** 听众打开着、要马上拉的歌单：拉它的请求不经过后台的节奏 */
  const urgent = new Set<number>()
  /** 拉歌单时正在后台通道里等着的请求：听众打开这张歌单时叫它别等了，改成前台请求马上发 */
  const waiting = new Map<number, AbortController>()
  let opening = new Map<number, PlaylistOpening>()
  /** 这次登录打开过的专辑页（本机存着、这次还没拉的不在这里）、歌手页、不在曲库里的歌单，取过的标签库 */
  const pages = { albums: new Map<number, PageState<AlbumResponse>>(), artists: new Map<number, PageState<ArtistPage>>(), playlists: new Map<number, NeteasePlaylistPage>(), tags: null as PageState<PlaylistTagGroup[]> | null }
  /** 正在拉的专辑页：本机存着的专辑页拉的时候照常显示存着的，不记成加载中，所以另外记 */
  const fetchingAlbums = new Set<number>()
  /** 正在联网取的不在曲库里的歌单：打开过的再打开时照常显示记着的，所以另外记 */
  const fetchingPlaylists = new Set<number>()
  /** 不在曲库里的歌单取到的歌曲信息：这次登录期间记着（不存本机），再打开时只取还没有的 */
  const neteaseSongs = new Map<number, Song>()
  /** 改曲库后要告诉听众的事 */
  let notice: LibraryNotice | null = null
  /**
   * 多选移除（#35）：本地已经拿掉、还没提交的。提示条留 5 秒撤销，过了才提交；
   * 页面隐藏、离开歌单时立即提交（带 keepalive，请求体不超过 64 KiB）
   */
  let deferred: DeferredRemoval[] = []
  /** 提示条里的“撤销”对应哪一份；换了别的提示条就撤销不到了，但计时到了照样提交 */
  let noticeRemoval: DeferredRemoval | null = null
  /** 刚才没成功的移除：提示条里的“重试”重新拿掉、马上提交 */
  let failedRemoval: { playlist: Playlist, songIds: readonly number[] } | null = null
  /**
   * 拖动排序（#36）：本地已经改了、还没提交的。停手 2 秒才提交；页面隐藏、离开歌单时立即提交
   * （带 keepalive，请求体不超过 64 KiB）
   */
  const orders = new Map<number, DeferredOrder>()
  /** 刚才没成功的排序：提示条里的“重试”恢复刚才的顺序、马上提交 */
  let failedOrder: { playlist: Playlist, songIds: readonly number[] } | null = null
  /** 自建歌单之间的排序（#37）：本地已经改了、还没提交的。停手 2 秒才提交；页面隐藏时立即提交 */
  let playlistOrder: DeferredPlaylistOrder | null = null
  /** 刚才没成功的自建歌单顺序：提示条里的“重试”恢复刚才的顺序、马上提交 */
  let failedPlaylistOrder: { playlistIds: readonly number[] } | null = null
  /**
   * 上次关闭前没确认的改动（本机存着的标记）：打开 App 时读出来，同步拿到歌单列表后先从网易云重拉这几张、
   * 丢掉本地改动，再提示“已恢复原样”
   */
  let recovering = new Set<number>()
  /** 这个标签页已经写进本机的标记：只增删自己写的那几张，别的标签页记下的不动 */
  let writtenMarkers = new Set<number>()
  /** 未确认标记一步一步写，免得几次写交错、后写的拿着旧的一组把前面的盖掉 */
  let markerSaving: Promise<void> = Promise.resolve()
  /**
   * 听众改的、还没写进副本的修改（叠在显示着的副本上），和网易云确认过的修改（confirmedAt：确认的那一刻；
   * 同步拿回来的数据比它旧时要叠回去）。退出、换账号时清掉
   */
  let changes: PendingChange[] = []
  /** 同一样东西的修改按先后一个一个做（targetOf）：上一次修改连同写进副本做完的那一刻 */
  const submitting = new Map<string, Promise<void>>()
  /** 记先后用的时刻，只增不减：同步请求发出、修改确认时各走一格 */
  let tick = 0
  /** 改副本的步子一步一步走（save），这是最后一步 */
  let saving: Promise<unknown> = Promise.resolve()

  /** 显示的副本：还没写进副本的修改叠在上面 */
  function shown(current: Replica): Replica {
    return changes.filter(entry => !entry.saved).reduce((view, entry) => patched(view, changePatch(view, entry.change)), current)
  }

  /** 同步拿回来的是 at 那一刻的网易云：比它晚确认的修改叠回去 */
  function reapplied(view: Replica, at: number): Replica {
    return changes.filter(entry => entry.confirmedAt !== null && entry.confirmedAt > at).reduce((next, entry) => patched(next, changePatch(next, entry.change)), view)
  }

  /**
   * 本机记的“这几张歌单有改动还没确认”：正在提交的、上次关掉前没确认完的。
   * 只加/删这个标签页写过的，别的标签页同时在改别的歌单时不会被盖掉
   */
  function saveMarkers(mine: number): Promise<void> {
    const current = replica
    if (!current)
      return Promise.resolve()
    markerSaving = markerSaving.then(async () => {
      if (mine !== generation || !replica)
        return
      const active = new Set([...recovering, ...deferred.map(item => item.playlist.id), ...orders.keys()])
      for (const id of active) {
        if (writtenMarkers.has(id))
          continue
        await local.addPendingChange(current.owner, id)
        writtenMarkers.add(id)
      }
      for (const id of [...writtenMarkers]) {
        if (active.has(id))
          continue
        await local.removePendingChange(current.owner, id)
        writtenMarkers.delete(id)
      }
    }).catch(() => {})
    return markerSaving
  }

  /** 一份移除处理完了（确认了、放回原位了、撤销了）：不再提交，标记可能可以划掉 */
  function finishRemoval(mine: number, item: DeferredRemoval): void {
    item.settled = true
    item.cancelTimer()
    deferred = deferred.filter(each => each !== item)
    if (noticeRemoval === item)
      noticeRemoval = null
    void saveMarkers(mine)
  }

  /** 这个请求体带不带得动 keepalive：超过 64 KiB 的只能用普通请求（#35、#36） */
  function keepaliveAllowed(change: Change): boolean {
    if (change.kind !== 'remove' && change.kind !== 'order' && change.kind !== 'playlistOrder')
      return false
    const body = change.kind === 'playlistOrder'
      ? JSON.stringify({ playlistIds: change.playlistIds } satisfies PlaylistOrderRequest)
      : JSON.stringify({ songIds: change.songIds } satisfies RemoveTracksRequest | SongOrderRequest)
    return new TextEncoder().encode(body).byteLength <= KEEPALIVE_MAX_BYTES
  }

  /**
   * 提交一份移除：成功后写进本机副本；网易云说歌单不在了就放回原位、马上同步；
   * 其他失败放回原位并说明，提示条里可以重试。页面隐藏时带 keepalive
   */
  async function commitRemoval(mine: number, item: DeferredRemoval, { keepalive }: { keepalive: boolean }): Promise<void> {
    if (item.settled)
      return
    if (item.sending)
      return item.sending
    item.cancelTimer()
    if (noticeRemoval === item) {
      noticeRemoval = null
      if (notice?.kind === 'removed')
        notice = null
      publish()
    }
    const target = targetOf(item.change)
    const job = (submitting.get(target) ?? Promise.resolve()).then(async () => {
      try {
        // 提交前先让“这张歌单有改动还没确认”落盘：这时关掉页面，下次打开才知道要恢复
        await markerSaving
        if (item.settled || mine !== generation)
          return
        const { change } = item
        const result = await submit(mine, change, keepalive && keepaliveAllowed(change) ? { keepalive: true } : undefined)
        if (!result || mine !== generation)
          return
        if (result.ok && result.value === 'done') {
          item.entry.confirmedAt = ++tick
          if (!await save(mine, now => changePatch(now, item.entry.change), () => {
            item.entry.saved = true
          }) || mine !== generation) {
            return
          }
          failedRemoval = null
          finishRemoval(mine, item)
          publish()
          return
        }
        // 失败、歌单不在了：本地已经改回原样
        changes = changes.filter(each => each !== item.entry)
        finishRemoval(mine, item)
        if (result.ok) {
          notice = { kind: 'playlistMissing', change }
          publish()
          return start()
        }
        if (result.failure.kind === 'needsLogin')
          return context.loginExpired()
        failedRemoval = { playlist: item.playlist, songIds: item.songIds }
        notice = { kind: 'removeFailed', playlist: item.playlist, count: item.songIds.length, failure: result.failure }
        publish()
      }
      catch {
        // 本机数据库、请求本身出了意料之外的错：也按没成功处理，放回原位、说明原因
        if (item.settled || mine !== generation)
          return
        changes = changes.filter(each => each !== item.entry)
        finishRemoval(mine, item)
        failedRemoval = { playlist: item.playlist, songIds: item.songIds }
        notice = { kind: 'removeFailed', playlist: item.playlist, count: item.songIds.length, failure: { kind: 'serverError' } }
        publish()
      }
    }).finally(() => {
      if (submitting.get(target) === job)
        submitting.delete(target)
    })
    submitting.set(target, job)
    item.sending = job.finally(() => {
      item.sending = null
    })
    return item.sending
  }

  /** 先从本地拿掉，记下未确认；undo 时提示条留 5 秒撤销，否则马上提交 */
  function applyRemoval(mine: number, playlist: Playlist, songIds: readonly number[], { undo }: { undo: boolean }): DeferredRemoval {
    // 5 秒内又移除了一批：同一张歌单合成一条提示（撤销两批一起放回，计时从头算）；
    // 不同歌单的先提交上一批，别让它悄悄在后面提交、撤销不到了
    if (undo) {
      const previous = noticeRemoval
      if (previous && !previous.settled && !previous.sending) {
        if (previous.playlist.id === playlist.id) {
          const combined = [...new Set([...previous.songIds, ...songIds])]
          previous.songIds = combined
          previous.change.songIds = combined
          previous.cancelTimer()
          previous.cancelTimer = clock.after(REMOVE_UNDO_MS, () => {
            void commitRemoval(mine, previous, { keepalive: false })
          })
          noticeRemoval = previous
          notice = { kind: 'removed', playlist, count: combined.length }
          publish()
          return previous
        }
        void commitRemoval(mine, previous, { keepalive: false })
      }
    }
    const change: Extract<Change, { kind: 'remove' }> = { kind: 'remove', playlist, songIds: [...songIds] }
    const entry: PendingChange = { change, confirmedAt: null, saved: false }
    const item: DeferredRemoval = {
      playlist,
      songIds: [...songIds],
      change,
      entry,
      cancelTimer: () => {},
      sending: null,
      settled: false,
    }
    changes.push(entry)
    deferred.push(item)
    if (undo) {
      noticeRemoval = item
      notice = { kind: 'removed', playlist, count: songIds.length }
      item.cancelTimer = clock.after(REMOVE_UNDO_MS, () => {
        void commitRemoval(mine, item, { keepalive: false })
      })
    }
    else {
      noticeRemoval = null
      notice = null
    }
    publish()
    const marked = saveMarkers(mine)
    if (!undo)
      void marked.then(() => commitRemoval(mine, item, { keepalive: false }))
    return item
  }

  function removeSongs(playlist: Playlist, songIds: readonly number[]): void {
    const current = replica
    if (!current)
      return
    const tracks = current.tracks.get(playlist.id)
    const present = new Set(tracks?.trackIds ?? [])
    const ids = [...new Set(songIds)].filter(id => present.has(id))
    if (ids.length === 0)
      return
    const mine = generation
    failedRemoval = null
    if (ids.length > TRACKS_PER_CHANGE) {
      notice = { kind: 'removeFailed', playlist, count: ids.length, failure: { kind: 'invalid', problem: 'tooManySongs' }, retryable: false }
      publish()
      return
    }
    if (!context.online()) {
      // 断网时的写操作直接说没改成，不改本地（规则⑨）
      failedRemoval = { playlist, songIds: ids }
      notice = { kind: 'removeFailed', playlist, count: ids.length, failure: { kind: 'offline' } }
      publish()
      return
    }
    applyRemoval(mine, playlist, ids, { undo: true })
  }

  function undoRemove(): void {
    const item = noticeRemoval ?? deferred.at(-1) ?? null
    if (!item)
      return
    item.settled = true
    item.cancelTimer()
    changes = changes.filter(each => each !== item.entry)
    deferred = deferred.filter(each => each !== item)
    if (noticeRemoval === item)
      noticeRemoval = null
    if (notice?.kind === 'removed')
      notice = null
    failedRemoval = null
    publish()
    void saveMarkers(generation)
  }

  /** 把一个待提交移除里的这几首拿掉（重新加入歌单时用）：别的歌继续按 5 秒计时，拿掉的放回原位 */
  function restorePending(playlistId: number, songIds: readonly number[]): Set<number> {
    const ids = new Set(songIds)
    const restored = new Set<number>()
    for (const item of [...deferred]) {
      if (item.playlist.id !== playlistId || item.sending)
        continue
      const overlap = item.songIds.filter(id => ids.has(id))
      if (overlap.length === 0)
        continue
      for (const id of overlap)
        restored.add(id)
      const remaining = item.songIds.filter(id => !ids.has(id))
      if (remaining.length === 0) {
        item.settled = true
        item.cancelTimer()
        changes = changes.filter(each => each !== item.entry)
        deferred = deferred.filter(each => each !== item)
        if (noticeRemoval === item)
          noticeRemoval = null
      }
      else {
        item.songIds = remaining
        item.change.songIds = [...remaining]
      }
      if (notice?.kind === 'removed' && notice.playlist.id === playlistId) {
        notice = remaining.length > 0 ? { kind: 'removed', playlist: item.playlist, count: remaining.length } : null
      }
    }
    if (restored.size > 0) {
      failedRemoval = null
      const playlist = replica?.playlists?.find(item => item.id === playlistId)
      if (playlist)
        notice = { kind: 'alreadyAdded', playlist }
      publish()
      void saveMarkers(generation)
    }
    return restored
  }

  async function retryRemove(): Promise<void> {
    const failed = failedRemoval
    if (!failed)
      return
    const mine = generation
    failedRemoval = null
    if (!context.online()) {
      failedRemoval = failed
      notice = { kind: 'removeFailed', playlist: failed.playlist, count: failed.songIds.length, failure: { kind: 'offline' } }
      publish()
      return
    }
    const item = applyRemoval(mine, failed.playlist, failed.songIds, { undo: false })
    await commitRemoval(mine, item, { keepalive: false })
  }

  /** 一份排序的修改：显示着的顺序，先改本地、立即生效 */
  function orderEntry(playlist: Playlist, songIds: readonly number[]): PendingChange {
    return { change: { kind: 'order', playlist, songIds: [...songIds] }, confirmedAt: null, saved: false }
  }

  /** 开始一份新的排序：记下显示着的修改，等拖完合并提交 */
  function startOrder(playlist: Playlist, songIds: readonly number[]): DeferredOrder {
    const entry = orderEntry(playlist, songIds)
    const item: DeferredOrder = { playlist, songIds: [...songIds], entry, sendingEntry: null, cancelTimer: () => {}, sending: null, settled: false }
    orders.set(playlist.id, item)
    changes.push(entry)
    return item
  }

  /** 一份排序处理完了：不再提交，标记可能可以划掉 */
  function dropOrder(item: DeferredOrder): void {
    item.settled = true
    item.cancelTimer()
    item.sendingEntry = null
    orders.delete(item.playlist.id)
  }

  /** 两份顺序一样（长度和每一位都相同） */
  function sameOrder(a: readonly number[], b: readonly number[]): boolean {
    return a.length === b.length && a.every((id, index) => id === b[index])
  }

  /**
   * 曲库里能排序的歌单，按当前的先后：我喜欢的音乐在最前，然后是自建歌单。
   * 收藏的歌单不参与，别的顺序也照这个排（网易云的歌单列表本来就该是这个样子）
   */
  function sortablePlaylists(current: Replica): Playlist[] | null {
    if (!current.playlists)
      return null
    const sortable = current.playlists.filter(playlist => canSortPlaylist(playlist.kind))
    return [...sortable.filter(playlist => playlist.kind === 'liked'), ...sortable.filter(playlist => playlist.kind !== 'liked')]
  }

  /** 这个顺序能不能提交：正好是能排序的那几张，我喜欢的音乐在最前，没有重复；收藏的歌单不能出现 */
  function validPlaylistOrder(current: Replica, playlistIds: readonly number[]): boolean {
    const sortable = sortablePlaylists(current)
    if (!sortable || playlistIds.length !== sortable.length || new Set(playlistIds).size !== playlistIds.length)
      return false
    const allowed = new Set(sortable.map(playlist => playlist.id))
    if (playlistIds.some(id => !allowed.has(id)))
      return false
    const liked = sortable.find(playlist => playlist.kind === 'liked')
    return !liked || playlistIds[0] === liked.id
  }

  /** 过期、缺了几张的顺序补成能提交的：还在的照提交的先后，没出现的按原来的先后接在后面 */
  function normalizedPlaylistOrder(current: Replica, playlistIds: readonly number[]): number[] {
    const sortable = sortablePlaylists(current) ?? []
    return reorderSortable(sortable, playlistIds, () => true).map(playlist => playlist.id)
  }

  /** 一份自建歌单顺序的修改：显示着的顺序，先改本地、立即生效 */
  function playlistOrderEntry(playlistIds: readonly number[]): PendingChange {
    return { change: { kind: 'playlistOrder', playlistIds: [...playlistIds] }, confirmedAt: null, saved: false }
  }

  /** 开始一份新的自建歌单顺序：记下显示着的修改，停手 2 秒才提交 */
  function startPlaylistOrder(mine: number, playlistIds: readonly number[]): DeferredPlaylistOrder {
    const entry = playlistOrderEntry(playlistIds)
    const item: DeferredPlaylistOrder = { playlistIds: [...playlistIds], entry, sendingEntry: null, cancelTimer: () => {}, sending: null, settled: false }
    playlistOrder = item
    changes.push(entry)
    item.cancelTimer = clock.after(ORDER_MERGE_MS, () => {
      void commitPlaylistOrder(mine, item, { keepalive: false })
    })
    return item
  }

  /** 一份自建歌单顺序处理完了：不再提交 */
  function dropPlaylistOrder(item: DeferredPlaylistOrder): void {
    item.settled = true
    item.cancelTimer()
    item.sendingEntry = null
    if (playlistOrder === item)
      playlistOrder = null
  }

  /** 自建歌单顺序处理完了：不再提交，也没有要说的了 */
  function finishPlaylistOrder(item: DeferredPlaylistOrder): void {
    dropPlaylistOrder(item)
    publish()
  }

  /**
   * 这一份自建歌单顺序网易云确认了：写进本机副本。提交中又拖了的话，显示着的是下一份（还没提交）：
   * 这一份照样确认，返回 false 让提交接着发最新的那一份
   */
  async function savePlaylistOrdered(mine: number, item: DeferredPlaylistOrder, entry: PendingChange, change: Extract<Change, { kind: 'playlistOrder' }>): Promise<boolean> {
    entry.change = change
    entry.confirmedAt = ++tick
    if (!await save(mine, now => changePatch(now, change), () => {
      entry.saved = true
    }) || mine !== generation) {
      return true
    }
    item.sendingEntry = null
    if (item.entry === entry) {
      finishPlaylistOrder(item)
      return true
    }
    return false
  }

  /** 自建歌单顺序没成功：去掉这次的修改（本地退回原来的顺序），留下“重试”用的顺序 */
  function playlistOrderFailed(mine: number, item: DeferredPlaylistOrder, failure: ChangeFailure): void {
    if (mine !== generation)
      return
    const { playlistIds } = item
    changes = changes.filter(entry => entry.change.kind !== 'playlistOrder')
    dropPlaylistOrder(item)
    failedPlaylistOrder = { playlistIds: [...playlistIds] }
    notice = { kind: 'playlistOrderFailed', playlistIds: [...playlistIds], failure }
    publish()
  }

  /**
   * 网易云回了 -1 或者超时：重新读一次这张歌单，和提交的顺序一样就算成功（几千首位置都变时其实已经生效）。
   * 重读没成功、或者顺序不一样都是没有生效
   */
  async function orderLanded(mine: number, playlistId: number, songIds: readonly number[]): Promise<boolean> {
    const result = settle(mine, await api.get<TrackIdsResponse>(`/api/playlists/${playlistId}/track-ids`))
    if (!result?.ok)
      return false
    // 提交的顺序可能过期：多出来的歌（还在提交中的加入、红心）会被网易云忽略，漏掉的歌原地保留。
    // 只比两边都有的歌的先后；一首都没有对上时不能算成功
    const upstream = new Set(result.value.trackIds)
    const submitted = new Set(songIds)
    const common = result.value.trackIds.filter(id => submitted.has(id))
    const expected = songIds.filter(id => upstream.has(id))
    return common.length > 0 && sameOrder(expected, common)
  }

  /** 一份排序处理完了：不再提交，标记可以划掉 */
  function finishOrder(mine: number, item: DeferredOrder): void {
    dropOrder(item)
    publish()
    void saveMarkers(mine)
  }

  /**
   * 这一份顺序网易云确认了：写进本机副本。提交中又拖了的话，显示着的是下一份（还没提交）：
   * 这一份照样确认，返回 false 让提交接着发最新的那一份
   */
  async function saveOrdered(mine: number, item: DeferredOrder, entry: PendingChange, change: Extract<Change, { kind: 'order' }>): Promise<boolean> {
    entry.change = change
    entry.confirmedAt = ++tick
    if (!await save(mine, now => changePatch(now, change), () => {
      entry.saved = true
    }) || mine !== generation) {
      return true
    }
    item.sendingEntry = null
    if (item.entry === entry) {
      finishOrder(mine, item)
      return true
    }
    return false
  }

  /** 排序没成功：去掉这次排序的修改（本地退回原来的顺序），留下“重试”用的顺序。failure 是 null：说不出原因（没确认） */
  function orderFailed(mine: number, item: DeferredOrder, failure: ChangeFailure | null): void {
    if (mine !== generation)
      return
    const { playlist, songIds } = item
    changes = changes.filter(entry => !(entry.change.kind === 'order' && entry.change.playlist.id === playlist.id))
    dropOrder(item)
    failedOrder = { playlist, songIds: [...songIds] }
    notice = { kind: 'orderFailed', playlist, songIds: [...songIds], failure }
    publish()
    void saveMarkers(mine)
  }

  /** 排序时网易云说这张歌单已经不在了：退回原来的顺序，马上同步一次曲库 */
  function orderMissing(mine: number, item: DeferredOrder, change: Extract<Change, { kind: 'order' }>): void {
    if (mine !== generation)
      return
    changes = changes.filter(entry => !(entry.change.kind === 'order' && entry.change.playlist.id === item.playlist.id))
    dropOrder(item)
    failedOrder = null
    notice = { kind: 'playlistMissing', change }
    publish()
    void saveMarkers(mine)
    start()
  }

  /** 交给 handle 的返回：需要登录已经在 commitDeferred 里处理掉了 */
  type HandledResult = { ok: true, value: 'done' | 'missing' | 'unconfirmed' } | { ok: false, failure: ChangeFailure }

  /** 合并提交的公共部分：等 2 秒、同一目标串行、失败和登录失效；具体提交什么、怎么处理返回由调用方给 */
  interface DeferredCommit<T, C extends Change> {
    /** 同一样东西的排队键（submitting） */
    target: string
    /** 现在要提交的修改 */
    change: (item: T) => C
    /** 提交前要做的事（例如先让未确认标记落盘） */
    prepare?: () => Promise<void>
    /** 清掉上次失败的提示 */
    clearNotice: () => void
    /** 网易云确认了：写进副本，返回这一份是不是处理完了（false：提交中又改了，接着发最新的） */
    confirmed: (item: T, entry: PendingChange, change: C) => Promise<boolean>
    /** 网易云回了、不是需要登录：处理完是 'stop'，还要接着发最新的是 'next' */
    handle: (result: HandledResult, item: T, entry: PendingChange, change: C) => Promise<'next' | 'stop'>
    /** 提交失败（没成功、也没被 handle 处理掉） */
    failed: (item: T, failure: ChangeFailure) => void
    /** 需要登录：清掉这一份、让 App 变成登录失效 */
    loginExpired: (item: T) => void
  }

  /**
   * 把一份还没提交的修改合并提交：停手 2 秒才发；提交中又改了，等这一份回来再发最新的；
   * 页面隐藏、重试时立即发（immediate）。同一目标（target）按先后串行
   */
  async function commitDeferred<T extends { entry: PendingChange, sendingEntry: PendingChange | null, sending: Promise<void> | null, settled: boolean, cancelTimer: () => void }, C extends Change>(
    mine: number,
    item: T,
    { keepalive, immediate = false }: { keepalive: boolean, immediate?: boolean },
    options: DeferredCommit<T, C>,
  ): Promise<void> {
    if (item.settled)
      return
    if (item.sending)
      return item.sending
    item.cancelTimer()
    options.clearNotice()
    const job = (submitting.get(options.target) ?? Promise.resolve()).then(async () => {
      const waitForMerge = (): boolean => {
        if (immediate)
          return false
        item.cancelTimer()
        item.cancelTimer = clock.after(ORDER_MERGE_MS, () => {
          void commitDeferred(mine, item, { keepalive: false }, options)
        })
        return true
      }
      try {
        await options.prepare?.()
        for (;;) {
          if (item.settled || mine !== generation)
            return
          const entry = item.entry
          const change = options.change(item)
          item.sendingEntry = entry
          const result = await submit(mine, change, keepalive && keepaliveAllowed(change) ? { keepalive: true } : undefined)
          if (!result || mine !== generation)
            return
          if (!result.ok && result.failure.kind === 'needsLogin') {
            if (mine === generation)
              options.loginExpired(item)
            return
          }
          // 需要登录在上面已经处理掉了，剩下的失败都是 ChangeFailure
          if (await options.handle(result as HandledResult, item, entry, change) === 'stop')
            return
          if (await options.confirmed(item, entry, change))
            return
          if (waitForMerge())
            return
        }
      }
      catch {
        // 本机数据库、请求本身出了意料之外的错：也按没成功处理，退回原来的顺序、说明原因
        if (!item.settled && mine === generation)
          options.failed(item, { kind: 'serverError' })
      }
    }).finally(() => {
      if (submitting.get(options.target) === job)
        submitting.delete(options.target)
    })
    submitting.set(options.target, job)
    item.sending = job.finally(() => {
      item.sending = null
    })
    return item.sending
  }

  /**
   * 把整张歌单的新顺序提交给网易云：页面隐藏、离开歌单时带 keepalive（请求体超过 64 KiB 的用普通请求）。
   * 成功写进本机副本；网易云回 -1、超时先重读一次确认；失败、歌单不在了退回原来的顺序并说明
   */
  function commitOrder(mine: number, item: DeferredOrder, flags: { keepalive: boolean, immediate?: boolean }): Promise<void> {
    return commitDeferred(mine, item, flags, {
      target: targetOf({ kind: 'order', playlist: item.playlist, songIds: item.songIds }),
      change: item => ({ kind: 'order', playlist: item.playlist, songIds: [...item.songIds] }),
      prepare: () => markerSaving,
      clearNotice: () => {
        if (notice?.kind === 'orderFailed' && notice.playlist.id === item.playlist.id) {
          notice = null
          failedOrder = null
          publish()
        }
      },
      confirmed: (item, entry, change) => saveOrdered(mine, item, entry, change),
      async handle(result, item, entry, change) {
        if (result.ok && result.value === 'done')
          return 'next'
        if (result.ok && result.value === 'unconfirmed') {
          if (await orderLanded(mine, item.playlist.id, change.songIds))
            return 'next'
          orderFailed(mine, item, null)
          return 'stop'
        }
        if (!result.ok && result.failure.kind === 'neteaseUnavailable') {
          if (await orderLanded(mine, item.playlist.id, change.songIds))
            return 'next'
          orderFailed(mine, item, result.failure)
          return 'stop'
        }
        if (result.ok) {
          orderMissing(mine, item, change)
          return 'stop'
        }
        orderFailed(mine, item, result.failure)
        return 'stop'
      },
      failed: (item, failure) => orderFailed(mine, item, failure),
      loginExpired: (item) => {
        changes = changes.filter(each => !(each.change.kind === 'order' && each.change.playlist.id === item.playlist.id))
        finishOrder(mine, item)
        context.loginExpired()
      },
    })
  }

  /**
   * 把曲库里能排序的歌单的新顺序提交给网易云：页面隐藏时带 keepalive。
   * 成功写进本机副本；失败退回原来的顺序并说明，提示条里可以重试
   */
  function commitPlaylistOrder(mine: number, item: DeferredPlaylistOrder, flags: { keepalive: boolean, immediate?: boolean }): Promise<void> {
    return commitDeferred(mine, item, flags, {
      target: targetOf({ kind: 'playlistOrder', playlistIds: item.playlistIds }),
      change: item => ({ kind: 'playlistOrder', playlistIds: [...item.playlistIds] }),
      clearNotice: () => {
        if (notice?.kind === 'playlistOrderFailed') {
          notice = null
          failedPlaylistOrder = null
          publish()
        }
      },
      confirmed: (item, entry, change) => savePlaylistOrdered(mine, item, entry, change),
      async handle(result, item) {
        if (result.ok)
          return 'next'
        playlistOrderFailed(mine, item, result.failure)
        return 'stop'
      },
      failed: (item, failure) => playlistOrderFailed(mine, item, failure),
      loginExpired: (item) => {
        changes = changes.filter(each => each.change.kind !== 'playlistOrder')
        finishPlaylistOrder(item)
        context.loginExpired()
      },
    })
  }

  /**
   * 把勾选的几首挪到 before 那一首前面（null 是最后）：按列表里的先后一起挪，保持原来的先后。
   * 先改本地、立即生效，停手 2 秒才提交；提交中又拖了，等这一份回来再发最新的
   */
  function moveSongs(playlistId: number, songIds: readonly number[], before: number | null): boolean {
    const current = replica
    if (!current)
      return false
    const playlist = current.playlists?.find(item => item.id === playlistId)
    if (!playlist || !canSortPlaylist(playlist.kind))
      return false
    const tracks = shown(current).tracks.get(playlistId)
    if (!tracks)
      return false
    const moved = new Set(songIds)
    const moving = tracks.trackIds.filter(id => moved.has(id))
    if (moving.length === 0)
      return false
    const rest = tracks.trackIds.filter(id => !moved.has(id))
    const at = before === null ? rest.length : rest.indexOf(before)
    if (at < 0)
      return false
    const next = [...rest.slice(0, at), ...moving, ...rest.slice(at)]
    if (sameOrder(next, tracks.trackIds))
      return false
    if (!context.online()) {
      // 断网时先不改本地（规则⑨）；连上网络后点“重试”再把这次拖动排进去、提交
      failedOrder = { playlist, songIds: next }
      notice = { kind: 'orderFailed', playlist, songIds: next, failure: { kind: 'offline' } }
      publish()
      return false
    }
    const mine = generation
    let item = orders.get(playlistId)
    if (item && !item.settled) {
      item.songIds = next
      if (item.sending) {
        // 正在提交时又拖了：等这一份回来再发最新的；已经有一份在等的话，换掉它的顺序
        if (item.entry === item.sendingEntry) {
          item.entry = orderEntry(playlist, next)
          changes.push(item.entry)
        }
        else {
          item.entry.change = { kind: 'order', playlist, songIds: [...next] }
        }
      }
      else {
        item.entry.change = { kind: 'order', playlist, songIds: [...next] }
        item.cancelTimer()
        item.cancelTimer = clock.after(ORDER_MERGE_MS, () => {
          void commitOrder(mine, item!, { keepalive: false })
        })
      }
    }
    else {
      item = startOrder(playlist, next)
      item.cancelTimer = clock.after(ORDER_MERGE_MS, () => {
        void commitOrder(mine, item!, { keepalive: false })
      })
    }
    if (notice?.kind === 'orderFailed' && notice.playlist.id === playlistId)
      notice = null
    failedOrder = null
    publish()
    void saveMarkers(mine)
    return true
  }

  /**
   * 曲库里自建歌单之间的排序（#37）：playlistIds 是我喜欢的音乐和全部自建歌单的新先后。
   * 我喜欢的音乐必须在最前，收藏的歌单不能出现；顺序不合这个规矩时不改、返回 false。
   * 先改本地、立即生效，停手 2 秒才提交；提交中又拖了，等这一份回来再发最新的
   */
  function orderPlaylists(playlistIds: readonly number[]): boolean {
    const current = replica
    if (!current)
      return false
    // 按显示着的副本校验：刚新建、刚删除的歌单还没写进副本时，也能接着排
    const display = shown(current)
    if (!validPlaylistOrder(display, playlistIds))
      return false
    const next = [...playlistIds]
    const displayed = sortablePlaylists(display)
    if (displayed && sameOrder(next, displayed.map(playlist => playlist.id)))
      return false
    const mine = generation
    const item = playlistOrder
    // 拖回原来的顺序、还没开始提交：撤掉这份修改，什么都不发
    const base = sortablePlaylists(current)
    if (base && sameOrder(next, base.map(playlist => playlist.id))) {
      if (!item || item.settled)
        return false
      if (!item.sending) {
        changes = changes.filter(entry => entry !== item.entry)
        dropPlaylistOrder(item)
        failedPlaylistOrder = null
        notice = null
        publish()
        return true
      }
    }
    if (!context.online()) {
      // 断网时先不改本地（规则⑨）；连上网络后点“重试”再把这次拖动排进去、提交
      failedPlaylistOrder = { playlistIds: next }
      notice = { kind: 'playlistOrderFailed', playlistIds: next, failure: { kind: 'offline' } }
      publish()
      return false
    }
    if (item && !item.settled) {
      item.playlistIds = next
      if (item.sending) {
        // 正在提交时又拖了：等这一份回来再发最新的；已经有一份在等的话，换掉它的顺序
        if (item.entry === item.sendingEntry) {
          item.entry = playlistOrderEntry(next)
          changes.push(item.entry)
        }
        else {
          item.entry.change = { kind: 'playlistOrder', playlistIds: [...next] }
        }
      }
      else {
        item.entry.change = { kind: 'playlistOrder', playlistIds: [...next] }
        item.cancelTimer()
        item.cancelTimer = clock.after(ORDER_MERGE_MS, () => {
          void commitPlaylistOrder(mine, item!, { keepalive: false })
        })
      }
    }
    else {
      startPlaylistOrder(mine, next)
    }
    if (notice?.kind === 'playlistOrderFailed')
      notice = null
    failedPlaylistOrder = null
    publish()
    return true
  }

  /** 提示条里的“重试”：恢复刚才的顺序，马上提交（不是先改本地再等 2 秒） */
  async function retryOrder(): Promise<void> {
    const failed = failedOrder
    if (!failed)
      return
    const current = replica
    if (!current)
      return
    const playlist = current.playlists?.find(item => item.id === failed.playlist.id)
    if (!playlist)
      return
    const mine = generation
    failedOrder = null
    if (!context.online()) {
      failedOrder = failed
      notice = { kind: 'orderFailed', playlist, songIds: failed.songIds, failure: { kind: 'offline' } }
      publish()
      return
    }
    const item = startOrder(playlist, failed.songIds)
    notice = null
    publish()
    void saveMarkers(mine)
    await commitOrder(mine, item, { keepalive: false, immediate: true })
  }

  /** 提示条里的“重试”：恢复刚才的自建歌单顺序，马上提交（不是先改本地再等 2 秒） */
  async function retryPlaylistOrder(): Promise<void> {
    const failed = failedPlaylistOrder
    const current = replica
    if (!failed || !current)
      return
    const mine = generation
    failedPlaylistOrder = null
    if (!context.online()) {
      failedPlaylistOrder = failed
      notice = { kind: 'playlistOrderFailed', playlistIds: failed.playlistIds, failure: { kind: 'offline' } }
      publish()
      return
    }
    const item = startPlaylistOrder(mine, normalizedPlaylistOrder(current, failed.playlistIds))
    notice = null
    publish()
    await commitPlaylistOrder(mine, item, { keepalive: false, immediate: true })
  }

  /** 页面被隐藏、离开歌单：还没提交的移除和排序立即提交（带 keepalive，请求体太大的用普通请求） */
  async function flush(playlistId?: number): Promise<void> {
    const mine = generation
    await Promise.all([
      ...deferred
        .filter(item => playlistId === undefined || item.playlist.id === playlistId)
        .map(item => commitRemoval(mine, item, { keepalive: true })),
      ...[...orders.values()]
        .filter(item => playlistId === undefined || item.playlist.id === playlistId)
        .map(item => commitOrder(mine, item, { keepalive: true, immediate: true })),
      ...(playlistId === undefined && playlistOrder ? [commitPlaylistOrder(mine, playlistOrder, { keepalive: true, immediate: true })] : []),
    ])
  }

  /** 批量“加入歌单”的目标：除了当前歌单以外的自建歌单；歌单列表还没拿到时是 null */
  function addTargets(currentPlaylistId: number): Playlist[] | null {
    const playlists = replica?.playlists
    if (!playlists)
      return null
    return playlists.filter(playlist => playlist.kind === 'own' && playlist.id !== currentPlaylistId)
  }

  /** 一次加入几首：已经在歌单里的不再提交；全都已经在里面时什么都不发 */
  async function addSongs(playlist: Playlist, songs: readonly Song[]): Promise<AddSongsOutcome> {
    const current = replica
    if (!current)
      return null
    const seen = new Set<number>()
    const unique = songs.filter((song) => {
      if (seen.has(song.id))
        return false
      seen.add(song.id)
      return true
    })
    const restored = restorePending(playlist.id, unique.map(song => song.id))
    const have = new Set(shown(current).tracks.get(playlist.id)?.trackIds ?? [])
    const fresh = unique.filter(song => !restored.has(song.id) && !have.has(song.id))
    if (fresh.length === 0) {
      notice = { kind: 'alreadyAdded', playlist }
      publish()
      return { ok: true, added: 0 }
    }
    if (fresh.length > TRACKS_PER_CHANGE) {
      const failure = { kind: 'invalid', problem: 'tooManySongs' } as const
      notice = { kind: 'notChanged', change: { kind: 'addMany', playlist, songs: fresh }, failure }
      publish()
      return { ok: false, failure }
    }
    const result = await applyChange({ kind: 'addMany', playlist, songs: fresh })
    if (!result)
      return null
    if (result.ok && result.value === 'done')
      return { ok: true, added: fresh.length }
    if (result.ok)
      return { ok: false, failure: { kind: 'missing' } }
    if (result.failure.kind === 'needsLogin')
      return null
    return { ok: false, failure: result.failure }
  }

  function publish(next: SyncStatus = status): void {
    status = next
    if (replica)
      context.write(stateOf(shown(replica), status, opening, pages, notice))
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

  /** 记下请求发出的那一刻（被拒后重发时重记）：拿回来的就是那一刻的网易云 */
  function stamped<T>(send: () => Promise<Result<T>>): { send: () => Promise<Result<T>>, at: () => number } {
    let at = 0
    return {
      send: () => {
        at = ++tick
        return send()
      },
      at: () => at,
    }
  }

  /**
   * 改副本的一步（同步拿到的、确认了的修改）：这一轮还算数时，轮到它才按那时的副本算出要改什么（patchOf），先写进本机数据库，
   * 再改显示着的；作废了（退出、登录失效、换账号）就什么都不写。一步一步走，免得两步交错时后写的拿着旧的副本把前面的盖掉。
   * 检查和开事务在同一步里（数据库打开后 LocalDb 当场开事务），本标签页退出时删副本的事务一定排在后面。
   * 别的标签页退出删了副本、或换了账号时，LocalDb 在写的事务里核对副本的主人，对不上就不写：这一轮停下，
   * 退出的那个标签页会广播过来（App 跟着变成未登录）
   */
  function save(mine: number, patchOf: (current: Replica) => LibraryPatch, after?: () => void): Promise<boolean> {
    const step = saving.then(async () => {
      const current = replica
      if (mine !== generation || !current)
        return false
      const patch = patchOf(current)
      if (!emptyPatch(patch) && (!await local.saveLibrary(current.owner, patch) || mine !== generation))
        return false
      Object.assign(current, patched(current, patch))
      after?.()
      publish()
      return true
    })
    saving = step.catch(() => {})
    return step
  }

  /** 一张歌单的曲目存进副本：tracks 是 at 那一刻的网易云，叠回那之后确认的修改 */
  function saveTracks(mine: number, playlistId: number, tracks: PlaylistTracks, at: number): Promise<boolean> {
    return save(mine, (current) => {
      const merged = reapplied({ ...current, tracks: new Map([[playlistId, tracks]]) }, at).tracks.get(playlistId) ?? tracks
      return { tracks: new Map([[playlistId, merged]]) }
    }, () => {
      // 拉完了：之前打开时没拉成的说明不再显示
      if (tracks.complete)
        opening.delete(playlistId)
    })
  }

  /** 把一张歌单拉到和网易云一致：更新时间变了才重拉曲目编号，再取还没有的歌曲信息 */
  /** force：上次关掉前有没确认的改动（#35），就算本机的版本看起来没变也从网易云重拉一遍 */
  async function pull(mine: number, current: Replica, playlist: Playlist, force = false): Promise<Pulled> {
    const { id } = playlist
    /** 拉的时候新的歌单列表到了，这张已经在网易云里删掉：不再往本机写它的曲目（列表到的时候已经删过了） */
    const deleted = () => current.playlists !== null && !current.playlists.some(item => item.id === id)

    /** 这张歌单的曲目，和它是哪一刻的：本机存着的就是现在的 */
    let tracks = current.tracks.get(id)
    let at = tick
    if (force || tracks?.version !== playlist.tracksUpdatedAt) {
      const request = stamped(() => api.get<TrackIdsResponse>(`/api/playlists/${id}/track-ids`))
      const fetched = await playlistRequest(mine, id, request.send)
      if (!fetched?.ok)
        return fetched
      tracks = { version: playlist.tracksUpdatedAt, trackIds: fetched.value.trackIds, complete: false }
      at = request.at()
      if (deleted())
        return { ok: true, value: undefined }
      if (!await saveTracks(mine, id, tracks, at))
        return null
    }
    if (tracks.complete)
      return { ok: true, value: undefined }
    const missing = (current.tracks.get(id) ?? tracks).trackIds.filter(songId => !current.songs.has(songId))
    for (const ids of chunks(missing, SONGS_PER_REQUEST)) {
      const page = await playlistRequest(mine, id, () => api.post<SongsResponse>('/api/songs', { ids } satisfies SongsRequest))
      if (!page?.ok)
        return page
      if (!await save(mine, () => ({ songs: page.value.songs })))
        return null
    }
    if (deleted())
      return { ok: true, value: undefined }
    return await saveTracks(mine, id, { ...tracks, complete: true }, at) ? { ok: true, value: undefined } : null
  }

  /** 拉一张歌单；同一个版本已经有一处在拉（后台同步、听众打开）就等它，不重拉；拉的是别的版本就等它拉完再拉这个 */
  function load(mine: number, current: Replica, playlist: Playlist, force = false): Promise<Pulled> {
    const { id, tracksUpdatedAt: version } = playlist
    const existing = pulling.get(id)
    if (existing?.version === version && (existing.force || !force))
      return existing.job
    const before = existing?.job.catch(() => null) ?? Promise.resolve(null)
    const job: Promise<Pulled> = before.then(() => pull(mine, current, playlist, force)).finally(() => {
      // 退出、换账号时已经清掉了，那之后开始的拉取不归它管
      if (pulling.get(id)?.job === job) {
        pulling.delete(id)
        urgent.delete(id)
      }
    })
    pulling.set(id, { version, force, job })
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
   * 同步收藏的专辑或歌手的列表：一个请求拿全，叠回比它晚确认的修改，存进本机副本。返回 'synced'：存好了；
   * 返回同步失败：内容网易云不认、SDK 认不出，跳过它接着同步别的；null：这一轮作废了，或者停下了（已经说明了原因）
   */
  async function syncCollected<T>(mine: number, path: string, patchOf: (value: T, current: Replica, at: number) => LibraryPatch): Promise<'synced' | SyncFailure | null> {
    const request = stamped(() => api.get<T>(path))
    const fetched = await background(mine, request.send)
    if (!fetched || fetched === 'gaveUp')
      return null
    if (fetched.ok)
      return await save(mine, current => patchOf(fetched.value, current, request.at())) ? 'synced' : null
    if (skippable(fetched.failure))
      return fetched.failure
    publish({ status: 'failed', failure: fetched.failure })
    return null
  }

  /**
   * 上次关掉前没确认的改动（#35）：歌单列表拿到以后，先把这几张从网易云重拉一遍、丢掉本地改动，再提示“已恢复原样”。
   * 没拉成（网易云返回认不出、断网时后台通道会等着）就留着标记，下一轮同步再试
   */
  async function recoverPending(mine: number, current: Replica): Promise<void> {
    if (recovering.size === 0)
      return
    let recovered = false
    for (const id of [...recovering]) {
      if (mine !== generation)
        return
      const playlist = current.playlists?.find(item => item.id === id)
      if (!playlist) {
        recovering.delete(id)
        recovered = true
        continue
      }
      const result = await load(mine, current, playlist, true)
      if (!result)
        return
      if (!result.ok)
        continue
      recovering.delete(id)
      recovered = true
    }
    if (recovered && mine === generation) {
      notice = { kind: 'recovered' }
      publish()
    }
    await saveMarkers(mine)
  }

  async function run(mine: number): Promise<void> {
    const current = replica
    if (mine !== generation || !current)
      return
    const startedAt = ++tick
    publish({ status: 'syncing' })
    const heartsRequest = stamped(() => api.get<HeartsResponse>(`/api/hearts?uid=${current.owner}`))
    const hearts = await background(mine, heartsRequest.send)
    if (!hearts || hearts === 'gaveUp')
      return
    if (!hearts.ok)
      return publish({ status: 'failed', failure: hearts.failure })
    if (!await save(mine, now => ({ hearts: reapplied({ ...now, hearts: hearts.value.songIds }, heartsRequest.at()).hearts! })))
      return
    const listRequest = stamped(() => api.get<PlaylistsResponse>(`/api/playlists?uid=${current.owner}`))
    const list = await background(mine, listRequest.send)
    if (!list || list === 'gaveUp')
      return
    if (!list.ok)
      return publish({ status: 'failed', failure: list.failure })
    // 在网易云里删掉的歌单：曲目跟着删（patched），打开它时没拉成的说明也不再显示
    const removeDeleted = () => {
      const kept = new Set(current.playlists?.map(playlist => playlist.id))
      for (const id of opening.keys()) {
        if (!kept.has(id))
          opening.delete(id)
      }
    }
    if (!await save(mine, now => ({ playlists: reapplied({ ...now, playlists: list.value.playlists }, listRequest.at()).playlists! }), removeDeleted))
      return
    await recoverPending(mine, current)
    if (mine !== generation)
      return

    const albums = await syncCollected<CollectedAlbumsResponse>(mine, '/api/albums', (value, now, at) => ({ albums: reapplied({ ...now, albums: value.albums }, at).albums! }))
    if (!albums)
      return
    const artists = await syncCollected<CollectedArtistsResponse>(mine, '/api/artists', (value, now, at) => ({ artists: reapplied({ ...now, artists: value.artists }, at).artists! }))
    if (!artists)
      return

    // 跳过了的（skippable）：别的照常同步，最后说没同步完
    let skipped = [albums, artists].find((result): result is SyncFailure => result !== 'synced') ?? null
    for (const playlist of current.playlists ?? []) {
      const result = await syncPlaylist(mine, current, playlist)
      if (!result)
        return
      if (result.ok)
        continue
      if (!skippable(result.failure))
        return publish({ status: 'failed', failure: result.failure })
      skipped ??= result.failure
    }
    // 这一轮的请求都是在它开始以后发的：那之前确认的修改都已经在拿回来的数据里了，不用再记着
    changes = changes.filter(entry => entry.confirmedAt === null || entry.confirmedAt > startedAt)
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
    const { playlist, trackIds, tracksUpdatedAt } = page
    const contentOf = (more: PlaylistOpening | null): NeteasePlaylistSongs => ({
      playlist,
      songs: trackIds.flatMap(id => neteaseSongs.get(id) ?? []),
      total: trackIds.length,
      complete: more === null,
      more,
      trackIds,
      tracksUpdatedAt,
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

  /** 提交一个修改的结果：做好了；歌单不在了（missing）；排序回了 -1、要重读确认（unconfirmed） */
  type Submitted = { ok: true, value: 'done' | 'missing' | 'unconfirmed' } | { ok: false, failure: ChangeFailure | Extract<RequestFailure, { kind: 'needsLogin' }> }

  function done(result: Result<unknown>): Submitted {
    return result.ok ? { ok: true, value: 'done' } : result
  }

  /**
   * 把一个修改提交给网易云（前台请求，马上发）。收藏歌单先现取一枚反作弊令牌。
   * 发之前这一轮已经作废（退出、登录失效、换账号，可能就在排队或取令牌的时候）就不发，返回 null
   */
  async function submit(mine: number, change: Change, options?: { keepalive?: boolean }): Promise<Submitted | null> {
    const post = async <T>(path: string, body: unknown): Promise<Result<T> | null> => (mine === generation ? api.post<T>(path, body, options) : null)
    const heart = heartOf(change)
    if (heart) {
      const result = await post<HeartResponse>('/api/hearts', { songId: heart.song.id, hearted: heart.hearted } satisfies HeartRequest)
      return result && done(result)
    }
    switch (change.kind) {
      case 'heart':
        throw new Error('红心在上面已经提交了')
      case 'add': {
        const result = await post<AddTracksResponse>(`/api/playlists/${change.playlist.id}/tracks`, { songIds: [change.song.id] } satisfies AddTracksRequest)
        return result && (result.ok ? { ok: true, value: result.value.kind === 'missing' ? 'missing' : 'done' } : result)
      }
      case 'addMany': {
        const result = await post<AddTracksResponse>(`/api/playlists/${change.playlist.id}/tracks`, { songIds: change.songs.map(song => song.id) } satisfies AddTracksRequest)
        return result && (result.ok ? { ok: true, value: result.value.kind === 'missing' ? 'missing' : 'done' } : result)
      }
      case 'remove': {
        const result = await post<RemoveTracksResponse>(`/api/playlists/${change.playlist.id}/tracks/remove`, { songIds: change.songIds } satisfies RemoveTracksRequest)
        return result && (result.ok ? { ok: true, value: result.value.kind === 'missing' ? 'missing' : 'done' } : result)
      }
      case 'order': {
        const result = await post<SongOrderResponse>(`/api/playlists/${change.playlist.id}/order`, { songIds: change.songIds } satisfies SongOrderRequest)
        return result && (result.ok ? { ok: true, value: result.value.kind === 'ordered' ? 'done' : result.value.kind } : result)
      }
      case 'playlistOrder': {
        const result = await post<PlaylistOrderResponse>('/api/library/order', { playlistIds: change.playlistIds } satisfies PlaylistOrderRequest)
        return result && done(result)
      }
      case 'collectAlbum': {
        const result = await post<CollectResponse>(`/api/albums/${change.album.id}/collect`, { collected: change.collected } satisfies CollectRequest)
        return result && done(result)
      }
      case 'collectArtist': {
        const result = await post<CollectResponse>(`/api/artists/${change.artist.id}/collect`, { collected: change.collected } satisfies CollectRequest)
        return result && done(result)
      }
      case 'collectPlaylist': {
        let body: PlaylistCollectRequest = { collected: false }
        if (change.collected) {
          const checkToken = await context.checkToken().catch(() => null)
          if (!checkToken)
            return { ok: false, failure: { kind: 'checkTokenUnavailable' } }
          body = { collected: true, checkToken }
        }
        const result = await post<PlaylistCollectResponse>(`/api/playlists/${change.playlist.id}/collect`, body)
        return result && (result.ok ? { ok: true, value: result.value.kind === 'missing' ? 'missing' : 'done' } : result)
      }
      case 'rename': {
        const result = await post<PlaylistChangeResponse>(`/api/playlists/${change.playlist.id}/name`, { name: change.name } satisfies RenamePlaylistRequest)
        return result && done(result)
      }
      case 'describe': {
        const result = await post<PlaylistChangeResponse>(`/api/playlists/${change.playlist.id}/description`, { description: change.description ?? '' } satisfies DescribePlaylistRequest)
        return result && done(result)
      }
      case 'tag': {
        const result = await post<PlaylistChangeResponse>(`/api/playlists/${change.playlist.id}/tags`, { tags: change.tags } satisfies TagPlaylistRequest)
        return result && done(result)
      }
      case 'publish': {
        const result = await post<PlaylistChangeResponse>(`/api/playlists/${change.playlist.id}/public`, {})
        return result && done(result)
      }
      case 'delete': {
        const result = await post<PlaylistChangeResponse>(`/api/playlists/${change.playlist.id}/delete`, {})
        return result && done(result)
      }
      default: {
        const unhandled: never = change
        throw new Error(`不认识的修改：${JSON.stringify(unhandled)}`)
      }
    }
  }

  /**
   * 取消收藏前，把它现在显示的样子记成这次登录打开过的页：取消后它不在曲库里了，页面照常显示这些，
   * 不用变回加载中（不在曲库里的歌单另外联网重取一遍，取到了换成新的）
   */
  function keepPage(current: Replica, change: Change): void {
    if (change.kind === 'collectAlbum' && !change.collected && pages.albums.get(change.album.id)?.status !== 'shown') {
      const stored = current.albumPages.get(change.album.id)
      if (stored)
        pages.albums.set(change.album.id, { status: 'shown', content: stored })
    }
    if (change.kind === 'collectPlaylist' && !change.collected && pages.playlists.get(change.playlist.id)?.status !== 'shown') {
      const tracks = current.tracks.get(change.playlist.id)
      if (!tracks)
        return
      const { songs, total, complete } = songsOf(current, change.playlist)
      for (const song of songs)
        neteaseSongs.set(song.id, song)
      pages.playlists.set(change.playlist.id, {
        status: 'shown',
        content: { playlist: change.playlist, songs, total, complete, more: null, trackIds: tracks.trackIds, tracksUpdatedAt: tracks.version },
      })
    }
  }

  /**
   * 网易云确认了、没有先改本地这一步的修改（新建好的歌单、换好的封面）：记下来、立即显示，
   * 再写进副本；同步拿回来的、比它旧的歌单列表上也会叠回去
   */
  async function confirm(mine: number, change: ConfirmedChange): Promise<boolean> {
    const entry: PendingChange = { change, confirmedAt: ++tick, saved: false }
    changes.push(entry)
    publish()
    return save(mine, now => changePatch(now, entry.change), () => {
      entry.saved = true
    })
  }

  /** 网易云确认了这个修改：写进副本。收藏专辑时打开着它的专辑页，专辑页一起存（断网也能看） */
  function confirmedPatch(current: Replica, change: Change): LibraryPatch {
    const patch = changePatch(current, change)
    if (change.kind !== 'collectAlbum' || !change.collected)
      return patch
    const page = pages.albums.get(change.album.id)
    return page?.status === 'shown' ? { ...patch, albumPages: new Map([[change.album.id, page.content]]) } : patch
  }

  /**
   * 网易云回了这个修改：成了就写进副本（加入歌单再提示一句）；歌单已经不在了就改回原样，马上同步一次；
   * 没成就改回原样并说明原因，需要登录（续期也没成功）时整个 App 变成登录失效
   */
  async function settleChange(mine: number, entry: PendingChange, change: Change, result: Submitted): Promise<void> {
    if (result.ok && result.value === 'done') {
      entry.confirmedAt = ++tick
      await save(mine, now => confirmedPatch(now, change), () => {
        entry.saved = true
        if (change.kind === 'add' || change.kind === 'addMany')
          notice = { kind: 'added', change }
      })
      return
    }
    changes = changes.filter(each => each !== entry)
    if (result.ok) {
      // 要加歌、要收藏的歌单在别处被删掉了：马上同步一次，曲库里也就没有它了
      if (change.kind === 'add' || change.kind === 'addMany' || change.kind === 'collectPlaylist')
        notice = { kind: 'playlistMissing', change }
      publish()
      return start()
    }
    if (result.failure.kind === 'needsLogin')
      return context.loginExpired()
    notice = { kind: 'notChanged', change, failure: result.failure }
    publish()
  }

  /** 换了一轮（登录、退出、登录失效）：上一轮打开、正在拉的、还没提交完的修改都不算了 */
  function forget(): void {
    pulling.clear()
    urgent.clear()
    waiting.clear()
    opening = new Map()
    pages.albums.clear()
    pages.artists.clear()
    pages.playlists.clear()
    pages.tags = null
    fetchingAlbums.clear()
    fetchingPlaylists.clear()
    neteaseSongs.clear()
    for (const item of deferred)
      item.cancelTimer()
    deferred = []
    noticeRemoval = null
    failedRemoval = null
    for (const item of orders.values())
      item.cancelTimer()
    orders.clear()
    failedOrder = null
    playlistOrder?.cancelTimer()
    playlistOrder = null
    failedPlaylistOrder = null
    recovering.clear()
    writtenMarkers.clear()
    changes = []
    submitting.clear()
    notice = null
  }

  async function applyChange(change: Change): Promise<Submitted | null> {
    const current = replica
    if (!current)
      return null
    const mine = generation
    // 不合规的（界面先拦了，这里兜底）、断网时：不改，直接说没改成（规则⑨）
    const problem = changeProblem(change)
    const failure: ChangeFailure | null = problem ? { kind: 'invalid', problem } : context.online() ? null : { kind: 'offline' }
    if (failure) {
      notice = { kind: 'notChanged', change, failure }
      publish()
      return { ok: false, failure }
    }
    keepPage(current, change)
    const entry: PendingChange = { change, confirmedAt: null, saved: false }
    changes.push(entry)
    publish()
    // 同一样东西的上一次修改连同写进副本做完了，才提交这一次；打开这张歌单（open）也等它做完
    const target = targetOf(change)
    let submitted: Submitted | null = null
    const job = (submitting.get(target) ?? Promise.resolve()).then(async () => {
      const result = await submit(mine, change)
      if (result && mine === generation) {
        submitted = result
        await settleChange(mine, entry, change, result)
      }
    })
    submitting.set(target, job)
    await job
    if (submitting.get(target) === job)
      submitting.delete(target)
    return submitted
  }

  return {
    async enter(account) {
      generation += 1
      forget()
      const mine = generation
      const [stored, pending] = await Promise.all([local.readLibrary(), local.pendingChanges(account.id)])
      const shown: Replica = stored?.owner === account.id
        ? stored
        : { owner: account.id, hearts: null, playlists: null, tracks: new Map(), songs: new Map(), albums: null, artists: null, albumPages: new Map() }
      if (shown !== stored && mine === generation)
        await local.resetLibrary(account.id)
      if (mine === generation) {
        replica = shown
        // 上次关掉前有没确认的改动：同步拿到歌单列表以后重拉这几张、恢复原样（#35）
        recovering = new Set(stored?.owner === account.id ? pending : [])
        writtenMarkers = new Set(recovering)
        status = { status: 'syncing' }
        lane.resume()
      }
      return stateOf(shown, status, opening, pages, notice)
    },
    sync: start,
    retry() {
      if (status.status !== 'failed')
        return
      publish({ status: 'syncing' })
      start()
    },
    async open(playlistId) {
      // 正在收藏、取消收藏这张歌单：等网易云回了，再看它在不在曲库里
      await submitting.get(`playlist:${playlistId}`)
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
        await save(mine, () => ({ albumPages: new Map([[albumId, page]]) }))
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
    async openPlaylistTags() {
      const shown = pages.tags
      if (!replica || shown?.status === 'loading' || shown?.status === 'shown')
        return
      const mine = generation
      pages.tags = { status: 'loading' }
      publish()
      const result = settle(mine, await api.get<PlaylistTagsResponse>('/api/playlist-tags'))
      if (!result)
        return
      pages.tags = result.ok ? { status: 'shown', content: result.value.groups } : { status: 'failed', failure: result.failure }
      publish()
    },
    async change(change) {
      await applyChange(change)
    },
    addSongs,
    removeSongs,
    undoRemove,
    restorePending,
    retryRemove,
    moveSongs,
    retryOrder,
    orderPlaylists,
    retryPlaylistOrder,
    flush,
    addTargets,
    async setCover(playlistId, coverUrl) {
      if (!replica)
        return
      await confirm(generation, { kind: 'cover', playlistId, coverUrl })
    },
    async create(draft, songs = []) {
      const name = draft.name.trim()
      const problem = nameProblem(name)
      if (problem)
        return { ok: false, failure: { kind: 'invalid', problem } }
      if (!replica)
        return null
      if (!context.online())
        return { ok: false, failure: { kind: 'offline' } }
      const mine = generation
      const result = settle(mine, await api.post<CreatePlaylistResponse>('/api/playlists', { name, private: draft.private } satisfies CreatePlaylistRequest))
      if (!result)
        return null
      if (!result.ok)
        return result
      const { playlist } = result.value
      // 网易云建好了：直接是确认过的修改，写进副本；确认之前发出的同步拿回来的歌单列表里没有它，照样叠回去
      if (!await confirm(mine, { kind: 'create', playlist }))
        return null
      if (songs.length > 0)
        void addSongs(playlist, songs)
      return { ok: true, playlistId: playlist.id }
    },
    dismissNotice() {
      if (notice?.kind === 'removed')
        noticeRemoval = null
      if (notice?.kind === 'removeFailed')
        failedRemoval = null
      if (notice?.kind === 'orderFailed')
        failedOrder = null
      if (notice?.kind === 'playlistOrderFailed')
        failedPlaylistOrder = null
      notice = null
      publish()
    },
    notify(next) {
      if (!replica)
        return
      notice = next
      publish()
    },
    leave() {
      generation += 1
      forget()
      replica = null
      lane.stop()
    },
  }
}
