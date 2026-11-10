<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { LucideIcon } from '@lucide/svelte';
  import {
    CircleArrowDown,
    Ellipsis,
    ListMusic,
    ListPlus,
    Lock,
    SearchX,
  } from '@lucide/svelte';

  import type { Playlist, PlaylistUnavailable } from '#lib/api/library.js';
  import { playlistName } from '#lib/api/library.js';
  import type { LibraryState } from '#lib/app/library.js';
  import Avatar from '#lib/components/account/Avatar.svelte';
  import CollectButton from '#lib/components/library/CollectButton.svelte';
  import DetailHeader from '#lib/components/library/DetailHeader.svelte';
  import PlaylistSongs from '#lib/components/library/PlaylistSongs.svelte';
  import PlaylistTile from '#lib/components/library/PlaylistTile.svelte';
  import { ROW_COVER_SIZE } from '#lib/components/library/tile-grid.js';
  import { playlistHeader } from '#lib/components/library/view.js';
  import { anchorBelow } from '#lib/components/menu/menu-anchor.js';
  import { getOverlays } from '#lib/components/overlay/overlay-context.js';
  import { getAppView } from '#lib/components/shared/app-context.svelte.js';
  import { failureText } from '#lib/components/shared/failure.js';
  import { desktopLayout } from '#lib/components/shared/layout.js';
  import {
    atOnce,
    reveal,
    scrollBehavior,
    stagger,
  } from '#lib/components/shared/motion.js';
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js';
  import { langOf } from '#lib/components/shared/text.js';
  import { playerDockBottom } from '#lib/components/shell/player-dock.js';
  import PlayAllButton from '#lib/components/songs/PlayAllButton.svelte';
  import Button from '#lib/components/ui/Button.svelte';
  import IconButton from '#lib/components/ui/IconButton.svelte';
  import Scrollbar from '#lib/components/ui/Scrollbar.svelte';
  import SearchField from '#lib/components/ui/SearchField.svelte';
  import StateBlock from '#lib/components/ui/StateBlock.svelte';

  import type { PageProps } from './$types';

  const { params }: PageProps = $props();
  const view = getAppView();
  const { addSongsDialog, downloadPicker, playlistMenu, playerLayer } =
    getOverlays();
  const library = $derived(view.state.library);
  const id = $derived(params.id);
  const page = $derived(library?.playlistPage(id) ?? null);
  const shown = $derived(page?.songs ?? null);
  const outside = $derived(page?.inLibrary === false);
  const header = $derived(page && playlistHeader(page));
  const phone = $derived(!desktopLayout.current);
  const here = $derived(resolve('/playlists/[id=neteaseId]', { id }));

  let query = $state('');
  scrollSnapshot(
    '/playlists/[id=neteaseId]',
    () => query,
    (value) => {
      query = value;
    },
  );
  afterNavigate(({ type, shallow }) => {
    if (shallow && type === 'goto') return;
    if (type !== 'popstate' && type !== 'enter') atOnce(() => (query = ''));
  });

  $effect(() => view.app.viewing({ kind: 'playlist', id }));

  const name = $derived(header?.name ?? '');
  const own = $derived(page?.can.edit ?? false);

  const openMenu = (event: MouseEvent, compact = false) => {
    const button = event.currentTarget as HTMLElement;
    if (playlistMenu.request?.from === button) return playlistMenu.close();
    playlistMenu.open({
      playlistId: id,
      from: button,
      anchor: anchorBelow(event),
      compact,
    });
  };

  const openAddSongs = (event: MouseEvent) => {
    addSongsDialog.open({
      playlistId: id,
      from: event.currentTarget as HTMLElement,
    });
  };

  const UNAVAILABLE = {
    deleted: { icon: ListMusic, title: '这张歌单已被删除' },
    missing: { icon: SearchX, title: '没有这张歌单', body: '可能是地址不对' },
    private: { icon: Lock, title: '这是别人的隐私歌单' },
  } satisfies Record<
    PlaylistUnavailable,
    { icon: LucideIcon; title: string; body?: string }
  >;

  const side = $derived.by(() => {
    const playlists = library?.playlists ?? [];
    return {
      liked: playlists.filter((item) => item.kind === 'liked'),
      own: playlists.filter((item) => item.kind === 'own'),
      collected: playlists.filter((item) => item.kind === 'collected'),
    };
  });
  const sideListed = $derived(library?.playlists != null);
  const playingFrom = $derived.by(() => {
    const { player } = view.state;
    const source =
      player.current === null ? null : player.queue[player.current].source;
    return source?.kind === 'playlist' ? source.id : null;
  });
  const sideBottom = $derived(
    playerDockBottom({
      desktop: true,
      present: playerLayer.hasQueue,
      withoutBar: '0px',
    }),
  );

  const SIDE_FADE = 40;
  let sideNav = $state<HTMLElement>();
  let sidePlacedFor: number | null = null;
  $effect(() => {
    const nav = sideNav;
    if (!nav) {
      sidePlacedFor = null;
      return;
    }
    if (!sideListed || sidePlacedFor === id) return;
    const current = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!current) return;
    const first = sidePlacedFor === null;
    sidePlacedFor = id;
    const box = nav.getBoundingClientRect();
    const row = current.getBoundingClientRect();
    const fadeTop = Math.min(nav.scrollTop, SIDE_FADE);
    const fadeBottom = Math.min(
      nav.scrollHeight - nav.clientHeight - nav.scrollTop,
      SIDE_FADE,
    );
    if (
      !first &&
      row.top >= box.top + fadeTop &&
      row.bottom <= box.bottom - fadeBottom
    )
      return;
    nav.scrollTo({
      top:
        nav.scrollTop + row.top - box.top - (nav.clientHeight - row.height) / 2,
      behavior: first ? 'auto' : scrollBehavior(),
    });
  });
</script>

<svelte:head><title>{name || '歌单'} · Campanula</title></svelte:head>

{#snippet headerMeta()}
  {#if header}
    {#if header.creator}
      <span class="min-w-0 inline-flex items-center gap-1.5">
        <Avatar url={header.creatorAvatarUrl} size={20} />
        <span class="truncate" lang={langOf(header.creator)}
          >{header.creator}</span
        >
      </span>
      {#if header.meta.length > 0}<span aria-hidden="true">·</span>{/if}
    {/if}
    {#each header.meta as part, i (i)}
      {#if i > 0}<span aria-hidden="true">·</span>{/if}
      <span class="tabular-nums">{part}</span>
    {/each}
    {#if header.private}<span
        class="inline-flex items-center"
        role="img"
        aria-label="隐私歌单"
        title="隐私歌单"><Lock size={13} aria-hidden="true" /></span
      >{/if}
  {/if}
{/snippet}

{#snippet headerSearch(compact: boolean)}
  <SearchField
    label="在歌单里搜索"
    bind:value={query}
    placeholder={compact ? '搜索' : '在歌单里搜索'}
    class="max-w-[280px] min-w-[128px] w-full"
    disabled={shown?.kind !== 'songs'}
  />
{/snippet}

{#snippet headerActions(compact: boolean)}
  <PlayAllButton
    songs={shown?.kind === 'songs' ? shown.songs : null}
    source={{ kind: 'playlist', id }}
  />
  {#if page?.inLibrary === true}
    {@const unloaded = shown?.kind !== 'songs' || shown.songs.length === 0}
    {#if compact && page?.can.collect}
      <Button
        variant="download"
        icon={CircleArrowDown}
        class="w-10 px-0!"
        title="下载"
        aria-label="下载"
        disabled={!view.state.online || unloaded}
        onclick={(event: MouseEvent) =>
          downloadPicker.open({
            kind: 'playlist',
            playlistId: id,
            from: event.currentTarget as HTMLElement,
          })}
      ></Button>
    {:else}
      <Button
        variant="download"
        icon={CircleArrowDown}
        disabled={!view.state.online || unloaded}
        onclick={(event: MouseEvent) =>
          downloadPicker.open({
            kind: 'playlist',
            playlistId: id,
            from: event.currentTarget as HTMLElement,
          })}>下载</Button
      >
    {/if}
  {/if}
  {#if page?.can.collect}
    <CollectButton
      target={{ kind: 'playlist', id }}
      {name}
      look={compact ? 'icon' : 'pill'}
    />
  {/if}
  {#if own}
    <span class="flex items-center gap-1 md:ml-1">
      {#if !compact}
        <IconButton
          icon={ListPlus}
          label="添加歌曲"
          title="添加歌曲"
          data-add-songs-entry
          onclick={openAddSongs}
        />
      {/if}
      <IconButton
        icon={Ellipsis}
        label={`歌单操作：${name}`}
        title="歌单操作"
        aria-haspopup="menu"
        aria-expanded={playlistMenu.request?.playlistId === id}
        onclick={(event: MouseEvent) => openMenu(event, compact)}
      />
    </span>
  {/if}
{/snippet}

{#snippet mainColumn(library: LibraryState)}
  <DetailHeader
    ready={!!header}
    cover={{ url: header?.coverUrl ?? null, placeholder: ROW_COVER_SIZE }}
    title={name}
    flight={here}
    tags={header?.tags ?? []}
    description={header?.description}
  >
    {#snippet meta()}{@render headerMeta()}{/snippet}
    {#snippet actions(compact: boolean)}{@render headerActions(
        compact,
      )}{/snippet}
    {#snippet search(compact: boolean)}{@render headerSearch(compact)}{/snippet}
  </DetailHeader>
  <div class={phone ? '' : 'mt-6'}>
    <PlaylistSongs {library} playlistId={id} bind:query {phone} />
  </div>
{/snippet}

{#snippet sideGroup(
  library: LibraryState,
  items: readonly Playlist[],
  from: number,
  title: string | null,
)}
  {#if title && items.length > 0}
    <h2
      class="mb-1 mt-5 px-2 text-caption text-neutral-500 font-500"
      in:stagger={{ order: from }}
    >
      {title}
    </h2>
  {/if}
  <ul class="flex flex-col gap-0.5">
    {#each items as item, i (item.id)}
      {@const current = item.id === id}
      <li in:stagger={{ order: from + i }}>
        <PlaylistTile
          id={item.id}
          name={playlistName(item)}
          coverUrl={item.coverUrl}
          trackCount={library.songCountOf(item.id)}
          creator={null}
          locked={item.private}
          look="nav"
          {current}
          now={item.id === playingFrom}
        />
      </li>
    {/each}
  </ul>
{/snippet}

{#if library && page && page.songs.kind === 'unavailable'}
  {@const why = UNAVAILABLE[page.songs.reason]}
  <div in:reveal>
    <StateBlock
      kind="empty"
      icon={why.icon}
      title={why.title}
      body={'body' in why ? why.body : undefined}
      action={{
        label: '回到曲库',
        run: () => goto(resolve('/')),
      }}
    />
  </div>
{:else if library && outside && page?.failure?.where === 'list'}
  <div in:reveal>
    <StateBlock
      kind="error"
      title="这张歌单没能打开"
      body={page.failure.failure.kind === 'offline'
        ? '不在曲库里的歌单要联网才能打开'
        : failureText(page.failure.failure)}
      action={{
        label: '重试',
        run: () => void view.app.openPlaylist(id),
      }}
    />
  </div>
{:else if library && desktopLayout.current && outside}
  {@render mainColumn(library)}
{:else if library && desktopLayout.current}
  <div class="grid items-start gap-8 lg:grid-cols-[208px_minmax(0,1fr)]">
    <div class="min-w-0 lg:col-start-2 lg:row-start-1">
      {@render mainColumn(library)}
    </div>

    <nav
      bind:this={sideNav}
      class="side sticky hidden overflow-y-auto lg:col-start-1 lg:row-start-1 -ml-3 -mt-4 lg:block"
      style:top="calc(4rem + var(--offline-bar-height, 0px))"
      style:max-height={`calc(100dvh - 4rem - var(--offline-bar-height, 0px) - ${sideBottom})`}
      style:--side-fade={`${SIDE_FADE}px`}
      aria-label="曲库里的歌单"
    >
      <Scrollbar />
      <div class="py-4 pl-1 pr-2">
        {@render sideGroup(library, side.liked, 0, null)}
        {@render sideGroup(library, side.own, side.liked.length, '自建歌单')}
        {@render sideGroup(
          library,
          side.collected,
          side.liked.length + side.own.length,
          '收藏的歌单',
        )}
      </div>
    </nav>
  </div>
{:else if library}
  {@render mainColumn(library)}
{/if}

<style>
  @property --side-fade-top {
    syntax: '<length>';
    inherits: false;
    initial-value: 0px;
  }

  @property --side-fade-bottom {
    syntax: '<length>';
    inherits: false;
    initial-value: 0px;
  }

  .side {
    scroll-padding-block: var(--side-fade);
    mask-image: linear-gradient(
      180deg,
      transparent,
      #000 var(--side-fade-top),
      #000 calc(100% - var(--side-fade-bottom)),
      transparent
    );
    animation:
      side-fade-top linear both,
      side-fade-bottom linear both;
    animation-timeline: scroll(self), scroll(self);
    animation-range:
      0px var(--side-fade),
      calc(100% - var(--side-fade)) 100%;
  }

  :global(html:active-view-transition-type(fade)) .side {
    view-transition-name: playlist-side;
    view-transition-class: still;
  }

  @keyframes side-fade-top {
    from {
      --side-fade-top: 0px;
    }
    to {
      --side-fade-top: var(--side-fade);
    }
  }

  @keyframes side-fade-bottom {
    from {
      --side-fade-bottom: var(--side-fade);
    }
    to {
      --side-fade-bottom: 0px;
    }
  }
</style>
