<!--
  播放的提示：浮在播放条上方，说清发生了什么、能怎么办（按播放键重试）。网络慢是状态，其余是出了问题；可以关掉。
  手机上播放页开着时挪到顶上，不压住控制键
-->
<script lang='ts'>
  import { CircleAlert, LoaderCircle, X } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import { noticeText } from './view'

  const { phone = false, overPlayerPage = false }: { phone?: boolean, overPlayerPage?: boolean } = $props()
  const view = getAppView()
  const player = $derived(view.state.player)
  const notice = $derived(player.notice)
</script>

{#if notice}
  <div
    class={[
      'fixed z-50 flex items-center gap-2.5 rounded-xl bg-white py-1.5 pl-3.5 pr-1.5 shadow-float',
      phone
        ? ['inset-x-2', overPlayerPage ? 'top-16' : 'bottom-[calc(80px+env(safe-area-inset-bottom))]']
        : 'bottom-24 left-1/2 max-w-[min(560px,calc(100vw-48px))] w-max -translate-x-1/2',
    ]}
    role={notice.kind === 'slow' ? 'status' : 'alert'}
  >
    {#if notice.kind === 'slow'}
      <LoaderCircle size={18} class='flex-none animate-spin text-primary-900' aria-hidden='true' />
    {:else}
      <CircleAlert size={18} class='flex-none text-error-700' aria-hidden='true' />
    {/if}
    <p class='min-w-0 flex-1 text-caption text-neutral-800'>{noticeText(notice, player)}</p>
    <IconButton icon={X} label='关闭提示' onclick={() => view.app.dismissPlayerNotice()} />
  </div>
{/if}
