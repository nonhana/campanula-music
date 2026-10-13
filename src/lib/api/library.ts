// 曲库的接口（Spec #11“服务端：Campanula API”曲库一项）。都要登录；只回界面用得到的字段。
// 同步一张歌单要两步：先拿全部曲目编号，再按页取歌曲信息（验证关卡①）

/** GET /api/hearts?uid=：红心了哪些歌。决定红心状态以它为准（我喜欢的音乐的歌曲数会对不上几首，#21 留言） */
export interface HeartsResponse {
  songIds: number[]
}

/** 曲库里的一张歌单 */
export interface Playlist {
  id: number
  name: string
  /** 网易云的原图地址；显示时按尺寸取缩略图 */
  coverUrl: string
  kind: 'liked' | 'own' | 'collected'
  /** 创建者的昵称：收藏的歌单下面写是谁的 */
  creator: string
  /** 隐私歌单：只有自己看得到 */
  private: boolean
  /** 网易云写的歌曲数。我喜欢的音乐的这个数会比曲目编号少几首（验证关卡①：4,965 对 4,968），拿到编号后以编号为准 */
  trackCount: number
  /** 曲目最后一次变动的时间（毫秒）：和本机副本里的比，变了才重拉曲目 */
  tracksUpdatedAt: number
}

/** GET /api/playlists?uid=:歌单列表，我喜欢的音乐在最前，然后是自建的、收藏的，和网易云的顺序一样；在网易云里删掉的歌单不在里面 */
export interface PlaylistsResponse {
  playlists: Playlist[]
}

/** GET /api/playlists/[id]/track-ids：这张歌单的全部曲目编号，按歌单里的顺序 */
export interface TrackIdsResponse {
  trackIds: number[]
}

/** 署名的歌手。传到云盘、没匹配上曲库的歌：歌手的编号是 0、名字是 null（SDK 2.4.0，nonhana/hana-music-api#48） */
export interface Credit {
  id: number
  name: string | null
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
  /** 网易云的原图地址，不一定是正方形；显示时按尺寸取正方形的缩略图 */
  avatarUrl: string
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
