<!--
  播放页：盖住整个 App 的一层抽屉，打开从底下升起、收起缩回（drawer.svelte.ts）；底色由当前封面染出（CoverTint），里面按布局放桌面版或手机版。
  离开顶部露出 24px 圆角，后面的曲库跟着压暗；抽屉的位置和底下垫的一截由 playerDrawer.panel 管。open 是这一层的请求（浮层栈登记、浅路由记着），
  开着时页面不滚动，焦点进收起键、关掉回打开它的按钮；升起前、缩回时不能操作。Esc 先收手机播放队列，再关播放页。
  由 PlayerLayer 在两个外框里挂载（有歌、抽屉没完全收起才画），开合、历史、焦点由浮层栈管。
-->
<script lang='ts'>
  import { innerHeight } from 'svelte/reactivity/window'

  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import { desktopLayout } from '../shared/layout'
  import CoverTint from './CoverTint.svelte'
  import DesktopPlayerPage from './DesktopPlayerPage.svelte'
  import { currentSong } from './now'
  import PhonePlayerPage from './PhonePlayerPage.svelte'
  import { createPlayhead } from './playhead.svelte'
  import { sourceName, turnOf } from './view'

  const { open }: { open: boolean } = $props()

  /** 离开顶部多少就圆多少，最多 24px（底部弹层顶边） */
  const RADIUS = 24
  /** 整个拉开时后面的曲库压暗多少 */
  const DIM = 0.2

  const view = getAppView()
  const { player: layer, playerDrawer } = getOverlays()
  const player = $derived(view.state.player)
  /** 有歌才有；退出登录清空队列那一刻还在，什么都不画 */
  const song = $derived(currentSong(player))
  const source = $derived(player.current === null
    ? null
    : sourceName(view.state.library, player.queue[player.current].source))
  const turn = $derived(turnOf(player.change))
  const playhead = createPlayhead(() => view.state.player)
  const radius = $derived(Math.max(0, Math.min(RADIUS, playerDrawer.position * (innerHeight.current ?? 0))))

  let root = $state<HTMLElement>()

  $effect(() => {
    if (!open)
      return
    root?.querySelector<HTMLElement>('button')?.focus()
    const { documentElement } = document
    documentElement.style.overflow = 'hidden'
    return () => {
      documentElement.style.overflow = ''
    }
  })

</script>

<div class='pointer-events-none fixed inset-0 z-49 bg-neutral-900' style:opacity={Math.min(1, 1 - playerDrawer.position) * DIM} aria-hidden='true'></div>
<div
  bind:this={root}
  class='fixed inset-x-0 top-0 z-50 flex flex-col overflow-hidden shadow-float'
  {@attach playerDrawer.panel}
  style:border-radius='{radius}px {radius}px 0 0'
  role='dialog'
  aria-modal='true'
  aria-label='正在播放'
  inert={!open || layer.containerInert}
>
  {#if song}
    <CoverTint coverUrl={song.album.coverUrl} />
    {#if desktopLayout.current}
      <DesktopPlayerPage {song} {source} {playhead} {turn} />
    {:else}
      <PhonePlayerPage {song} {source} {playhead} {turn} />
    {/if}
  {/if}
</div>
