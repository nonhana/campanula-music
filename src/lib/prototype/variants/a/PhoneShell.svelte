<!--
  PROTOTYPE：变体 A 的手机骨架：晨光底上的各个页面，底部浮起的迷你播放条，全屏播放页，歌单编辑弹层。
  站长没有选右下角的随机播放悬浮按钮，这里不放。
-->
<script lang='ts'>
  import type { PageScreen } from '$lib/prototype/nav.svelte'
  import { nav } from '$lib/prototype/nav.svelte'
  import MiniPlayer from './MiniPlayer.svelte'
  import OfflineBanner from './OfflineBanner.svelte'
  import PhoneAlbum from './PhoneAlbum.svelte'
  import PhoneArtist from './PhoneArtist.svelte'
  import PhoneDaily from './PhoneDaily.svelte'
  import PhoneDownloads from './PhoneDownloads.svelte'
  import PhoneLibrary from './PhoneLibrary.svelte'
  import PhoneLoggedOut from './PhoneLoggedOut.svelte'
  import PhonePlayer from './PhonePlayer.svelte'
  import PhonePlaylist from './PhonePlaylist.svelte'
  import PhoneSearch from './PhoneSearch.svelte'
  import PlaylistEditor from './PlaylistEditor.svelte'

  /** 播放页下面露出的那一页（手机上搜索是整页） */
  let lastPage: PageScreen = nav.screen === 'player' ? 'library' : nav.screen
  const underlying = $derived.by(() => {
    if (nav.screen !== 'player')
      lastPage = nav.screen
    return lastPage
  })

  $effect(() => {
    void underlying
    void nav.playlistId
    void nav.id
    void nav.tab
    window.scrollTo({ top: 0 })
  })
</script>

{#if nav.loggedOut}
  <PhoneLoggedOut />
{:else}
  <div class='min-h-dvh bg-primary-50 pb-[calc(96px+env(safe-area-inset-bottom))]' inert={nav.screen === 'player' || Boolean(nav.edit)}>
    {#if underlying === 'playlist'}
      {#key nav.playlistId}
        <PhonePlaylist />
      {/key}
    {:else if underlying === 'artist'}
      {#key nav.id}
        <PhoneArtist />
      {/key}
    {:else if underlying === 'album'}
      {#key nav.id}
        <PhoneAlbum />
      {/key}
    {:else if underlying === 'daily'}
      <PhoneDaily />
    {:else if underlying === 'downloads'}
      <PhoneDownloads />
    {:else if underlying === 'search'}
      <PhoneSearch />
    {:else}
      <PhoneLibrary />
    {/if}

    {#if nav.offline && underlying !== 'search'}
      <div class='fixed inset-x-2 bottom-[calc(80px+env(safe-area-inset-bottom))] z-30'>
        <OfflineBanner class='shadow-float' />
      </div>
    {/if}

    <MiniPlayer />
  </div>

  {#if nav.edit}
    <PlaylistEditor phone />
  {/if}
{/if}

{#if nav.screen === 'player'}
  <PhonePlayer />
{/if}
