<!--
  播放条上的 44px 圆形播放键（森林墨底、白色图标，DESIGN.md Player Bars）：停着时是播放，在放时是暂停；
  在取播放地址、缓冲时转圈，按下去照样停下。出了问题停下时按它就是重试
-->
<script lang='ts'>
  import { LoaderCircle, Pause, Play } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'

  const view = getAppView()
  const status = $derived(view.state.player.status)
  const busy = $derived(status === 'loading' || status === 'buffering')
</script>

<button
  type='button'
  class='grid size-11 flex-none place-items-center rounded-full bg-primary-950 text-white transition-[background-color,transform] duration-150 ease-out active:scale-98 mouse:hover:bg-primary-900'
  aria-label={status === 'paused' ? '播放' : busy ? '暂停（正在加载）' : '暂停'}
  onclick={() => view.app.togglePlay()}
>
  {#if busy}
    <LoaderCircle size={20} class='motion-safe:animate-spin' aria-hidden='true' />
  {:else if status === 'playing'}
    <Pause size={20} fill='currentColor' aria-hidden='true' />
  {:else}
    <Play size={20} fill='currentColor' class='ml-0.5' aria-hidden='true' />
  {/if}
</button>
