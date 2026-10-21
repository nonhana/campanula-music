<!--
  改曲库的提示（红心、加入歌单、收藏，#30；文案见 notice.ts）：没改成（已经改回原样）说清哪件事没成、为什么，一直留着，直到关掉或被新的换掉；
  加入歌单成功说一句“已加入「…」”，4 秒后自己走（换了一条就重新计时）。都可以关掉。
  样子、位置、进出和播放的提示（PlayerNotice）一样：桌面底部正中，手机迷你播放条上方，手机播放页开着时顶上；换页时原地不动。
  两条同时在时它排在播放提示外侧（底部的在上面，顶上的在下面），让出播放提示的高度；播放提示来了、走了，它横着不动、竖着平移过去（只动 transform）
-->
<script lang='ts'>
  import { Check, CircleAlert, X } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { toast } from '../motion'
  import { playerNoticeBox } from '../player/PlayerNotice.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import { libraryNoticeText } from './notice'

  /** 加入歌单成功的提示停留多久（ms） */
  const ADDED_SHOWN_MS = 4000
  /** 和播放提示之间空多少（px） */
  const GAP = 8

  const { phone = false, overPlayerPage = false }: { phone?: boolean, overPlayerPage?: boolean } = $props()
  const view = getAppView()
  const notice = $derived(view.state.library?.notice ?? null)
  /** 播放提示也在：让出它的高度 */
  const offset = $derived(view.state.player.notice ? playerNoticeBox.height + GAP : 0)

  /** 提示放在哪：和播放提示一样 */
  type Place = 'desktop' | 'bottom' | 'top'
  const place = $derived<Place>(!phone ? 'desktop' : overPlayerPage ? 'top' : 'bottom')
  /** 让出播放提示：贴着底边的往上挪，贴着顶边的往下挪 */
  const shift = $derived(`translateY(${place === 'top' ? offset : -offset}px)`)

  /** 提示上一次在哪，没有提示时是 null */
  let lastPlace: Place | null = null
  /** 这次出现是不是换了位置：换了位置只淡入（和旧位置上的交叉淡化），刚冒出来才从边上飘进来 */
  const arrival = { moved: false }
  $effect.pre(() => {
    const now = notice ? place : null
    arrival.moved = lastPlace !== null && now !== null && now !== lastPlace
    lastPlace = now
  })

  // 加入歌单成功（包括都已经在歌单里）：过一会儿自己走。换成了别的提示（新的一条也算）就重新来
  $effect(() => {
    if (notice?.kind !== 'added' && notice?.kind !== 'alreadyAdded')
      return
    const timer = setTimeout(() => view.app.dismissLibraryNotice(), ADDED_SHOWN_MS)
    return () => clearTimeout(timer)
  })

  const informative = $derived(notice?.kind === 'added' || notice?.kind === 'alreadyAdded' || notice?.kind === 'removed' || notice?.kind === 'recovered')
  const alerting = $derived(notice?.kind === 'notChanged' || notice?.kind === 'playlistMissing' || notice?.kind === 'removeFailed' || notice?.kind === 'orderFailed' || notice?.kind === 'playlistOrderFailed' || notice?.kind === 'downloadFailed')
  /** 提示条里的“重试”：移除失败、排序失败、下载失败共用同一个按钮 */
  const retry = $derived.by(() => {
    if (notice?.kind === 'removeFailed' && notice.retryable !== false)
      return () => void view.app.retryRemove()
    if (notice?.kind === 'orderFailed')
      return () => void view.app.retryOrder()
    if (notice?.kind === 'playlistOrderFailed')
      return () => void view.app.retryPlaylistOrder()
    if (notice?.kind === 'downloadFailed') {
      const { song } = notice
      // 开始重下了才关掉：断网、没登录时下不了，提示条留着（原因已经写在上面）
      return () => {
        if (view.app.download(song) === null)
          view.app.dismissLibraryNotice()
      }
    }
    return null
  })
</script>

{#if notice}
  <!-- 换了位置是另一块：旧位置上的淡出，新位置上的淡入。global：提示刚出现时这一块跟着外面的 if 一起建出来，也要飘进来 -->
  {#key place}
    <div
      class={[
        'notice fixed z-50',
        place === 'desktop'
          ? 'bottom-24 left-1/2 max-w-[min(560px,calc(100vw-48px))] w-max -translate-x-1/2'
          : ['inset-x-2', place === 'top' ? 'top-16' : 'bottom-[calc(80px+env(safe-area-inset-bottom))]'],
      ]}
      role={alerting ? 'alert' : 'status'}
      transition:toast|global={{ edge: place === 'top' ? 'top' : 'bottom', moved: arrival.moved }}
    >
      <div class='flex items-center gap-2.5 rounded-xl bg-white py-1.5 pl-3.5 pr-1.5 shadow-float transition-transform duration-move-state ease-out-soft' style:transform={shift}>
        {#if informative}
          <Check size={18} class='flex-none text-primary-900' aria-hidden='true' />
        {:else}
          <CircleAlert size={18} class='flex-none text-error-700' aria-hidden='true' />
        {/if}
        <p class='min-w-0 flex-1 text-caption text-neutral-800'>{libraryNoticeText(notice)}</p>
        {#if notice.kind === 'removed'}
          <button
            type='button'
            class='h-11 flex-none rounded-full px-3.5 text-label text-primary-900 font-600 transition-colors duration-feedback md:h-10 mouse:hover:bg-primary-100'
            onclick={() => view.app.undoRemove()}
          >撤销</button>
        {:else if retry}
          <button
            type='button'
            class='h-11 flex-none rounded-full px-3.5 text-label text-primary-900 font-600 transition-colors duration-feedback md:h-10 mouse:hover:bg-primary-100'
            onclick={retry}
          >重试</button>
        {/if}
        <IconButton icon={X} label='关闭提示' onclick={() => view.app.dismissLibraryNotice()} />
      </div>
    </div>
  {/key}
{/if}

<style>
  /* 换页时原地不动。正在淡出的那块（Svelte 标成 inert）不要名字：两块同名时浏览器会跳过这次换页的过渡 */
  .notice:not([inert]) {
    view-transition-name: library-notice;
    view-transition-class: still;
  }
</style>
