<!--
  播放的提示：浮在播放条上方，一句话说什么没成、为什么；网络慢是状态，其余是出错，可以关掉。手机播放页开着时挪到顶上，不压控制键。
  换页时和播放条一样原地不动（uno.config.ts 的 still）；出现从贴着的边飘进来、走时淡出；播放页开合时旧位置淡出、新位置淡入。
  量出自己多高（playerNoticeBox）：改曲库和下载的提示同时在时排在它外侧，不重叠。
-->
<script lang='ts' module>
  /** 提示走了留着上一次的，别处看播放提示在不在就用它 */
  export const playerNoticeBox = $state({ height: 0 })
</script>

<script lang='ts'>
  import { CircleAlert, LoaderCircle, X } from '@lucide/svelte'
  import type { Attachment } from 'svelte/attachments'

  import type { NoticePlace } from '../notice/arrival.svelte'
  import { noticeArrival } from '../notice/arrival.svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { toast } from '../shared/motion'
  import IconButton from '../ui/IconButton.svelte'
  import { noticeText } from './view'

  const { phone = false, overPlayerPage = false }: { phone?: boolean, overPlayerPage?: boolean } = $props()
  const view = getAppView()
  const notice = $derived(view.state.player.notice)

  /** 桌面底部正中，手机迷你条上方，手机播放页开着时顶上 */
  const place = $derived<NoticePlace>(!phone
    ? 'desktop'
    : overPlayerPage ? 'top' : 'bottom')
  const arrival = noticeArrival(() => notice ? place : null)

  /** 换位置时正在淡出的那块（Svelte 标成 inert）不算 */
  const measure: Attachment<HTMLElement> = (node) => {
    const observer = new ResizeObserver(() => {
      if (!node.inert)
        playerNoticeBox.height = node.offsetHeight
    })
    observer.observe(node)
    return () => observer.disconnect()
  }
</script>

{#if notice}
  <!-- 换位置是另一块：旧的淡出、新的淡入。global：刚出现时跟着外面的 if 建出来，也要飘进来 -->
  {#key place}
    <div
      class={[
        'notice fixed z-50 flex items-center gap-2.5 rounded-xl bg-white py-1.5 pl-3.5 pr-1.5 shadow-float',
        place === 'desktop'
          ? 'bottom-24 left-1/2 max-w-[min(560px,calc(100vw-48px))] w-max -translate-x-1/2'
          : [
            'inset-x-2',
            place === 'top'
              ? 'top-16'
              : 'bottom-[calc(80px+env(safe-area-inset-bottom))]',
          ],
      ]}
      role={notice.kind === 'slow'
        ? 'status'
        : 'alert'}
      transition:toast|global={{
        edge: place === 'top'
          ? 'top'
          : 'bottom',
        moved: arrival.moved,
      }}
      {@attach measure}
    >
      {#if notice.kind === 'slow'}
        <LoaderCircle size={18} class='flex-none animate-spin text-primary-900' aria-hidden='true' />
      {:else}
        <CircleAlert size={18} class='flex-none text-error-700' aria-hidden='true' />
      {/if}
      <p class='min-w-0 flex-1 text-caption text-neutral-800'>{noticeText(notice)}</p>
      <IconButton icon={X} label='关闭提示' onclick={() => view.app.dismissPlayerNotice()} />
    </div>
  {/key}
{/if}

<style>
  /* 换页时原地不动。正在淡出的那块不要名字：两块同名时浏览器会跳过这次换页过渡 */
  .notice:not([inert]) {
    view-transition-name: player-notice;
    view-transition-class: still;
  }
</style>
