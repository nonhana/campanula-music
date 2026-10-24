import { endpoints, searchPage } from '#lib/api/endpoints.js'
import type { Song } from '#lib/api/library.js'
import type { SearchedItems, SearchKind, SearchPageResponse, Suggestion } from '#lib/api/search.js'
import { SEARCH_KINDS } from '#lib/api/search.js'

import type { Clock } from './browser'
import type { LocalDb } from './local'
import type { SessionApi, SessionFailure, SessionResult, SessionRound } from './session-round'

// 搜索（#31、#32，Spec #11“搜索”）：边输入边给建议；按搜索后单曲、歌单、歌手、专辑四类各自拉第一页（结果页的综合由它们拼成），
// 每类再一页一页地取；搜索历史只存在这台设备上（和设置一样，退出、换账号都不删）。
// 会话一轮结束时 App 会清掉建议和结果；旧一轮的回复由会话一轮直接丢掉。

/** 听众停手这么久（毫秒）才问网易云要建议：接着打字时不每个字问一次 */
export const SUGGEST_DELAY = 200
const SEARCH_HISTORY_MAX = 20

/** 一个词的建议 */
export interface Suggestions {
  keyword: string
  items: readonly Suggestion[]
}

/** 搜索结果没拉到的原因 */
export type SearchFailure = SessionFailure

/** 一类结果后面还有：还没取、正在取、没取成（再取一次就是重试） */
type MoreResults
  = | { status: 'notLoaded' }
    | { status: 'loading' }
    | { status: 'failed', failure: SearchFailure }

/** 一类结果拉到哪了 */
export type SearchList<K extends SearchKind = SearchKind>
  = | { status: 'loading' }
  /** 第一页没拉到：说明原因，再打开一次就是重试 */
    | { status: 'failed', failure: SearchFailure }
    | {
      status: 'shown'
      /** 已经取到的，按网易云的顺序；网易云翻页时在后面的页里又给了一次的不再列 */
      items: readonly SearchedItems[K][]
      /** 网易云最近一次说的总数 */
      total: number
      /** 下一页从网易云的第几个起 */
      offset: number
      /** 后面还有；都取到了是 null */
      more: MoreResults | null
    }

/** 最后一次搜的词的四类结果，各自拉到哪了 */
type SearchResults = { keyword: string } & { [K in SearchKind]: SearchList<K> }

export interface SearchState {
  /** 搜索历史：新的在前，同一个词只有一个 */
  history: readonly string[]
  /**
   * 建议：最后一次回来的、给搜索框里最后打的词的（接着打字时先留着上一个词的，新的回来了原地换）。
   * 搜索框空着时是 null；没问到（断网、网易云出错）时 items 是空的
   */
  suggestions: Suggestions | null
  /** 搜索结果：只记着最后一次搜的词的，还没搜过时是 null */
  results: SearchResults | null
}

export const INITIAL_SEARCH: SearchState = { history: [], suggestions: null, results: null }

/** 把 keyword 记进搜索历史：排到最前，原来有的挪过来，超出的去掉最旧的 */
const remembered = (history: readonly string[], keyword: string): string[] => [
  keyword,
  ...history.filter(each => each !== keyword),
].slice(0, SEARCH_HISTORY_MAX)

/** 网易云的一页（从第 offset 个起）接在已经取到的后面：网易云翻页时在后面的页里又给了一次的（#32 录到过）只留第一次的 */
const appended = <K extends SearchKind>(items: readonly SearchedItems[K][], page: SearchPageResponse<K>, offset: number): SearchList<K> => {
  const seen = new Set(items.map(item => item.id))
  const fresh: SearchedItems[K][] = []
  for (const item of page.items) {
    if (!seen.has(item.id))
      fresh.push(item)
    seen.add(item.id)
  }
  const next = offset + page.items.length
  // 网易云给了空的一页就当作取完了，不再一直问
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
  /** 搜索框里的字变了：空的就收起建议；停手 SUGGEST_DELAY 毫秒后问网易云这个词的建议，回来时已经又打了别的就不要了 */
  suggest: (keyword: string) => void
  /** 按搜索：记进搜索历史（存在本机），打开这个词的结果 */
  search: (keyword: string) => Promise<void>
  /**
   * 打开一个词的结果：记着的是别的词（或者还没搜过）就用前台请求把四类的第一页一起拉，各拉各的；
   * 这个词的结果记着，就只重拉第一页没拉成的那几类，显示着、正在拉的不动
   */
  open: (keyword: string) => Promise<void>
  /** 一类结果“显示更多”：后面还有、没在取就取下一页，接在后面；没取成时再调一次就是重试 */
  more: (keyword: string, kind: SearchKind) => Promise<void>
  /**
   * 选择器里搜索单曲：只要网易云的第一页，不记搜索历史、不动搜索结果页（state.search）。
   * 这一轮会话结束时是 null；没搜到是空数组
   */
  searchSongs: (keyword: string) => Promise<SessionResult<readonly Song[]>>
  /** 清空搜索历史，本机存的也删 */
  clearHistory: () => Promise<void>
}

export const createSearch = (context: SearchContext): Search => {
  const { api, clock, local } = context
  /** 搜索框里最后打的词（去掉首尾空白） */
  let typed = ''
  /** 还在等听众停手：取消它 */
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

  /** 换掉一类结果：还是这个词的结果页才换 */
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
