<script lang='ts'>
  import type { Attachment } from 'svelte/attachments'
  import { afterNavigate, beforeNavigate, pushState } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { logPage } from '$lib/probe/log'
  import LogView from '$lib/probe/LogView.svelte'
  import { onMount } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'

  type Strategy = 'history' | 'closewatcher'

  const ROWS = Array.from({ length: 40 }, (_, index) => ({ key: `r${index + 1}`, title: `第 ${index + 1} 首测试歌` }))
  const LONG_PRESS_MS = 400

  let strategy = $state<Strategy>('history')
  let mode = $state(false)
  const selected = new SvelteSet<string>()
  let watcher: CloseWatcher | null = null
  let suppressNextClick = false

  const inSelectHistory = () => Boolean(page.state.select)

  function activation() {
    return { isActive: navigator.userActivation?.isActive, hasBeenActive: navigator.userActivation?.hasBeenActive, historyLength: history.length }
  }

  function enter(key: string | null, how: string) {
    if (mode) {
      if (key)
        toggle(key)
      return
    }
    mode = true
    if (key)
      selected.add(key)
    const before = activation()
    if (strategy === 'history') {
      pushState('', { select: true })
      logPage('select', '进入多选，压了一条浅路由历史', { how, before, after: { historyLength: history.length } })
    }
    else {
      watcher = new CloseWatcher()
      watcher.onclose = () => {
        watcher = null
        logPage('select', 'CloseWatcher 收到 close，退出多选', activation())
        exitLocal()
      }
      logPage('select', '进入多选，开了一个 CloseWatcher', { how, before })
    }
  }

  function exitLocal() {
    mode = false
    selected.clear()
  }

  /** 页面上的“完成”和桌面的 Esc：在多选历史里就退回去，让返回和按钮走同一条路。 */
  function exit(how: string) {
    logPage('select', `用${how}退出多选`, { strategy })
    if (watcher)
      watcher.close()
    else if (inSelectHistory())
      history.back()
    else
      exitLocal()
  }

  function toggle(key: string) {
    if (selected.has(key))
      selected.delete(key)
    else
      selected.add(key)
  }

  function onRowClick(key: string) {
    if (suppressNextClick) {
      suppressNextClick = false
      return
    }
    if (mode)
      toggle(key)
  }

  /** 原型的长按：只认触屏和手写笔，手指挪动超过 8px 算滚动，放弃。 */
  const longPress: Attachment<HTMLElement> = (node) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let x0 = 0
    let y0 = 0
    let pointer = -1
    const cancel = () => {
      clearTimeout(timer)
      timer = undefined
      pointer = -1
    }
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse')
        return
      const row = (event.target as HTMLElement).closest<HTMLElement>('[data-key]')
      if (!row)
        return
      cancel()
      pointer = event.pointerId
      x0 = event.clientX
      y0 = event.clientY
      timer = setTimeout(() => {
        timer = undefined
        navigator.vibrate?.(10)
        suppressNextClick = true
        enter(row.dataset.key!, '长按')
      }, LONG_PRESS_MS)
    }
    const move = (event: PointerEvent) => {
      if (event.pointerId === pointer && timer && Math.hypot(event.clientX - x0, event.clientY - y0) > 8)
        cancel()
    }
    const contextmenu = (event: MouseEvent) => {
      if ((event as PointerEvent).pointerType !== 'mouse')
        event.preventDefault()
    }
    node.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerup', cancel)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('scroll', cancel, { passive: true })
    node.addEventListener('contextmenu', contextmenu)
    return () => {
      cancel()
      node.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', cancel)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('scroll', cancel)
      node.removeEventListener('contextmenu', contextmenu)
    }
  }

  // 浅路由历史被返回手势退掉了：退出多选（这就是“返回先退出多选”）
  $effect(() => {
    if (strategy === 'history' && mode && !page.state.select) {
      logPage('select', '多选那条历史被退掉，退出多选', activation())
      exitLocal()
    }
  })

  beforeNavigate(({ to, type }) => {
    // 多选还开着就要离开歌单页：返回手势跳过了多选那一步
    logPage('select', mode ? '多选还开着就要离开歌单页' : '离开歌单页', { to: to?.url.pathname ?? null, type, strategy })
    watcher?.destroy()
    watcher = null
  })

  afterNavigate(({ from, type }) => {
    logPage('select', '打开歌单页', { from: from?.url.pathname ?? null, type, ...activation() })
  })

  function setStrategy(next: Strategy) {
    if (mode)
      exit('切换方式')
    strategy = next
    localStorage.setItem('probe-select-strategy', next)
  }

  onMount(() => {
    const saved = localStorage.getItem('probe-select-strategy')
    if (saved === 'history' || saved === 'closewatcher')
      strategy = saved
    const onPop = (event: PopStateEvent) => logPage('select', 'popstate', { state: event.state, ...activation() })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mode) {
        event.preventDefault()
        exit(' Esc ')
      }
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
    }
  })
</script>

<header class='bar' class:selecting={mode}>
  {#if mode}
    <button type='button' aria-label='退出多选' onclick={() => exit('左上角关闭')}>✕</button>
    <strong>已选 {selected.size} 首</strong>
    <button type='button' onclick={() => exit('“完成”')}>完成</button>
  {:else}
    <a href={resolve('/probe/select')}>‹ 返回</a>
    <strong>测试歌单</strong>
    <button type='button' onclick={() => enter(null, '“多选”按钮')}>多选</button>
  {/if}
</header>

<section class='settings'>
  <span>退出多选的方式：</span>
  <label><input type='radio' name='strategy' checked={strategy === 'history'} onchange={() => setStrategy('history')} /> 浅路由历史（pushState）</label>
  <label><input type='radio' name='strategy' checked={strategy === 'closewatcher'} onchange={() => setStrategy('closewatcher')} disabled={!('CloseWatcher' in window)} /> CloseWatcher{'CloseWatcher' in window ? '' : '（没有）'}</label>
</section>

<ul class='rows' {@attach longPress}>
  {#each ROWS as row (row.key)}
    <li>
      <button type='button' data-key={row.key} class:on={selected.has(row.key)} onclick={() => onRowClick(row.key)}>
        {#if mode}<span class='check' aria-hidden='true'>{selected.has(row.key) ? '●' : '○'}</span>{/if}
        {row.title}
      </button>
    </li>
  {/each}
</ul>

<LogView topic='select' />

<style>
  .bar {
    position: sticky;
    top: 57px;
    z-index: 1;
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    background: #f5fcf9;
  }
  .bar.selecting {
    background: #d1f1e3;
  }
  .bar a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: #1a5b43;
  }
  .settings {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: 13px;
  }
  .rows {
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .rows button {
    display: flex;
    gap: 12px;
    align-items: center;
    width: 100%;
    min-height: 56px;
    color: #111827;
    text-align: left;
    user-select: none;
    background: transparent;
    border: 0;
    border-bottom: 1px solid #e8f8f1;
    border-radius: 0;
    -webkit-touch-callout: none;
  }
  .rows button.on {
    background: #e8f8f1;
  }
  .check {
    color: #206f52;
  }
</style>
