<!--
  弹窗外壳（DESIGN.md Overlays · 弹窗）：只管布局与抽屉呈现，层协议由浮层栈统一拥有。桌面居中弹窗；手机底部弹层和播放页同一套抽屉
  （拉手、拖标题收起、点遮罩/返回/Esc 收起）。确认（confirm）贴底边、外壳画标题、没有关闭键；表单接近全屏，标题行里的文字按钮由内容排。
  宽度：确认 440、表单 480、挑歌 560、宽表单 680。忙着时关不掉；Esc 只给最上层，栈在 DOM 更新后归还焦点。
-->
<script lang='ts' module>
  const DIALOG_SIZES = {
    confirm: 'max-w-[440px]',
    form: 'max-w-[480px]',
    picker: 'max-w-[560px]',
    wide: 'max-w-[680px]',
  } as const
  export type DialogSize = keyof typeof DIALOG_SIZES
</script>

<script lang='ts' generics='R extends DialogRequest'>
  import { X } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import type { Attachment } from 'svelte/attachments'

  import { createDrawer } from '../player/drawer.svelte'
  import { dialog, fade } from '../shared/motion'
  import { DURATIONS } from '../shared/motion-tokens'
  import IconButton from '../ui/IconButton.svelte'
  import type { DialogRequest } from './overlay-requests'
  import type { OverlayLayer } from './overlay-stack'

  interface Props {
    layer: OverlayLayer<R, HTMLElement>
    title: (request: R) => string
    size: (request: R) => DialogSize
    /** 添加歌曲：加入「…」 */
    subtitle?: Snippet<[request: R]>
    /** 每次打开都重新建；sheet 是在手机底部弹层里，heading 是手机表单放进自己标题行的标题 */
    children: Snippet<[request: R, sheet: boolean, heading: Snippet<[classes: string]>]>
  }

  const { layer, title, size, subtitle, children }: Props = $props()

  const titleId = $derived(`${layer.name}-title`)

  /** 打开的头一帧还没画出来时按多高算（px） */
  const SHORT_SHEET_ESTIMATE = 320

  const request = $derived(layer.request)
  /** 关上的动画里还画着刚才那一个 */
  let shown = $state.raw<R | null>(null)
  $effect.pre(() => {
    if (request)
      shown = request
  })
  const tall = $derived(shown !== null && size(shown) !== 'confirm')

  const dialogOpen = $derived(request !== null && !layer.asSheet)
  const sheetOpen = $derived(request !== null && layer.asSheet)
  const drawer = createDrawer(() => (tall
    ? window.innerHeight - 24
    : SHORT_SHEET_ESTIMATE))
  /** 拖过阈值就收起；忙着时弹回去 */
  const commit = () => {
    if (layer.busy)
      drawer.settle(true)
    else
      layer.close()
  }
  const gripHandle = drawer.grip({
    from: 'open',
    commit,
    tap: () => layer.close(),
  })
  const gripTitle = drawer.grip({ from: 'open', commit })

  $effect(() => drawer.settle(sheetOpen))

  /** 落在 data-autofocus，没有就是第一个能操作的 */
  const focusFirst: Attachment<HTMLElement> = (node) => {
    queueMicrotask(() => (node.querySelector<HTMLElement>('[data-autofocus]') ?? node.querySelector<HTMLElement>('input, textarea, button'))?.focus({ preventScroll: true }))
  }
</script>

<!-- 按住往下拖收起 -->
{#snippet heading(classes: string)}
  <h2 id={titleId} class={['touch-none', classes]} {@attach gripTitle}>{shown
    ? title(shown)
    : ''}</h2>
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
