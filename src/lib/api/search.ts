import type { Song } from './library'

// 搜索的接口（Spec #11“服务端：Campanula API”搜索一项）。都要登录；关键词放在 keywords 里

/** 边输入边给的一条建议：点它就是搜这个名字（#31） */
export interface Suggestion {
  kind: 'song' | 'artist' | 'album'
  name: string
}

/** GET /api/search/suggestions?keywords=：网易云给的建议，单曲、歌手、专辑依次排，同一个名字只出现一次 */
export interface SuggestionsResponse {
  suggestions: Suggestion[]
}

/** 单曲结果一次取这么多首（网易云最多给 300 首） */
export const SEARCH_SONGS_PER_REQUEST = 100

/** GET /api/search/songs?keywords=：单曲结果的前 SEARCH_SONGS_PER_REQUEST 首，按网易云的顺序 */
export interface SearchSongsResponse {
  songs: Song[]
}
