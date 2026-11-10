<script lang="ts">
  import { SearchX } from '@lucide/svelte';
  import { tick } from 'svelte';

  import { creditLine } from '#lib/api/library.js';
  import type { SearchedItems, SearchKind } from '#lib/api/search.js';

  import AlbumTile from '../library/AlbumTile.svelte';
  import ArtistTile from '../library/ArtistTile.svelte';
  import { selectionActions } from '../library/selection-actions.svelte';
  import TileGrid from '../library/TileGrid.svelte';
  import { getAppView } from '../shared/app-context.svelte';
  import { fadeAway, reveal } from '../shared/motion';
  import { formatSongCount, yearOf } from '../shared/text';
  import SongList from '../songs/SongList.svelte';
  import type { SongListView } from '../songs/view';
  import ShowMore from '../ui/ShowMore.svelte';
  import StateBlock from '../ui/StateBlock.svelte';
  import PlaylistResults from './PlaylistResults.svelte';
  import type { KindItems } from './view';
  import { KIND_WORDS, searchFailure } from './view';

  interface Props {
    keyword: string;
    kind: SearchKind;
    phone?: boolean;
  }

  const { keyword, kind, phone = false }: Props = $props();
  const view = getAppView();
  const list = $derived(
    view.state.search.results?.keyword === keyword
      ? view.state.search.results[kind]
      : ({ status: 'loading' } as const),
  );
  const shown = $derived(
    list.status === 'shown' ? ({ kind, items: list.items } as KindItems) : null,
  );
  const more = $derived(list.status === 'shown' ? list.more : null);
  const words = $derived(KIND_WORDS[kind]);
  const failed = $derived(
    list.status === 'failed' ? searchFailure(list.failure) : null,
  );
  const gridFailure = $derived(
    failed
      ? {
          title: failed.title,
          body: failed.body,
          retry: () => void view.app.openSearch(keyword),
        }
      : null,
  );
  const songs = $derived(shown?.kind === 'songs' ? shown.items : null);
  const playlists = $derived(shown?.kind === 'playlists' ? shown.items : null);
  const artists = $derived(shown?.kind === 'artists' ? shown.items : null);
  const albums = $derived(shown?.kind === 'albums' ? shown.items : null);
  const songView = $derived.by((): SongListView => {
    if (list.status === 'failed') {
      const action = searchFailure(list.failure);
      return {
        kind: 'failed',
        title: action.title,
        body: action.body,
        retry: () => void view.app.openSearch(keyword),
      };
    }
    if (!songs) return { kind: 'loading' };
    if (songs.length === 0)
      return {
        kind: 'empty',
        icon: SearchX,
        title: `没有相关的${words.label}`,
      };
    return { kind: 'songs', songs };
  });

  let body = $state<HTMLElement>();
  const actions = selectionActions();
  const select = $derived({
    actions: [
      actions.addToPlaylist(),
      actions.download(() => ({ kind: 'single' })),
    ],
  });
  let appendedAt = $state(0);
  const showMore = async () => {
    const before = list.status === 'shown' ? list.items.length : 0;
    appendedAt = before;
    await view.app.moreSearchResults(keyword, kind);
    await tick();
    if (more === null && list.status === 'shown') {
      const items = body?.querySelectorAll('li') ?? [];
      (items[before] ?? items[items.length - 1])
        ?.querySelector<HTMLElement>('a, button')
        ?.focus();
    }
  };
</script>

<div
  bind:this={body}
  class={phone ? '' : 'rounded-xl bg-white p-2 shadow-ambient'}
>
  {#if kind === 'songs'}
    <SongList
      list={songView}
      source={{ kind: 'search', keyword }}
      {phone}
      loadingLabel={`正在搜索${words.label}`}
      bare
      reveal
      virtual={false}
      label="单曲"
      {appendedAt}
      {select}
    />
  {:else if kind === 'playlists'}
    {#if list.status === 'failed' && failed}
      <div in:reveal>
        <StateBlock
          kind="error"
          title={failed.title}
          body={failed.body}
          action={{
            label: '重试',
            run: () => void view.app.openSearch(keyword),
          }}
        />
      </div>
    {:else if !playlists}
      <div
        role="status"
        aria-busy="true"
        aria-label="正在搜索歌单"
        out:fadeAway
      >
        {#each { length: phone ? 8 : 9 }, i (i)}
          <div
            class={['h-16 flex items-center gap-3', phone ? 'px-4' : 'px-2']}
          >
            <span class="bone size-12 flex-none rounded-lg"></span>
            <span class="min-w-0 flex-1">
              <span
                class="bone h-3.5 rounded-full"
                style:width={`${[62, 48, 71, 55, 66, 44, 58, 69, 51][i]}%`}
              ></span>
              <span class="bone mt-2 h-3 w-2/5 rounded-full"></span>
            </span>
          </div>
        {/each}
      </div>
    {:else if playlists.length === 0}
      <div in:reveal>
        <StateBlock
          kind="empty"
          icon={SearchX}
          title={`没有相关的${words.label}`}
        />
      </div>
    {:else}
      <div in:reveal><PlaylistResults {playlists} {phone} {appendedAt} /></div>
    {/if}
  {:else if kind === 'artists'}
    <TileGrid
      kind="artist"
      layout="grid"
      {phone}
      inset={!phone}
      items={artists}
      label="歌手"
      loadingLabel={`正在搜索${words.label}`}
      failure={gridFailure}
      empty={{ icon: SearchX, title: `没有相关的${words.label}` }}
      staggerFrom={appendedAt}
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
  {:else}
    <TileGrid
      kind="album"
      layout="grid"
      {phone}
      inset={!phone}
      items={albums}
      label="专辑"
      loadingLabel={`正在搜索${words.label}`}
      failure={gridFailure}
      empty={{ icon: SearchX, title: `没有相关的${words.label}` }}
      staggerFrom={appendedAt}
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
  {/if}
</div>
{#if shown && shown.items.length > 0}
  <ShowMore {more} onmore={showMore} class={phone ? 'px-4 pt-5' : 'pt-5'} />
{/if}
