import { endpoints, searchPage } from '#lib/api/endpoints.js'
import type { Song } from '#lib/api/library.js'
import type { SearchedItems, SearchKind, SearchPageResponse, Suggestion } from '#lib/api/search.js'
import { SEARCH_KINDS } from '#lib/api/search.js'

import type { Clock } from './browser'
import type { LocalDb } from './local'
import type { SessionApi, SessionFailure, SessionResult, SessionRound } from './session-round'

// 搜索（#31、#32，Spec #11“搜索”）：边输入边给建议；按搜索后四类各自拉第一页，每类再一页一页地取。
// 搜索历史只存在这台设备上，退出、换账号都不删；会话一轮结束时 App 清掉建议和结果，旧一轮的回复由会话一轮丢掉。

/** 听众停手这么久（毫秒）才问网易云要建议：接着打字时不每个字问一次 */
export const SUGGEST_DELAY = 200
const SEARCH_HISTORY_MAX = 20

export interface Suggestions {
  keyword: string
  items: readonly Suggestion[]
}

export type SearchFailure = SessionFailure

type MoreResults
  = | { status: 'notLoaded' }
    | { status: 'loading' }
    | { status: 'failed', failure: SearchFailure }

export type SearchList<K extends SearchKind = SearchKind>
  = | { status: 'loading' }
    /** 第一页没拉到；再打开一次就是重试 */
    | { status: 'failed', failure: SearchFailure }
    | {
      status: 'shown'
      /** 按网易云的顺序；翻页时在后面的页里又给了一次的不再列 */
      items: readonly SearchedItems[K][]
      total: number
      offset: number
      more: MoreResults | null
    }

type SearchResults = { keyword: string } & { [K in SearchKind]: SearchList<K> }

export interface SearchState {
  /** 新的在前，同一个词只有一个 */
  history: readonly string[]
  /** 最后一次回来的、给最后打的词的（接着打字时先留着上一个词的）；搜索框空着是 null，没问到时 items 是空的 */
  suggestions: Suggestions | null
  /** 只记着最后一次搜的词的 */
  results: SearchResults | null
}

export const INITIAL_SEARCH: SearchState = { history: [], suggestions: null, results: null }

/** 排到最前，原来有的挪过来，超出的去掉最旧的 */
const remembered = (history: readonly string[], keyword: string): string[] => [
  keyword,
  ...history.filter(each => each !== keyword),
].slice(0, SEARCH_HISTORY_MAX)

/** 从第 offset 个起的一页接在后面；翻页时又给了一次的（#32 录到过）只留第一次的 */
const appended = <K extends SearchKind>(items: readonly SearchedItems[K][], page: SearchPageResponse<K>, offset: number): SearchList<K> => {
  const seen = new Set(items.map(item => item.id))
  const fresh: SearchedItems[K][] = []
  for (const item of page.items) {
    if (!seen.has(item.id))
      fresh.push(item)
    seen.add(item.id)
  }
  const next = offset + page.items.length
  // 空的一页就当作取完了，不再一直问
  const more = page.items.length > 0 && next < page.total
    ? { status: 'notLoaded' } as const
    : null
  return {
    status: 'shown',
    items: [
      ...items,
      ...fresh,
    ],
    total: page.total,
    offset: next,
    more,
  }
}

export interface SearchContext {
  api: SessionApi
  session: SessionRound
  clock: Clock
  local: Pick<LocalDb, 'changeSearchHistory'>
  read: () => SearchState
  write: (search: SearchState) => void
}

export interface Search {
  /** 空的就收起建议；停手 SUGGEST_DELAY 毫秒后问这个词，回来时已经又打了别的就不要了 */
  suggest: (keyword: string) => void
  /** 记进搜索历史（存在本机），打开这个词的结果 */
  search: (keyword: string) => Promise<void>
  /** 记着的是别的词就用前台请求把四类的第一页一起拉；这个词的结果记着时只重拉第一页没拉成的那几类 */
  open: (keyword: string) => Promise<void>
  /** 后面还有、没在取就取下一页接在后面 */
  more: (keyword: string, kind: SearchKind) => Promise<void>
  /** 只要网易云的第一页，不记搜索历史、不动搜索结果页；这一轮结束时是 null，没搜到是空数组 */
  searchSongs: (keyword: string) => Promise<SessionResult<readonly Song[]>>
  clearHistory: () => Promise<void>
}

export const createSearch = (context: SearchContext): Search => {
  const { api, clock, local } = context
  let typed = ''
  let cancelWait: (() => void) | null = null

  const update = (next: Partial<SearchState>): void => {
    context.write({
      ...context.read(),
      ...next,
    })
  }

  const ask = async (keyword: string): Promise<void> => {
    const result = await api.get(endpoints.suggestions, { keywords: keyword })
    if (keyword !== typed)
      return
    if (result?.ok) {
      return update({
        suggestions: { keyword, items: result.value.suggestions },
      })
    }
    // 建议只是顺手的：没问到、这一轮结束了就不给，按搜索时再说明原因
    update({
      suggestions: { keyword, items: [] },
    })
  }

  const stopWaiting = (): void => {
    cancelWait?.()
    cancelWait = null
  }

  const pageOf = <K extends SearchKind>(kind: K, keyword: string, offset: number): Promise<SessionResult<SearchPageResponse<K>>> => api.get(searchPage(kind), { keywords: keyword, offset })

  /** 还是这个词的结果页才换 */
  const show = <K extends SearchKind>(keyword: string, kind: K, list: SearchList<K>): void => {
    const results = context.read().results
    if (results?.keyword === keyword) {
      update({
        results: { ...results, [kind]: list },
      })
    }
  }

  const first = async (keyword: string, kind: SearchKind): Promise<void> => {
    const result = await pageOf(kind, keyword, 0)
    if (context.read().results?.keyword !== keyword)
      return
    if (result?.ok)
      return show(keyword, kind, appended([], result.value, 0))
    if (result)
      show(keyword, kind, { status: 'failed', failure: result.failure })
  }

  const clear = (): void => {
    typed = ''
    stopWaiting()
    update({ suggestions: null, results: null })
  }

  context.session.onChange((change) => {
    if (change.kind !== 'signedIn')
      clear()
  })

  const open = async (keyword: string): Promise<void> => {
    const searched = keyword.trim()
    if (!searched)
      return
    const shown = context.read().results
    const kept = shown?.keyword === searched
      ? shown
      : null
    const kinds = kept
      ? SEARCH_KINDS.filter(kind => kept[kind].status === 'failed')
      : SEARCH_KINDS
    if (kinds.length === 0)
      return
    const loading = { status: 'loading' } as const
    const base: SearchResults = kept ?? {
      keyword: searched,
      songs: loading,
      playlists: loading,
      artists: loading,
      albums: loading,
    }
    update({
      results: {
        ...base,
        ...Object.fromEntries(kinds.map(kind => [kind, loading])),
      },
    })
    await Promise.all(kinds.map(kind => first(searched, kind)))
  }

  const more = async (keyword: string, kind: SearchKind): Promise<void> => {
    const results = context.read().results
    const list = results?.keyword === keyword
      ? results[kind]
      : null
    if (list?.status !== 'shown' || !list.more || list.more.status === 'loading')
      return
    show(keyword, kind, {
      ...list,
      more: { status: 'loading' },
    })
    const result = await pageOf(kind, keyword, list.offset)
    const current = context.read().results
    const listed = current?.keyword === keyword
      ? current[kind]
      : null
    if (listed?.status !== 'shown' || listed.offset !== list.offset)
      return
    if (result?.ok)
      return show(keyword, kind, appended(list.items, result.value, list.offset))
    if (result) {
      show(keyword, kind, {
        ...list,
        more: { status: 'failed', failure: result.failure },
      })
    }
  }

  return {
    suggest(keyword) {
      const next = keyword.trim()
      if (next === typed)
        return
      typed = next
      stopWaiting()
      if (!next)
        return update({ suggestions: null })
      cancelWait = clock.after(SUGGEST_DELAY, () => {
        cancelWait = null
        void ask(next)
      })
    },
    async search(keyword) {
      const searched = keyword.trim()
      if (!searched)
        return
      const opening = open(searched)
      update({ history: await local.changeSearchHistory(history => remembered(history, searched)) })
      await opening
    },
    open,
    more,
    async searchSongs(keyword) {
      const searched = keyword.trim()
      if (!searched)
        return { ok: true, value: [] }
      const result = await pageOf('songs', searched, 0)
      return result && (result.ok
        ? { ok: true, value: result.value.items }
        : result)
    },
    async clearHistory() {
      update({ history: await local.changeSearchHistory(() => []) })
    },
  }
}
