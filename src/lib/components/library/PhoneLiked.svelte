<!--
  手机上的我喜欢的音乐：同步细条 + 列表（加载中、空、出错时换成对应的样子）。曲库首页和 /liked 共用。
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import type { LibraryState } from '$lib/app/library'
  import LikedStates from './LikedStates.svelte'
  import PhoneSongRow from './PhoneSongRow.svelte'
  import SyncNotice from './SyncNotice.svelte'
  import { likedView } from './view'
  import VirtualList from './VirtualList.svelte'

  const { library }: { library: LibraryState } = $props()
  const liked = $derived(likedView(library))
</script>

<SyncNotice {library} phone />
<div class='pt-1.5'>
  {#if liked.kind === 'songs'}
    <VirtualList items={liked.songs} itemHeight={56} getKey={(song: Song) => song.id}>
      {#snippet row(song: Song)}
        <PhoneSongRow {song} />
      {/snippet}
    </VirtualList>
  {:else}
    <LikedStates {liked} rows={10} phone />
  {/if}
</div>
