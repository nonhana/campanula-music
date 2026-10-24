<!--
  播放条停靠（三个外框共用：DesktopShell、PhoneShell、SignedOutFrame）：播放队列里有歌时才有，桌面是 80px 通栏，手机是离屏幕边 8px、64px 高的迷你条，底下垫一层晨光底的渐隐。
  第一次有歌时从屏幕底下浮上来，清空（包括退出登录，整个外框拿掉时）沉下去（motion.ts 的 dock）；手机多选时底部操作条占它的位置（replace）。
  换页时原地不动：顶边起名字 player-bar、带 still，进度线照常走（ADR-0011；见 uno.config.ts）。data-player-bar：点歌时封面飞到这里（cover-flight.svelte.ts），拖动排序也按它的上沿算边缘。
  页面滚动条的下沿由 player-dock.ts 的 playerDockBottom 给出，外框只传“有没有”；设计页的示意图（preview）只借容器，不起 player-bar / bar-fade 的名字、不标 data-player-bar。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'

  import DesktopPlayerBar from '../player/DesktopPlayerBar.svelte'
  import PhoneMiniPlayer from '../player/PhoneMiniPlayer.svelte'
  import { queueEmpty } from '../player/view'
  import { getAppView } from '../shared/app-context.svelte'
  import { desktopLayout } from '../shared/layout'
  import { dock, fade } from '../shared/motion'
  import { DURATIONS } from '../shared/motion-tokens'

  interface Props {
    /** 播放条在不在：播放队列里有歌；手机上多选时底部操作条也占这个位置 */
    present: boolean
    /** 占播放条位置的东西（手机多选的底部操作条）；不传就是播放条本身 */
    replace?: Snippet
    /** 设计系统页（/design）画骨架示意图用：代替真正的播放条内容；生产外框不传 */
    preview?: Snippet
  }

  const { present, replace, preview }: Props = $props()
  const view = getAppView()
  /**
   * 播放队列真的空了（清空、退出登录）：播放条收起时才沉下去，换成手机布局、登录失效时跟着外框直接拿掉。收起的那一刻直接读 App 的状态：外框整个拿掉时，组件里的 $derived 停在旧的值上
   */
  const emptied = () => queueEmpty(view.app.state.player)
  /** 设计页的示意图只借容器：不起真实播放条的名字、不标 data-player-bar */
  const chrome = $derived(preview === undefined
    ? {
      bar: 'player-bar',
      fade: 'bar-fade',
      still: 'still',
      anchor: true,
    }
    : {
      bar: undefined,
      fade: undefined,
      still: undefined,
      anchor: undefined,
    })
</script>

{#if present}
  {#if desktopLayout.current}
    <div
      class='fixed inset-x-0 bottom-0 z-40 h-20 bg-white px-5 shadow-float'
      style:view-transition-name={chrome.bar}
      style:view-transition-class={chrome.still}
      data-player-bar={chrome.anchor}
      in:dock
      out:dock|global={{
        gone: emptied(),
      }}
    >
      {#if preview}
        {@render preview()}
      {:else}
        <DesktopPlayerBar />
      {/if}
    </div>
  {:else}
    <div
      class='pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[calc(104px+env(safe-area-inset-bottom))] from-primary-50/0 to-primary-50 bg-gradient-to-b'
      style:view-transition-name={chrome.fade}
      style:view-transition-class={chrome.still}
      aria-hidden='true'
      in:fade={{ duration: DURATIONS.panel }}
      out:fade|global={{
        duration: emptied()
          ? DURATIONS['panel-out']
          : 0,
      }}
    ></div>
    <div
      class='fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] z-40 h-16 overflow-hidden rounded-xl bg-white shadow-float'
      style:view-transition-name={chrome.bar}
      style:view-transition-class={chrome.still}
      data-player-bar={chrome.anchor}
      in:dock
      out:dock|global={{
        gone: emptied(),
      }}
    >
      {#if preview}
        {@render preview()}
      {:else if replace}
        {@render replace()}
      {:else}
        <PhoneMiniPlayer />
      {/if}
    </div>
  {/if}
{/if}
