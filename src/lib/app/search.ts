import type { Song } from '#lib/api/library.js'
import type { SearchSongsResponse, Suggestion, SuggestionsResponse } from '#lib/api/search.js'
import type { Api, RequestFailure } from './api'
import type { Clock } from './browser'
import type { LocalDb } from './local'

// 搜索（#31，Spec #11“搜索”）：边输入边给建议，按搜索后拉单曲结果；搜索历史只存在这台设备上（和设置一样，退出、换账号都不删）。

/** 听众停手这么久（毫秒）才问网易云要建议：接着打字时不每个字问一次 */
export const SUGGEST_DELAY = 200
const SEARCH_HISTORY_MAX = 20

/** 一个词的建议 */
export interface Suggestions {
  keyword: string
  items: readonly Suggestion[]
}

/** 单曲结果没拉到的原因（需要登录另外处理：整个 App 变成登录失效） */
export type SearchFailure = Exclude<RequestFailure, { kind: 'needsLogin' }>

/** 最后一次搜的词的单曲结果拉到哪了 */
export type SearchResults
  = | { keyword: string, status: 'loading' }
  /** 没拉到：说明原因，再打开一次就是重试 */
    | { keyword: string, status: 'failed', failure: SearchFailure }
    | { keyword: string, status: 'shown', songs: readonly Song[] }

export interface SearchState {
  /** 搜索历史：新的在前，同一个词只有一个 */
  history: readonly string[]
  /**
   * 建议：最后一次回来的、给搜索框里最后打的词的（接着打字时先留着上一个词的，新的回来了原地换）。
   * 搜索框空着时是 null；没问到（断网、网易云出错）时 items 是空的
   */
  suggestions: Suggestions | null
  /** 单曲结果：只记着最后一次搜的词的，还没搜过时是 null */
  results: SearchResults | null
}

export const INITIAL_SEARCH: SearchState = { history: [], suggestions: null, results: null }

/** 把 keyword 记进搜索历史：排到最前，原来有的挪过来，超出的去掉最旧的 */
function remembered(history: readonly string[], keyword: string): string[] {
  return [keyword, ...history.filter(each => each !== keyword)].slice(0, SEARCH_HISTORY_MAX)
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
  /** 按搜索：记进搜索历史（存在本机），打开这个词的单曲结果 */
  search: (keyword: string) => Promise<void>
  /** 打开一个词的单曲结果：这个词的结果显示着、正在拉就不再拉，别的（没拉过、上次没拉成、记着的是别的词）就用前台请求拉 */
  open: (keyword: string) => Promise<void>
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
  /** 每拉一次单曲结果、清掉一次就加一：回来的不是最近一次拉的就不要了 */
  let attempt = 0

  function update(next: Partial<SearchState>): void {
    context.write({ ...context.read(), ...next })
  }

  async function ask(keyword: string): Promise<void> {
    const result = await api.get<SuggestionsResponse>(`/api/search/suggestions?keywords=${encodeURIComponent(keyword)}`)
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

  async function open(keyword: string): Promise<void> {
    const searched = keyword.trim()
    const shown = context.read().results
    if (!searched || (shown?.keyword === searched && shown.status !== 'failed'))
      return
    const mine = ++attempt
    update({ results: { keyword: searched, status: 'loading' } })
    const result = await api.get<SearchSongsResponse>(`/api/search/songs?keywords=${encodeURIComponent(searched)}`)
    if (mine !== attempt)
      return
    if (result.ok)
      return update({ results: { keyword: searched, status: 'shown', songs: result.value.songs } })
    // 登录失效时 App 会清掉搜索结果（clear）
    if (result.failure.kind === 'needsLogin')
      return context.loginExpired()
    update({ results: { keyword: searched, status: 'failed', failure: result.failure } })
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
