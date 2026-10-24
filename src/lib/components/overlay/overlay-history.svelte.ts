import type { Navigation } from '$app/navigation'
import { beforeNavigate, goto, onNavigate } from '$app/navigation'
import { resolve } from '$app/paths'
import { navigating, page } from '$app/state'
import { onDestroy, onMount, tick, untrack } from 'svelte'

import type { HistoryResult, OverlayHistory, OverlayMarker, OverlayPosition, OverlayResult } from './overlay-stack'
import { samePosition } from './overlay-stack'

interface Operation {
  kind: 'write' | 'go' | 'leave'
  from: OverlayPosition
  url: string
  cursor: number
  stamp?: string
  target?: OverlayPosition
  navigation?: Promise<void>
  native?: unknown
  receipt?: { state: unknown, received: boolean }
  published?: OverlayPosition
  invalidated: boolean
  finish: (result: HistoryResult) => void
}

interface NavigationIntent {
  type: Navigation['type']
  to: Navigation['to']
  complete: Promise<void>
  shallow?: boolean
  delta?: number | null
}

/**
 * Kit 3.1 没有“遍历完成”的 promise。它的 historyIndex（client.js:79、2927–2939、3305–3347）
 * 能在 page.state 还没更新时指认一条物理条目。这个版本相关的细节只留在这里，
 * 不进层、也不进纯核心。goto 可能在取消时照样 resolve；navigation.complete 和真正的目标
 * 必须同时对上（:1971–1975、2264–2283、2900–2904）。钩子在原生历史写入之后才跑。
 */
export const createOverlayHistory = (callbacks: { changed: (phase?: 'intent' | 'settled') => void, navigate: () => boolean }): OverlayHistory => {
  let active: Operation | null = null
  let destroyed = false
  let previous = page.state
  let previousUrl = page.url.href
  const seenNavigations = new WeakSet<Promise<void>>()
  const known: Partial<Record<number, OverlayPosition>> = {}
  const signatures: Record<number, unknown> = {}
  let moving = false

  const cursor = (): number => {
    const index: unknown = history.state?.['sveltekit:metadata']?.historyIndex
    if (typeof index !== 'number' || !Number.isSafeInteger(index))
      throw new TypeError('Kit history entry has no historyIndex')
    return index
  }

  const capture = (): OverlayPosition => ({
cursor: cursor(),
url: (page.shallow?.url ?? page.url).href,
marker: page.state.overlays?.ids.length ? page.state.overlays : undefined,
stamp: page.state.overlays?.stamp,
})
  const signature = () => history.state?.['sveltekit:metadata']?.state
  let settled = capture()
  const read = (): OverlayPosition => settled
  const result = (status: OverlayResult): HistoryResult => ({
status,
position: read(),
})
  const remember = (position: OverlayPosition): void => {
    known[position.cursor] = position
    signatures[position.cursor] = signature()
  }
  remember(settled)

  const invalidate = (): void => {
    if (!active)
      return
    const interrupted = active
    active = null
    interrupted.invalidated = true
    interrupted.finish(result('invalidated'))
  }

  const ownNavigation = (navigation: NavigationIntent): boolean => {
    if (!active)
      return false
    if (active.navigation)
      return active.navigation === navigation.complete
    const matches = active.kind === 'go'
      ? navigation.type === 'popstate' && navigation.delta === active.cursor - active.from.cursor && navigation.to?.url.href === active.url
      : navigation.type === 'goto' && navigation.to?.url.href === active.url && (navigation.shallow === undefined || navigation.shallow === (active.kind === 'write'))
    if (matches)
      active.navigation = navigation.complete
    return matches
  }

  const navigationStarted = (navigation: Navigation, cancel?: () => void): void => {
    if (seenNavigations.has(navigation.complete))
      return
    seenNavigations.add(navigation.complete)
    const own = ownNavigation(navigation)
    if (own)
      return
    const origin = read()
    const originSignature = signature()
    moving = true
    invalidate()
    if (!navigation.shallow && !callbacks.navigate()) {
      if (cancel) {
        cancel()
      }
      else {
        // 另一次导航还在跑时，Kit 会跳过 beforeNavigate（:1900–1905），这一次没有 cancel 可用。
        // 拒绝关闭的层不能被这样带走，所以在原地顶替这次仍在加载的导航：把当前物理条目登记成
        // 已知签名（否则 operate 的起点核对必然不通过），再按原来的条目浅写回去。
        moving = false
        const physical = {
...read(),
cursor: cursor(),
url: location.href,
}
        settled = physical
        remember(physical)
        void restorePosition(origin, physical, true).then(() => callbacks.changed('settled'))
      }
    }
    void navigation.complete.catch(() => {
      if (cursor() === origin.cursor && location.href === origin.url && signature() === originSignature) {
        moving = false
        callbacks.changed('settled')
      }
    })
  }

  beforeNavigate(navigation => navigationStarted(navigation, navigation.cancel))
  onNavigate((navigation) => {
    navigationStarted(navigation)
    if (active?.navigation === navigation.complete)
      active.native = history.state
  })

  // Kit 3.1 的 navigating 包装在运行时没有 shallow/event，尽管类型里有
  // （runtime/app/state/client.svelte.js:110–129）。只用它提前判失效；
  // 关闭门禁交给完整的导航钩子，每个意图只求值一次。
  $effect.pre(() => {
    if (navigating.type === null)
      return
    const intent: NavigationIntent = {
      type: navigating.type,
      to: navigating.to,
      complete: navigating.complete,
      delta: navigating.type === 'popstate'
? navigating.delta
: undefined,
    }
    untrack(() => {
      if (!seenNavigations.has(intent.complete) && !ownNavigation(intent)) {
        moving = true
        invalidate()
        callbacks.changed('intent')
      }
    })
  })

  // 一次遍历要两个事实都到齐才算完成：Kit 已经发布了目标条目的 page.state，
  // 以及带着那条条目自己 metadata 的原生 popstate 到了（先后不限）。
  const confirmTraversal = (operation: Operation): void => {
    if (active !== operation || !operation.receipt?.received || !operation.published)
      return
    if (cursor() === operation.cursor && location.href === operation.url && signature() === operation.receipt.state) {
      moving = false
      operation.finish({ status: 'committed', position: operation.published })
      return
    }
    // 两个事实都到了，但历史在两者之间变了、又没有我们看到的意图：别让队列一直挂着。
    invalidate()
    callbacks.changed()
  }

  const observed = (): void => {
    const position = capture()
    // 被顶替的 Kit 回调可能在原生历史已经移动之后才发布过期的 page.state，
    // 不要把那份旧状态和另一条物理条目凑在一起。
    if (location.href !== position.url)
      return
    if (signatures[position.cursor] === signature() && known[position.cursor]?.stamp !== position.stamp)
      return
    settled = position
    moving = false
    remember(position)
    if (active && !active.invalidated) {
      const expected = active.kind === 'go'
        ? active.target && samePosition(position, active.target)
        : position.cursor === active.cursor && position.url === active.url && position.stamp === active.stamp
      if (expected) {
        if (active.kind === 'go') {
          active.published = position
          confirmTraversal(active)
        }
        return
      }
      invalidate()
    }
    callbacks.changed()
  }

  $effect(() => {
    const state = page.state
    const url = page.url.href
    if (state === previous && url === previousUrl)
      return
    previous = state
    previousUrl = url
    untrack(observed)
  })

  onMount(() => {
    // 只记下原生回执，单靠它永远不会让一次遍历完成。目标条目没有 pageUrl 时，
    // Kit 自己的 popstate 监听会同步发布 page.state（client.js:3329–3373），
    // trace 显示它早于这个监听到达。所以下一条命令必须等到 confirmTraversal 两个事实都对上。
    const pop = (event: PopStateEvent) => {
      const metadata = event.state?.['sveltekit:metadata']
      if (active?.kind === 'go' && active.receipt && metadata?.historyIndex === active.cursor && metadata?.state === active.receipt.state && location.href === active.url) {
        active.receipt.received = true
        confirmTraversal(active)
        return
      }
      moving = !(cursor() === settled.cursor && location.href === settled.url && signatures[settled.cursor] === signature())
      invalidate()
      callbacks.changed('intent')
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  })
  onDestroy(() => {
    destroyed = true
    invalidate()
  })

  const operate = async (operation: Omit<Operation, 'invalidated' | 'finish'>, perform?: () => Promise<void>): Promise<HistoryResult> => {
    if (destroyed || moving || active || !samePosition(operation.from, read()) || cursor() !== operation.from.cursor || signatures[operation.from.cursor] !== signature() || location.href !== operation.from.url)
      return result('invalidated')
    let finish!: (value: HistoryResult) => void
    const interrupted = new Promise<HistoryResult>((resolve) => {
      finish = resolve
    })
    const mine: Operation = { ...operation, invalidated: false, finish }
    active = mine
    if (!perform) {
      mine.receipt = { state: signatures[mine.cursor], received: false }
      history.go(mine.cursor - mine.from.cursor)
      const completed = await interrupted
      if (active === mine)
        active = null
      return completed
    }
    const work = (async (): Promise<HistoryResult> => {
      try {
        await perform()
        const completed = mine.navigation
? await mine.navigation.then(() => true, () => false)
: false
        await tick()
        if (mine.invalidated || destroyed)
          return result('invalidated')
        const position = read()
        if (completed && position.cursor === mine.cursor && position.url === mine.url && position.stamp === mine.stamp) {
          remember(position)
          return { status: 'committed', position }
        }
        return result('cancelled')
      }
      catch (error) {
        if (mine.invalidated || destroyed)
          return result('invalidated')
        // 只撤销自己写下的那个原生对象。外部替换或遍历拥有的是另一个对象，
        // 哪怕它复用了同一个历史索引和 URL。
        if (mine.native && history.state === mine.native) {
          active = null
          settled = mine.target!
          remember(settled)
          moving = false
          if (mine.cursor !== mine.from.cursor) {
            const recovered = await go(mine.from, read())
            if (recovered.status !== 'committed')
              return result('invalidated')
          }
          else {
            const recovered = await restorePosition(mine.from, read(), mine.kind === 'write')
            if (recovered.status !== 'committed')
              return result('invalidated')
          }
        }
        return {
status: 'failed',
error,
position: read(),
}
      }
      finally {
        if (active === mine)
          active = null
      }
    })()
    return Promise.race([work, interrupted])
  }

  const restorePosition = (target: OverlayPosition, from: OverlayPosition, shallow: boolean): Promise<HistoryResult> => {
    const marker = target.marker ?? (target.stamp
? { session: target.stamp, ids: [], stamp: target.stamp }
: undefined)
    return operate({
kind: shallow ? 'write' : 'leave',
from,
target,
cursor: from.cursor,
url: target.url,
stamp: target.stamp,
}, () =>
      // eslint-disable-next-line svelte/no-navigation-without-resolve -- 这个 URL 是从已提交的 Kit 页面里取的
       goto(target.url, {
shallow,
replace: true,
state: marker
? { overlays: marker }
: {},
}))
  }

  const go = (target: OverlayPosition, from: OverlayPosition): Promise<HistoryResult> => {
    if (destroyed || moving || active || !samePosition(from, read()) || cursor() !== from.cursor || signatures[from.cursor] !== signature() || location.href !== from.url)
      return Promise.resolve(result('invalidated'))
    if (samePosition(target, from))
      return Promise.resolve(result('committed'))
    const remembered = known[target.cursor]
    if (!remembered || !samePosition(remembered, target))
      return Promise.resolve(result('cancelled'))
    return operate({
kind: 'go',
from,
target,
cursor: target.cursor,
url: target.url,
})
  }

  const write = (marker: OverlayMarker | undefined, replace: boolean, from: OverlayPosition): Promise<HistoryResult> => {
    const stamp = crypto.randomUUID()
    const value = { session: marker?.session ?? stamp, ids: marker?.ids ?? [], stamp }
    const target = {
cursor: from.cursor + (replace ? 0 : 1),
url: from.url,
stamp,
marker: marker ? value : undefined,
}
    return operate({
kind: 'write',
from,
target,
url: from.url,
cursor: target.cursor,
stamp,
}, () =>
      // eslint-disable-next-line svelte/no-navigation-without-resolve -- 空 URL 表示保留当前这一条历史不动
       goto('', {
shallow: true,
replace,
state: { overlays: value },
}))
  }

  return {
    read,
    write,
    go,
    leave(path, from) {
      const stamp = crypto.randomUUID()
      const url = `${location.origin}${resolve(path)}`
      const target = { cursor: from.cursor, url, stamp }
      return operate({
kind: 'leave',
from,
target,
url,
cursor: from.cursor,
stamp,
}, () => goto(resolve(path), {
        replace: true,
        state: {
overlays: { session: stamp, ids: [], stamp },
},
      }))
    },
  }
}
