<script lang="ts">
  import type { LibraryState } from '#lib/app/library.ts';
  import PlaylistSongs from '#lib/components/library/PlaylistSongs.svelte';
  import SyncNotice from '#lib/components/library/SyncNotice.svelte';

  interface Props {
    library: LibraryState;
    likedId: number;
    notice: ReturnType<typeof import('#lib/app/library.ts').syncNoticeFor>;
    query: string;
  }

  let { library, likedId, notice, query = $bindable() }: Props = $props();
</script>

<h1 class="sr-only">我喜欢的音乐</h1>
<SyncNotice {notice} phone />
<PlaylistSongs {library} playlistId={likedId} liked bind:query phone />
