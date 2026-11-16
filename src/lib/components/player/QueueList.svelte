<script lang="ts">
  import { ListX, X } from '@lucide/svelte';
  import { tick, untrack } from 'svelte';
  import type { ClassValue } from 'svelte/elements';

  import { songTitle } from '#lib/api/library.ts';
  import type { QueueEntry } from '#lib/app/player.ts';

  import { getOverlays } from '../overlay/overlay-context.ts';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import { desktopLayout } from '../shared/layout.ts';
  import { fade } from '../shared/motion.ts';
  import { createNowLocate, focusNowRow } from '../shared/now-locate.svelte.ts';
  import { setScrollLookup } from '../shared/scroll-marks.ts';
  import { formatCount, formatDuration } from '../shared/text.ts';
  import CreditLine from '../songs/CreditLine.svelte';
  import LocateNowButton from '../songs/LocateNowButton.svelte';
  import MorningWash from '../songs/MorningWash.svelte';
  import NowIndex from '../songs/NowIndex.svelte';
  import PlayTarget from '../songs/PlayTarget.svelte';
  import { measureRows } from '../songs/row-height.ts';
  import { songLook } from '../songs/song-look.ts';
  import SongTitle from '../songs/SongTitle.svelte';
  import { SONG_ROW_HEIGHT, songMark } from '../songs/view.ts';
  import Cover from '../ui/Cover.svelte';
  import Scrollbar from '../ui/Scrollbar.svelte';
  import TextButton from '../ui/TextButton.svelte';
  import VirtualList from '../ui/VirtualList.svelte';

  interface Props {
    ground?: boolean;
    shown?: boolean;
    titled?: boolean;
    class?: ClassValue;
  }

  const {
    ground = false,
    shown = true,
    titled = false,
    class: klass,
  }: Props = $props();
  const { playerLayer } = getOverlays();

  let rowHeight = $state(SONG_ROW_HEIGHT);
  const measureText = measureRows(
    () => SONG_ROW_HEIGHT,
    (height) => (rowHeight = height),
  );
  const uid = $props.id();
  const view = getAppView();
  const lookup = setScrollLookup({ markAt: null });
  const queue = $derived(view.state.player.queue);
  const current = $derived(view.state.player.current);

  let scroller = $state<HTMLElement>();

  $effect(() => {
    if (!scroller || !shown) return;
    const el = scroller;
    const top = untrack(() =>
      Math.max(0, (current ?? 0) * rowHeight - rowHeight),
    );
    void tick().then(() => {
      el.scrollTop = top;
    });
  });

  const locate = createNowLocate({
    scroller: () => scroller ?? null,
    band: () => {
      const rect = scroller!.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    },
  });
  $effect(() =>
    locate.register({
      row: () =>
        current === null || !scroller
          ? null
          : {
              top:
                scroller.getBoundingClientRect().top -
                scroller.scrollTop +
                current * rowHeight,
              height: rowHeight,
              first: current === 0,
            },
      focus: () => focusNowRow(scroller),
    }),
  );

  let section = $state<HTMLElement>();

  const remove = async (index: number) => {
    view.app.removeFromQueue(index);
    await tick();
    const next = Math.min(index, view.state.player.queue.length - 1);
    const target =
      scroller?.querySelector<HTMLElement>(
        `[data-remove="${next}"]:not([inert])`,
      ) ?? section?.querySelector<HTMLElement>('[data-clear]');
    target?.focus();
  };
</script>

<section
  bind:this={section}
  class={['flex min-h-0 flex-col', klass]}
  aria-labelledby="{uid}-title"
>
  <header class="flex flex-none items-center gap-3 px-5 pb-2 pt-4">
    <div class="min-w-0 flex-1">
      <h2
        id="{uid}-title"
        class={[
          'text-title-sm text-neutral-900 font-600',
          !titled && 'md:sr-only',
        ]}
      >
        播放队列
      </h2>
      <p class="truncate text-caption text-neutral-600 tabular-nums">
        {formatCount(queue.length)} 首
      </p>
    </div>
    <TextButton
      tone="neutral"
      desktop={{ variant: 'outline', icon: ListX }}
      class="max-md:-mr-3 md:h-9! md:pl-3.5! md:pr-4!"
      data-clear
      onclick={playerLayer.clearQueue}>清空</TextButton
    >
  </header>

  <div class="relative mb-2 min-h-0 flex flex-1 flex-col">
    <div
      bind:this={scroller}
      class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      <div class="px-2">
        <VirtualList
          items={queue}
          itemHeight={rowHeight}
          scrollParent={scroller}
          getKey={(entry: QueueEntry) => entry.song.id}
          markOf={(entry: QueueEntry, i: number) => songMark(entry.song, i)}
        >
          {#snippet row(entry: QueueEntry, i: number)}
            {@const now = i === current}
            {@const look = songLook(view, entry.song)}
            {@const off = look.off}
            <div
              class={[
                'relative h-full rounded-lg',
                !off &&
                  (ground
                    ? 'mouse:hover:bg-white/60'
                    : 'mouse:hover:bg-neutral-50'),
              ]}
            >
              {#if now}<MorningWash
                  start={92}
                  surface={ground ? 'tint' : 'paper'}
                />{/if}
              <div
                class={[
                  'relative grid grid-cols-[28px_40px_minmax(0,1fr)_auto_36px] h-full items-center gap-3 pl-2 pr-1',
                  off && 'opacity-45',
                ]}
              >
                <NowIndex n={i + 1} {now} onGround={ground} />
                <Cover
                  url={entry.song.album.coverUrl}
                  size={40}
                  class="rounded-md"
                />
                <span class="min-w-0" {@attach measureText}>
                  <PlayTarget
                    class="block w-full"
                    rounded
                    disabled={off}
                    {now}
                    onplay={() => view.app.playFromQueue(i)}
                  >
                    <SongTitle song={entry.song} {now} {look} creditsOutside />
                  </PlayTarget>
                  <CreditLine
                    artists={entry.song.artists}
                    linked={desktopLayout.current}
                    spoken={false}
                    class="block truncate text-caption text-neutral-600"
                  />
                </span>
                <span
                  class={[
                    'text-caption tabular-nums',
                    ground || now ? 'text-neutral-600' : 'text-neutral-500',
                  ]}
                  >{#if entry.song.duration !== null}{formatDuration(
                      entry.song.duration,
                    )}{/if}</span
                >
                <span class="grid size-9">
                  {#if !now}
                    <button
                      type="button"
                      class={[
                        'relative z-1 grid size-9 place-items-center rounded-lg transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950)',
                        ground ? 'text-neutral-600' : 'text-neutral-500',
                      ]}
                      aria-label="从播放队列移出：{songTitle(entry.song)}"
                      data-remove={i}
                      onclick={() => remove(i)}
                      transition:fade
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  {/if}
                </span>
              </div>
            </div>
          {/snippet}
        </VirtualList>
      </div>
    </div>
    <Scrollbar {lookup} target={scroller} />
    <LocateNowButton {locate} class="absolute bottom-4 right-6 z-1" />
  </div>
</section>
