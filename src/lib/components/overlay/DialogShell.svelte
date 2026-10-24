<!--
  弹窗的外壳（DESIGN.md Overlays · 弹窗）：只管布局与抽屉呈现，层协议由浮层栈统一拥有。
  桌面是居中弹窗：遮罩淡入，弹窗从下面 8px、98% 大小飘到位，关掉时淡出；顶上是标题（下面可以再跟一行说明）和关闭键，下面是内容。
  手机是底部弹层，和播放页同一套抽屉：拉手、标题按住往下拖收起，点遮罩、返回、Esc 也收起。确认（size 是 confirm）贴着底边，
  外壳画标题，没有关闭键（下面的按钮里有取消）；表单接近全屏，标题行里还有文字按钮（取消、创建），由内容自己排：
  外壳把标题（带 id 和拖动）交给 children 的第三个参数，内容放进自己的标题行。标题的 id 只在外壳里。
  size：确认 440px，表单 480px，挑歌 560px（添加歌曲），宽表单 680px（编辑歌单信息，左边封面右边字段）。
  忙着时（layer.busy）关不掉；统一宿主把 Esc 只送给最上层，栈在 DOM 更新后归还焦点。
-->
<script lang='ts' module>
  /** 桌面弹窗的宽度 */
  const DIALOG_SIZES = {
    confirm: 'max-w-[440px]',
    form: 'max-w-[480px]',
    picker: 'max-w-[560px]',
    wide: 'max-w-[680px]',
  } as const
  export type DialogSize = keyof typeof DIALOG_SIZES
</script>

<script lang='ts' generics='R extends DialogRequest'>
  import type { Snippet } from 'svelte'
  import type { Attachment } from 'svelte/attachments'
  import type { DialogRequest } from './overlay-requests'
  import type { OverlayLayer } from './overlay-stack'
  import { X } from '@lucide/svelte'
  import { createDrawer } from '../player/drawer.svelte'
  import { dialog, fade } from '../shared/motion'
  import { DURATIONS } from '../shared/motion-tokens'
  import IconButton from '../ui/IconButton.svelte'

  interface Props {
    layer: OverlayLayer<R, HTMLElement>
    title: (request: R) => string
    size: (request: R) => DialogSize
    /** 桌面标题下面的一行说明（添加歌曲：加入「…」） */
    subtitle?: Snippet<[request: R]>
    /** 里面的内容：每次打开都重新建；sheet 是在手机的底部弹层里，heading 是手机表单放进自己标题行的标题（classes 定样子） */
    children: Snippet<[request: R, sheet: boolean, heading: Snippet<[classes: string]>]>
  }

  const { layer, title, size, subtitle, children }: Props = $props()

  const titleId = $derived(`${layer.name}-title`)

  /** 贴着底边的弹层还没画出来时（打开的头一帧）按多高算（px） */
  const SHORT_SHEET_ESTIMATE = 320

  const request = $derived(layer.request)
  /** 关上的动画里还画着刚才那一个 */
  let shown = $state.raw<R | null>(null)
  $effect.pre(() => {
    if (request)
      shown = request
  })
  /** 手机上是接近全屏的弹层（表单），不是的贴着底边（确认） */
  const tall = $derived(shown !== null && size(shown) !== 'confirm')

  const dialogOpen = $derived(request !== null && !layer.asSheet)
  const sheetOpen = $derived(request !== null && layer.asSheet)
  const drawer = createDrawer(() => (tall ? window.innerHeight - 24 : SHORT_SHEET_ESTIMATE))
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

  /** 打开时焦点落在标了 data-autofocus 的地方，没有就是第一个能操作的 */
  const focusFirst: Attachment<HTMLElement> = (node) => {
    queueMicrotask(() => (node.querySelector<HTMLElement>('[data-autofocus]') ?? node.querySelector<HTMLElement>('input, textarea, button'))?.focus({ preventScroll: true }))
  }
</script>

<!-- 手机弹层的标题：按住往下拖收起 -->
{#snippet heading(classes: string)}
  <h2 id={titleId} class={['touch-none', classes]} {@attach gripTitle}>{shown ? title(shown) : ''}</h2>
{/snippet}

{#if dialogOpen && shown}
  <button type='button' class='fixed inset-0 z-70 bg-neutral-900/35' aria-label='关闭' tabindex='-1' onclick={() => layer.close()} transition:fade={{ duration: DURATIONS.state }}></button>
  <div class='pointer-events-none fixed inset-0 z-71 grid place-items-center p-6'>
    <div
      class={['pointer-events-auto max-h-[calc(100dvh-48px)] w-full flex flex-col rounded-xl bg-white shadow-float', DIALOG_SIZES[size(shown)]]}
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      tabindex='-1'
      inert={!request || layer.inert}
      {@attach focusFirst}
      transition:dialog
    >
      {#key shown}
        <div class='flex flex-none items-center gap-3 pb-2 pl-6 pr-4 pt-5'>
          <div class='min-w-0 flex-1'>
            <h2 id={titleId} class='text-title-sm text-neutral-900 font-600'>{title(shown)}</h2>
            {@render subtitle?.(shown)}
          </div>
          <IconButton icon={X} label='关闭' disabled={layer.busy} onclick={() => layer.close()} />
        </div>
        {@render children(shown, false, heading)}
      {/key}
    </div>
  </div>
{/if}

{#if shown && layer.asSheet && (sheetOpen || drawer.visible)}
  <button type='button' class='fixed inset-0 z-70 bg-neutral-900/30' style:opacity={1 - drawer.position} aria-label='关闭' tabindex='-1' onclick={() => layer.close()}></button>
  <div
    class={['fixed inset-x-0 z-71 flex flex-col rounded-t-sheet bg-white shadow-float', tall && 'top-6']}
    {@attach drawer.panel}
    role='dialog'
    tabindex='-1'
    aria-modal='true'
    aria-labelledby={titleId}
    inert={!sheetOpen || layer.inert}
    {@attach focusFirst}
  >
    <div class='grid h-6 flex-none touch-none place-items-center' aria-hidden='true' {@attach gripHandle}>
      <span class='h-1 w-9 rounded-full bg-neutral-300'></span>
    </div>
    {#key shown}
      {#if !tall}
        {@render heading('px-6 pt-2 text-title-sm text-neutral-900 font-600')}
      {/if}
      {@render children(shown, true, heading)}
    {/key}
  </div>
{/if}
