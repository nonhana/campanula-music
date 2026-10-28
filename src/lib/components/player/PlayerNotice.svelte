<!--
  播放的提示（一摞里的一条，见 notice/NoticeStack.svelte）：一句话说什么没成、为什么；网络慢是状态，其余是出错，可以关掉。
  手机播放页开着时整摞挪到顶上，不压控制键；换页时和播放条一样原地不动（uno.config.mts 的 still）。位置在 NoticeStack。
-->
<script lang='ts'>
  import { CircleAlert, LoaderCircle, X } from '@lucide/svelte'

  import type { PlayerNotice as Notice } from '#lib/app/player.js'

  import { getAppView } from '../shared/app-context.svelte'
  import { toast } from '../shared/motion'
  import IconButton from '../ui/IconButton.svelte'
  import { noticeText } from './view'

  const { playerNotice, phone, edge, moved }: {
    playerNotice: Notice
    phone: boolean
    edge: 'top' | 'bottom'
    moved: boolean
  } = $props()
  const view = getAppView()
</script>

<div
  class={[
    'notice pointer-events-auto flex items-center gap-2.5 rounded-xl bg-white py-1.5 pl-3.5 pr-1.5 shadow-float',
    phone
      ? 'w-full'
      : 'w-max max-w-[min(560px,calc(100vw-48px))]',
  ]}
  role={playerNotice.kind === 'slow'
    ? 'status'
    : 'alert'}
  transition:toast|global={{ edge, moved }}
>
  {#if playerNotice.kind === 'slow'}
    <LoaderCircle size={18} class='flex-none animate-spin text-primary-900' aria-hidden='true' />
  {:else}
    <CircleAlert size={18} class='flex-none text-error-700' aria-hidden='true' />
  {/if}
  <p class='min-w-0 flex-1 text-caption text-neutral-800'>{noticeText(playerNotice)}</p>
  <IconButton icon={X} label='关闭提示' onclick={() => view.app.dismissPlayerNotice()} />
</div>

<style>
  /* 换页时原地不动。正在淡出的那块不要名字：两块同名时浏览器会跳过这次换页过渡 */
  .notice:not([inert]) {
    view-transition-name: player-notice;
    view-transition-class: still;
  }
</style>
