import { onNavigate } from '$app/navigation'
import type { RouteId } from '$app/types'
import { onMount } from 'svelte'

import type { Toward } from '../shared/motion'

/** 换页往哪边走：内容往 up / down / left / right 漂（同 motion.ts 的 Toward），fade 只淡入淡出 */
type PageTurn = Toward | 'fade'

/**
 * 换页的方向（DESIGN.md Navigation · 页面切换），交给 uno.config.ts 的页面过渡：同一层的曲库标签之间按左右顺序横着走，新页从所选标签那一侧进来，
 * 同一种页面之间（桌面歌单页左栏换歌单）只淡入淡出；后退、前进（delta）返回往下沉、前进往上浮；
 * 点进去的回到曲库是返回，其余（曲库 → 歌单、专辑、歌手、设置，专辑 → 歌手）是进入下一层
 */
const pageTurn = (from: RouteId, to: RouteId, delta: number | undefined, tabs: readonly RouteId[]): PageTurn => {
  const fromTab = tabs.indexOf(from)
  const toTab = tabs.indexOf(to)
  if (fromTab >= 0 && toTab >= 0) {
    return toTab > fromTab
      ? 'left'
      : 'right'
  }
  if (from === to)
    return 'fade'
  if (delta !== undefined) {
    return delta < 0
      ? 'down'
      : 'up'
  }
  return toTab >= 0
    ? 'down'
    : 'up'
}

/**
 * 换页用浏览器的 View Transitions（ADR-0011），要在组件初始化时调用。tabs 是曲库标签的地址，从左到右。
 * - 浏览器先拍下旧页面，等 SvelteKit 渲染好新页面、返回时恢复好滚动位置（snapshot.ts 同步恢复），再拍新的一帧；
 * - 过渡中又换了页：上一个立刻结束、不排队；Android 返回手势自带“预览上一页”（hasUAVisualTransition）时不再叠一层，不支持的浏览器直接换页；
 * - 播放页的开关是浅路由，不经过这里
 */
export const pageTransitions = (tabs: readonly RouteId[]): void => {
  let running: ViewTransition | null = null

  onNavigate((navigation) => {
    if (navigation.shallow && navigation.type === 'goto')
      return

    running?.skipTransition()
    running = null
    const { from, to } = navigation
    if (!document.startViewTransition || !from?.route.id || !to?.route.id || from.url.href === to.url.href)
      return
    if (navigation.type === 'popstate' && navigation.event.hasUAVisualTransition)
      return

    const delta = navigation.type === 'popstate'
      ? navigation.delta
      : undefined
    const turn = pageTurn(from.route.id, to.route.id, delta, tabs)

    return new Promise<void>((captured) => {
      const transition = document.startViewTransition({
        types: [turn],
        update: async () => {
          captured()
          // 被下一次换页打断时 complete 会失败：这一页不用等了，下一次换页会把这个过渡结束掉
          await navigation.complete.catch(() => {})
        },
      })
      running = transition
      // 被跳过（又换了一页、页面在后台）时 ready 会失败，是预期的
      transition.ready.catch(() => {})
      void transition.finished.then(() => {
        if (running === transition)
          running = null
      })
    })
  })

  // 过渡中浏览器把所有点按都交给 <html>，链接、按钮都点不到。按下时就结束过渡，
  // 松开后的 click 交给手指下面真正的元素：快速连点、过渡中点别的页面都照常生效（DESIGN.md Motion · 随时可打断）
  onMount(() => {
    let interrupted = false
    const press = () => {
      interrupted = running !== null
      running?.skipTransition()
    }
    const click = (event: MouseEvent) => {
      if (!interrupted || event.target !== document.documentElement)
        return
      interrupted = false
      // 同一次点按（带着 ⌘ / Ctrl / Shift）原样交给它：链接、按钮都按平常的规矩处理，svg 图标上点的也会冒泡到按钮
      document.elementFromPoint(event.clientX, event.clientY)?.dispatchEvent(new MouseEvent('click', event))
    }
    document.addEventListener('pointerdown', press, true)
    document.addEventListener('click', click, true)
    return () => {
      document.removeEventListener('pointerdown', press, true)
      document.removeEventListener('click', click, true)
    }
  })
}
