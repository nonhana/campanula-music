import { goto } from '$app/navigation'
import { resolve } from '$app/paths'
import { on } from 'svelte/events'
import { createSubscriber } from 'svelte/reactivity'

// 旧 Safari、Firefox 没有 Navigation API，看不到记录：返回一律回曲库、前进不能点，不报错，也不走出 App
const supported = 'navigation' in window

/**
 * 桌面顶栏的返回、前进和手机返回栏的 ←（DESIGN.md Navigation · 返回、前进）按页走：同一个地址上连着的几条浏览记录算一页，直接跳到上一个、下一个地址。
 * 播放页、菜单、弹窗是同一地址上的浅路由：关掉后留下前进记录，从菜单里换页又在身后留下一条；浮层栈从别的地址落到这些记录上只撤层、
 * 不重建（overlay-stack.ts 的 reconcile），一条条走就会白按。只看这个标签页这一次打开以来的记录（Navigation API 的 entries），到头就停。
 */
const pageStep = (direction: -1 | 1): number | null => {
  if (!supported)
    return null
  const current = navigation.currentEntry!
  const entries = navigation.entries()
  for (let index = current.index + direction; ; index += direction) {
    const entry = entries[index]
    // 刷新前的记录属于上一个文档：走过去要整页重新加载，会打断播放；地址也读不到（app.html 的 no-referrer 让它是 null）
    if (!entry?.sameDocument)
      return null
    if (entry.url !== current.url)
      return index - current.index
  }
}

const subscribe = createSubscriber(update => supported
  ? on(navigation, 'currententrychange', update)
  : undefined)

/** 每次换页、浅路由、替换地址（换标签）后重新算 */
export const pageHistory = {
  get canBack() {
    subscribe()
    return pageStep(-1) !== null
  },
  get canForward() {
    subscribe()
    return pageStep(1) !== null
  },
}

/** 这个标签页里 App 前面没有别的页（直接打开的第一页）就回曲库，替换掉这一条：再返回就离开 App，不回到这一页 */
export const backPage = (): void => {
  const step = pageStep(-1)
  if (step === null)
    void goto(resolve('/'), { replace: true })
  else
    history.go(step)
}

export const forwardPage = (): void => {
  const step = pageStep(1)
  // history.go(0) 是刷新，会打断播放
  if (step !== null)
    history.go(step)
}
