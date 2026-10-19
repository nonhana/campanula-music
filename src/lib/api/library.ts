// 曲库的接口（Spec #11“服务端：Campanula API”曲库一项）。都要登录；只回界面用得到的字段。
// 同步一张歌单要两步：先拿全部曲目编号，再按页取歌曲信息（验证关卡①）

/** GET /api/hearts?uid=：红心了哪些歌。决定红心状态以它为准（我喜欢的音乐的歌曲数会对不上几首，#21 留言） */
export interface HeartsResponse {
  songIds: number[]
}

/** POST /api/hearts：红心或取消红心一首歌（一次只能一首，hana-music-api 的 like 只收一个编号） */
export interface HeartRequest {
  songId: number
  hearted: boolean
}

export interface HeartResponse {
  hearted: boolean
}

/**
 * 加入歌单、从歌单移除一次最多几首（验证关卡②：一次加 9,000 首成功；再大没验证过）。
 * 批量加入、批量移除都是一次请求带上全部编号
 */
export const TRACKS_PER_CHANGE = 9000

/** POST /api/playlists/[id]/tracks：加入歌单（自建歌单；我喜欢的音乐用红心）。1 到 TRACKS_PER_CHANGE 首 */
export interface AddTracksRequest {
  songIds: number[]
}

/** 加好了（已经在歌单里的歌也算加好了）；这张歌单在网易云里已经不在了（被删掉了）是 missing */
export type AddTracksResponse = { kind: 'added' } | { kind: 'missing' }

/** POST /api/playlists/[id]/tracks/remove：从自建歌单移除歌。1 到 TRACKS_PER_CHANGE 首 */
export interface RemoveTracksRequest {
  songIds: number[]
}

/** 移除了（不在歌单里的歌网易云也照样接受）；这张歌单在网易云里已经不在了（被删掉了）是 missing */
export type RemoveTracksResponse = { kind: 'removed' } | { kind: 'missing' }

/**
 * 一次提交整张歌单的新顺序最多几首（Spec #11：整张歌单的新顺序一次提交）。
 * 验证关卡②录到 4,967 首可以；上限没有验证过，这里拦在远大于实际曲库的数，防止请求体失控
 */
export const SONGS_PER_ORDER = 20000

/** POST /api/playlists/[id]/order：整张歌单的新顺序（自建歌单、我喜欢的音乐），按歌单里的先后排列 */
export interface SongOrderRequest {
  songIds: number[]
}

/**
 * 新顺序提交了；这张歌单在网易云里已经不在了是 missing；
 * 网易云回 -1“请求异常，请稍后重试”时是 unconfirmed：几千首位置都变的排序其实已经生效，要重新读一次这张歌单确认
 */
export type SongOrderResponse = { kind: 'ordered' } | { kind: 'missing' } | { kind: 'unconfirmed' }

/** POST /api/albums/[id]/collect、/api/artists/[id]/collect：收藏或取消收藏 */
export interface CollectRequest {
  collected: boolean
}

/**
 * POST /api/playlists/[id]/collect：收藏歌单要带网易云的反作弊令牌（浏览器里的官方 Watchman 现取，服务端只透传给 SDK、不记不存），
 * 取消收藏不带（官方网页版就是这样，#30 留言）
 */
export type PlaylistCollectRequest = { collected: true, checkToken: string } | { collected: false }

export interface CollectResponse {
  collected: boolean
}

/** 收藏、取消收藏歌单：做好了；这张歌单在网易云里已经不在了（被创建者删掉了）是 missing */
export type PlaylistCollectResponse = { kind: 'done' } | { kind: 'missing' }

/**
 * 一张歌单头部的信息：曲库里的、不在曲库里的都一样（网易云的歌单列表和歌单详情给的是同一份歌单，SDK 的 PlaylistSummary）
 */
export interface PlaylistInfo {
  id: number
  name: string
  /** 网易云的原图地址；显示时按尺寸取缩略图 */
  coverUrl: string
  /** 创建者的昵称：收藏的、不在曲库里的歌单下面写是谁的 */
  creator: string
  playCount: number
  /** 简介；没写时是 null */
  description: string | null
  tags: string[]
}

/** 曲库里的一张歌单 */
export interface Playlist extends PlaylistInfo {
  kind: 'liked' | 'own' | 'collected'
  /** 隐私歌单：只有自己看得到 */
  private: boolean
  /** 网易云写的歌曲数。我喜欢的音乐的这个数会比曲目编号少几首（验证关卡①：4,965 对 4,968），拿到编号后以编号为准 */
  trackCount: number
  /** 曲目最后一次变动的时间（毫秒）：和本机副本里的比，变了才重拉曲目 */
  tracksUpdatedAt: number
}

/** 这张歌单能不能手动排序：自建歌单和我喜欢的音乐（#36）；收藏的歌单不能 */
export function canSortPlaylist(kind: Playlist['kind']): boolean {
  return kind === 'own' || kind === 'liked'
}

/** GET /api/playlists?uid=:歌单列表，我喜欢的音乐在最前，然后是自建的、收藏的，和网易云的顺序一样；在网易云里删掉的歌单不在里面 */
export interface PlaylistsResponse {
  playlists: Playlist[]
}

// 歌单的增删改（#33）：新建、删除自建歌单，改名称、简介、标签，隐私歌单改公开。界面先拦不合规的，服务端再拦（回 400）

/** 歌单名称最多这么宽（验证关卡②：40 个英文字母、20 个汉字可以，多一个网易云就回“标题字数异常”） */
export const PLAYLIST_NAME_WIDTH = 40
/** 简介最多这么多字：原型定的；网易云收 1,001 个汉字（#33 录制），上限比这个大 */
export const PLAYLIST_DESCRIPTION_LENGTH = 1000
/** 一张歌单最多几个标签（验证关卡②：4 个回“标签数据非法”） */
export const PLAYLIST_TAGS_MAX = 3

/**
 * 歌单名称有多宽：ASCII 字符算 1，别的（汉字、假名、全角符号）算 2。按 UTF-16 码元数，表情这类占两个码元的算 4：
 * 网易云怎么算表情不知道，往宽里算，不放过网易云会拒的名称
 */
export function nameWidth(name: string): number {
  let width = 0
  for (let index = 0; index < name.length; index += 1)
    width += name.charCodeAt(index) < 0x80 ? 1 : 2
  return width
}

/** 新建歌单、改名称、简介、标签，或者一次改太多首歌时不能提交的原因 */
export type PlaylistEditProblem = 'nameEmpty' | 'nameTooLong' | 'descriptionTooLong' | 'tooManyTags' | 'tooManySongs'

/** 歌单名称（去掉首尾空白后的）不能提交的原因；能提交是 null */
export function nameProblem(name: string): PlaylistEditProblem | null {
  if (!name)
    return 'nameEmpty'
  return nameWidth(name) > PLAYLIST_NAME_WIDTH ? 'nameTooLong' : null
}

/** POST /api/playlists：新建自建歌单。name 去掉了首尾空白，1 到 PLAYLIST_NAME_WIDTH 个宽度 */
export interface CreatePlaylistRequest {
  name: string
  private: boolean
}

/** 新建好的歌单：网易云建好后再读一次它的详情（新建的返回里只有编号和名称是 SDK 声明过的，ADR-0005） */
export interface CreatePlaylistResponse {
  playlist: Playlist
}

/** POST /api/playlists/[id]/name：改自建歌单的名称，和新建一样去掉了首尾空白、1 到 PLAYLIST_NAME_WIDTH 个宽度 */
export interface RenamePlaylistRequest {
  name: string
}

/** POST /api/playlists/[id]/description：改简介，最多 PLAYLIST_DESCRIPTION_LENGTH 个字；空字符串是清空 */
export interface DescribePlaylistRequest {
  description: string
}

/** POST /api/playlists/[id]/tags：换一组标签，0 到 PLAYLIST_TAGS_MAX 个，从标签库里选的（不在标签库里的网易云会悄悄丢掉，验证关卡②） */
export interface TagPlaylistRequest {
  tags: string[]
}

/**
 * POST /api/playlists/[id]/name、description、tags、public（隐私歌单改公开）、delete（删除自建歌单）都回它：做好了。
 * 歌单已经被删掉时网易云照样回 200（验证关卡②、#33 录制），要等下一次同步发现它不在歌单列表里了
 */
export interface PlaylistChangeResponse {
  done: true
}

/** 标签库里的一类（语种、风格、场景、情感、主题），标签照网易云的顺序 */
export interface PlaylistTagGroup {
  name: string
  tags: string[]
}

/** GET /api/playlist-tags：网易云的歌单标签库，每次都从网易云取，不写死（Spec #11；验证关卡②录到 70 个、5 类） */
export interface PlaylistTagsResponse {
  groups: PlaylistTagGroup[]
}

/** GET /api/playlists/[id]/track-ids：这张歌单的全部曲目编号，按歌单里的顺序 */
export interface TrackIdsResponse {
  trackIds: number[]
}

/** 打不开的歌单：已被删除、不存在（地址不对）、别人的隐私歌单 */
export type PlaylistUnavailable = 'deleted' | 'missing' | 'private'

/**
 * GET /api/playlists/[id]：不在曲库里的一张歌单，每次打开都联网取（ADR-0007）。头部和全部曲目编号（按歌单里的顺序），
 * 歌曲信息另外按页取（/api/songs）；打不开时说明原因。tracksUpdatedAt 和歌单列表里的一样：收藏后它进了曲库，本机副本照它判断曲目变没变
 */
export type PlaylistPageResponse
  = | { kind: 'shown', playlist: PlaylistInfo, trackIds: number[], tracksUpdatedAt: number }
    | { kind: 'unavailable', reason: PlaylistUnavailable }

/** 署名的歌手。传到云盘、没匹配上曲库的歌：歌手的编号是 0、名字是 null（SDK 2.4.0，nonhana/hana-music-api#48） */
export interface Credit {
  id: number
  name: string | null
}

/** 歌手一行：没有名字的歌手（传到云盘、没匹配上曲库的歌）不列；一个都没有时写“未知歌手” */
export function creditLine(credits: readonly Credit[]): string {
  const names = credits.flatMap(artist => artist.name ?? [])
  return names.length > 0 ? names.join(' / ') : '未知歌手'
}

/** 网易云图片（coverUrl、头像）的缩略图：地址加 ?param=宽y宽（原图不是正方形时网易云裁成正方形），换成 https（图片服务器支持，页面是 https 的） */
export function thumbnailUrl(url: string, pixels: number): string {
  return `${url.replace(/^http:/, 'https:')}?param=${pixels}y${pixels}`
}

export interface Song {
  id: number
  name: string
  artists: Credit[]
  album: {
    id: number
    /** 传到云盘、没匹配上曲库的歌是 null */
    name: string | null
    /** 网易云的原图地址；显示时按尺寸取缩略图 */
    coverUrl: string
  }
  /** 时长，毫秒 */
  duration: number
  /**
   * 这个账号能不能放（网易云的权限信息 privilege）：完整的；只能放试听片段（会员歌对非会员）；无版权，不能放。
   * 列表里事先标出来，播放时以取到的播放地址为准
   */
  availability: Availability
}

export type Availability = 'full' | 'trial' | 'noCopyright'

/** 能点来放：无版权的不能（只能放试听片段的也能放） */
export function playable(song: Song): boolean {
  return song.availability !== 'noCopyright'
}

/**
 * POST /api/songs 一次最多取这么多首。网易云一次 1,000 首的原始返回约 2.1 MB，
 * 离 Vercel 单次响应 4.5 MB 的上限不远（验证关卡①），所以服务端只回 Song 里的字段
 */
export const SONGS_PER_REQUEST = 1000

/** POST /api/songs 的请求体：1 到 SONGS_PER_REQUEST 个歌曲编号 */
export interface SongsRequest {
  ids: number[]
}

/** 按请求的顺序；网易云没给的歌（比如已经下架）不在里面 */
export interface SongsResponse {
  songs: Song[]
}

/** 曲库里收藏的一张专辑 */
export interface CollectedAlbum {
  id: number
  name: string
  /** 网易云的原图地址；显示时按尺寸取缩略图 */
  coverUrl: string
  artists: Credit[]
  /** 网易云写的歌曲数：和本机存着的专辑页的对不上才重拉专辑页 */
  songCount: number
}

/** GET /api/albums：收藏的专辑，最近收藏的在前，和网易云的顺序一样 */
export interface CollectedAlbumsResponse {
  albums: CollectedAlbum[]
}

/** 曲库里收藏的一位歌手 */
export interface CollectedArtist {
  id: number
  name: string
  /** 网易云的原图地址，不一定是正方形；显示时按尺寸取正方形的缩略图。在搜索结果里收藏的、没有头像的歌手是 null */
  avatarUrl: string | null
}

/** GET /api/artists：收藏的歌手，最近收藏的在前，和网易云的顺序一样 */
export interface CollectedArtistsResponse {
  artists: CollectedArtist[]
}

/** GET /api/albums/[id]：专辑页 */
export interface AlbumResponse {
  album: {
    id: number
    name: string
    coverUrl: string
    /** 专辑署名的歌手（网易云只给一位主要的） */
    artist: Credit
    /** 发行时间（毫秒） */
    publishedAt: number
    /** 简介；没有时是 null（nonhana/hana-music-api#59） */
    description: string | null
    /** 网易云写的歌曲数：本机存着的专辑页按它判断收藏的专辑变没变（和收藏的专辑列表里的 songCount 比） */
    songCount: number
  }
  /** 曲目，按专辑里的顺序 */
  songs: Song[]
}

/** 歌手页里的一张专辑 */
export interface ArtistAlbum {
  id: number
  name: string
  coverUrl: string
  /** 发行时间（毫秒） */
  publishedAt: number
}

/** 歌手页的专辑一次取这么多张。专辑最多的歌手有五千多张（#23 留言），一次全取太大 */
export const ARTIST_ALBUMS_PER_REQUEST = 100

/** GET /api/artists/[id]：歌手页的头部、热门歌曲（网易云给 50 首）和第一页专辑（新的在前） */
export interface ArtistResponse {
  artist: {
    id: number
    name: string
    /** 正方形的头像 */
    avatarUrl: string
    songCount: number
    albumCount: number
  }
  hotSongs: Song[]
  albums: ArtistAlbum[]
  /** 后面还有专辑：用 /api/artists/[id]/albums 接着取 */
  moreAlbums: boolean
}

/** GET /api/artists/[id]/albums?offset=：歌手页从第 offset 张往后的一页专辑 */
export interface ArtistAlbumsResponse {
  albums: ArtistAlbum[]
  /** 后面还有 */
  more: boolean
}
