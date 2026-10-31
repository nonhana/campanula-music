// 曲库的接口（Spec #11“服务端：Campanula API”曲库一项）。都要登录；只回界面用得到的字段。
// 同步一张歌单要两步：先拿全部曲目编号，再按页取歌曲信息（验证关卡①）

/** 红心了哪些歌。决定红心状态以它为准（我喜欢的音乐的歌曲数会对不上几首，#21 留言） */
export interface HeartsResponse {
  songIds: number[]
}

/** 红心或取消红心一首歌的请求体（一次只能一首，hana-music-api 的 like 只收一个编号） */
export interface HeartRequest {
  songId: number
  hearted: boolean
}

/** 一次加入、移除最多几首（验证关卡②：9,000 首成功；再大没验证过）；一次请求带上全部编号 */
export const TRACKS_PER_CHANGE = 9000

export interface AddTracksRequest {
  songIds: number[]
}

export interface RemoveTracksRequest {
  songIds: number[]
}

/** 整张歌单的新顺序一次提交（Spec #11）；验证关卡②录到 4,967 首可以，上限没验证过，这里拦在远大于实际曲库的数，防止请求体失控 */
export const SONGS_PER_ORDER = 20000

export interface SongOrderRequest {
  songIds: number[]
}

/** 一次提交曲库里能排序的歌单最多几张：只有我喜欢的音乐和自建歌单，数量很小；这里拦在远大于实际的数，防止请求体失控 */
export const PLAYLISTS_PER_ORDER = 1000

/** 曲库里能排序的歌单的新顺序（#37）：我喜欢的音乐和全部自建歌单的编号，我喜欢的音乐必须在最前，收藏的歌单不传 */
export interface PlaylistOrderRequest {
  playlistIds: number[]
}

export interface CollectRequest {
  collected: boolean
}

/** 收藏要带网易云的反作弊令牌（浏览器里的 Watchman 现取，服务端只透传、不记不存），取消收藏不带（官方网页版就是这样，#30 留言） */
export type PlaylistCollectRequest = { collected: true, checkToken: string } | { collected: false }

/** 歌单头部：曲库里的、不在曲库里的都一样（歌单列表和详情给的是同一份，SDK 的 PlaylistSummary）。null 是网易云没给（#78） */
export interface PlaylistInfo {
  id: number
  name: string | null
  coverUrl: string | null
  /** 收藏的、不在曲库里的歌单下面写是谁的 */
  creator: string | null
  /** 创建者的头像；网易云没给时是 null（#39） */
  creatorAvatarUrl: string | null
  playCount: number | null
  /** 没写时是 null */
  description: string | null
  tags: string[]
}

export interface Playlist extends PlaylistInfo {
  kind: 'liked' | 'own' | 'collected'
  /** 隐私歌单：只有自己看得到。网易云没给隐私标记时当作公开（#78） */
  private: boolean
  /** 网易云写的歌曲数。我喜欢的音乐的这个数会比曲目编号少几首（验证关卡①：4,965 对 4,968），拿到编号后以编号为准 */
  trackCount: number | null
  /** 曲目最后一次变动的时间（毫秒）：和本机副本里的比，变了才重拉曲目。网易云没给时是 null，本机有曲目就不重拉（#78） */
  tracksUpdatedAt: number | null
}

/** 我喜欢的音乐在网易云 user_playlist 里的 specialType（和曲库同步、mock 共用） */
const LIKED_SPECIAL_TYPE = 5

/** 从 user_playlist 的 specialType 和创建者认出这张歌单是哪一类（和曲库同步、mock 共用） */
export const playlistKindOf = (specialType: number, creatorUserId: number, uid: number): Playlist['kind'] => {
  if (specialType === LIKED_SPECIAL_TYPE)
    return 'liked'
  return creatorUserId === uid
    ? 'own'
    : 'collected'
}

/** 这张歌单能不能手动排序：自建歌单和我喜欢的音乐（#36）；收藏的歌单不能 */
export const canSortPlaylist = (kind: Playlist['kind']): boolean => kind === 'own' || kind === 'liked'

/** 把提交的顺序套到一组歌单上（#37）：只排 isSortable 的，没出现的按原来的先后接在后面，已不在列表里的编号忽略；曲库副本、提交前补齐和 mock 的写入共用 */
export const reorderSortable = <T extends { id: number }>(items: readonly T[], ids: readonly number[], isSortable: (item: T) => boolean): T[] => {
  const byId = new Map(items.map(item => [item.id, item]))
  const ordered: T[] = []
  for (const id of ids) {
    const item = byId.get(id)
    if (item && isSortable(item))
      ordered.push(item)
  }
  const seen = new Set(ordered.map(item => item.id))
  for (const item of items) {
    if (isSortable(item) && !seen.has(item.id))
      ordered.push(item)
  }
  let next = 0
  return items.map(item => isSortable(item)
    ? ordered[next++]!
    : item)
}

/** 歌单列表，我喜欢的音乐在最前，然后是自建的、收藏的，和网易云的顺序一样；在网易云里删掉的歌单不在里面 */
export interface PlaylistsResponse {
  playlists: Playlist[]
}

// 歌单的增删改（#33）：界面先拦不合规的，服务端再拦（回 400）

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
export const nameWidth = (name: string): number => {
  let width = 0
  for (let index = 0; index < name.length; index += 1) {
    width += name.charCodeAt(index) < 0x80
      ? 1
      : 2
  }
  return width
}

export type PlaylistEditProblem = 'nameEmpty' | 'nameTooLong' | 'descriptionTooLong' | 'tooManyTags' | 'tooManySongs'

/** 能提交是 null */
export const nameProblem = (name: string): PlaylistEditProblem | null => {
  if (!name)
    return 'nameEmpty'
  return nameWidth(name) > PLAYLIST_NAME_WIDTH
    ? 'nameTooLong'
    : null
}

/** name 去掉了首尾空白，1 到 PLAYLIST_NAME_WIDTH 个宽度 */
export interface CreatePlaylistRequest {
  name: string
  private: boolean
}

/** 新建好的歌单：网易云建好后再读一次它的详情（新建的返回里只有编号和名称是 SDK 声明过的，ADR-0005） */
export interface CreatePlaylistResponse {
  playlist: Playlist
}

/** 和新建一样去掉了首尾空白、1 到 PLAYLIST_NAME_WIDTH 个宽度 */
export interface RenamePlaylistRequest {
  name: string
}

/** 空字符串是清空 */
export interface DescribePlaylistRequest {
  description: string
}

/** 从标签库里选（不在标签库里的网易云会悄悄丢掉，验证关卡②） */
export interface TagPlaylistRequest {
  tags: string[]
}

/** 一类标签（语种、风格、场景、情感、主题），标签照网易云的顺序 */
export interface PlaylistTagGroup {
  name: string
  tags: string[]
}

/** 网易云的歌单标签库，每次都从网易云取，不写死（Spec #11；验证关卡②录到 70 个、5 类） */
export interface PlaylistTagsResponse {
  groups: PlaylistTagGroup[]
}

/** 按歌单里的顺序 */
export interface TrackIdsResponse {
  trackIds: number[]
}

/** 打不开的歌单：已被删除、不存在（地址不对）、别人的隐私歌单 */
export type PlaylistUnavailable = 'deleted' | 'missing' | 'private'

/** 不在曲库里的一张歌单，每次打开都联网取（ADR-0007）；歌曲信息另按页取（songs 端点）。tracksUpdatedAt 和歌单列表里的一样：收藏后它进了曲库，本机副本照它判断曲目变没变 */
export type PlaylistPageResponse
  = | { kind: 'shown', playlist: PlaylistInfo, trackIds: number[], tracksUpdatedAt: number | null }
    | { kind: 'unavailable', reason: PlaylistUnavailable }

/** 署名的歌手。传到云盘、没匹配上曲库的歌：歌手的编号是 0、名字是 null（SDK 2.4.0，nonhana/hana-music-api#48）；网易云没给的也是 null（#78） */
export interface Credit {
  id: number | null
  name: string | null
}

/** 歌手一行：没有名字的歌手（传到云盘、没匹配上曲库的歌）不列；一个都没有时写“未知歌手” */
export const creditLine = (credits: readonly Credit[]): string => {
  const names = credits.flatMap(artist => artist.name ?? [])
  return names.length > 0
    ? names.join(' / ')
    : '未知歌手'
}

/** 歌名：网易云没给时写“未知歌曲”（#78）。只在显示时换，数据里仍是 null：导出不能把它当成歌名写进文件 */
export const songTitle = (song: Pick<Song, 'name'>): string => song.name ?? '未知歌曲'

/**
 * 歌单的名字：我喜欢的音乐在网易云里叫“某某喜欢的音乐”，界面上统一叫“我喜欢的音乐”；网易云没给名字时写“未命名歌单”（#78），
 * 只在显示时换，数据里仍是 null。不在曲库里的歌单、搜索结果没有 kind。
 */
export const playlistName = (playlist: { name: string | null, kind?: Playlist['kind'] | null }): string => playlist.kind === 'liked'
  ? '我喜欢的音乐'
  : playlist.name ?? '未命名歌单'

/** 网易云图片（coverUrl、头像）的缩略图：地址加 ?param=宽y宽（原图不是正方形时网易云裁成正方形），换成 https（图片服务器支持，页面是 https 的） */
export const thumbnailUrl = (url: string, pixels: number): string => `${url.replace(/^http:/, 'https:')}?param=${pixels}y${pixels}`

// 下面这些接口里的 null：网易云没给（hana-music-api 3.x 的宽松字段缺了或类型不对，ADR-0005）。界面上歌名写“未知歌曲”、
// 歌单名写“未命名歌单”，别的文字和数字不显示这一项，封面用默认的（#78）

export interface Song {
  id: number
  name: string | null
  artists: Credit[]
  album: {
    id: number | null
    /** 传到云盘、没匹配上曲库的歌也是 null */
    name: string | null
    coverUrl: string | null
  }
  /** 时长，毫秒 */
  duration: number | null
  /** 极高音质（现在的下载音质）整首多少字节；网易云没给时是 null（#39）。下载前只用来估算，实际以下载地址返回的大小为准 */
  downloadSize: number | null
  /** 网易云的权限信息 privilege；列表里事先标出来，播放时以取到的播放地址为准。权限标记缺了按能完整播放（#78） */
  availability: Availability
  /** 专辑里的第几首；网易云不知道时写 0 */
  trackNumber: number | null
  /** 第几张碟，网易云写的原文：“01”“1/2”“CD 01 …”，也有“A”“无”“0” */
  disc: string | null
  /** 别名 */
  aliases: string[]
  /** 译名 */
  translations: string[]
  /** 发行时间（毫秒）；网易云不知道时写 0，专辑页里的歌不给 */
  publishedAt: number | null
}

export type Availability = 'full' | 'trial' | 'noCopyright'

/**
 * 一次取歌曲信息最多这么多首。网易云一次 1,000 首的原始返回约 2.1 MB，
 * 离 Vercel 单次响应 4.5 MB 的上限不远（验证关卡①），所以服务端只回 Song 里的字段
 */
export const SONGS_PER_REQUEST = 1000

/** 取歌曲信息的请求体：1 到 SONGS_PER_REQUEST 个歌曲编号 */
export interface SongsRequest {
  ids: number[]
}

/** 按请求的顺序；网易云没给的歌（比如已经下架）不在里面 */
export interface SongsResponse {
  songs: Song[]
}

export interface CollectedAlbum {
  id: number
  name: string | null
  coverUrl: string | null
  artists: Credit[]
  /** 网易云写的歌曲数：和本机存着的专辑页的对不上才重拉专辑页（两边都没给时当作没变） */
  songCount: number | null
}

/** 收藏的专辑，最近收藏的在前，和网易云的顺序一样 */
export interface CollectedAlbumsResponse {
  albums: CollectedAlbum[]
}

export interface CollectedArtist {
  id: number
  name: string | null
  /** 原图不一定是正方形；在搜索结果里收藏的、没有头像的歌手也是 null */
  avatarUrl: string | null
}

/** 收藏的歌手，最近收藏的在前，和网易云的顺序一样 */
export interface CollectedArtistsResponse {
  artists: CollectedArtist[]
}

export interface AlbumResponse {
  album: {
    id: number
    name: string | null
    coverUrl: string | null
    /** 专辑署名的歌手（网易云只给一位主要的）；没给时编号和名字都是 null */
    artist: Credit
    /** 发行时间（毫秒） */
    publishedAt: number | null
    /** 简介；没有时是 null（nonhana/hana-music-api#59） */
    description: string | null
    /** 网易云写的歌曲数：本机存着的专辑页按它判断收藏的专辑变没变（和收藏的专辑列表里的 songCount 比） */
    songCount: number | null
    /** 发行公司；网易云没写时可能是空字符串 */
    company: string | null
  }
  songs: Song[]
}

export interface ArtistAlbum {
  id: number
  name: string | null
  coverUrl: string | null
  /** 发行时间（毫秒） */
  publishedAt: number | null
}

/** 歌手页的专辑一次取这么多张。专辑最多的歌手有五千多张（#23 留言），一次全取太大 */
export const ARTIST_ALBUMS_PER_REQUEST = 100

/** 歌手页的歌曲一次取这么多首（#83 录制时网易云一次给得了 100 首）；后面还有时“显示更多” */
export const ARTIST_SONGS_PER_REQUEST = 100

/** 歌手的歌怎么排：热门（网易云的热度）、最新（发行时间，新的在前） */
export const ARTIST_SONG_ORDERS = ['hot', 'time'] as const
export type ArtistSongOrder = typeof ARTIST_SONG_ORDERS[number]

/** 歌手的一页歌曲（一种排法里从第 offset 首起） */
export interface ArtistSongsResponse {
  songs: Song[]
  /** 后面还有：用 artistSongs 端点接着取 */
  more: boolean
  /** 网易云写的这位歌手的歌曲总数；没给时是 null */
  total: number | null
}

/** 歌手页的头部、热门排法的第一页歌曲和第一页专辑（新的在前） */
export interface ArtistResponse {
  artist: {
    id: number
    name: string | null
    /** 正方形的头像 */
    avatarUrl: string | null
    songCount: number | null
    albumCount: number | null
  }
  songs: ArtistSongsResponse
  albums: ArtistAlbum[]
  /** 后面还有专辑：用 artistAlbums 端点接着取 */
  moreAlbums: boolean
}

export interface ArtistAlbumsResponse {
  albums: ArtistAlbum[]
  /** 后面还有 */
  more: boolean
}

/** 歌手简介里的一段：标题可以没有 */
export interface ArtistIntroSection {
  title: string | null
  text: string
}

/** 歌手简介：先是一段简介，下面是分段的介绍（按网易云的先后，正文是空的段不在里面） */
export interface ArtistIntroResponse {
  /** 网易云给的是空字符串（或只有空白）时是 null */
  brief: string | null
  sections: ArtistIntroSection[]
}
