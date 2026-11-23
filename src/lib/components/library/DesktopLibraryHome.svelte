<script lang="ts">
  import { resolve } from '$app/paths';
  import {
    ChevronLeft,
    ChevronRight,
    Heart,
    ListMusic,
    Plus,
  } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  import type { Playlist } from '#lib/api/library.ts';
  import { playlistName } from '#lib/api/library.ts';
  import type { LibraryState, PlaylistPage } from '#lib/app/library.ts';
  import { playlistGroups } from '#lib/app/library.ts';
  import DailyTile from '#lib/components/daily/DailyTile.svelte';
  import CollectedGrid from '#lib/components/library/CollectedGrid.svelte';
  import { likedFailure } from '#lib/components/library/liked-failure.ts';
  import PlaylistTile from '#lib/components/library/PlaylistTile.svelte';
  import SyncNotice from '#lib/components/library/SyncNotice.svelte';
  import TileGrid from '#lib/components/library/TileGrid.svelte';
  import { songMenuActions } from '#lib/components/menu/song-menu.svelte.ts';
  import { getOverlays } from '#lib/components/overlay/overlay-context.ts';
  import { currentSong } from '#lib/components/player/now.ts';
  import { getAppView } from '#lib/components/shared/app-context.svelte.ts';
  import { dragScroll } from '#lib/components/shared/drag-scroll.ts';
  import { failureText } from '#lib/components/shared/failure.ts';
  import {
    fade,
    fadeAway,
    reveal,
    scrollBehavior,
  } from '#lib/components/shared/motion.ts';
  import { formatCount } from '#lib/components/shared/text.ts';
  import CreditLine from '#lib/components/songs/CreditLine.svelte';
  import DownloadMark from '#lib/components/songs/DownloadMark.svelte';
  import NowChip from '#lib/components/songs/NowChip.svelte';
  import PlayAllButton from '#lib/components/songs/PlayAllButton.svelte';
  import PlayTarget from '#lib/components/songs/PlayTarget.svelte';
  import { songLook } from '#lib/components/songs/song-look.ts';
  import SongMoreButton from '#lib/components/songs/SongMoreButton.svelte';
  import SongTitle from '#lib/components/songs/SongTitle.svelte';
  import Cover from '#lib/components/ui/Cover.svelte';
  import IconButton from '#lib/components/ui/IconButton.svelte';
  import StateBlock from '#lib/components/ui/StateBlock.svelte';
  import TextButton from '#lib/components/ui/TextButton.svelte';
  import ToolButton from '#lib/components/ui/ToolButton.svelte';

  interface Props {
    library: LibraryState;
    liked: PlaylistPage;
    notice: ReturnType<typeof import('#lib/app/library.ts').syncNoticeFor>;
    stripEl?: HTMLElement;
    onReady?: () => void;
  }

  let {
    library,
    liked,
    notice,
    stripEl = $bindable(),
    onReady,
  }: Props = $props();

  const view = getAppView();
  const { openSongMenuAt } = songMenuActions();
  const { playlistEditor } = getOverlays();

  const strip = $derived(
    liked.songs.kind === 'songs' ? liked.songs.songs.slice(0, 36) : [],
  );
  const nowId = $derived(currentSong(view.state.player)?.id ?? null);
  const groups = $derived(
    library.playlists ? playlistGroups(library.playlists) : null,
  );
  const own = $derived(groups?.own ?? null);
  const collected = $derived(groups?.collected ?? null);

  const newPlaylist = (
    event: MouseEvent & { currentTarget: HTMLButtonElement },
  ) =>
    playlistEditor.open({ mode: 'new', songs: [], from: event.currentTarget });

  const listFailure = (title: string) =>
    library.sync.status === 'failed'
      ? {
          title,
          body: failureText(library.sync.failure),
          retry: () => view.app.retrySync(),
        }
      : null;

  let stripWidth = $state(0);
  const covers = $state<HTMLElement[]>([]);
  let atStart = $state(true);
  let atEnd = $state(false);

  const measureStrip = () => {
    if (!stripEl) return;
    atStart = stripEl.scrollLeft < 4;
    atEnd = stripEl.scrollLeft + stripEl.clientWidth > stripEl.scrollWidth - 4;
  };

  $effect(() => onReady?.());

  $effect(() => {
    void strip.length;
    void stripWidth;
    measureStrip();
  });

  const turn = (dir: 1 | -1) =>
    stripEl?.scrollBy({
      left: dir * stripEl.clientWidth,
      behavior: scrollBehavior(),
    });

  const retryLiked = () => {
    if (!liked.failure) return;
    const action = likedFailure(liked.failure);
    if (action.retry === 'open' && liked.info)
      void view.app.openPlaylist(liked.info.id);
    else view.app.retrySync();
  };
</script>

<svelte:window onresize={measureStrip} />

{#snippet likedStates()}
  {#if liked.failure}
    {@const action = likedFailure(liked.failure)}
    <StateBlock
      kind="error"
      title={action.title}
      body={failureText(liked.failure.failure)}
      action={{ label: '重试', run: retryLiked }}
    />
  {:else}
    <StateBlock kind="empty" icon={Heart} title="还没有红心的歌" />
  {/if}
{/snippet}

{#snippet seeAll(href: string)}
  <span class="ml-1" in:fade
    ><TextButton {href} class="md:h-9 md:px-4">查看全部</TextButton></span
  >
{/snippet}

{#snippet rowHead(
  id: string,
  title: string,
  count: string | null,
  all: string | null,
  tools?: Snippet,
)}
  <div class="mb-4 min-h-10 flex flex-wrap items-center gap-x-3 gap-y-2">
    <h2 {id} class="whitespace-nowrap text-title text-neutral-900 font-600">
      {title}
    </h2>
    {#if count !== null}<span
        class="whitespace-nowrap text-caption text-neutral-500 tabular-nums"
        in:fade>{count}</span
      >{/if}
    <div class="ml-auto flex items-center gap-2">
      {@render tools?.()}
      {#if all !== null}
        {@render seeAll(all)}
      {:else if count === null}
        <span class="invisible ml-1" aria-hidden="true" inert
          ><TextButton href={resolve('/')} class="md:h-9 md:px-4"
            >查看全部</TextButton
          ></span
        >
      {/if}
    </div>
  </div>
{/snippet}

{#snippet newPlaylistButton()}
  <ToolButton icon={Plus} label="新建歌单" onclick={newPlaylist} />
{/snippet}

<h1 class="sr-only">曲库</h1>
<SyncNotice {notice} class="pb-10" />
<section aria-labelledby="liked-heading">
  <div class="mb-4 min-h-10 flex flex-wrap items-center gap-x-3 gap-y-2">
    <h2
      id="liked-heading"
      class="whitespace-nowrap text-title text-neutral-900 font-600"
    >
      我喜欢的音乐
    </h2>
    {#if liked.songs.kind === 'songs'}
      <span
        class="whitespace-nowrap text-caption text-neutral-500 tabular-nums"
        in:fade>{formatCount(liked.songs.total)} 首</span
      >
    {/if}
    <div class="ml-auto flex items-center gap-2">
      {#if liked.songs.kind === 'songs'}
        <span class="flex items-center gap-2" in:fade>
          <IconButton
            icon={ChevronLeft}
            label="上一页"
            disabled={atStart}
            onclick={() => turn(-1)}
          />
          <IconButton
            icon={ChevronRight}
            label="下一页"
            disabled={atEnd}
            onclick={() => turn(1)}
          />
        </span>
      {/if}
      {#if library.liked}
        {@const likedId = library.liked.playlist.id}
        {@render seeAll(resolve('/playlists/[id=neteaseId]', { id: likedId }))}
        <PlayAllButton
          songs={library.liked.songs}
          source={{ kind: 'playlist', id: likedId }}
        />
      {/if}
    </div>
  </div>

  <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
    <div class="strip-card min-w-0 rounded-xl bg-white p-2 shadow-ambient">
      {#if liked.songs.kind === 'loading' && liked.failure?.where !== 'list'}
        <div
          class="strip"
          style:overflow-x="hidden"
          style:--fade-l="0px"
          style:--fade-r="48px"
          role="status"
          aria-busy="true"
          aria-label="正在加载我喜欢的音乐"
          out:fadeAway
        >
          {#each { length: 12 }, i (i)}
            <div
              class="grid grid-cols-[48px_minmax(0,1fr)_32px] h-[60px] items-center gap-3 pl-1.5 pr-1"
            >
              <span class="bone size-12 rounded-md"></span>
              <span class="flex flex-col gap-2">
                <span
                  class="bone h-3.5 rounded-full"
                  style:width="{[72, 58, 81, 64][i % 4]}%"
                ></span>
                <span
                  class="bone h-3 rounded-full"
                  style:width="{[40, 32, 46, 36][i % 4]}%"
                ></span>
              </span>
            </div>
          {/each}
        </div>
      {:else}
        <div in:reveal>
          {#if liked.songs.kind === 'songs'}
            <div
              bind:this={stripEl}
              bind:clientWidth={stripWidth}
              class="strip"
              role="list"
              aria-label="我喜欢的音乐的前 {strip.length} 首"
              style:--fade-l={atStart ? '0px' : '32px'}
              style:--fade-r={atEnd ? '0px' : '48px'}
              onscroll={measureStrip}
              data-reveal-group
              {@attach dragScroll}
            >
              {#each strip as song, i (song.id)}
                {@const look = songLook(view, song)}
                {@const off = look.off}
                {@const now = song.id === nowId}
                {@const source = {
                  kind: 'playlist',
                  id: library.liked!.playlist.id,
                } as const}
                <div
                  role="listitem"
                  class={[
                    'cell relative h-[60px] rounded-lg',
                    !off && 'mouse:hover:bg-neutral-50',
                  ]}
                  oncontextmenu={(event) => openSongMenuAt(event, song, source)}
                >
                  <div
                    class={[
                      'grid grid-cols-[48px_minmax(0,1fr)_32px] h-full items-center gap-3 pl-1.5 pr-1',
                      off && 'opacity-45',
                    ]}
                  >
                    <span class="relative size-12" bind:this={covers[i]}>
                      <Cover
                        url={song.album.coverUrl}
                        size={48}
                        eager={i < 6}
                        class="rounded-md"
                      />
                      {#if now}<NowChip />{/if}
                    </span>
                    <span class="min-w-0">
                      <PlayTarget
                        class="block w-full"
                        rounded
                        disabled={off}
                        {now}
                        cover={covers[i]}
                        onplay={() => view.app.play(source, song.id)}
                      >
                        <SongTitle
                          {song}
                          {now}
                          {look}
                          mark
                          tight
                          creditsOutside
                        />
                      </PlayTarget>
                      <span
                        class="flex items-center gap-1.5 text-caption text-neutral-600"
                        aria-hidden="true"
                      >
                        {#if look.mark}<DownloadMark
                            mark={look.mark}
                            variant="inline"
                          />{/if}
                        <CreditLine
                          artists={song.artists}
                          linked
                          class="min-w-0 truncate"
                        />
                      </span>
                    </span>
                    <SongMoreButton {song} {source} size="cell" />
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            {@render likedStates()}
          {/if}
        </div>
      {/if}
    </div>
    <DailyTile />
  </div>
</section>

<section class="mt-10" aria-labelledby="own-heading">
  {@render rowHead(
    'own-heading',
    '自建歌单',
    own && `${formatCount(own.length)} 张`,
    own && own.length > 0 ? resolve('/playlists') : null,
    newPlaylistButton,
  )}
  <TileGrid
    kind="playlist"
    layout="shelf"
    items={own}
    label="自建歌单"
    loadingLabel="正在加载自建歌单"
    failure={listFailure('自建歌单没能同步')}
    empty={{ icon: ListMusic, title: '还没有自建歌单' }}
  >
    {#snippet tile(playlist: Playlist)}
      <PlaylistTile
        id={playlist.id}
        name={playlistName(playlist)}
        coverUrl={playlist.coverUrl}
        trackCount={library.songCountOf(playlist.id)}
        creator={null}
        locked={playlist.private}
      />
    {/snippet}
  </TileGrid>
</section>

<section class="mt-10" aria-labelledby="collected-heading">
  {@render rowHead(
    'collected-heading',
    '收藏的歌单',
    collected && `${formatCount(collected.length)} 张`,
    collected && collected.length > 0
      ? `${resolve('/playlists')}#collected-playlists-heading`
      : null,
  )}
  <TileGrid
    kind="playlist"
    layout="shelf"
    items={collected}
    label="收藏的歌单"
    loadingLabel="正在加载收藏的歌单"
    failure={listFailure('收藏的歌单没能同步')}
    empty={{ icon: ListMusic, title: '还没有收藏的歌单' }}
  >
    {#snippet tile(playlist: Playlist)}
      <PlaylistTile
        id={playlist.id}
        name={playlistName(playlist)}
        coverUrl={playlist.coverUrl}
        trackCount={library.songCountOf(playlist.id)}
        creator={playlist.creator}
        locked={playlist.private}
      />
    {/snippet}
  </TileGrid>
</section>

<section class="mt-10" aria-labelledby="albums-heading">
  {@render rowHead(
    'albums-heading',
    '收藏的专辑',
    library.albums && `${formatCount(library.albums.length)} 张`,
    (library.albums?.length ?? 0) > 0 ? resolve('/albums') : null,
  )}
  <CollectedGrid {library} kind="albums" layout="shelf" />
</section>

<section class="mt-10 pb-12" aria-labelledby="artists-heading">
  {@render rowHead(
    'artists-heading',
    '收藏的歌手',
    library.artists && `${formatCount(library.artists.length)} 位`,
    (library.artists?.length ?? 0) > 0 ? resolve('/artists') : null,
  )}
  <CollectedGrid {library} kind="artists" layout="shelf" />
</section>

<style>
  .strip-card {
    container-type: inline-size;
  }

  .strip {
    display: grid;
    grid-template-rows: repeat(3, 60px);
    grid-auto-flow: column;
    grid-auto-columns: calc((100% - 24px) / 3.25);
    column-gap: 8px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    mask-image: linear-gradient(
      90deg,
      transparent 0,
      #000 var(--fade-l),
      #000 calc(100% - var(--fade-r)),
      transparent 100%
    );
  }

  @container (max-width: 679px) {
    .strip {
      grid-auto-columns: calc((100% - 16px) / 2.25);
    }
  }

  @container (max-width: 419px) {
    .strip {
      grid-auto-columns: calc((100% - 8px) / 1.25);
    }
  }

  .cell {
    scroll-snap-align: start;
  }
</style>
