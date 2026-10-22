<!--
  弹窗的外壳（dialog-layer.svelte.ts 的 DialogLayer）：歌单编辑（PlaylistEditor）和退出登录的确认（LogoutConfirm）共用，里面画什么由调用方给。
  桌面是居中弹窗（DESIGN.md Overlays · 弹窗：遮罩淡入，弹窗从下面 8px、98% 大小飘到位，关掉时淡出），点遮罩、关闭键、Esc 关上；
  手机是底部弹层，和播放页同一套抽屉：拉手、标题按住往下拖收起，点遮罩、返回、Esc 也收起。tall 的是接近全屏的弹层（表单），其余贴着底边（确认）。
  忙着时（layer.busy，正在等网易云建好新歌单）关不掉：拖下去会弹回来，返回会再压回那条浅路由（只有零点几秒）。
  开着时后面的骨架和播放页都不能操作（SignedInFrame 设 inert），打开时焦点落在标了 data-autofocus 的地方（名称输入框、确认时的取消），
  没有就是第一个能操作的；关上后回到打开它的地方。放在 SignedInFrame 里，盖在所有东西上面
-->
<script lang='ts' generics='R extends DialogRequest'>
  import type { Snippet } from 'svelte'
  import type { Attachment } from 'svelte/attachments'
  import type { DialogLayer, DialogRequest } from './dialog-layer.svelte'
  import { page } from '$app/state'
  import { dialog, fade } from './motion'
  import { DURATIONS } from './motion-tokens'
  import { createDrawer } from './player/drawer.svelte'
  import { pushShallowState } from './shallow-state'

  interface Props {
    layer: DialogLayer<R>
    /** 标题的 id */
    labelledby: string
    /** 桌面弹窗多宽（max-w-[…]） */
    width: (request: R) => string
    /** 手机上是接近全屏的弹层（表单）；不是的贴着底边（确认） */
    tall: (request: R) => boolean
    /** 上面又盖了一层（换封面的裁剪页）：这一层不能操作 */
    covered?: boolean
    /** 里面的内容：每次打开都重新建；sheet 是在手机的底部弹层里，grip 让标题也能按住往下拖收起 */
    children: Snippet<[request: R, sheet: boolean, grip: Attachment<HTMLElement> | undefined]>
  }

  const { layer, labelledby, width, tall, covered = false, children }: Props = $props()

  /** 贴着底边的弹层还没画出来时（打开的头一帧）按多高算（px） */
  const SHORT_SHEET_ESTIMATE = 320

  const request = $derived(layer.request)
  /** 关上的动画里还画着刚才那一个 */
  let shown = $state.raw<R | null>(null)
  $effect.pre(() => {
    if (request)
      shown = request
  })
  const full = $derived(shown !== null && tall(shown))

  const dialogOpen = $derived(request !== null && !layer.sheet)
  /** 底部弹层开着：浅路由也说开着 */
  const sheetOpen = $derived(request !== null && layer.sheet && page.state[layer.key] === true)
  const drawer = createDrawer(() => (full ? window.innerHeight - 24 : SHORT_SHEET_ESTIMATE))
  /** 拖过了阈值：收起；忙着时弹回去 */
  function commit() {
    if (layer.busy)
      drawer.settle(true)
    else
      layer.close()
  }
  const gripHandle = drawer.grip({ from: 'open', commit, tap: () => layer.close() })
  const gripTitle = drawer.grip({ from: 'open', commit })

  $effect(() => drawer.settle(sheetOpen))

  /** 浅路由已经说过开着的那一次：压浏览记录要等一会儿，刚打开的那一下它还没说开着，不算收起 */
  let acknowledged: R | null = null
  // 返回手势、后退收起了底部弹层：关上，焦点回到打开它的地方；忙着时再压回那条浅路由
  $effect(() => {
    if (!request || !layer.sheet)
      return
    if (page.state[layer.key])
      acknowledged = request
    else if (acknowledged === request && layer.busy)
      pushShallowState({ ...page.state, [layer.key]: true })
    else if (acknowledged === request)
      layer.dismiss(request)
  })

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape')
      return
    event.preventDefault()
    layer.close()
  }

  /** 打开时焦点落在标了 data-autofocus 的地方，没有就是第一个能操作的 */
  const focusFirst: Attachment<HTMLElement> = (node) => {
    queueMicrotask(() => (node.querySelector<HTMLElement>('[data-autofocus]') ?? node.querySelector<HTMLElement>('input, textarea, button'))?.focus({ preventScroll: true }))
  }
</script>

{#if dialogOpen && shown}
  <button type='button' class='fixed inset-0 z-70 bg-neutral-900/35' aria-label='关闭' tabindex='-1' onclick={() => layer.close()} transition:fade={{ duration: DURATIONS.state }}></button>
  <div class='pointer-events-none fixed inset-0 z-71 grid place-items-center p-6'>
    <div
      class={['pointer-events-auto max-h-[calc(100dvh-48px)] w-full flex flex-col rounded-xl bg-white shadow-float', width(shown)]}
      role='dialog'
      aria-modal='true'
      aria-labelledby={labelledby}
      tabindex='-1'
      inert={covered}
      {onkeydown}
      {@attach focusFirst}
      transition:dialog
    >
      {#key shown}{@render children(shown, false, undefined)}{/key}
    </div>
  </div>
{/if}

{#if shown && layer.sheet && (sheetOpen || drawer.visible)}
  <button type='button' class='fixed inset-0 z-70 bg-neutral-900/30' style:opacity={1 - drawer.position} aria-label='关闭' tabindex='-1' onclick={() => layer.close()}></button>
  <div
    class={['fixed inset-x-0 z-71 flex flex-col rounded-t-sheet bg-white shadow-float', full && 'top-6']}
    {@attach drawer.panel}
    role='dialog'
    tabindex='-1'
    aria-modal='true'
    aria-labelledby={labelledby}
    inert={!sheetOpen || covered}
    {onkeydown}
    {@attach focusFirst}
  >
    <div class='grid h-6 flex-none touch-none place-items-center' aria-hidden='true' {@attach gripHandle}>
      <span class='h-1 w-9 rounded-full bg-neutral-300'></span>
    </div>
    {#key shown}{@render children(shown, true, gripTitle)}{/key}
  </div>
{/if}
