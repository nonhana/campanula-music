<script lang="ts">
  import { Disc3, SearchX, UserRound } from '@lucide/svelte';

  import type { CollectedAlbum, CollectedArtist } from '#lib/api/library.js';
  import { creditLine } from '#lib/api/library.js';
  import type { LibraryState } from '#lib/app/library.js';

  import { getAppView } from '../shared/app-context.svelte';
  import { failureText } from '../shared/failure';
  import AlbumTile from './AlbumTile.svelte';
  import ArtistTile from './ArtistTile.svelte';
  import LibraryPageHead from './LibraryPageHead.svelte';
  import TileGrid from './TileGrid.svelte';

  interface Props {
    library: LibraryState;
    kind: 'albums' | 'artists';
    layout: 'phone' | 'grid' | 'shelf';
    query?: string;
  }

  let { library, kind, layout, query = $bindable('') }: Props = $props();
  const view = getAppView();
  const phone = $derived(layout === 'phone');
  const words = $derived(
    kind === 'albums'
      ? { title: '专辑', unit: '张' as const }
      : { title: '歌手', unit: '位' as const },
  );
  const term = $derived(query.trim());
  const total = $derived(
    (kind === 'albums' ? library.albums : library.artists)?.length ?? null,
  );
  const albums = $derived.by(() => {
    if (kind !== 'albums' || !library.albums) return null;
    return term ? view.app.searchAlbums(term) : library.albums;
  });
  const artists = $derived.by(() => {
    if (kind !== 'artists' || !library.artists) return null;
    return term ? view.app.searchArtists(term) : library.artists;
  });
  const found = $derived(term ? ((albums ?? artists)?.length ?? null) : null);
  const failure = $derived(
    library.sync.status === 'failed'
      ? {
          title: `收藏的${words.title}没能同步`,
          body: failureText(library.sync.failure),
          retry: () => view.app.retrySync(),
        }
      : null,
  );
  const tileLayout = $derived(layout === 'shelf' ? 'shelf' : 'grid');
  const notFound = $derived({ icon: SearchX, title: `没有找到“${term}”` });
</script>

{#if layout !== 'shelf'}
  <LibraryPageHead
    title={words.title}
    unit={words.unit}
    {total}
    {found}
    bind:query
    {phone}
  />
{/if}

{#if kind === 'albums'}
  <TileGrid
    kind="album"
    layout={tileLayout}
    {phone}
    items={albums}
    label="收藏的专辑"
    loadingLabel="正在加载收藏的专辑"
    {failure}
    empty={term ? notFound : { icon: Disc3, title: '还没有收藏的专辑' }}
  >
    {#snippet tile(album: CollectedAlbum)}
      <AlbumTile
        id={album.id}
        name={album.name}
        coverUrl={album.coverUrl}
        detail={creditLine(album.artists)}
        {phone}
      />
    {/snippet}
  </TileGrid>
{:else}
  <TileGrid
    kind="artist"
    layout={tileLayout}
    {phone}
    items={artists}
    label="收藏的歌手"
    loadingLabel="正在加载收藏的歌手"
    {failure}
    empty={term ? notFound : { icon: UserRound, title: '还没有收藏的歌手' }}
    detail={false}
  >
    {#snippet tile(artist: CollectedArtist)}
      <ArtistTile
        id={artist.id}
        name={artist.name}
        avatarUrl={artist.avatarUrl}
      />
    {/snippet}
  </TileGrid>
{/if}
