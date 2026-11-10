<script lang="ts">
  import { ListChecks, ListMusic, SearchX } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';
  import type { ClassValue } from 'svelte/elements';

  import type { Song } from '#lib/api/library.js';
  import type { PlaySource } from '#lib/api/playback.js';

  import type { SelectionSource } from '../library/multi-select.svelte';
  import { selectionKeyOf } from '../library/selection-core';
  import SelectionToolbar from '../library/SelectionToolbar.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import { currentSong } from '../player/now';
  import { getAppView } from '../shared/app-context.svelte';
  import { fade, reveal, stagger } from '../shared/motion';
  import {
    focusNowRow,
    getNowLocate,
    hasNowLocate,
  } from '../shared/now-locate.svelte';
  import { formatCount } from '../shared/text';
  import IconButton from '../ui/IconButton.svelte';
  import StateBlock from '../ui/StateBlock.svelte';
  import VirtualList from '../ui/VirtualList.svelte';
  import SkeletonRows from './SkeletonRows.svelte';
  import SongRow, { SONG_COLUMNS, SONG_GRID } from './SongRow.svelte';
  import type {
    SongDragHooks,
    SongListView,
    SongSearch,
    SongSelect,
  } from './view';
  import { SONG_ROW_HEIGHT, songMark } from './view';

  // 让开顶栏；断网提示条和页面自己的吸顶行高度由外部写成 CSS 变量
  const HEADER_TOP =
    'calc(4rem + var(--offline-bar-height, 0px) + var(--sticky-below-header, 0px))';

  interface Props {
    list: SongListView;
    source: PlaySource;
    phone?: boolean;
    numbered?: boolean;
    loadingLabel: string;
    search?: SongSearch | null;
    count?: number | null;
    skeleton?: number;
    notice?: Snippet;
    select?: SongSelect | null;
    grip?: Snippet<[Song]>;
    drag?: SongDragHooks | null;
    rowWrap?: Snippet<[Song, number, Snippet<[Song, number]>]>;
    appendedAt?: number;
    bare?: boolean;
    virtual?: boolean;
    staggerRows?: boolean;
    headerHidden?: boolean;
    reveal?: boolean;
    label?: string;
    contentClass?: ClassValue;
    host?: HTMLElement;
    /** 换了值就重新量一次虚拟列表 */
    remeasure?: unknown;
    locate?: boolean;
  }

  let {
    list,
    source,
    phone = false,
    numbered = false,
    loadingLabel,
    search = null,
    count,
    skeleton,
    notice,
    select = null,
    grip,
    drag = null,
    rowWrap,
    appendedAt = 0,
    bare = false,
    virtual: wantedVirtual,
    staggerRows = true,
    headerHidden = true,
    reveal: wantedReveal,
    label = '歌曲',
    contentClass,
    host = $bindable(),
    remeasure,
    locate = true,
  }: Props = $props();

  const revealContent = $derived(wantedReveal ?? !bare);
  const virtualRows = $derived(wantedVirtual ?? !bare);
  const view = getAppView();
  const { multiSelect } = getOverlays();
  const nowId = $derived(currentSong(view.state.player)?.id ?? null);
  const songs = $derived(list.kind === 'songs' ? list.songs : []);
  const selecting = $derived(select !== null && multiSelect.mode);
  const entryLabel = $derived(select?.entryLabel ?? '多选');
  const mode = $derived(
    search ? (songs.length === 0 ? 'none' : 'found') : 'all',
  );
  // 加载中也先占好这一行，骨架换成歌时下面的行不往下跳
  const countRow = $derived(
    (list.kind === 'songs' || list.kind === 'loading') &&
      (search !== null || count !== undefined || select !== null),
  );

  const play = (song: Song): void => {
    view.app.play(source, song.id);
  };

  const activate = (song: Song): void => {
    if (selecting) multiSelect.toggle(song.id);
    else play(song);
  };

  // 入口按钮会被工具条换掉，退出多选时靠它重新找到
  let entry = $state<HTMLElement>();
  const entryFocus = (): HTMLElement | null =>
    entry?.querySelector<HTMLElement>('button') ?? null;
  const rowEntryFocus =
    (from: HTMLElement): (() => HTMLElement | null) =>
    () =>
      from.isConnected ? from : entryFocus();

  const selectionSource: SelectionSource = {
    get key() {
      return selectionKeyOf(source);
    },
    songs: () => select?.songs?.() ?? songs,
    visible: () => songs.map((song) => song.id),
    get actions() {
      return select?.actions ?? [];
    },
    present: () => list.kind === 'songs',
    focusFirst: () =>
      host
        ?.querySelector<HTMLElement>('[data-play-target]')
        ?.focus({ preventScroll: true }),
  };
  if (untrack(() => select)) {
    multiSelect.attach(selectionSource);
    $effect(() => () => multiSelect.detach(selectionSource));
  }

  const enterFromEntry = (event: MouseEvent): void => {
    void multiSelect.enter({
      from: event.currentTarget as HTMLElement,
      focusFirst: true,
      focusEntry: entryFocus,
    });
  };

  const modifiers = (song: Song, event: MouseEvent): void => {
    if (!multiSelect.mode) {
      const from = event.currentTarget as HTMLElement;
      multiSelect.enter({
        from,
        focusEntry: rowEntryFocus(from),
      });
    }
    if (event.shiftKey) multiSelect.range(song.id);
    else multiSelect.toggle(song.id);
  };

  const longpress = (song: Song, from: HTMLElement): void => {
    multiSelect.enter({
      id: song.id,
      from,
      focusEntry: rowEntryFocus(from),
    });
  };

  const nowLocate = hasNowLocate() ? getNowLocate() : null;
  const nowIndex = $derived(
    nowId === null ? -1 : songs.findIndex((song) => song.id === nowId),
  );

  $effect(() => {
    if (!nowLocate || !locate) return;
    return nowLocate.register({
      row: () =>
        nowIndex < 0 || !host || selecting || drag
          ? null
          : {
              top:
                host.getBoundingClientRect().top + nowIndex * SONG_ROW_HEIGHT,
              height: SONG_ROW_HEIGHT,
              first: nowIndex === 0,
            },
      focus: () => focusNowRow(host),
    });
  });
</script>

{#snippet found()}
  <!-- 普通的开头空格 Svelte 会去掉，分隔符前用 &nbsp; -->
  找到 {formatCount(songs.length)} 首{#if search?.incomplete}<span
      class="text-neutral-700 font-500">&nbsp;· 可能不全</span
    >{/if}
{/snippet}

{#snippet plainRow(song: Song, i: number)}
  <SongRow
    {song}
    {source}
    {phone}
    n={i + 1}
    now={song.id === nowId}
    {selecting}
    selected={selecting && multiSelect.has(song.id)}
    onselect={select
      ? (event: MouseEvent) => modifiers(song, event)
      : undefined}
    onlongpress={select
      ? (from: HTMLElement) => longpress(song, from)
      : undefined}
    grip={selecting ? grip : undefined}
    onplay={() => activate(song)}
  />
{/snippet}

{#snippet wrappedRow(song: Song, i: number)}
  {#if rowWrap}
    {@render rowWrap(song, i, plainRow)}
  {:else}
    {@render plainRow(song, i)}
  {/if}
{/snippet}

{#snippet listRow(song: Song, i: number)}
  {#if phone && numbered}
    <div class="h-14 flex items-center">
      <span
        class="w-9 flex-none pl-4 text-caption text-neutral-500 tabular-nums"
        aria-hidden="true">{i + 1}</span
      >
      <div class="h-full min-w-0 flex-1 -ml-2">
        {@render wrappedRow(song, i)}
      </div>
    </div>
  {:else}
    {@render wrappedRow(song, i)}
  {/if}
{/snippet}

{#snippet entryButton()}
  <button
    type="button"
    class="grid size-8 place-items-center rounded-full text-neutral-700 transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950)"
    aria-label={entryLabel}
    title={entryLabel}
    onclick={enterFromEntry}><ListChecks size={16} aria-hidden="true" /></button
  >
{/snippet}

{#snippet header()}
  {#if selecting}
    <div
      class="sticky z-10 rounded-t-xl bg-white px-2 pt-2 -mx-2 -mt-2"
      style:top={HEADER_TOP}
    >
      <SelectionToolbar />
    </div>
  {:else}
    <div class={[SONG_GRID, 'h-9 text-caption text-neutral-500']}>
      <div class="contents" aria-hidden={headerHidden ? 'true' : undefined}>
        <span class={SONG_COLUMNS.index}>#</span>
        <span
          class={[
            'grid grid-cols-[minmax(0,1fr)] pl-[52px]',
            SONG_COLUMNS.title,
          ]}
          role="status"
        >
          {#if search && list.kind === 'songs'}
            <span class="col-start-1 row-start-1 truncate" transition:fade
              >{@render found()}</span
            >
          {:else}
            <span class="col-start-1 row-start-1 truncate" transition:fade
              >标题</span
            >
          {/if}
        </span>
        <span class={SONG_COLUMNS.album}>专辑</span>
        <span class={SONG_COLUMNS.status}></span>
        <span class={SONG_COLUMNS.duration}>时长</span>
      </div>
      <span class="grid place-items-center">
        {#if select && songs.length > 0}
          <span class="contents" bind:this={entry}>{@render entryButton()}</span
          >
        {/if}
      </span>
    </div>
  {/if}
{/snippet}

{#snippet songList()}
  <div bind:this={host} class={['relative', contentClass]}>
    {#if virtualRows}
      <div role="group" aria-label={label}>
        <VirtualList
          items={songs}
          itemHeight={SONG_ROW_HEIGHT}
          getKey={(song: Song) => song.id}
          markOf={drag && !drag.marks ? undefined : songMark}
          placeOf={drag?.placeOf}
          keep={drag?.keep}
          animatePlace={drag?.animatePlace}
          hidden={drag?.hidden}
          row={listRow}
          {remeasure}
        />
      </div>
    {:else}
      <ul aria-label={label} data-reveal-group>
        {#each songs as song, i (song.id)}
          {#if staggerRows}
            <li
              class="h-14"
              in:stagger={{
                order: Math.max(0, i - appendedAt),
              }}
            >
              {@render listRow(song, i)}
            </li>
          {:else}
            <li class="h-14">{@render listRow(song, i)}</li>
          {/if}
        {/each}
      </ul>
    {/if}
  </div>
{/snippet}

{#snippet body()}
  {#if list.kind === 'failed'}
    <StateBlock
      kind="error"
      title={list.title}
      body={list.body}
      action={{ label: '重试', run: list.retry }}
    />
  {:else if list.kind === 'empty'}
    <StateBlock
      kind="empty"
      icon={list.icon ?? ListMusic}
      title={list.title}
      body={list.body}
      action={list.action}
    />
  {:else}
    <div class="grid grid-cols-[minmax(0,1fr)]">
      {#key mode}
        <div class="col-start-1 row-start-1 min-w-0" transition:fade>
          {#if songs.length === 0}
            {#if search}
              <StateBlock
                kind="empty"
                icon={SearchX}
                title={`没有“${search.term}”`}
                body={search.incomplete ? search.incompleteBody : undefined}
              />
            {:else}
              <StateBlock kind="empty" icon={ListMusic} title="这里还没有歌" />
            {/if}
          {:else}
            {@render songList()}
          {/if}
        </div>
      {/key}
    </div>
  {/if}
{/snippet}

{#if phone}
  {#if countRow}
    <div
      class={select
        ? 'min-h-12 flex items-center gap-2 px-4 pt-1'
        : 'flex items-center gap-2 px-4 pt-2'}
    >
      <p
        class="min-w-0 flex-1 px-1 text-caption text-neutral-600 tabular-nums"
        role="status"
      >
        {#if list.kind === 'loading'}
          <span
            class="bone inline-block h-3 w-10 rounded-full align-middle"
            aria-hidden="true"
          ></span>
        {:else if search}
          {@render found()}
        {:else if count !== null}
          {formatCount(count ?? songs.length)} 首
        {/if}
      </p>
      {#if select && !selecting && songs.length > 0}
        <span class="contents" bind:this={entry}>
          <IconButton
            icon={ListChecks}
            label={entryLabel}
            title={entryLabel}
            class="-mr-3"
            onclick={enterFromEntry}
          />
        </span>
      {/if}
    </div>
  {/if}
  {#if notice}
    <div class="pt-2">{@render notice()}</div>
  {/if}
  {#if list.kind === 'loading'}
    <!-- 上边距要和下面内容的 pt-2 同步 -->
    <SkeletonRows
      class={bare ? undefined : 'pt-2'}
      count={skeleton ?? 8}
      look={numbered ? 'numbered' : 'phone'}
      label={loadingLabel}
    />
  {:else if bare}
    {#if revealContent}<div in:reveal>
        {@render body()}
      </div>{:else}{@render body()}{/if}
  {:else}
    <div class="pt-2" in:reveal>{@render body()}</div>
  {/if}
{:else if bare}
  {#if select}{@render header()}{/if}
  {#if list.kind === 'loading'}
    <SkeletonRows count={skeleton ?? 9} label={loadingLabel} />
  {:else if revealContent}
    <div in:reveal>{@render body()}</div>
  {:else}
    {@render body()}
  {/if}
{:else}
  <div class="rounded-xl bg-white p-2 shadow-ambient">
    {@render header()}
    {#if notice}{@render notice()}{/if}
    {#if list.kind === 'loading'}
      <SkeletonRows count={skeleton ?? 9} label={loadingLabel} />
    {:else}
      <div in:reveal>{@render body()}</div>
    {/if}
  </div>
{/if}
