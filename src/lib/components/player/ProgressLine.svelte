<!--
  播放条上 2px 的平直进度线（DESIGN.md Wave Progress：常驻的播放条不用波浪）：桌面底栏压在顶边，手机迷你播放条压在底边。
  放在 position: relative（或 fixed）的播放条里
-->
<script lang='ts'>
  import { getAppView } from '../app-context.svelte'
  import { progressOf } from './view'

  const { edge }: { edge: 'top' | 'bottom' } = $props()
  const view = getAppView()
  const progress = $derived(progressOf(view.state.player))
</script>

<div class={['absolute inset-x-0 h-[2px] bg-primary-100', edge === 'top' ? 'top-0' : 'bottom-0']} aria-hidden='true'>
  <div class='h-full bg-primary-700 transition-[width] duration-250 ease-linear motion-reduce:transition-none' style:width='{progress * 100}%'></div>
</div>
