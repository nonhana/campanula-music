<!-- PROTOTYPE（变体 C）：手机骨架。顶栏就是搜索条；底部迷你播放条；搜索和播放页都是全屏。 -->
<script lang='ts'>
  import { nav } from '$lib/prototype/nav.svelte'
  import { ui } from '../ui.svelte'
  import LibraryP from './LibraryP.svelte'
  import MiniPlayer from './MiniPlayer.svelte'
  import PlayerP from './PlayerP.svelte'
  import PlaylistP from './PlaylistP.svelte'
  import SearchViewP from './SearchViewP.svelte'

  let lastKey = ''
  $effect(() => {
    if (nav.screen === 'player')
      return
    const key = `${nav.screen}:${nav.playlistId}:${nav.tab}`
    if (lastKey && key !== lastKey)
      window.scrollTo({ top: 0 })
    lastKey = key
  })
</script>

<div class='min-h-dvh bg-white'>
  {#if nav.screen === 'playlist'}
    <PlaylistP />
  {:else}
    <LibraryP />
  {/if}

  <MiniPlayer />

  {#if ui.searchOpen && nav.screen === 'library'}
    <SearchViewP />
  {/if}

  {#if nav.screen === 'player'}
    <PlayerP />
  {/if}
</div>
