<!-- PROTOTYPE：手机二级页面的顶栏：返回、标题、右侧操作（可选）。 -->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { nav } from '$lib/prototype/nav.svelte'
  import { ArrowLeft } from '@lucide/svelte'

  interface Props {
    title?: string
    /** 返回按钮的读屏文字 */
    backLabel?: string
    onback?: () => void
    actions?: Snippet
  }

  const { title = '', backLabel = '返回', onback = () => nav.back(), actions }: Props = $props()
</script>

<div class='sticky top-0 z-20 flex h-14 items-center gap-1 bg-primary-50 px-1'>
  <button class='grid size-11 flex-none place-items-center rounded-full text-neutral-800 active:bg-primary-100' aria-label={backLabel} onclick={onback}>
    <ArrowLeft size={22} aria-hidden='true' />
  </button>
  <span class='min-w-0 flex-1 truncate text-[16px] font-500 text-neutral-900'>{title}</span>
  {@render actions?.()}
</div>
