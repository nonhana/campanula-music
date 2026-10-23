import type { SearchedItems, SearchKind, SearchPageResponse, Suggestion } from '#lib/api/search.js'
import type { Api, RequestFailure, Result } from './api'
import type { Clock } from './browser'
import type { LocalDb } from './local'
import { endpoints, searchPage } from '#lib/api/endpoints.js'
import { SEARCH_KINDS } from '#lib/api/search.js'

// 搜索（#31、#32，Spec #11“搜索”）：边输入边给建议；按搜索后单曲、歌单、歌手、专辑四类各自拉第一页（结果页的综合由它们拼成），
// 每类再一页一页地取；搜索历史只存在这台设备上（和设置一样，退出、换账号都不删）。

/** 听众停手这么久（毫秒）才问网易云要建议：接着打字时不每个字问一次 */
export const SUGGEST_DELAY = 200
const SEARCH_HISTORY_MAX = 20

/** 一个词的建议 */
export interface Suggestions {
  keyword: string
  items: readonly Suggestion[]
}

/** 搜索结果没拉到的原因（需要登录另外处理：整个 App 变成登录失效） */
export type SearchFailure = Exclude<RequestFailure, { kind: 'needsLogin' }>

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
function remembered(history: readonly string[], keyword: string): string[] {
  return [keyword, ...history.filter(each => each !== keyword)].slice(0, SEARCH_HISTORY_MAX)
}

/** 网易云的一页（从第 offset 个起）接在已经取到的后面：网易云翻页时在后面的页里又给了一次的（#32 录到过）只留第一次的 */
function appended<K extends SearchKind>(items: readonly SearchedItems[K][], page: SearchPageResponse<K>, offset: number): SearchList<K> {
  const seen = new Set(items.map(item => item.id))
  const fresh: SearchedItems[K][] = []
  for (const item of page.items) {
    if (!seen.has(item.id))
      fresh.push(item)
    seen.add(item.id)
  }
  const next = offset + page.items.length
  // 网易云给了空的一页就当作取完了，不再一直问
  const more = page.items.length > 0 && next < page.total ? { status: 'notLoaded' } as const : null
  return { status: 'shown', items: [...items, ...fresh], total: page.total, offset: next, more }
}

export interface SearchContext {
  api: Api
  clock: Clock
  local: Pick<LocalDb, 'changeSearchHistory'>
  read: () => SearchState
  write: (search: SearchState) => void
  /** 网易云说需要登录，续期也没成功 */
  loginExpired: () => void
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
  /** 清空搜索历史，本机存的也删 */
  clearHistory: () => Promise<void>
  /** 退出登录、登录失效：建议和结果不再显示，在等的、在路上的都不要了（搜索历史属于这台设备，留着） */
  clear: () => void
}

export function createSearch(context: SearchContext): Search {
  const { api, clock, local } = context
  /** 搜索框里最后打的词（去掉首尾空白） */
  let typed = ''
  /** 还在等听众停手：取消它 */
  let cancelWait: (() => void) | null = null
  /** 每换一个词、清掉一次就加一：回来的不是这一轮拉的就不要了 */
  let attempt = 0

  function update(next: Partial<SearchState>): void {
    context.write({ ...context.read(), ...next })
  }

  async function ask(keyword: string): Promise<void> {
    const result = await api.get(endpoints.suggestions, { keywords: keyword })
    if (keyword !== typed)
      return
    if (result.ok)
      return update({ suggestions: { keyword, items: result.value.suggestions } })
    if (result.failure.kind === 'needsLogin')
      return context.loginExpired()
    // 建议只是顺手的：没问到就不给，按搜索时再说明原因
    update({ suggestions: { keyword, items: [] } })
  }

  function stopWaiting(): void {
    cancelWait?.()
    cancelWait = null
  }

  function pageOf<K extends SearchKind>(kind: K, keyword: string, offset: number): Promise<Result<SearchPageResponse<K>>> {
    return api.get(searchPage(kind), { keywords: keyword, offset })
  }

  /** 换掉一类结果；不是这一轮（mine）的就不要了 */
  function show<K extends SearchKind>(mine: number, kind: K, list: SearchList<K>): void {
    const results = context.read().results
    if (mine === attempt && results)
      update({ results: { ...results, [kind]: list } })
  }

  async function first(mine: number, keyword: string, kind: SearchKind): Promise<void> {
    const result = await pageOf(kind, keyword, 0)
    if (mine !== attempt)
      return
    if (result.ok)
      return show(mine, kind, appended([], result.value, 0))
    // 登录失效时 App 会清掉搜索结果（clear）
    if (result.failure.kind === 'needsLogin')
      return context.loginExpired()
    show(mine, kind, { status: 'failed', failure: result.failure })
  }

  async function open(keyword: string): Promise<void> {
    const searched = keyword.trim()
    if (!searched)
      return
    const shown = context.read().results
    const kept = shown?.keyword === searched ? shown : null
    const kinds = kept ? SEARCH_KINDS.filter(kind => kept[kind].status === 'failed') : SEARCH_KINDS
    if (kinds.length === 0)
      return
    if (!kept)
      attempt += 1
    const mine = attempt
    const loading = { status: 'loading' } as const
    const base: SearchResults = kept ?? { keyword: searched, songs: loading, playlists: loading, artists: loading, albums: loading }
    update({ results: { ...base, ...Object.fromEntries(kinds.map(kind => [kind, loading])) } })
    await Promise.all(kinds.map(kind => first(mine, searched, kind)))
  }

  async function more(keyword: string, kind: SearchKind): Promise<void> {
    const results = context.read().results
    const list = results?.keyword === keyword ? results[kind] : null
    if (list?.status !== 'shown' || !list.more || list.more.status === 'loading')
      return
    const mine = attempt
    show(mine, kind, { ...list, more: { status: 'loading' } })
    const result = await pageOf(kind, keyword, list.offset)
    if (mine !== attempt)
      return
    if (result.ok)
      return show(mine, kind, appended(list.items, result.value, list.offset))
    if (result.failure.kind === 'needsLogin')
      return context.loginExpired()
    show(mine, kind, { ...list, more: { status: 'failed', failure: result.failure } })
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
    async clearHistory() {
      update({ history: await local.changeSearchHistory(() => []) })
    },
    clear() {
      typed = ''
      attempt += 1
      stopWaiting()
      update({ suggestions: null, results: null })
    },
  }
}
