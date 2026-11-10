<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Disc3, UserRound } from '@lucide/svelte';
  import { tick } from 'svelte';

  import type {
    ArtistAlbum,
    ArtistIntroResponse,
    ArtistSongOrder,
  } from '#lib/api/library.js';
  import type { ArtistTab } from '#lib/app/library.js';
  import AlbumTile from '#lib/components/library/AlbumTile.svelte';
  import {
    ARTIST_ORDERS,
    ARTIST_PANEL_ID,
    ARTIST_TABS,
    artistOrderOf,
    artistSearch,
    artistTabId,
    artistTabOf,
  } from '#lib/components/library/artist-view.js';
  import CollectButton from '#lib/components/library/CollectButton.svelte';
  import DetailHeader from '#lib/components/library/DetailHeader.svelte';
  import { selectionActions } from '#lib/components/library/selection-actions.svelte.js';
  import TileGrid from '#lib/components/library/TileGrid.svelte';
  import { getOverlays } from '#lib/components/overlay/overlay-context.js';
  import { getAppView } from '#lib/components/shared/app-context.svelte.js';
  import { failureText } from '#lib/components/shared/failure.js';
  import { desktopLayout } from '#lib/components/shared/layout.js';
  import { DURATIONS } from '#lib/components/shared/motion-tokens.js';
  import { fade, fadeAway, reveal } from '#lib/components/shared/motion.js';
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js';
  import { formatCount, langOf, yearOf } from '#lib/components/shared/text.js';
  import PlayAllButton from '#lib/components/songs/PlayAllButton.svelte';
  import SongList from '#lib/components/songs/SongList.svelte';
  import type { SongListView } from '#lib/components/songs/view.js';
  import { SONG_ROW_HEIGHT } from '#lib/components/songs/view.js';
  import LongText from '#lib/components/ui/LongText.svelte';
  import Segmented from '#lib/components/ui/Segmented.svelte';
  import ShowMore from '#lib/components/ui/ShowMore.svelte';
  import StateBlock from '#lib/components/ui/StateBlock.svelte';
  import Tabs from '#lib/components/ui/Tabs.svelte';

  import type { PageProps } from './$types';

  const { params }: PageProps = $props();
  const view = getAppView();
  const { multiSelect } = getOverlays();
  const library = $derived(view.state.library);
  const id = $derived(params.id);
  const tab = $derived(artistTabOf(page.url.searchParams.get('tab')));
  const order = $derived(artistOrderOf(page.url.searchParams.get('order')));
  const opened = $derived(library?.artistPage(id) ?? null);
  const content = $derived(opened?.status === 'shown' ? opened.content : null);
  const artist = $derived(content?.artist ?? null);
  const here = $derived(resolve('/artists/[id=neteaseId]', { id }));
  const phone = $derived(!desktopLayout.current);
  const counts = $derived(
    artist
      ? [
          artist.songCount === null
            ? null
            : `${formatCount(artist.songCount)} 首歌`,
          artist.albumCount === null
            ? null
            : `${formatCount(artist.albumCount)} 张专辑`,
        ]
          .filter((part) => part !== null)
          .join(' · ')
      : '',
  );

  scrollSnapshot(
    '/artists/[id=neteaseId]',
    () => null,
    () => {},
  );

  $effect(() => view.app.viewing({ kind: 'artist', id, tab, order }));

  const songs = $derived(content?.songs[order] ?? null);
  const shownSongs = $derived(songs?.status === 'shown' ? songs.content : null);
  const songList = $derived.by((): SongListView => {
    if (songs?.status === 'failed') {
      return {
        kind: 'failed',
        title: '歌曲没能加载',
        body: failureText(songs.failure),
        retry: () => void view.app.openArtistSongs(id, order),
      };
    }
    if (!shownSongs) return { kind: 'loading' };
    if (shownSongs.songs.length === 0)
      return { kind: 'empty', title: '还没有歌' };
    return { kind: 'songs', songs: shownSongs.songs };
  });

  const actions = selectionActions();
  const select = $derived({
    actions: [
      actions.addToPlaylist(),
      actions.download(() => ({ kind: 'single' })),
    ],
  });

  const tabs = $derived(
    ARTIST_TABS.map((item) => ({
      key: item.key,
      label: item.label,
      href: resolve(`/artists/[id=neteaseId]${artistSearch(item.key, order)}`, {
        id,
      }),
    })),
  );

  let gap = $state<HTMLElement>();
  let tabRow = $state<HTMLElement>();
  let tabsHeight = $state(0);
  $effect(() => {
    const { style } = document.documentElement;
    style.setProperty('--sticky-below-header', `${tabsHeight}px`);
    return () => style.removeProperty('--sticky-below-header');
  });

  const stuckTop = (): number | null => {
    if (!gap || !tabRow) return null;
    const top = Number.parseFloat(getComputedStyle(tabRow).top);
    return gap.getBoundingClientRect().bottom < top ? top : null;
  };

  const go = async (next: { tab: ArtistTab; order: ArtistSongOrder }) => {
    if (next.tab === tab && next.order === order) return;
    if (multiSelect.mode) await multiSelect.leave();
    const stuck = stuckTop();
    await goto(
      resolve(`/artists/[id=neteaseId]${artistSearch(next.tab, next.order)}`, {
        id,
      }),
      { replace: true, reset: false },
    );
    await tick();
    if (stuck !== null && gap)
      window.scrollTo({
        top: window.scrollY + gap.getBoundingClientRect().bottom - stuck,
        behavior: 'instant',
      });
  };

  const selectTab = (key: ArtistTab) => go({ tab: key, order });
  const selectOrder = (key: ArtistSongOrder) => void go({ tab, order: key });

  const panelMinHeight = $derived(
    phone
      ? `calc(100dvh - var(--phone-top, 0px) - ${tabsHeight}px)`
      : `calc(100dvh - 4rem - var(--offline-bar-height, 0px) - ${tabsHeight}px)`,
  );

  let songsHost = $state<HTMLElement>();
  const showMoreSongs = async () => {
    const from = order;
    const shown = shownSongs?.songs.length ?? 0;
    await view.app.moreArtistSongs(id, from);
    await tick();
    if (order === from && shownSongs?.more === null && songsHost) {
      const top =
        songsHost.getBoundingClientRect().top + shown * SONG_ROW_HEIGHT;
      [...songsHost.querySelectorAll<HTMLElement>('[data-play-target]')]
        .find((target) => target.getBoundingClientRect().top >= top - 1)
        ?.focus();
    }
  };

  const introFrame = $derived(phone ? 'px-4 pt-4' : 'pb-6 pt-5');
  const introCard = $derived([
    'rounded-xl bg-white shadow-ambient',
    phone ? 'p-4' : 'mx-auto max-w-[768px] p-6',
  ]);

  let albumList = $state<HTMLElement>();
  let appendedAt = $state(0);
  const showMoreAlbums = async () => {
    const shown = content?.albums.length ?? 0;
    appendedAt = shown;
    await view.app.moreArtistAlbums(id);
    await tick();
    if (!content?.moreAlbums) albumList?.querySelectorAll('a')[shown]?.focus();
  };

  const intro = $derived(content?.intro ?? null);
  const introEmpty = $derived(
    intro?.status === 'shown' &&
      !intro.content.brief &&
      intro.content.sections.length === 0,
  );
</script>

<svelte:head><title>{artist?.name ?? '歌手'} · Campanula</title></svelte:head>

{#snippet orderSwitch()}
  <Segmented
    options={ARTIST_ORDERS}
    value={order}
    onchange={selectOrder}
    role="radio"
    id="artist-order"
    label="排序"
    look="text"
  />
{/snippet}

{#snippet introText(text: ArtistIntroResponse)}
  <div class="space-y-6">
    {#if text.brief}<LongText text={text.brief} />{/if}
    {#each text.sections as section (section)}
      <section>
        {#if section.title}
          <h2
            class="break-words text-title-sm text-neutral-900 font-600"
            lang={langOf(section.title)}
          >
            {section.title}
          </h2>
        {/if}
        <LongText text={section.text} class={section.title && 'mt-2'} />
      </section>
    {/each}
  </div>
{/snippet}

{#snippet introPanel()}
  {#if intro?.status === 'failed'}
    <div in:fade>
      <StateBlock
        kind="error"
        title="简介没能加载"
        body={failureText(intro.failure)}
        action={{
          label: '重试',
          run: () => void view.app.openArtistIntro(id),
        }}
      />
    </div>
  {:else if introEmpty}
    <div in:fade>
      <StateBlock kind="empty" icon={UserRound} title="还没有简介" />
    </div>
  {:else if intro?.status === 'shown'}
    <div class={introFrame} in:fade={{ duration: DURATIONS.reveal }}>
      <div class={introCard}>{@render introText(intro.content)}</div>
    </div>
  {:else}
    <div
      class={introFrame}
      role="status"
      aria-busy="true"
      aria-label="正在加载简介"
      out:fadeAway
    >
      <div class={introCard}>
        {#each [100, 96, 64] as width (width)}
          <span class="h-7 flex items-center" style:width="{width}%"
            ><span class="bone h-3.5 w-full rounded-full"></span></span
          >
        {/each}
        <span class="mt-6 h-6 w-1/3 flex items-center"
          ><span class="bone h-4 w-full rounded-full"></span></span
        >
        {#each [100, 88] as width, i (width)}
          <span
            class={['h-7 flex items-center', i === 0 && 'mt-2']}
            style:width="{width}%"
            ><span class="bone h-3.5 w-full rounded-full"></span></span
          >
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

{#if library}
  {#if opened?.status === 'failed'}
    <div in:reveal>
      <StateBlock
        kind="error"
        title="这位歌手的页面没能加载"
        body={failureText(opened.failure)}
        action={{
          label: '重试',
          run: () => void view.app.openArtist(id),
        }}
      />
    </div>
  {:else}
    <DetailHeader
      align="center"
      ready={!!artist}
      cover={{
        url: artist?.avatarUrl ?? null,
        round: true,
        fallback: UserRound,
      }}
      title={artist?.name ?? ''}
      flight={here}
    >
      {#snippet meta()}
        {#if artist}
          {counts}
        {/if}
      {/snippet}
      {#snippet actions()}
        {#if artist}
          <PlayAllButton
            songs={shownSongs?.songs ?? null}
            source={{ kind: 'artist', id }}
          />
          <CollectButton
            target={{ kind: 'artist', id }}
            name={artist.name}
            look="pill"
          />
        {/if}
      {/snippet}
    </DetailHeader>

    <div bind:this={gap} class={phone ? 'h-4' : 'h-8'}></div>
    {#if phone}
      <div
        bind:this={tabRow}
        class="sticky z-10 flex items-center bg-primary-50"
        style:top="var(--phone-top, 0px)"
        bind:clientHeight={tabsHeight}
      >
        <Tabs
          {tabs}
          selected={tab}
          onselect={selectTab}
          idOf={artistTabId}
          panel={ARTIST_PANEL_ID}
          label="歌手页"
          class="min-w-0 flex-1 px-2"
        />
        {#if tab === 'songs'}
          <div class="flex-none pr-2" transition:fade>
            {@render orderSwitch()}
          </div>
        {/if}
      </div>
    {:else}
      <div
        bind:this={tabRow}
        class="sticky z-10 flex items-center gap-4 bg-primary-50 px-3 -mx-3"
        style:top="calc(4rem + var(--offline-bar-height, 0px))"
        bind:clientHeight={tabsHeight}
      >
        <Tabs
          {tabs}
          selected={tab}
          onselect={selectTab}
          idOf={artistTabId}
          panel={ARTIST_PANEL_ID}
          label="歌手页"
          class="min-w-0 flex-1 -ml-3"
        />
        {#if tab === 'songs'}
          <div class="flex-none -mr-2" transition:fade>
            {@render orderSwitch()}
          </div>
        {/if}
      </div>
    {/if}

    <div
      id={ARTIST_PANEL_ID}
      role="tabpanel"
      aria-labelledby={artistTabId(tab)}
      style:min-height={panelMinHeight}
    >
      {#if tab === 'songs'}
        {#if phone}
          <SongList
            list={songList}
            source={{ kind: 'artist', id }}
            loadingLabel="正在加载歌曲"
            phone
            count={shownSongs?.total ?? null}
            {select}
            bind:host={songsHost}
          />
          <ShowMore
            more={shownSongs?.more ?? null}
            onmore={() => void showMoreSongs()}
            failed="没能加载更多歌曲"
            class="px-4 pt-5"
          />
        {:else}
          <div class="pb-6 pt-5">
            <SongList
              list={songList}
              source={{ kind: 'artist', id }}
              loadingLabel="正在加载歌曲"
              {select}
              bind:host={songsHost}
            />
            <ShowMore
              more={shownSongs?.more ?? null}
              onmore={() => void showMoreSongs()}
              failed="没能加载更多歌曲"
              class="pt-5"
            />
          </div>
        {/if}
      {:else if tab === 'albums'}
        <div class={phone ? '' : 'pb-6 pt-5'}>
          <div bind:this={albumList}>
            <TileGrid
              kind="album"
              layout="grid"
              {phone}
              items={content?.albums ?? null}
              label="专辑"
              loadingLabel="正在加载专辑"
              empty={content?.moreAlbums
                ? undefined
                : { icon: Disc3, title: '还没有专辑' }}
              staggerFrom={appendedAt}
            >
              {#snippet tile(album: ArtistAlbum)}
                <AlbumTile
                  id={album.id}
                  name={album.name}
                  coverUrl={album.coverUrl}
                  detail=""
                  year={yearOf(album.publishedAt)}
                  {phone}
                />
              {/snippet}
            </TileGrid>
          </div>
          <ShowMore
            more={content?.moreAlbums ?? null}
            onmore={() => void showMoreAlbums()}
            failed="没能加载更多专辑"
            class={phone ? 'px-4 pt-5' : 'pt-5'}
          />
        </div>
      {:else}
        {@render introPanel()}
      {/if}
    </div>
  {/if}
{/if}
