<!--
  播放页：盖住整个 App 的一层抽屉（对话框），打开时从底下升起，收起时缩回底下（drawer.svelte.ts）；
  底色由当前封面染出（CoverTint），里面按布局放桌面版或手机版。离开顶部时露出 24px 的圆角，后面的曲库跟着压暗一点；
  抽屉的位置和底下垫的那一截由 playerDrawer.panel 管。
  open：浅路由说开着。开着时页面本身不滚动，焦点进来（收起键），关掉后回到打开它的那个按钮；
  还在升起前（从播放条往上拖）、正在缩回时不能操作。Esc 先收起手机上的播放队列，再关掉播放页。
  在 SignedInFrame 里，播放队列里有歌、抽屉没完全收起时才有
-->
<script lang='ts'>
  import { page } from '$app/state'
  import { innerHeight } from 'svelte/reactivity/window'
  import { getAppView } from '../app-context.svelte'
  import { desktopLayout } from '../layout'
  import CoverTint from './CoverTint.svelte'
  import DesktopPlayerPage from './DesktopPlayerPage.svelte'
  import PhonePlayerPage from './PhonePlayerPage.svelte'
  import { closePlayerPage, closeQueueSheet, playerDrawer } from './player-page.svelte'
  import { createPlayhead } from './playhead.svelte'
  import { currentSong, sourceName } from './view'

  const { open }: { open: boolean } = $props()

  /** 顶上的圆角（px）：离开顶部多少就圆多少，最多 24px（底部弹层的顶边） */
  const RADIUS = 24
  /** 整个拉开时后面的曲库压暗多少 */
  const DIM = 0.2

  const view = getAppView()
  const player = $derived(view.state.player)
  /** 播放队列里有歌时才有（SignedInFrame）；退出登录清空播放队列的那一刻还在，什么都不画 */
  const song = $derived(currentSong(player))
  const source = $derived(player.current === null ? null : sourceName(view.state.library, player.queue[player.current].source))
  const playhead = createPlayhead(() => view.state.player)
  const radius = $derived(Math.max(0, Math.min(RADIUS, playerDrawer.position * (innerHeight.current ?? 0))))

  let root = $state<HTMLElement>()

  $effect(() => {
    if (!open)
      return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    root?.querySelector<HTMLElement>('button')?.focus()
    const { documentElement } = document
    documentElement.style.overflow = 'hidden'
    return () => {
      documentElement.style.overflow = ''
      if (opener?.isConnected)
        opener.focus()
    }
  })

  function onkeydown(event: KeyboardEvent) {
    if (!open || event.key !== 'Escape' || event.defaultPrevented)
      return
    event.preventDefault()
    if (page.state.player === 'queue')
      closeQueueSheet()
    else
      closePlayerPage()
  }
</script>

<svelte:window {onkeydown} />

<div class='pointer-events-none fixed inset-0 z-49 bg-neutral-900' style:opacity={Math.min(1, 1 - playerDrawer.position) * DIM} aria-hidden='true'></div>
<div
  bind:this={root}
  class='fixed inset-x-0 top-0 z-50 flex flex-col overflow-hidden shadow-float'
  {@attach playerDrawer.panel}
  style:border-radius='{radius}px {radius}px 0 0'
  role='dialog'
  aria-modal='true'
  aria-label='正在播放'
  inert={!open}
>
  {#if song}
    <CoverTint coverUrl={song.album.coverUrl} />
    {#if desktopLayout.current}
      <DesktopPlayerPage {song} {source} {playhead} />
    {:else}
      <PhonePlayerPage {song} {source} {playhead} />
    {/if}
  {/if}
</div>
