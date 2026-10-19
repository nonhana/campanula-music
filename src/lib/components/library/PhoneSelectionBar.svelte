<!--
  手机多选的底部操作条（#35，原型 PhoneActionBar）：占迷你播放条的位置，拇指够得着。
  加入歌单对哪种歌单都有；移除只有自建歌单有（我喜欢的音乐、收藏的歌单没有，Spec #11）。下载由 #38 加进来。
-->
<script lang='ts'>
  import { ListMinus, ListPlus } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { batchPicker } from '../batch-picker.svelte'
  import { leaveSelection, playlistSelection } from './playlist-selection.svelte'
  import { playlistView } from './view'

  const view = getAppView()
  const library = $derived(view.state.library)
  const id = $derived(playlistSelection.playlistId)
  const shown = $derived(library && id !== null ? playlistView(library, id) : null)
  const picked = $derived(shown?.kind === 'songs' ? shown.songs.filter(song => playlistSelection.has(song.id)) : [])
  const own = $derived(id !== null && library?.songsOf(id)?.playlist.kind === 'own')
  const none = $derived(picked.length === 0)

  function openAdd(event: MouseEvent) {
    if (id === null || none)
      return
    batchPicker.open({ songs: picked, currentPlaylistId: id, from: event.currentTarget as HTMLElement, anchor: null })
  }

  function remove() {
    if (id === null || none)
      return
    view.app.removeFromPlaylist(id, picked.map(song => song.id))
    leaveSelection()
  }
</script>

<div class='grid h-full' class:grid-cols-2={own} class:grid-cols-1={!own}>
  <button
    type='button'
    class='h-full flex flex-col items-center justify-center gap-1 rounded-l-xl text-neutral-800 active:bg-primary-100 disabled:opacity-45'
    disabled={none}
    onclick={openAdd}
  >
    <ListPlus size={20} aria-hidden='true' />
    <span class='text-caption font-500'>加入歌单</span>
  </button>
  {#if own}
    <button
      type='button'
      class='h-full flex flex-col items-center justify-center gap-1 rounded-r-xl text-neutral-800 active:bg-primary-100 disabled:opacity-45'
      disabled={none}
      onclick={remove}
    >
      <ListMinus size={20} aria-hidden='true' />
      <span class='text-caption font-500'>移除</span>
    </button>
  {/if}
</div>
