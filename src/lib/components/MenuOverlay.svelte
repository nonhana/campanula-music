<!--
  菜单类浮层的外壳（overlay-layer.svelte.ts 的 OverlayLayer）：歌曲的“更多”菜单（SongMenu）、加入歌单（AddToPlaylist）、歌单页的 •••（PlaylistMenu）共用。
  鼠标打开的是贴着锚点的浮动菜单：从锚点那一侧飘出来，关掉时淡出（DESIGN.md Overlays），
  点外面、滚动（菜单里面自己滚不算）、窗口变了、换页都关上；触屏是底部弹层：和播放页同一套抽屉，
  按住拉手或上面那一块往下拖、点按拉手或遮罩都收起，返回也先收起它。
  键盘：打开时焦点落在第一项能选的，↑/↓、Home/End 移动，Esc 关上并回到打开它的地方，Tab 离开时关上。
  里面画什么由用的地方给：content 是菜单项（role menuitem），sheetHeader 是底部弹层拉手下面、能按住往下拖的那一块
-->
<script lang='ts' generics='R extends OverlayRequest'>
  import type { Snippet } from 'svelte'
  import type { Attachment } from 'svelte/attachments'
  import type { OverlayLayer, OverlayRequest } from './overlay-layer.svelte'
  import { page } from '$app/state'
  import { pop } from './motion'
  import { createDrawer } from './player/drawer.svelte'

  interface Props {
    layer: OverlayLayer<R>
    /** 读屏读出的名字 */
    label: (request: R) => string
    /** 浮动菜单的宽度（class） */
    width: string
    /** 还没画出来时按多高算（px）：浮动菜单决定往下还是往上飘，底部弹层打开的头一帧 */
    estimate: (request: R, sheet: boolean) => number
    sheetHeader: Snippet<[R]>
    content: Snippet<[R, boolean]>
  }

  const { layer, label, width, estimate, sheetHeader, content }: Props = $props()

  /** 浮动菜单离视口边至少这么远（px） */
  const MARGIN = 8

  const request = $derived(layer.request)
  const floating = $derived(request?.anchor ? request : null)
  const sheetRequest = $derived(request && !request.anchor ? request : null)
  /** 底部弹层开着：浅路由也说开着 */
  const sheetOpen = $derived(sheetRequest !== null && page.state[layer.sheet] === true)
  /** 收起的动画里还画着刚才那一层 */
  let sheetShown = $state<R | null>(null)
  /** 菜单本身（浮动菜单，或者底部弹层里的那一列）：在里面找菜单项 */
  let menu = $state<HTMLElement>()
  const drawer = createDrawer(() => (sheetShown ? estimate(sheetShown, true) : 0))
  const gripSheet = drawer.grip({ from: 'open', commit: () => layer.close(), tap: () => layer.close() })

  $effect.pre(() => {
    if (sheetRequest)
      sheetShown = sheetRequest
  })

  $effect(() => drawer.settle(sheetOpen))

  /** 浅路由已经说过开着的那一次：压浏览记录要等一会儿，刚打开的那一下它还没说开着，不算收起 */
  let acknowledged: R | null = null

  // 返回手势、后退收起了底部弹层：关上，焦点回到打开它的那个按钮
  $effect(() => {
    if (!sheetRequest)
      return
    if (page.state[layer.sheet])
      acknowledged = sheetRequest
    else if (acknowledged === sheetRequest)
      layer.dismiss(sheetRequest)
  })

  // 浮动菜单：点外面（打开它的那个按钮除外：再点一下是关上）、滚动、窗口变了、换页都关上，焦点留在点到的地方
  $effect(() => {
    if (!floating)
      return
    const shown = floating
    const dismiss = () => {
      if (layer.request === shown)
        layer.request = null
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu?.contains(target) && !shown.from?.contains(target))
        dismiss()
    }
    const onScroll = (event: Event) => {
      if (!menu?.contains(event.target as Node))
        dismiss()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', dismiss)
    }
  })

  $effect(() => {
    void page.url.pathname
    return () => {
      if (layer.request?.anchor)
        layer.request = null
    }
  })

  const enabled = () => [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])]

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      layer.close()
      return
    }
    const list = enabled()
    const at = list.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      list[(at + step + list.length) % list.length]?.focus()
    }
    else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      ;(event.key === 'Home' ? list[0] : list.at(-1))?.focus()
    }
  }

  /** 打开时焦点落在第一项能选的；一项都不能选（或者还在加载）时落在菜单上，Esc 照样能关 */
  const focusFirst: Attachment<HTMLElement> = (node) => {
    queueMicrotask(() => (enabled()[0] ?? node).focus({ preventScroll: true }))
  }

  /** 菜单在锚点下面放得下（按估计的高度）：往下飘，放不下就翻到锚点上面 */
  function fitsBelow(shown: R): boolean {
    return shown.anchor!.y + estimate(shown, false) <= window.innerHeight - MARGIN
  }

  /** 摆好浮动菜单：贴着锚点，不出视口 */
  const place: Attachment<HTMLElement> = (node) => {
    const anchor = floating!.anchor!
    const below = anchor.y + node.offsetHeight <= window.innerHeight - MARGIN
    const left = Math.min(Math.max(MARGIN, anchor.end ? anchor.x - node.offsetWidth : anchor.x), window.innerWidth - node.offsetWidth - MARGIN)
    node.style.left = `${left}px`
    node.style.top = `${below ? anchor.y : Math.max(MARGIN, anchor.top - node.offsetHeight)}px`
    node.style.transformOrigin = `${anchor.end ? 'right' : 'left'} ${below ? 'top' : 'bottom'}`
  }
</script>

{#if floating}
  <div
    bind:this={menu}
    class={['fixed z-60 rounded-xl bg-white p-1.5 shadow-float outline-none', width]}
    role='menu'
    tabindex='-1'
    aria-label={label(floating)}
    {onkeydown}
    {@attach place}
    {@attach focusFirst}
    transition:pop={{ below: floating ? fitsBelow(floating) : true }}
  >
    {@render content(floating, false)}
  </div>
{/if}

{#if sheetShown && (sheetOpen || drawer.visible)}
  {@const shown = sheetShown}
  <button type='button' class='fixed inset-0 z-60 bg-neutral-900/30' style:opacity={1 - drawer.position} aria-label='关闭菜单' tabindex='-1' onclick={() => layer.close()}></button>
  <div
    class='fixed inset-x-0 z-61 rounded-t-sheet bg-white px-2 pt-1 shadow-float'
    {@attach drawer.panel}
    role='dialog'
    tabindex='-1'
    aria-modal='true'
    aria-label={label(shown)}
    inert={!sheetOpen}
    {onkeydown}
  >
    <div class='touch-none' {@attach gripSheet}>
      <div class='grid h-6 place-items-center' aria-hidden='true'>
        <span class='h-1 w-9 rounded-full bg-neutral-300'></span>
      </div>
      {@render sheetHeader(shown)}
    </div>
    <div class='mx-4 mb-1 h-px bg-neutral-100' aria-hidden='true'></div>
    <div bind:this={menu} class='pb-3 outline-none' role='menu' tabindex='-1' aria-label={label(shown)} {@attach focusFirst}>
      {@render content(shown, true)}
    </div>
  </div>
{/if}
