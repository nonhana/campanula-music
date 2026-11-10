<script lang="ts">
  import { ArrowUpDown, ListMusic, Plus, SearchX } from '@lucide/svelte';
  import { flushSync, tick } from 'svelte';
  import { flip } from 'svelte/animate';

  import type { Playlist } from '#lib/api/library.js';
  import { playlistName } from '#lib/api/library.js';
  import type { LibraryState } from '#lib/app/library.js';
  import { playlistGroups } from '#lib/app/library.js';

  import { getOverlays } from '../overlay/overlay-context';
  import { getAppView } from '../shared/app-context.svelte';
  import { failureText } from '../shared/failure';
  import {
    animateHeight,
    fade,
    fadeThrough,
    moveMs,
    reveal,
    stagger,
  } from '../shared/motion';
  import { DURATIONS } from '../shared/motion-tokens';
  import { formatCount } from '../shared/text';
  import StateBlock from '../ui/StateBlock.svelte';
  import TextButton from '../ui/TextButton.svelte';
  import ToolButton from '../ui/ToolButton.svelte';
  import DragGrip from './DragGrip.svelte';
  import LibraryPageHead from './LibraryPageHead.svelte';
  import { PlaylistSort } from './playlist-sort.svelte';
  import PlaylistTile from './PlaylistTile.svelte';
  import { tileGridLook } from './tile-grid';
  import TileGrid from './TileGrid.svelte';

  interface Props {
    library: LibraryState;
    phone?: boolean;
    query: string;
  }

  let { library, phone = false, query = $bindable() }: Props = $props();
  const view = getAppView();
  const { playlistEditor, stack } = getOverlays();
  const groups = $derived(
    library.playlists ? playlistGroups(library.playlists) : null,
  );
  const own = $derived(groups?.own ?? null);
  const collected = $derived(groups?.collected ?? null);
  const term = $derived(query.trim());
  const found = $derived(
    term && library.playlists ? view.app.searchPlaylists(term) : null,
  );
  const total = $derived(
    own && collected ? own.length + collected.length : null,
  );
  const canOrder = $derived((own?.length ?? 0) > 1);
  const desktopGrid = $derived(tileGridLook('playlist', 'grid', false));

  let sorting = $state(false);
  let announcement = $state('');
  let ownSwap = $state<HTMLElement>();
  let resizing: Animation | undefined;

  const commitOrder = (ids: readonly number[]) => view.app.orderPlaylists(ids);
  const sort = new PlaylistSort({
    ids: () => own?.map((playlist) => playlist.id) ?? [],
    playlistOf: (id: number) => own?.find((playlist) => playlist.id === id),
    commit: commitOrder,
    layout: () => (phone ? 'rows' : 'grid'),
  });
  const sorted = $derived(
    sort.order
      .map((id) => own?.find((playlist) => playlist.id === id))
      .filter((playlist) => playlist !== undefined),
  );

  $effect(() => () => {
    sort.cancel();
  });

  // 先量旧高度再换内容（flushSync）：手机上新旧叠在同一格里，焦点放进去不会把页面滚走
  const switchSorting = (change: () => void) => {
    const box = ownSwap?.isConnected ? ownSwap : null;
    const from = box?.getBoundingClientRect().height ?? 0;
    resizing?.cancel();
    change();
    flushSync();
    if (!box) return;
    // 正在淡出的那块 Svelte 标成 inert；连着进出时留下来的可能是原来那块
    const incoming = box.querySelector<HTMLElement>(':scope > :not([inert])');
    if (incoming)
      resizing =
        animateHeight(box, from, incoming.offsetHeight, DURATIONS.panel) ??
        undefined;
  };

  const startSort = () => {
    if (!canOrder) return;
    switchSorting(() => {
      query = '';
      announcement = `正在排序，共 ${own?.length ?? 0} 张`;
      sorting = true;
    });
    document.querySelector<HTMLElement>('[data-playlist-sort] a')?.focus();
  };

  const finishSort = () => {
    switchSorting(() => {
      sorting = false;
      sort.cancel();
      announcement = '';
    });
    document.querySelector<HTMLElement>('[data-sort-entry]')?.focus();
  };

  const onWindowKeydown = (event: KeyboardEvent) => {
    // 有浮层开着时 Esc 先归最上层：浮动菜单不会让背景 inert，只看 inert 不够
    // 也不能让宿主在捕获阶段监听：那会抢在拖动的取消之前
    if (
      !sorting ||
      stack.top ||
      sort.dragging ||
      event.defaultPrevented ||
      event.key !== 'Escape'
    )
      return;
    event.preventDefault();
    finishSort();
  };

  const onListKeydown = (event: KeyboardEvent) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown'))
      return;
    const row = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-playlist-id]',
    );
    if (!row) return;
    const id = Number(row.dataset.playlistId);
    const sorter = sort;
    if (!sorter.moveByKeyboard(id, event.key === 'ArrowUp' ? -1 : 1)) {
      return;
    }
    event.preventDefault();
    // 卡片换位后浏览器会把焦点丢回 body：等这一帧排好再放回这一张
    void tick().then(() => {
      document
        .querySelector<HTMLElement>(`[data-playlist-id="${id}"] a`)
        ?.focus();
      const order = sorter.order;
      const playlist = sorter.playlistOf(id);
      const name = playlist ? playlistName(playlist) : '歌单';
      announcement = `${name}移到第 ${order.indexOf(id) + 1} 张，共 ${order.length} 张`;
    });
  };

  const EMPTY = { own: '还没有自建歌单', collected: '还没有收藏的歌单' };
</script>

{#snippet ownTile(playlist: Playlist)}
  <PlaylistTile
    id={playlist.id}
    name={playlistName(playlist)}
    coverUrl={playlist.coverUrl}
    trackCount={library.songCountOf(playlist.id)}
    creator={null}
    locked={playlist.private}
    {phone}
  />
{/snippet}

<svelte:window onkeydown={onWindowKeydown} />

<LibraryPageHead
  title="歌单"
  unit="张"
  {total}
  found={found && found.own.length + found.collected.length}
  bind:query
  disabled={sorting}
  {phone}
/>

{#if own === null && library.sync.status === 'failed'}
  <div in:reveal>
    <StateBlock
      kind="error"
      title="歌单列表没能同步"
      body={failureText(library.sync.failure)}
      action={{
        label: '重试',
        run: () => view.app.retrySync(),
      }}
    />
  </div>
{:else if found && found.own.length === 0 && found.collected.length === 0}
  <div in:reveal>
    <StateBlock kind="empty" icon={SearchX} title={`没有找到“${term}”`} />
  </div>
{:else}
  {#if sorting}
    <p class="sr-only" aria-live="polite">{announcement}</p>
  {/if}
  {#if !found || found.own.length > 0}
    <section aria-labelledby="own-playlists-heading">
      <div class={['mb-3 flex items-center gap-3', phone && 'px-4 pt-3']}>
        <h2
          id="own-playlists-heading"
          class="text-title-sm text-neutral-900 font-600"
        >
          自建歌单
        </h2>
        {#if own !== null}
          <span class="text-caption text-neutral-500 tabular-nums"
            >{formatCount((found?.own ?? own).length)} 张</span
          >
        {/if}
        {#if sorting}
          <TextButton
            strong
            desktop={{ variant: 'primary' }}
            class="ml-auto max-md:-mr-3"
            onclick={finishSort}>完成</TextButton
          >
        {:else}
          <div class="ml-auto flex items-center gap-2 max-md:-mr-3">
            {#if canOrder}
              <ToolButton
                icon={ArrowUpDown}
                label="排序自建歌单"
                text="排序"
                onclick={startSort}
                data-sort-entry
              />
            {/if}
            <ToolButton
              icon={Plus}
              label="新建歌单"
              onclick={(event) =>
                playlistEditor.open({
                  mode: 'new',
                  songs: [],
                  from: event.currentTarget,
                })}
            />
          </div>
        {/if}
      </div>

      {#if own === null}
        <TileGrid
          kind="playlist"
          layout="grid"
          {phone}
          items={null}
          label="自建歌单"
          loadingLabel="正在加载自建歌单"
        >
          {#snippet tile(playlist: Playlist)}{@render ownTile(
              playlist,
            )}{/snippet}
        </TileGrid>
      {:else if found}
        <TileGrid
          kind="playlist"
          layout="grid"
          {phone}
          items={found.own}
          label="自建歌单"
          loadingLabel="正在加载自建歌单"
        >
          {#snippet tile(playlist: Playlist)}{@render ownTile(
              playlist,
            )}{/snippet}
        </TileGrid>
      {:else if phone}
        <div
          bind:this={ownSwap}
          class="grid grid-cols-[minmax(0,1fr)] items-start"
        >
          {#key sorting ? 'sort' : 'own'}
            <div class="col-start-1 row-start-1 min-w-0" transition:fadeThrough>
              {#if sorting}
                <ul
                  class="w-full flex flex-col gap-2 px-4 pb-8"
                  aria-label="自建歌单，正在排序"
                  data-playlist-sort
                >
                  {#each sorted as playlist (playlist.id)}
                    <li
                      data-playlist-id={playlist.id}
                      class="relative"
                      animate:flip={{
                        duration: moveMs(DURATIONS.state),
                      }}
                    >
                      <div
                        class={[
                          'h-14 flex items-center gap-3 rounded-xl pl-3 pr-2',
                          sort.lifted(playlist.id)
                            ? 'bg-primary-100'
                            : 'bg-white shadow-ambient',
                        ]}
                      >
                        <div
                          class={[
                            'flex min-w-0 flex-1 items-center gap-3',
                            sort.lifted(playlist.id) &&
                              'pointer-events-none opacity-0',
                          ]}
                        >
                          <PlaylistTile
                            id={playlist.id}
                            name={playlistName(playlist)}
                            coverUrl={playlist.coverUrl}
                            trackCount={library.songCountOf(playlist.id)}
                            creator={null}
                            locked={playlist.private}
                            look="row"
                            onkeydown={onListKeydown}
                          />
                          <DragGrip
                            label={playlistName(playlist)}
                            size="phone"
                            attach={sort.handle(playlist.id)}
                            onkeydown={onListKeydown}
                          />
                        </div>
                      </div>
                    </li>
                  {/each}
                </ul>
              {:else}
                <TileGrid
                  kind="playlist"
                  layout="grid"
                  {phone}
                  items={own}
                  label="自建歌单"
                  loadingLabel="正在加载自建歌单"
                  empty={{ icon: ListMusic, title: EMPTY.own }}
                >
                  {#snippet tile(playlist: Playlist)}{@render ownTile(
                      playlist,
                    )}{/snippet}
                </TileGrid>
              {/if}
            </div>
          {/key}
        </div>
      {:else if own.length === 0}
        <TileGrid
          kind="playlist"
          layout="grid"
          {phone}
          items={own}
          label="自建歌单"
          loadingLabel="正在加载自建歌单"
          empty={{ icon: ListMusic, title: EMPTY.own }}
        >
          {#snippet tile(playlist: Playlist)}{@render ownTile(
              playlist,
            )}{/snippet}
        </TileGrid>
      {:else}
        <ul
          class={['grid', desktopGrid.list]}
          aria-label={sorting ? '自建歌单，正在排序' : '自建歌单'}
          data-reveal-group
          data-playlist-sort={sorting ? '' : undefined}
        >
          {#each sorted as playlist, i (playlist.id)}
            <li
              data-playlist-id={playlist.id}
              class="relative min-w-0"
              in:stagger={{ order: i }}
              animate:flip={{
                duration: moveMs(DURATIONS.state),
              }}
            >
              <!-- 不能淡入：影子落定时要和这一张同一帧换回，淡入中间会空一下 -->
              <div
                class={[
                  sort.lifted(playlist.id) && 'pointer-events-none opacity-0',
                ]}
              >
                <PlaylistTile
                  id={playlist.id}
                  name={playlistName(playlist)}
                  coverUrl={playlist.coverUrl}
                  trackCount={library.songCountOf(playlist.id)}
                  creator={null}
                  locked={playlist.private}
                  onkeydown={sorting ? onListKeydown : undefined}
                />
              </div>
              {#if sort.lifted(playlist.id)}
                <div
                  class="pointer-events-none absolute inset-x-0 top-0 aspect-square rounded-lg bg-primary-100"
                ></div>
              {/if}
              {#if sorting}
                <span
                  class={[
                    'absolute right-2 top-2 z-10',
                    sort.lifted(playlist.id) && 'pointer-events-none opacity-0',
                  ]}
                  in:fade={{ duration: DURATIONS.feedback }}
                >
                  <DragGrip
                    label={playlistName(playlist)}
                    size="desktop"
                    overlay
                    attach={sort.handle(playlist.id)}
                    onkeydown={onListKeydown}
                  />
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}

  {#if !found || found.collected.length > 0}
    <section
      class={!found || found.own.length > 0 ? 'mt-8' : ''}
      aria-labelledby="collected-playlists-heading"
    >
      <div class={['mb-3 flex items-center gap-3', phone && 'px-4 pt-3']}>
        <h2
          id="collected-playlists-heading"
          class="text-title-sm text-neutral-900 font-600"
        >
          收藏的歌单
        </h2>
        {#if collected !== null}
          <span class="text-caption text-neutral-500 tabular-nums"
            >{formatCount((found?.collected ?? collected).length)} 张</span
          >
        {/if}
      </div>

      <TileGrid
        kind="playlist"
        layout="grid"
        {phone}
        items={found?.collected ?? collected}
        label="收藏的歌单"
        loadingLabel="正在加载收藏的歌单"
        empty={{ icon: ListMusic, title: EMPTY.collected }}
      >
        {#snippet tile(playlist: Playlist)}
          <PlaylistTile
            id={playlist.id}
            name={playlistName(playlist)}
            coverUrl={playlist.coverUrl}
            trackCount={library.songCountOf(playlist.id)}
            creator={playlist.creator}
            locked={playlist.private}
            {phone}
          />
        {/snippet}
      </TileGrid>
    </section>
  {/if}
{/if}

{#if phone && (sort.dragging || sort.settling) && sort.grabbed}
  <div
    class={[
      'pointer-events-none fixed left-0 top-0 z-50',
      sort.settling && 'transition-transform duration-move-state ease-out-soft',
    ]}
    style:left="{sort.ghost.x}px"
    style:width="{sort.ghost.width}px"
    style:transform="translate3d(0, {sort.settling
      ? sort.settleY
      : sort.ghost.y}px, 0)"
    aria-hidden="true"
    inert={true}
  >
    <div
      class={[
        'h-14 flex items-center gap-3 rounded-xl bg-white pl-3 pr-2 transition-shadow duration-state',
        sort.settling ? 'shadow-ambient' : 'shadow-float',
      ]}
    >
      <PlaylistTile
        id={sort.grabbed.id}
        name={playlistName(sort.grabbed)}
        coverUrl={sort.grabbed.coverUrl}
        trackCount={library.songCountOf(sort.grabbed.id)}
        creator={null}
        locked={sort.grabbed.private}
        look="row"
      />
      <DragGrip label={playlistName(sort.grabbed)} size="phone" ghost />
    </div>
  </div>
{:else if !phone && (sort.dragging || sort.settling) && sort.grabbed}
  <div
    class={[
      'pointer-events-none fixed left-0 top-0 z-50',
      sort.settling && 'transition-transform duration-move-state ease-out-soft',
    ]}
    style:width="{sort.ghost.width}px"
    style:transform="translate3d({sort.settling
      ? sort.settleX
      : sort.ghost.x}px, {sort.settling ? sort.settleY : sort.ghost.y}px, 0)"
    aria-hidden="true"
    inert={true}
  >
    <div
      class={[
        'relative rounded-xl p-2 transition-[background-color,box-shadow] duration-state',
        !sort.settling && 'bg-white shadow-float',
      ]}
    >
      <PlaylistTile
        id={sort.grabbed.id}
        name={playlistName(sort.grabbed)}
        coverUrl={sort.grabbed.coverUrl}
        trackCount={library.songCountOf(sort.grabbed.id)}
        creator={null}
        locked={sort.grabbed.private}
        flight={false}
      />
      <span class="absolute right-4 top-4 z-10">
        <DragGrip
          label={playlistName(sort.grabbed)}
          size="desktop"
          overlay
          ghost
        />
      </span>
    </div>
  </div>
{/if}
