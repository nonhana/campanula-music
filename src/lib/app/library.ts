import type { Account } from '#lib/api/account.js'
import type { AlbumResponse, ArtistAlbum, ArtistResponse, CollectedAlbum, CollectedArtist, CreatePlaylistRequest, Playlist, PlaylistCollectRequest, PlaylistEditProblem, PlaylistInfo, PlaylistTagGroup, PlaylistUnavailable, Song } from '#lib/api/library.js'
import type { WriteResponse } from '#lib/api/write.js'
import type { Api, Result } from './api'
import type { Clock, PageVisibility } from './browser'
import type { Change, ConfirmedChange, ImmediateChange } from './changes'
import type { Deferred, PendingChange } from './deferred'
import type { DownloadNotice } from './downloads'
import type { LibraryPatch, LocalDb, PlaylistTracks, Replica } from './local'
import type { Waiting } from './pacing'
import type { BackgroundFailure, BackgroundSessionResult, SessionFailure, SessionResult, SessionRound } from './session-round'
import { endpoints } from '#lib/api/endpoints.js'
import { nameProblem, SONGS_PER_REQUEST, TRACKS_PER_CHANGE } from '#lib/api/library.js'
import { changePatch, changeProblem, heartOf, playlistTarget, targetOf } from './changes'
import { createDeferred } from './deferred'
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

/** 同步没成功的原因；会话结束和请求节奏的等待都已经在会话一轮、后台通道里处理掉了 */
export type SyncFailure = BackgroundFailure

/** 打开歌单时没拉成的原因：前台请求不等，断网、操作频繁都直接说 */
type OpenFailure = SessionFailure

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

type SyncStatus
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
type MoreAlbums
  = | { status: 'notLoaded' }
    | { status: 'loading' }
    | { status: 'failed', failure: OpenFailure }

interface ArtistPage {
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
type NeteasePlaylistPage = PageState<NeteasePlaylistSongs> | { status: 'unavailable', reason: PlaylistUnavailable }

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
  /** 原始请求：后台同步把 send 交给请求节奏，由会话一轮判断这一轮还算不算数 */
  api: Api
  session: SessionRound
  local: LocalDb
  clock: Clock
  /** 页面可见性：晚一点才提交的修改在页面隐藏时自己立即提交（#70） */
  page: PageVisibility
  /** 曲库变了（同步拿到了新的部分、同步的状态变了） */
  write: (library: LibraryState) => void
  /** 浏览器觉得联网着（navigator.onLine）：断网时改曲库直接说没改成（规则⑨） */
  online: () => boolean
  /** 收藏歌单前现取一枚网易云的反作弊令牌（BrowserCapabilities.checkToken） */
  checkToken: () => Promise<string>
}

export interface Library {
  /** 登录了：拿出这个账号的本机副本（别的账号的清掉）。返回要显示的曲库，然后调 sync()；这一轮已经结束是 null */
  enter: (account: Account) => Promise<LibraryState | null>
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
  change: (change: ImmediateChange) => Promise<void>
  /**
   * 一次把几首加入自建歌单（多选、添加歌曲选择器）：先改本地、立即生效，再一个请求提交；
   * 已经在歌单里的不再提交，全都已经在里面时什么都不发。网易云拒绝时改回原样并说明
   */
  addSongs: (playlist: Playlist, songs: readonly Song[]) => Promise<AddSongsOutcome>
  /**
   * 从自建歌单移除几首（#35）：先从本地拿掉，提示条留 5 秒撤销，没撤销才提交。
   * 提交失败放回原位并说明、可以重试；页面隐藏、离开歌单时立即提交
   */
  removeSongs: (playlist: Playlist, songIds: readonly number[]) => void
  /** 撤销刚才的移除：放回原位，什么都不提交 */
  undoRemove: () => void
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
   * 曲库里自建歌单之间的排序（#37）：playlistIds 只是全部自建歌单的新先后，我喜欢的音乐由模块放在最前，收藏的歌单不传。
   * 不是“正好是全部自建歌单、不重复”时抛错（编程错误）。先改本地、立即生效，停手 2 秒才一次提交；
   * 页面隐藏时立即提交。断网时不改本地、直接说没改成（规则⑨）。返回顺序有没有改
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
export function filterSongs(songs: readonly Song[], query: string): Song[] {
  const term = folded(query.trim())
  const matches = (text: string | null) => text !== null && folded(text).includes(term)
  return songs.filter(song => matches(song.name) || matches(song.album.name) || song.artists.some(artist => matches(artist.name)))
}

/** 歌单内搜索：在本机副本（不在曲库里的歌单是打开时取到的歌）里即时完成 */
export function searchPlaylist(playlist: PlaylistSongs<unknown>, query: string): PlaylistSearch {
  return { songs: filterSongs(playlist.songs, query), incomplete: !playlist.complete }
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
  const { api, session, local, clock } = context
  /** 显示着的副本；没登录时是 null */
  let replica: Replica | null = null
  let status: SyncStatus = { status: 'synced' }
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
   * 听众改的、还没写进副本的修改（叠在显示着的副本上），和网易云确认过的修改（confirmedAt：确认的那一刻；
   * 同步拿回来的数据比它旧时要叠回去）。退出、换账号时清掉
   */
  let changes: PendingChange[] = []
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

  /** 晚一点才提交的修改（#70）：计时、合并、排队、标记与恢复都在这个模块里 */
  const deferred: Deferred = createDeferred({
    clock,
    page: context.page,
    local,
    session,
    replica: () => replica,
    shown: () => replica ? shown(replica) : null,
    overlay: {
      add: (entry) => {
        changes.push(entry)
      },
      remove: (match) => {
        changes = changes.filter(entry => !match(entry.change))
      },
      confirm: async (mine, entry, change) => {
        entry.change = change
        entry.confirmedAt = ++tick
        return save(mine, now => changePatch(now, change), () => {
          entry.saved = true
        })
      },
    },
    publish: () => publish(),
    notify: (next) => {
      notice = next
      publish()
    },
    notice: () => notice,
    sync: start,
    online: context.online,
  })
  /** 从自建歌单移除几首（#35）：先改本地，5 秒内可撤销，没撤销才提交 */
  function removeSongs(playlist: Playlist, songIds: readonly number[]): void {
    deferred.remove(playlist, songIds)
  }

  function undoRemove(): void {
    deferred.undoRemove()
  }

  function retryRemove(): Promise<void> {
    return deferred.retryRemove()
  }

  /** 多选里的拖动排序（#36）：把整张歌单的新顺序先改本地，停手 2 秒合并提交 */
  function moveSongs(playlistId: number, songIds: readonly number[], before: number | null): boolean {
    return deferred.moveSongs(playlistId, songIds, before)
  }

  function retryOrder(): Promise<void> {
    return deferred.retryOrder()
  }

  /** 曲库里自建歌单之间的排序（#37）：只收自建歌单的先后，我喜欢的音乐由模块放在最前 */
  function orderPlaylists(playlistIds: readonly number[]): boolean {
    return deferred.orderPlaylists(playlistIds)
  }

  function retryPlaylistOrder(): Promise<void> {
    return deferred.retryPlaylistOrder()
  }

  /** 页面被隐藏（切到后台、锁屏、关页面）或离开歌单：把还没提交的移除、排序立即提交 */
  function flush(playlistId?: number): Promise<void> {
    return deferred.flush(playlistId)
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
    const restored = deferred.restore(playlist.id, unique.map(song => song.id))
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
    return { ok: false, failure: result.failure }
  }

  function publish(next: SyncStatus = status): void {
    status = next
    if (replica)
      context.write(stateOf(shown(replica), status, opening, pages, notice))
  }

  /** 发一个后台请求：经过后台通道（操作频繁、断网时等着再发）。这一轮结束、giveUp 了都不发 */
  function background<T>(mine: number, send: () => Promise<Result<T>>, giveUp?: AbortSignal): Promise<BackgroundSessionResult<T> | 'gaveUp'> {
    return session.background(send, (waitingFor) => {
      if (session.isCurrent(mine))
        publish(waitingFor ? waitingStatus(waitingFor) : { status: 'syncing' })
    }, giveUp)
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
      if (!session.isCurrent(mine))
        return null
    }
    return session.api.request(send)
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
      if (!session.isCurrent(mine) || !current)
        return false
      const patch = patchOf(current)
      if (!emptyPatch(patch) && (!await local.saveLibrary(current.owner, patch) || !session.isCurrent(mine)))
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
      const request = stamped(() => api.get(endpoints.trackIds, { id }))
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
      const page = await playlistRequest(mine, id, () => api.post(endpoints.songs, { ids }))
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
  async function syncCollected<T>(mine: number, send: () => Promise<Result<T>>, patchOf: (value: T, current: Replica, at: number) => LibraryPatch): Promise<'synced' | SyncFailure | null> {
    const request = stamped(send)
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

  async function run(mine: number): Promise<void> {
    const current = replica
    if (!session.isCurrent(mine) || !current)
      return
    const startedAt = ++tick
    publish({ status: 'syncing' })
    const heartsRequest = stamped(() => api.get(endpoints.hearts, { uid: current.owner }))
    const hearts = await background(mine, heartsRequest.send)
    if (!hearts || hearts === 'gaveUp')
      return
    if (!hearts.ok)
      return publish({ status: 'failed', failure: hearts.failure })
    if (!await save(mine, now => ({ hearts: reapplied({ ...now, hearts: hearts.value.songIds }, heartsRequest.at()).hearts! })))
      return
    const listRequest = stamped(() => api.get(endpoints.playlists, { uid: current.owner }))
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
    await deferred.recover(mine, async (playlistId) => {
      const playlist = current.playlists?.find(item => item.id === playlistId)
      if (!playlist)
        return 'missing'
      const result = await load(mine, current, playlist, true)
      if (!result)
        return 'stopped'
      return result.ok ? 'recovered' : 'failed'
    })
    if (!session.isCurrent(mine))
      return

    const albums = await syncCollected(mine, () => api.get(endpoints.albums), (value, now, at) => ({ albums: reapplied({ ...now, albums: value.albums }, at).albums! }))
    if (!albums)
      return
    const artists = await syncCollected(mine, () => api.get(endpoints.artists), (value, now, at) => ({ artists: reapplied({ ...now, artists: value.artists }, at).artists! }))
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
    const mine = session.current
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

    const fetched = await session.api.get(endpoints.playlist, { id: playlistId })
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
      const songs = await session.api.post(endpoints.songs, { ids })
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

  /**
   * 立即修改的提交结果：做好了；歌单不在了（missing）。
   * unconfirmed 只属于延迟模块的整张歌单排序，立即修改的端点不会回它。
   */
  type Submitted = { ok: true, value: WriteResponse['kind'] } | { ok: false, failure: ChangeFailure }

  /** 写接口统一回 done / missing / unconfirmed（#lib/api/write）：这里只做一次映射 */
  function submitted(result: SessionResult<WriteResponse>): Submitted | null {
    if (!result)
      return null
    return result.ok ? { ok: true, value: result.value.kind } : result
  }

  /**
   * 把一个修改提交给网易云（前台请求，马上发）。收藏歌单先现取一枚反作弊令牌。
   * 发之前这一轮已经作废（退出、登录失效、换账号，可能就在排队或取令牌的时候）就不发，返回 null
   */
  async function submit(mine: number, change: ImmediateChange): Promise<Submitted | null> {
    const send = <T>(call: () => Promise<Result<T>>): Promise<SessionResult<T>> | null => (session.isCurrent(mine) ? session.api.request(call) : null)
    const heart = heartOf(change)
    if (heart) {
      const result = await send(() => api.post(endpoints.heart, { songId: heart.song.id, hearted: heart.hearted }))
      return result && submitted(result)
    }
    switch (change.kind) {
      case 'heart':
        throw new Error('红心在上面已经提交了')
      case 'add': {
        const result = await send(() => api.post(endpoints.addTracks, { id: change.playlist.id }, { songIds: [change.song.id] }))
        return result && submitted(result)
      }
      case 'addMany': {
        const result = await send(() => api.post(endpoints.addTracks, { id: change.playlist.id }, { songIds: change.songs.map(song => song.id) }))
        return result && submitted(result)
      }
      case 'collectAlbum': {
        const result = await send(() => api.post(endpoints.collectAlbum, { id: change.album.id }, { collected: change.collected }))
        return result && submitted(result)
      }
      case 'collectArtist': {
        const result = await send(() => api.post(endpoints.collectArtist, { id: change.artist.id }, { collected: change.collected }))
        return result && submitted(result)
      }
      case 'collectPlaylist': {
        let body: PlaylistCollectRequest = { collected: false }
        if (change.collected) {
          const checkToken = await context.checkToken().catch(() => null)
          if (!checkToken)
            return { ok: false, failure: { kind: 'checkTokenUnavailable' } }
          body = { collected: true, checkToken }
        }
        const result = await send(() => api.post(endpoints.collectPlaylist, { id: change.playlist.id }, body))
        return result && submitted(result)
      }
      case 'rename': {
        const result = await send(() => api.post(endpoints.renamePlaylist, { id: change.playlist.id }, { name: change.name }))
        return result && submitted(result)
      }
      case 'describe': {
        const result = await send(() => api.post(endpoints.describePlaylist, { id: change.playlist.id }, { description: change.description ?? '' }))
        return result && submitted(result)
      }
      case 'tag': {
        const result = await send(() => api.post(endpoints.tagPlaylist, { id: change.playlist.id }, { tags: change.tags }))
        return result && submitted(result)
      }
      case 'publish': {
        const result = await send(() => api.post(endpoints.publishPlaylist, { id: change.playlist.id }, undefined))
        return result && submitted(result)
      }
      case 'delete': {
        const result = await send(() => api.post(endpoints.deletePlaylist, { id: change.playlist.id }, undefined))
        return result && submitted(result)
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
    deferred.forget()
    changes = []
    notice = null
  }

  async function applyChange(change: ImmediateChange): Promise<Submitted | null> {
    const current = replica
    if (!current)
      return null
    const mine = session.current
    // 5 秒撤销窗口里把移除的一首加回来：撤掉待提交的移除就行，它还在网易云上，不用再发加入。
    // 放在断网判断前面：和以前一样，断网时加回待提交的移除也照样放回原位
    if (change.kind === 'add' && change.playlist.kind === 'own' && deferred.restore(change.playlist.id, [change.song.id]).has(change.song.id))
      return null
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
    await deferred.serialize(target, async () => {
      const result = await submit(mine, change)
      if (result && session.isCurrent(mine)) {
        submitted = result
        await settleChange(mine, entry, change, result)
      }
    })
    return submitted
  }

  /** 退出、登录失效、换账号：上一轮打开、正在拉的、还没提交完的修改都不算了 */
  function leave(): void {
    forget()
    replica = null
  }

  context.session.onChange((change) => {
    if (change.kind !== 'signedIn')
      leave()
  })

  return {
    async enter(account) {
      const mine = session.current
      // 旧的登录回来得晚：这一轮已经换掉了，不能再碰新一轮的曲库
      if (!session.isCurrent(mine))
        return null
      forget()
      const [stored, pending] = await Promise.all([local.readLibrary(), local.pendingChanges(account.id)])
      const shown: Replica = stored?.owner === account.id
        ? stored
        : { owner: account.id, hearts: null, playlists: null, tracks: new Map(), songs: new Map(), albums: null, artists: null, albumPages: new Map() }
      if (shown !== stored && session.isCurrent(mine))
        await local.resetLibrary(account.id)
      if (!session.isCurrent(mine))
        return null
      replica = shown
      // 上次关掉前有没确认的改动：同步拿到歌单列表以后重拉这几张、恢复原样（#35）
      deferred.resume(stored?.owner === account.id ? pending : [])
      status = { status: 'syncing' }
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
      await deferred.settled(playlistTarget(playlistId))
      const current = replica
      if (!current?.playlists)
        return
      const playlist = current.playlists.find(item => item.id === playlistId)
      if (!playlist)
        return openNetease(playlistId)
      if (upToDate(current, playlist))
        return
      const mine = session.current
      urgent.add(playlistId)
      waiting.get(playlistId)?.abort()
      opening.set(playlistId, { status: 'loading' })
      publish()
      const result = await load(mine, current, playlist)
      if (!result || !session.isCurrent(mine))
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
      const mine = session.current
      const stored = current.albumPages.get(albumId)
      // 存着的就是现在的样子（收藏的专辑列表每次同步都拿新的）：不拉
      if (stored && stored.album.songCount === current.albums?.find(album => album.id === albumId)?.songCount)
        return
      fetchingAlbums.add(albumId)
      if (!stored) {
        pages.albums.set(albumId, { status: 'loading' })
        publish()
      }
      const result = await session.api.get(endpoints.album, { id: albumId })
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
      pages.artists.set(artistId, { status: 'loading' })
      publish()
      const result = await session.api.get(endpoints.artist, { id: artistId })
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
      const page = shown.content
      const show = (content: ArtistPage) => {
        pages.artists.set(artistId, { status: 'shown', content })
        publish()
      }
      show({ ...page, moreAlbums: { status: 'loading' } })
      const result = await session.api.get(endpoints.artistAlbums, { id: artistId, offset: page.albums.length })
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
      pages.tags = { status: 'loading' }
      publish()
      const result = await session.api.get(endpoints.playlistTags)
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
      await confirm(session.current, { kind: 'cover', playlistId, coverUrl })
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
      const mine = session.current
      const result = await session.api.post(endpoints.createPlaylist, { name, private: draft.private })
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
      deferred.dismiss()
      notice = null
      publish()
    },
    notify(next) {
      if (!replica)
        return
      notice = next
      publish()
    },
  }
}
