<!--
  播放页：盖住整个 App 的一层（对话框），底色由当前封面染出（CoverTint）；里面按布局放桌面版或手机版。
  开着时页面本身不滚动，焦点进来（收起键），关掉后回到打开它的那个按钮；Esc 先收起手机上的播放队列，再关掉播放页。
  在 SignedInFrame 里，播放队列里有歌、浅路由说开着时才有
-->
<script lang='ts'>
  import { page } from '$app/state'
  import { prefersReducedMotion } from 'svelte/motion'
  import { fade, fly } from 'svelte/transition'
  import { getAppView } from '../app-context.svelte'
  import { desktopLayout } from '../layout'
  import CoverTint from './CoverTint.svelte'
  import DesktopPlayerPage from './DesktopPlayerPage.svelte'
  import PhonePlayerPage from './PhonePlayerPage.svelte'
  import { closePlayerPage, closeQueueSheet } from './player-page.svelte'
  import { createPlayhead } from './playhead.svelte'
  import { currentSong, sourceName } from './view'

  const view = getAppView()
  const player = $derived(view.state.player)
  /** 播放队列里有歌时才打开（SignedInFrame）；退出登录清空播放队列的那一刻还在，什么都不画 */
  const song = $derived(currentSong(player))
  const source = $derived(player.current === null ? null : sourceName(view.state.library, player.queue[player.current].source))
  const playhead = createPlayhead(() => view.state.player)

  /** 桌面淡入淡出；手机从下面浮上来（照原型）。减少动态效果时直接出现、消失 */
  function appear(node: Element) {
    const still = prefersReducedMotion.current
    return desktopLayout.current
      ? fade(node, { duration: still ? 0 : 220 })
      : fly(node, { y: 48, opacity: 0, duration: still ? 0 : 360, easing: t => 1 - (1 - t) ** 4 })
  }

  let root = $state<HTMLElement>()

  $effect(() => {
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
    if (event.key !== 'Escape' || event.defaultPrevented)
      return
    event.preventDefault()
    if (page.state.player === 'queue')
      closeQueueSheet()
    else
      closePlayerPage()
  }
</script>

<svelte:window {onkeydown} />

<div
  bind:this={root}
  class='fixed inset-0 z-50 flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]'
  role='dialog'
  aria-modal='true'
  aria-label='正在播放'
  transition:appear
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
