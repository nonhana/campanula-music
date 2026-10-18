import type { Credit, Song } from './library'

// 搜索的接口（Spec #11“服务端：Campanula API”搜索一项）。都要登录；关键词放在 keywords 里

/**
 * 边输入边给的一条建议（#31）：点单曲是搜这首的名字；歌手、专辑、歌单带编号，点了进它的页面
 * （歌单不在曲库里时联网现取，#56）
 */
export type Suggestion
  = | { kind: 'song', name: string }
    | { kind: 'artist' | 'album' | 'playlist', id: number, name: string }

/** GET /api/search/suggestions?keywords=：网易云给的建议，单曲、歌手、专辑、歌单依次排 */
export interface SuggestionsResponse {
  suggestions: Suggestion[]
}

/** 搜索结果的四类：单曲、歌单、歌手、专辑（结果页的综合由这四类各自的第一页拼成） */
export type SearchKind = 'songs' | 'playlists' | 'artists' | 'albums'

/** 四类的先后：标签和综合里都是这个顺序 */
export const SEARCH_KINDS: readonly SearchKind[] = ['songs', 'playlists', 'artists', 'albums']

/** 每类结果一次取这么多（网易云自己的分页也是 30） */
export const SEARCH_RESULTS_PER_REQUEST = 30

/** 歌单结果里的一张歌单 */
export interface SearchedPlaylist {
  id: number
  name: string
  /** 网易云的原图地址；显示时按尺寸取缩略图 */
  coverUrl: string
  /** 创建者的昵称 */
  creator: string
  trackCount: number
  playCount: number
}

/** 歌手结果里的一位歌手 */
export interface SearchedArtist {
  id: number
  name: string
  /** 网易云的原图地址；有的歌手没有头像，是 null */
  avatarUrl: string | null
  /** 网易云写的单曲数 */
  songCount: number
}

/** 专辑结果里的一张专辑 */
export interface SearchedAlbum {
  id: number
  name: string
  /** 网易云的原图地址；显示时按尺寸取缩略图 */
  coverUrl: string
  artists: Credit[]
  /** 发行时间（毫秒） */
  publishedAt: number
}

/** 每类结果的一项 */
export interface SearchedItems {
  songs: Song
  playlists: SearchedPlaylist
  artists: SearchedArtist
  albums: SearchedAlbum
}

/**
 * GET /api/search/<kind>?keywords=&offset=：这类结果从网易云的第 offset 个起的一页（SEARCH_RESULTS_PER_REQUEST 个），按网易云的顺序。
 * total 是网易云这一次说的总数（单曲最多给几百首；翻页时会变，同一项也可能在后面的页里再出现一次）
 */
export interface SearchPageResponse<K extends SearchKind = SearchKind> {
  items: SearchedItems[K][]
  total: number
}
