<!--
  没登录、登录失效时的已下载页外框（#38，原型 DesktopLoggedOut / PhoneLoggedOut 的已下载那一屏）：ADR-0006 说下载属于设备，
  这是“未登录只能看到登录页”的唯一例外。顶上一行是 logo（回到登录页）和右边的“登录”，没有侧栏、顶栏搜索；
  播放队列里有歌时底下是播放条（桌面 80px 通栏、手机浮起的迷你播放条），能打开播放页、能开“更多”菜单。
  播放页、播放提示、“更多”菜单、改曲库的提示和登录后的骨架（SignedInFrame）一样放；播放页开着时后面的不能操作
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { getAppView } from '../app-context.svelte'
  import Brand from '../Brand.svelte'
  import { desktopLayout } from '../layout'
  import LibraryNotice from '../library/LibraryNotice.svelte'
  import { dock, fade } from '../motion'
  import { DURATIONS } from '../motion-tokens'
  import DesktopPlayerBar from '../player/DesktopPlayerBar.svelte'
  import PhoneMiniPlayer from '../player/PhoneMiniPlayer.svelte'
  import { playerDrawer } from '../player/player-page.svelte'
  import PlayerNotice from '../player/PlayerNotice.svelte'
  import PlayerPage from '../player/PlayerPage.svelte'
  import SongMenu from '../SongMenu.svelte'
  import { setScrollLookup } from '../ui/scroll-marks'
  import Scrollbar from '../ui/Scrollbar.svelte'

  const { children }: { children: Snippet } = $props()
  const view = getAppView()
  const lookup = setScrollLookup({ markAt: null })
  /** 播放队列里有歌：才有播放条 */
  const hasQueue = $derived(view.state.player.queue.length > 0)
  /** 播放页开着（浅路由，见 player-page.svelte.ts） */
  const playerOpen = $derived(hasQueue && page.state.player !== undefined)
  /** 播放页要画出来：开着，或者正在升起、缩回、被拖着 */
  const playerShown = $derived(hasQueue && (playerOpen || playerDrawer.visible))
  /** 播放队列真的空了（清空）：播放条收起时才沉下去；登录了、换成别的布局时跟着外框直接拿掉 */
  const emptied = () => view.app.state.player.queue.length === 0

  // 浅路由说开着就升起来，说关了就缩回去（返回手势、后退、Esc、收起键都走这里）
  $effect(() => playerDrawer.settle(playerOpen))
</script>

<div class='contents' inert={playerOpen}>
  <div class={['bg-primary-50 min-h-dvh', hasQueue ? 'pb-[calc(112px+env(safe-area-inset-bottom))] md:pb-28' : 'pb-[calc(32px+env(safe-area-inset-bottom))] md:pb-12']}>
    <header class='sticky top-0 z-40 h-14 flex items-center gap-3 bg-primary-50 pl-4 pr-3 md:fixed md:inset-x-0 md:h-16 md:pl-6 md:pr-6' data-page-top>
      <a href={resolve('/')} class='rounded-lg' aria-label='Campanula · 回到登录页'><Brand /></a>
      <a
        href={resolve('/')}
        class='ml-auto h-10 inline-flex items-center rounded-full bg-primary-900 px-5 text-label text-white font-500 transition-colors duration-feedback active:bg-primary-950 mouse:hover:bg-primary-950'
      >登录</a>
    </header>
    <main class='md:pt-16'>
      <div class='md:mx-auto md:max-w-[1200px] md:px-8 md:pt-4'>
        {@render children()}
      </div>
    </main>
  </div>
  {#if hasQueue}
    {#if desktopLayout.current}
      <!-- data-player-bar：点歌时封面飞到这里（cover-flight.svelte.ts） -->
      <div class='fixed inset-x-0 bottom-0 z-40 h-20 bg-white px-5 shadow-float' data-player-bar in:dock out:dock|global={{ gone: emptied() }}>
        <DesktopPlayerBar />
      </div>
    {:else}
      <div
        class='pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[calc(104px+env(safe-area-inset-bottom))] from-primary-50/0 to-primary-50 bg-gradient-to-b'
        aria-hidden='true'
        in:fade={{ duration: DURATIONS.panel }}
        out:fade|global={{ duration: emptied() ? DURATIONS['panel-out'] : 0 }}
      ></div>
      <div class='fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] z-40 h-16 overflow-hidden rounded-xl bg-white shadow-float' data-player-bar in:dock out:dock|global={{ gone: emptied() }}>
        <PhoneMiniPlayer />
      </div>
    {/if}
  {/if}
  <Scrollbar page={{ top: desktopLayout.current ? '64px' : '56px', bottom: hasQueue ? (desktopLayout.current ? '80px' : 'calc(72px + env(safe-area-inset-bottom))') : '0px' }} {lookup} />
</div>

{#if playerShown}
  <PlayerPage open={playerOpen} />
{/if}
<PlayerNotice phone={!desktopLayout.current} overPlayerPage={playerOpen} />
<LibraryNotice phone={!desktopLayout.current} overPlayerPage={playerOpen} />
<SongMenu />
