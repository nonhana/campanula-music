<script module lang="ts">
  export const SONG_GRID =
    'grid grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px] items-center gap-4 pl-2 pr-1';
  // 表头和行里同一列要用同一个对齐
  export const SONG_COLUMNS = {
    index: 'justify-self-center',
    title: '',
    album: '',
    status: 'justify-self-center',
    duration: 'justify-self-end',
    more: '',
  } as const;
</script>

<script lang="ts">
  import { Check } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  import type { Song } from '#lib/api/library.js';
  import type { PlaySource } from '#lib/api/playback.js';

  import { songMenuActions } from '../menu/song-menu.svelte';
  import { getAppView } from '../shared/app-context.svelte';
  import { formatDuration, langOf } from '../shared/text';
  import Cover from '../ui/Cover.svelte';
  import CreditLine from './CreditLine.svelte';
  import CreditName from './CreditName.svelte';
  import DownloadMark from './DownloadMark.svelte';
  import DragCountBadge from './DragCountBadge.svelte';
  import HeartButton from './HeartButton.svelte';
  import MorningWash from './MorningWash.svelte';
  import NowChip from './NowChip.svelte';
  import NowIndex from './NowIndex.svelte';
  import PlayTarget from './PlayTarget.svelte';
  import { songLook } from './song-look';
  import SongMoreButton from './SongMoreButton.svelte';
  import SongTitle from './SongTitle.svelte';

  const { openSongMenuAt } = songMenuActions();

  interface Props {
    song: Song;
    source: PlaySource;
    phone?: boolean;
    n?: number;
    now: boolean;
    onplay: () => void;
    selecting?: boolean;
    selected?: boolean;
    onselect?: (event: MouseEvent) => void;
    onlongpress?: (from: HTMLElement) => void;
    grip?: Snippet<[Song]>;
    ghost?: boolean;
    count?: number;
  }

  const {
    song,
    source,
    phone = false,
    n = 0,
    now,
    onplay,
    selecting = false,
    selected = false,
    onselect,
    onlongpress,
    grip,
    ghost = false,
    count = 1,
  }: Props = $props();
  const view = getAppView();
  const look = $derived(songLook(view, song));
  const off = $derived(look.off);
  const linked = $derived(!selecting && !ghost);
  let cover = $state<HTMLElement>();

  const LONG_PRESS = 400;
  const MOVE_SLOP = 10;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let origin: { x: number; y: number } | null = null;
  // 长按进入多选后，松手那一下的点按要吞掉；下一次 pointerdown 才复位，不按时间清
  let longPressed = false;

  $effect(() => () => {
    if (timer) clearTimeout(timer);
  });

  const cancelLongPress = (): void => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    origin = null;
  };

  const down = (event: PointerEvent): void => {
    if (
      ghost ||
      selecting ||
      event.pointerType === 'mouse' ||
      (event.target as Element).closest('[data-more], [data-grip]')
    )
      return;
    // 焦点要给这一行里的点歌按钮，不在模块里查全局 DOM
    const from =
      (event.target as Element).closest<HTMLElement>('[data-play-target]') ??
      (event.currentTarget as HTMLElement).querySelector<HTMLElement>(
        '[data-play-target]',
      ) ??
      (event.currentTarget as HTMLElement);
    origin = { x: event.clientX, y: event.clientY };
    longPressed = false;
    timer = setTimeout(() => {
      timer = undefined;
      longPressed = true;
      onlongpress?.(from);
    }, LONG_PRESS);
  };

  const move = (event: PointerEvent): void => {
    if (
      origin &&
      Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > MOVE_SLOP
    )
      cancelLongPress();
  };

  const activate = (): void => {
    if (longPressed) {
      longPressed = false;
      return;
    }
    onplay();
  };

  const rowclick = (event: MouseEvent): void => {
    if (selecting && !(event.target as Element).closest('button')) activate();
  };
</script>

<div
  class={[
    'row relative h-full rounded-lg',
    selected && 'bg-primary-100',
    ghost && 'bg-white shadow-float',
    !off && !selected && !phone && 'mouse:hover:bg-neutral-50',
    phone && 'row-touch',
  ]}
  role="presentation"
  data-song-id={song.id}
  oncontextmenu={(event) => openSongMenuAt(event, song, source)}
  onclick={rowclick}
  onpointerdown={phone ? down : undefined}
  onpointermove={phone ? move : undefined}
  onpointerup={phone ? cancelLongPress : undefined}
  onpointercancel={phone ? cancelLongPress : undefined}
  onpointerleave={phone ? cancelLongPress : undefined}
>
  {#if now && !ghost}
    {#if phone}<MorningWash
        start={selecting ? 106 : 70}
        surface="ground"
      />{:else}<MorningWash start={104} />{/if}
  {/if}
  {#if phone}
    <div
      class={[
        'relative grid h-full items-center gap-3.5 pl-4 pr-1',
        selecting
          ? grip
            ? 'grid-cols-[22px_48px_minmax(0,1fr)_44px]'
            : 'grid-cols-[22px_48px_minmax(0,1fr)]'
          : 'grid-cols-[48px_minmax(0,1fr)_44px]',
        off && !selected && 'opacity-45',
      ]}
    >
      {#if selecting}
        <span
          class={[
            'grid size-[22px] flex-none place-items-center rounded-md border-[1.5px]',
            selected
              ? 'border-primary-900 bg-primary-900 text-white'
              : 'border-neutral-500 bg-white',
          ]}
          aria-hidden="true"
        >
          {#if selected}<Check size={14} strokeWidth={3} />{/if}
        </span>
      {/if}
      <span class="relative size-12" bind:this={cover}>
        <Cover url={song.album.coverUrl} size={48} class="rounded-md" />
        {#if now && !ghost}<NowChip />{/if}
        <DragCountBadge {count} />
      </span>
      <PlayTarget
        class="min-w-0"
        disabled={off && !selecting}
        unplayable={off}
        {now}
        {cover}
        {selecting}
        {selected}
        onplay={activate}
        keyshortcuts={grip ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}
      >
        <SongTitle {song} {now} {look} size="body" mark tight />
      </PlayTarget>
      {#if grip}
        {@render grip(song)}
      {:else if !selecting}
        <SongMoreButton {song} {source} size="phone" />
      {/if}
    </div>
  {:else}
    <div
      class={['relative h-full', SONG_GRID, off && !selected && 'opacity-45']}
    >
      <span class={SONG_COLUMNS.index}>
        {#if selecting}
          <span
            class={[
              'grid size-[18px] place-items-center rounded-sm border-[1.5px]',
              selected
                ? 'border-primary-900 bg-primary-900 text-white'
                : 'border-neutral-500 bg-white',
            ]}
            aria-hidden="true"
          >
            {#if selected}<Check size={12} strokeWidth={3} />{/if}
          </span>
        {:else}
          <NowIndex {n} {now} />
        {/if}
      </span>
      <span class={['min-w-0 flex items-center gap-3', SONG_COLUMNS.title]}>
        <span class="relative flex-none" bind:this={cover}>
          <Cover url={song.album.coverUrl} size={40} class="rounded-md" />
          <DragCountBadge {count} />
        </span>
        <span class="min-w-0 flex-1">
          <PlayTarget
            class="block w-full"
            rounded
            disabled={off && !selecting && !onselect}
            unplayable={off}
            {now}
            {cover}
            onplay={activate}
            {selecting}
            {selected}
            {onselect}
            keyshortcuts={grip ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}
          >
            <SongTitle {song} {now} {look} creditsOutside />
          </PlayTarget>
          <CreditLine
            artists={song.artists}
            {linked}
            spoken={false}
            class="block truncate text-caption text-neutral-600"
          />
        </span>
      </span>
      <span
        class={['truncate text-caption text-neutral-600', SONG_COLUMNS.album]}
        lang={langOf(song.album.name ?? '')}
        ><CreditName kind="album" target={song.album} {linked} /></span
      >
      <span class={['flex items-center gap-2', SONG_COLUMNS.status]}>
        <HeartButton {song} size="row" />
        {#if look.mark}<DownloadMark mark={look.mark} variant="column" />{/if}
      </span>
      <!-- 没时长也要留这一格，各列才对齐 -->
      <span
        class={[
          'text-caption text-neutral-500 tabular-nums',
          SONG_COLUMNS.duration,
        ]}
        >{#if song.duration !== null}{formatDuration(song.duration)}{/if}</span
      >
      {#if grip}
        {@render grip(song)}
      {:else}
        <SongMoreButton {song} {source} size="desktop" />
      {/if}
    </div>
  {/if}
</div>

<style>
  .row-touch {
    -webkit-touch-callout: none;
    user-select: none;
    touch-action: pan-y;
  }
</style>
