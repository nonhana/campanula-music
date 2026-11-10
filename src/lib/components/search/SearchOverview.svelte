<script lang="ts">
  import { resolve } from '$app/paths';
  import { SearchX } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  import { creditLine, playlistName } from '#lib/api/library.js';
  import type {
    SearchedItems,
    SearchedPlaylist,
    SearchKind,
  } from '#lib/api/search.js';
  import type { SearchList } from '#lib/app/search.js';

  import AlbumTile from '../library/AlbumTile.svelte';
  import ArtistTile from '../library/ArtistTile.svelte';
  import PlaylistTile from '../library/PlaylistTile.svelte';
  import TileGrid from '../library/TileGrid.svelte';
  import { getAppView } from '../shared/app-context.svelte';
  import { reveal } from '../shared/motion';
  import { formatSongCount, yearOf } from '../shared/text';
  import SkeletonRows from '../songs/SkeletonRows.svelte';
  import SongList from '../songs/SongList.svelte';
  import StateBlock from '../ui/StateBlock.svelte';
  import TextButton from '../ui/TextButton.svelte';
  import { selectSearchTab } from './search-box.svelte';
  import {
    KIND_WORDS,
    OVERVIEW_COUNTS,
    searchFailure,
    searchPath,
  } from './view';

  interface Props {
    keyword: string;
    phone?: boolean;
  }

  const { keyword, phone = false }: Props = $props();
  const view = getAppView();
  const LOADING = { status: 'loading' } as const;
  const results = $derived(
    view.state.search.results?.keyword === keyword
      ? view.state.search.results
      : null,
  );
  const songs = $derived(results?.songs ?? LOADING);
  const playlists = $derived(results?.playlists ?? LOADING);
  const artists = $derived(results?.artists ?? LOADING);
  const albums = $derived(results?.albums ?? LOADING);
  const none = (list: SearchList) =>
    list.status === 'shown' && list.items.length === 0;
  const nothing = $derived([songs, playlists, artists, albums].every(none));

  const playlistItems = $derived(
    playlists.status === 'shown'
      ? playlists.items.slice(0, OVERVIEW_COUNTS.playlists)
      : null,
  );
  const artistItems = $derived(
    artists.status === 'shown'
      ? artists.items.slice(0, OVERVIEW_COUNTS.artists)
      : null,
  );
  const albumItems = $derived(
    albums.status === 'shown'
      ? albums.items.slice(0, OVERVIEW_COUNTS.albums)
      : null,
  );

  const failureOf = (list: SearchList) => {
    if (list.status !== 'failed') return null;
    const failed = searchFailure(list.failure);
    return {
      title: failed.title,
      body: failed.body,
      retry: () => void view.app.openSearch(keyword),
    };
  };

  const seeAll = (event: MouseEvent, kind: SearchKind) => {
    event.preventDefault();
    void selectSearchTab(keyword, kind);
  };
</script>

{#snippet section(kind: SearchKind, list: SearchList, body: Snippet)}
  {#if !none(list)}
    <section
      class={phone ? 'pt-5 first:pt-0' : 'pt-8 first:pt-0'}
      aria-labelledby={`overview-${kind}`}
    >
      <div class={['flex items-center gap-3', phone ? 'h-11 px-4' : 'mb-3']}>
        <h2
          id={`overview-${kind}`}
          class={[
            'text-neutral-900 font-600',
            phone ? 'text-title-sm' : 'text-title',
          ]}
        >
          {KIND_WORDS[kind].label}
        </h2>
        <TextButton
          href={resolve(searchPath(keyword, kind))}
          class={['ml-auto', phone ? '-mr-3' : 'h-9! -mr-4 px-4!']}
          onclick={(event) => seeAll(event, kind)}>查看全部</TextButton
        >
      </div>
      {@render body()}
    </section>
  {/if}
{/snippet}

{#snippet songsBody()}
  {#if songs.status === 'failed'}
    <div in:reveal>
      <StateBlock
        kind="error"
        title={searchFailure(songs.failure).title}
        body={searchFailure(songs.failure).body}
        action={{
          label: '重试',
          run: () => void view.app.openSearch(keyword),
        }}
      />
    </div>
  {:else if songs.status === 'loading'}
    <SkeletonRows
      count={OVERVIEW_COUNTS.songs}
      look={phone ? 'phone' : 'desktop'}
      label="正在搜索单曲"
      class={phone ? '' : 'rounded-xl bg-white p-2 shadow-ambient'}
    />
  {:else}
    <div in:reveal>
      <div class={phone ? '' : 'rounded-xl bg-white p-2 shadow-ambient'}>
        <SongList
          list={{
            kind: 'songs',
            songs: songs.items.slice(0, OVERVIEW_COUNTS.songs),
          }}
          source={{ kind: 'search', keyword }}
          {phone}
          loadingLabel="正在搜索单曲"
          bare
          virtual={false}
          label="单曲"
          locate={false}
        />
      </div>
    </div>
  {/if}
{/snippet}

{#snippet playlistsBody()}
  <TileGrid
    kind="playlist"
    layout={phone ? 'shelf' : 'overview'}
    {phone}
    items={playlistItems}
    label="歌单"
    loadingLabel="正在搜索歌单"
    failure={failureOf(playlists)}
  >
    {#snippet tile(playlist: SearchedPlaylist)}
      <PlaylistTile
        id={playlist.id}
        name={playlistName(playlist)}
        coverUrl={playlist.coverUrl}
        trackCount={playlist.trackCount}
        creator={playlist.creator}
        collectable
        {phone}
      />
    {/snippet}
  </TileGrid>
{/snippet}

{#snippet artistsBody()}
  <TileGrid
    kind="artist"
    layout="shelf"
    {phone}
    items={artistItems}
    label="歌手"
    loadingLabel="正在搜索歌手"
    failure={failureOf(artists)}
  >
    {#snippet tile(artist: SearchedItems['artists'])}
      <ArtistTile
        id={artist.id}
        name={artist.name}
        avatarUrl={artist.avatarUrl}
        detail={formatSongCount(artist.songCount) ?? undefined}
        collectable
      />
    {/snippet}
  </TileGrid>
{/snippet}

{#snippet albumsBody()}
  <TileGrid
    kind="album"
    layout="shelf"
    {phone}
    items={albumItems}
    label="专辑"
    loadingLabel="正在搜索专辑"
    failure={failureOf(albums)}
  >
    {#snippet tile(album: SearchedItems['albums'])}
      <AlbumTile
        id={album.id}
        name={album.name}
        coverUrl={album.coverUrl}
        detail={creditLine(album.artists)}
        year={yearOf(album.publishedAt)}
        {phone}
        collectable
      />
    {/snippet}
  </TileGrid>
{/snippet}

{#if nothing}
  <div in:reveal>
    <StateBlock kind="empty" icon={SearchX} title={`没有找到“${keyword}”`} />
  </div>
{:else}
  {@render section('songs', songs, songsBody)}
  {@render section('playlists', playlists, playlistsBody)}
  {@render section('artists', artists, artistsBody)}
  {@render section('albums', albums, albumsBody)}
{/if}
