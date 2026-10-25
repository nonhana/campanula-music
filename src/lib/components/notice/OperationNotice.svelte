<!--
  提示条（改曲库、下载共用，#30、#33、#38；文案见 text.ts）：失败的一直留着直到关掉或被换掉，成功的 4 秒后自己走（App 的时钟管）。
  动作也由 App 决定（state.library.noticeActions）：这里只照着画，不按种类猜该调哪个方法。
  位置和播放提示（PlayerNotice）一样：桌面底部、手机迷你播放条上方、手机播放页开着时顶上；换页时原地不动。
  两条同时在时排在播放提示外侧，让出它的高度；播放提示来了、走了，它横着不动、竖着平移过去（只动 transform）。
-->
<script lang='ts'>
  import { Check, CircleAlert, X } from '@lucide/svelte'

  import { getOverlays } from '../overlay/overlay-context'
  import { playerNoticeBox } from '../player/PlayerNotice.svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { toast } from '../shared/motion'
  import IconButton from '../ui/IconButton.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import type { NoticePlace } from './arrival.svelte'
  import { noticeArrival } from './arrival.svelte'
  import { operationNoticeText } from './text'

  /** 和播放提示之间空多少（px） */
  const GAP = 8

  const { phone = false }: { phone?: boolean } = $props()
  const view = getAppView()
  const overlays = getOverlays()
  /** 播放页开着时挪到顶上（和播放提示一样）；这一份推导在播放页层里只有一处 */
  const overPlayerPage = $derived(overlays.playerLayer.open)
  const notice = $derived(view.state.library?.notice ?? null)
  /** App 说这条提示支持哪些动作：界面照着画按钮 */
  const actions = $derived(view.state.library?.noticeActions ?? [])
  const offset = $derived(view.state.player.notice
    ? playerNoticeBox.height + GAP
    : 0)

  const place = $derived<NoticePlace>(!phone
    ? 'desktop'
    : overPlayerPage ? 'top' : 'bottom')
  const shift = $derived(`translateY(${place === 'top'
    ? offset
    : -offset}px)`)
  const arrival = noticeArrival(() => notice ? place : null)

  /** 配 ✓ 的：加入了、都已经在歌单里、移除了；别的（没改成、上次的修改没保存成功）配感叹号 */
  const informative = $derived(notice?.kind === 'added' || notice?.kind === 'alreadyAdded' || notice?.kind === 'removed' || notice?.kind === 'downloadsAdded' || notice?.kind === 'downloadsRemoved')
  const alerting = $derived(notice?.kind === 'notChanged' || notice?.kind === 'playlistMissing' || notice?.kind === 'removeFailed' || notice?.kind === 'orderFailed' || notice?.kind === 'playlistOrderFailed' || notice?.kind === 'downloadFailed' || notice?.kind === 'downloadsPaused')
</script>

{#if notice}
  <!-- 换了位置是另一块：旧位置上的淡出，新位置上的淡入。global：提示刚出现时这一块跟着外面的 if 一起建出来，也要飘进来 -->
  {#key place}
    <div
      class={[
        'notice fixed z-50',
        place === 'desktop'
          ? 'bottom-24 left-1/2 max-w-[min(560px,calc(100vw-48px))] w-max -translate-x-1/2'
          : [
            'inset-x-2',
            place === 'top'
              ? 'top-16'
              : 'bottom-[calc(80px+env(safe-area-inset-bottom))]',
          ],
      ]}
      role={alerting ? 'alert' : 'status'}
      transition:toast|global={{
        edge: place === 'top'
          ? 'top'
          : 'bottom',
        moved: arrival.moved,
      }}
    >
      <div class='flex items-center gap-2.5 rounded-xl bg-white py-1.5 pl-3.5 pr-1.5 shadow-float transition-transform duration-move-state ease-out-soft' style:transform={shift}>
        {#if informative}
          <Check size={18} class='flex-none text-primary-900' aria-hidden='true' />
        {:else}
          <CircleAlert size={18} class='flex-none text-error-700' aria-hidden='true' />
        {/if}
        <p class='min-w-0 flex-1 text-caption text-neutral-800'>{operationNoticeText(notice)}</p>
        {#if actions.includes('undo')}
          <TextButton strong class='md:h-10 px-3.5!' onclick={() => void view.app.noticeAction('undo')}>撤销</TextButton>
        {:else if actions.includes('resume')}
          <TextButton strong class='md:h-10 px-3.5!' onclick={() => void view.app.noticeAction('resume')}>继续下载</TextButton>
        {:else if actions.includes('retry')}
          <TextButton strong class='md:h-10 px-3.5!' onclick={() => void view.app.noticeAction('retry')}>重试</TextButton>
        {/if}
        <IconButton icon={X} label='关闭提示' onclick={() => void view.app.noticeAction('dismiss')} />
      </div>
    </div>
  {/key}
{/if}

<style>
  /* 换页时原地不动。正在淡出的那块（Svelte 标成 inert）不要名字：两块同名时浏览器会跳过这次换页的过渡 */
  .notice:not([inert]) {
    view-transition-name: operation-notice;
    view-transition-class: still;
  }
</style>
