import type { SearchedItems, SearchKind, Suggestion } from '#lib/api/search.js'
import { SEARCH_KINDS } from '#lib/api/search.js'
import type { SearchFailure } from '#lib/app/search.js'

import { failureText } from '../shared/failure'

// 搜索在界面上怎么写：建议是哪一类、哪一段和搜索框里一样，结果页有哪些标签、每类叫什么，没搜成时怎么说

/** 建议是哪一类 */
export const SUGGESTION_KINDS: Record<Suggestion['kind'], string> = {
  song: '单曲',
  artist: '歌手',
  album: '专辑',
  playlist: '歌单',
}

/** 结果页的标签：综合（地址里没有 type）和四类 */
export type SearchTab = 'all' | SearchKind

/** 取到的一类结果，带上是哪一类：按类分开画时，每一类拿到的是自己那一类的项 */
export type KindItems = { [K in SearchKind]: { kind: K, items: readonly SearchedItems[K][] } }[SearchKind]

/** 每类结果在界面上叫什么、论什么数（首、张、位） */
export const KIND_WORDS: Record<SearchKind, { label: string, unit: string }> = {
  songs: { label: '单曲', unit: '首' },
  playlists: { label: '歌单', unit: '张' },
  artists: { label: '歌手', unit: '位' },
  albums: { label: '专辑', unit: '张' },
}

/** 标签从左到右 */
export const SEARCH_TABS: readonly { key: SearchTab, label: string }[] = [
  { key: 'all', label: '综合' },
  ...SEARCH_KINDS.map(kind => ({ key: kind, label: KIND_WORDS[kind].label })),
]

/** 地址里的 type 是哪个标签：四类之一，没有或者不认识的是综合 */
export const searchTabOf = (type: string | null): SearchTab => SEARCH_KINDS.find(kind => kind === type) ?? 'all'

/** 结果页这个标签的地址（resolve 之前）：选中的标签写进 type，综合不写 */
export const searchPath = (keyword: string, tab: SearchTab): `/search?q=${string}` => `/search?q=${encodeURIComponent(keyword)}${tab === 'all'
  ? ''
  : `&type=${tab}`}`

/** 标签和它管的那一块内容的 id（读屏把标签和内容对上：aria-controls、aria-labelledby） */
export const SEARCH_PANEL_ID = 'search-results'
export const searchTabId = (tab: SearchTab): string => `search-tab-${tab}`

/** 综合里每类先列几项：单曲几行，歌单一排（宽屏 6 张，窄了少几张），歌手、专辑一排横向架子 */
export const OVERVIEW_COUNTS: Record<SearchKind, number> = {
  songs: 5,
  playlists: 6,
  artists: 12,
  albums: 12,
}

/** 名字里和搜索框里的字一样的那一段（不分大小写）：[前面, 一样的, 后面]；网易云按拼音、简繁这类找到的没有一样的，整段在前面 */
export const matchedParts = (name: string, typed: string): [string, string, string] => {
  const at = typed
    ? name.toLowerCase().indexOf(typed.toLowerCase())
    : -1
  if (at < 0)
    return [name, '', '']
  return [
    name.slice(0, at),
    name.slice(at, at + typed.length),
    name.slice(at + typed.length),
  ]
}

/** 搜索结果没拉到时怎么说：断网时标题说要联网，不写正文；别的正文是原因 */
export const searchFailure = (failure: SearchFailure): { title: string, body?: string } => {
  if (failure.kind === 'offline')
    return { title: '搜索要联网' }
  return {
    title: '这次没搜成',
    body: failureText(failure),
  }
}
