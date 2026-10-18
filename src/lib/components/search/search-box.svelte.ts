import type { Suggestion } from '#lib/api/search.js'
import type { App } from '#lib/app/app.js'
import type { Suggestions } from '#lib/app/search.js'
import { goto } from '$app/navigation'
import { resolve } from '$app/paths'
import { page } from '$app/state'

// 搜索框（桌面顶栏正中的、手机搜索页顶上的）：里面的字、用 ↑↓ 选中的那一行建议、按键和按搜索。
// 手机的搜索框在骨架的顶行里，搜索历史、建议和结果在页面里，两边读写同一份

/** 建议列表的 id 和每一行的 id（读屏跟着 ↑↓ 读出选中的那一行：aria-activedescendant） */
export const SUGGESTION_LIST_ID = 'search-suggestions'
export function suggestionId(index: number): string {
  return `search-suggestion-${index}`
}

/** 正在看的搜索结果是哪个词：搜索结果页上是地址里的 q，别的页面是空的 */
export function shownKeyword(): string {
  return page.url.pathname === resolve('/search') ? (page.url.searchParams.get('q') ?? '').trim() : ''
}

/** 建议列表的一行：第一行是“搜索 <搜索框里的字>”，后面是网易云给的建议（单曲、歌手、专辑、歌单） */
export type SuggestionRow = { kind: 'search', name: string } | Suggestion

/** 搜索框里有字时建议列表的每一行（还没回来的建议先留着上一个词的） */
export function suggestionRows(draft: string, suggestions: Suggestions | null): SuggestionRow[] {
  const typed = draft.trim()
  return typed ? [{ kind: 'search', name: typed }, ...(suggestions?.items ?? [])] : []
}

export const searchBox: {
  /** 搜索框里的字（还没按搜索的也算） */
  draft: string
  /** 用 ↑↓ 选中的那一行建议（suggestionRows 的下标），-1 是没选。新的建议回来后可能超出行数，超出的当作没选 */
  active: number
} = $state({ draft: '', active: -1 })

/** 选中的那一行的 id（aria-activedescendant）；没选、超出了建议的行数时是 undefined */
export function activeSuggestionId(app: App): string | undefined {
  const rows = suggestionRows(searchBox.draft, app.state.search.suggestions)
  return searchBox.active >= 0 && searchBox.active < rows.length ? suggestionId(searchBox.active) : undefined
}

/** 换页了、收起了：搜索框里换回这一页搜的词（搜索结果页）或空的，不再要建议 */
export function resetSearchBox(app: App): void {
  searchBox.draft = shownKeyword()
  searchBox.active = -1
  app.suggest('')
}

/** 听众打字、清空：边输入边给建议 */
export function typeInSearchBox(app: App, value: string): void {
  searchBox.draft = value
  searchBox.active = -1
  app.suggest(value)
}

/**
 * 按搜索：记进搜索历史，打开这个词的结果页（搜的词放在地址的 q 里）。
 * 已经在搜索结果页上就换掉这一页：返回直接离开搜索，不在搜过的词之间来回
 */
export function submitSearch(app: App, keyword: string): void {
  const searched = keyword.trim()
  if (!searched)
    return
  searchBox.draft = searched
  searchBox.active = -1
  app.suggest('')
  void app.search(searched)
  void goto(resolve(`/search?q=${encodeURIComponent(searched)}`), { replace: page.url.pathname === resolve('/search') })
}

/**
 * 点了建议列表的一行、搜索历史里的词（当作 { kind: 'search', name }）：
 * “搜索…”那一行、单曲、搜过的词就搜这个名字；歌手、专辑、歌单直接打开它的页面（不在曲库里的歌单由那一页现取，#56）。
 * 打开页面不算搜索：不记进搜索历史，也不先清空搜索框（换页后 afterNavigate 会换回来）
 */
export function pickSuggestion(app: App, row: SuggestionRow): void {
  switch (row.kind) {
    case 'search':
    case 'song':
      submitSearch(app, row.name)
      break
    case 'artist':
      void goto(resolve('/artists/[id]', { id: String(row.id) }))
      break
    case 'album':
      void goto(resolve('/albums/[id]', { id: String(row.id) }))
      break
    case 'playlist':
      void goto(resolve('/playlists/[id]', { id: String(row.id) }))
      break
  }
}

/** 输入法还在拼字：这时的回车、方向键是给输入法的。Safari 按回车上屏的那一下 isComposing 是 false，只能看 keyCode 229 */
function composing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229
}

/** 搜索框里按键：↑↓ 在建议之间选（到头了绕回来），回车点选中的那一行（没选就是“搜索…”那一行，见 pickSuggestion）。处理了返回 true */
export function searchBoxKey(event: KeyboardEvent, app: App): boolean {
  if (composing(event))
    return false
  const rows = suggestionRows(searchBox.draft, app.state.search.suggestions)
  const at = searchBox.active < rows.length ? searchBox.active : -1
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && rows.length > 0) {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    searchBox.active = at < 0 ? (step > 0 ? 0 : rows.length - 1) : (at + step + rows.length) % rows.length
    document.getElementById(suggestionId(searchBox.active))?.scrollIntoView({ block: 'nearest' })
    return true
  }
  if (event.key === 'Enter' && rows.length > 0) {
    event.preventDefault()
    pickSuggestion(app, rows[Math.max(at, 0)])
    return true
  }
  return false
}
