<!--
  手机曲库首页的“我喜欢”标签：同步细条，下面是我喜欢的音乐的歌单内搜索和列表（和歌单页同一套）
-->
<script lang='ts'>
  import type { LibraryState } from '$lib/app/library'
  import PlaylistSongs from './PlaylistSongs.svelte'
  import SyncNotice from './SyncNotice.svelte'
  import { playlistView } from './view'

  interface Props {
    library: LibraryState
    /** 搜索词：首页存着，返回时恢复 */
    query: string
  }

  let { library, query = $bindable() }: Props = $props()
  /** 歌单列表还没拿到时还不知道是哪张：按还没有列表显示（加载中，或没同步成） */
  const likedId = $derived(library.liked?.playlist.id ?? 0)
  const failed = $derived(playlistView(library, likedId).kind === 'failed')
</script>

<SyncNotice {library} failureShown={failed} phone />
<PlaylistSongs {library} playlistId={likedId} bind:query phone />
