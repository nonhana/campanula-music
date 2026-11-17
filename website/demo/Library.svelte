<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';

  import PlaylistTile from '#lib/components/library/PlaylistTile.svelte';
  import { getAppView } from '#lib/components/shared/app-context.svelte.ts';
  import { desktopLayout } from '#lib/components/shared/layout.ts';
  import SongList from '#lib/components/songs/SongList.svelte';

  import { playlists, songs } from './sample.ts';

  const view = getAppView();
  const playlist = $derived(
    playlists.find((p) => p.id === Number(page.params.id)) ?? playlists[1],
  );
  const shown = $derived(
    view.state.library?.playlistPage(playlist.id).content?.songs,
  );
  $effect(() => view.app.viewing({ kind: 'playlist', id: playlist.id }));
</script>

<h1 class="mb-4 text-title font-600">
  {page.params.id ? playlist.name : '示例曲库'}
</h1>
{#if !page.params.id}
  <div class="grid grid-cols-2 mb-8 max-w-[480px] gap-5">
    {#each playlists as list (list.id)}
      <PlaylistTile
        id={list.id}
        name={list.name ?? ''}
        coverUrl={list.coverUrl}
        trackCount={songs.length}
        creator={null}
      />
    {/each}
  </div>
{:else}
  <a href={resolve('/')} class="mb-4 inline-block text-label text-primary-900"
    >回到示例曲库</a
  >
{/if}
<SongList
  list={shown ? { kind: 'songs', songs: shown } : { kind: 'loading' }}
  source={{ kind: 'playlist', id: playlist.id }}
  phone={!desktopLayout.current}
  loadingLabel="正在加载示例"
  bare
  locate={false}
/>
