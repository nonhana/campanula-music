// PROTOTYPE：改网址参数（界面状态都放在网址里）。切方案、切实现用 replaceState；换页面留一条历史，返回键能回来。
// 选择模式会压一条浅路由历史（page.state.select），手机的返回键 / 返回手势先退出选择，再离开页面。
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { selection } from './store.svelte'

export function inSelectHistory(): boolean {
  return Boolean((page.state as { select?: boolean }).select)
}

/** 先退出选择模式（必要时退掉那条浅路由历史），再做别的导航，免得返回和跳转打架 */
export async function exitSelection() {
  if (inSelectHistory()) {
    const done = new Promise<void>(resolve => window.addEventListener('popstate', () => resolve(), { once: true }))
    history.back()
    await done
  }
  selection.exit()
}

export async function setParams(params: Record<string, string | null>, opts: { push?: boolean, scrollTop?: boolean } = {}) {
  await exitSelection()
  const url = new URL(page.url)
  for (const [k, v] of Object.entries(params)) {
    if (v == null)
      url.searchParams.delete(k)
    else url.searchParams.set(k, v)
  }
  return goto(url, { replaceState: !opts.push, keepFocus: true, noScroll: !opts.scrollTop })
}

export function openPlaylist(id: string) {
  return setParams({ screen: null, pl: id }, { push: true, scrollTop: true })
}

export function openLibrary() {
  return setParams({ screen: 'library' }, { push: true, scrollTop: true })
}
