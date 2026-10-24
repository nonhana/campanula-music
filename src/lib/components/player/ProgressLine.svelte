<!-- 手机迷你播放条底边 2px 的平直进度线（DESIGN.md Wave Progress：常驻的播放条不用波浪），只是显示：
  轻点、上拖是打开播放页，跳进度在播放页的波浪条上。放在 position: relative（或 fixed）的播放条里。 -->
<script lang='ts'>
  import { getAppView } from '../shared/app-context.svelte'
  import { progressOf } from './now'

  const view = getAppView()
  const progress = $derived(progressOf(view.state.player))
</script>

<div class='absolute inset-x-0 bottom-0 h-[2px] bg-primary-100' aria-hidden='true'>
  <div class='h-full bg-primary-700 transition-[width] duration-move-tick ease-linear' style:width='{progress * 100}%'></div>
</div>
