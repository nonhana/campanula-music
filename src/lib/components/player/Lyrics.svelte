<script lang="ts">
  import { Check, Music, Play } from '@lucide/svelte';
  import type { ClassValue } from 'svelte/elements';

  import type { Song } from '#lib/api/library.js';
  import type { LyricLine } from '#lib/api/playback.js';

  import { getAppView } from '../shared/app-context.svelte';
  import { failureText } from '../shared/failure';
  import { fade, scrollBehavior } from '../shared/motion';
  import { DELAYS, DURATIONS } from '../shared/motion-tokens';
  import { formatDuration, langOf } from '../shared/text';
  import FilterChip from '../ui/FilterChip.svelte';
  import StateBlock from '../ui/StateBlock.svelte';
  import { playerPageChoices as choices } from './player-page.svelte';
  import type { Playhead } from './playhead.svelte';
  import { lineIndexAt, wordProgress } from './view';

  interface Props {
    song: Song;
    playhead: Playhead;
    compact?: boolean;
    class?: ClassValue;
  }

  const { song, playhead, compact = false, class: klass }: Props = $props();

  const FOLLOW_PAUSE_MS = 3000;
  const ANCHOR = 0.38;
  const LAYOUT_TRANSITIONS = new Set(['font-size', 'line-height', 'max-width']);

  const view = getAppView();
  const shown = $derived(
    view.state.lyrics?.songId === song.id ? view.state.lyrics : null,
  );
  const lyrics = $derived(
    shown?.status === 'shown' &&
      (shown.lyrics.kind === 'word' || shown.lyrics.kind === 'line')
      ? shown.lyrics
      : null,
  );
  const lines = $derived(lyrics?.lines ?? null);
  const translated = $derived(lyrics?.translated ?? false);
  const romanized = $derived(lyrics?.romanized ?? false);
  const showTranslation = $derived(choices.translation && translated);
  const showRomanization = $derived(choices.romanization && romanized);
  const active = $derived(lines ? lineIndexAt(lines, playhead.now) : -1);

  const toggles = $derived([
    {
      label: '翻译',
      has: translated,
      on: showTranslation,
      reason: '这首歌没有翻译',
      set: (on: boolean) => (choices.translation = on),
    },
    {
      label: '音译',
      has: romanized,
      on: showRomanization,
      reason: '这首歌没有音译',
      set: (on: boolean) => (choices.romanization = on),
    },
  ]);

  $effect(() => {
    void view.app.openLyrics(song.id);
  });

  let scroller = $state<HTMLElement>();
  let height = $state(0);
  let rolling = $state(false);
  let rollTimer: ReturnType<typeof setTimeout> | undefined;
  let pointing = $state(false);
  let keyed = $state(false);
  let aimed = $state(-1);
  let scrolledAt = Number.NEGATIVE_INFINITY;
  let resume: ReturnType<typeof setTimeout> | undefined;
  let placedLines: readonly LyricLine[] | null = null;

  const aimY = $derived(height * ANCHOR + (compact ? 8 + 14 : 12 + 18));
  const engaged = $derived(compact ? keyed : rolling || pointing || keyed);
  const target = $derived(lines?.[aimed] ?? null);

  const selecting = () => {
    const selection = document.getSelection();
    return (
      !!scroller &&
      !!selection &&
      !selection.isCollapsed &&
      selection.containsNode(scroller, true)
    );
  };

  const restingTop = (container: HTMLElement, row: HTMLElement) => {
    const moving = container
      .getAnimations({ subtree: true })
      .filter(
        (animation) =>
          animation instanceof CSSTransition &&
          LAYOUT_TRANSITIONS.has(animation.transitionProperty),
      );
    const times = moving.map((animation) => animation.currentTime);
    for (const animation of moving) {
      const end = animation.effect?.getComputedTiming().endTime;
      if (end !== undefined) animation.currentTime = end;
    }
    const top = row.offsetTop;
    moving.forEach(
      (animation, index) => (animation.currentTime = times[index]),
    );
    return top;
  };

  const follow = (smooth: boolean) => {
    if (
      !scroller ||
      pointing ||
      keyed ||
      performance.now() - scrolledAt < FOLLOW_PAUSE_MS ||
      selecting()
    )
      return;
    const line =
      active < 0
        ? null
        : scroller.querySelector<HTMLElement>(`[data-line="${active}"]`);
    const top = line
      ? restingTop(scroller, line) - scroller.clientHeight * ANCHOR
      : 0;
    scroller.scrollTo({
      top,
      behavior: smooth ? scrollBehavior() : 'auto',
    });
  };

  const aim = () => {
    if (!scroller) return;
    const y = scroller.scrollTop + aimY;
    aimed = Math.max(
      0,
      [...scroller.querySelectorAll<HTMLElement>('[data-line]')].findLastIndex(
        (row) => row.offsetTop <= y,
      ),
    );
  };

  $effect(() => {
    void lines;
    clearTimeout(rollTimer);
    rolling = false;
    pointing = false;
    keyed = false;
  });

  $effect(() => {
    void active;
    void showTranslation;
    void showRomanization;
    void height;
    if (!lines) return;
    follow(placedLines === lines);
    placedLines = lines;
    aim();
  });

  $effect(() => () => clearTimeout(resume));

  const roll = () => {
    rolling = true;
    clearTimeout(rollTimer);
    rollTimer = setTimeout(() => (rolling = false), DELAYS.scrollbar);
  };

  const scrolledByListener = () => {
    scrolledAt = performance.now();
    clearTimeout(resume);
    resume = setTimeout(follow, FOLLOW_PAUSE_MS, true);
    roll();
  };

  const SCROLL_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'PageUp',
    'PageDown',
    'Home',
    'End',
    ' ',
  ]);

  const watchListenerScroll = (target: HTMLElement) => {
    const onkey = (event: KeyboardEvent) =>
      SCROLL_KEYS.has(event.key) && scrolledByListener();
    const onfocus = (event: FocusEvent) =>
      event.target instanceof HTMLElement &&
      event.target.matches(':focus-visible') &&
      scrolledByListener();
    const onmove = () => rolling && roll();
    target.addEventListener('wheel', scrolledByListener, { passive: true });
    target.addEventListener('touchmove', scrolledByListener, { passive: true });
    target.addEventListener('keydown', onkey);
    target.addEventListener('focusin', onfocus);
    target.addEventListener('pointermove', onmove, { passive: true });
    target.addEventListener('scroll', aim, { passive: true });
    return () => {
      target.removeEventListener('wheel', scrolledByListener);
      target.removeEventListener('touchmove', scrolledByListener);
      target.removeEventListener('keydown', onkey);
      target.removeEventListener('focusin', onfocus);
      target.removeEventListener('pointermove', onmove);
      target.removeEventListener('scroll', aim);
      clearTimeout(rollTimer);
    };
  };

  const tapLines = (target: HTMLElement) => {
    let tap = false;
    const ondown = (event: PointerEvent) => {
      tap = (event.pointerType === 'touch' || compact) && !selecting();
    };
    const onclick = (event: MouseEvent) => {
      const row =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-line]')
          : null;
      const line = row && lines?.[Number(row.dataset.line)];
      if (tap && line && !selecting()) playFrom(line);
      tap = false;
    };
    target.addEventListener('pointerdown', ondown);
    target.addEventListener('click', onclick);
    return () => {
      target.removeEventListener('pointerdown', ondown);
      target.removeEventListener('click', onclick);
    };
  };

  const playFrom = (line: LyricLine) => {
    view.app.playFrom(line.start);
    if (selecting()) document.getSelection()?.removeAllRanges();
    scrolledAt = Number.NEGATIVE_INFINITY;
    clearTimeout(resume);
  };

  const jump = () => {
    if (!target) return;
    playFrom(target);
    clearTimeout(rollTimer);
    rolling = false;
    pointing = false;
  };
</script>

<div
  class={[
    'grid min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]',
    klass,
  ]}
>
  {#if lines}
    <div class="col-start-1 row-start-1 min-h-0 flex flex-col" transition:fade>
      <div
        class={[
          'flex flex-none flex-wrap items-center gap-2',
          compact ? 'pb-1' : 'pb-2',
        ]}
      >
        {#each toggles as toggle (toggle.label)}
          <FilterChip
            selected={toggle.on}
            disabled={!toggle.has}
            class="gap-1.5"
            onclick={() => toggle.set(!toggle.on)}
          >
            {#if toggle.on}<span
                class="grid"
                transition:fade={{ duration: DURATIONS.feedback }}
                ><Check size={16} strokeWidth={2.4} aria-hidden="true" /></span
              >{/if}
            {toggle.has ? toggle.label : `无${toggle.label}`}
            {#if !toggle.has}<span class="sr-only">：{toggle.reason}</span>{/if}
          </FilterChip>
        {/each}
      </div>

      <div
        class={[
          'frame relative min-h-0 flex flex-1 flex-col -ml-2',
          compact ? '-mr-2' : 'bleed',
        ]}
      >
        <div
          {@attach watchListenerScroll}
          {@attach tapLines}
          bind:this={scroller}
          bind:clientHeight={height}
          class="scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
          role="group"
          aria-label="歌词"
        >
          <div class="anchor">
            {#each lines as line, i (i)}
              {@const current = i === active}
              <div
                data-line={i}
                class={[
                  'line pl-2',
                  compact && 'group',
                  compact ? 'py-2 pr-2' : 'py-3',
                ]}
                aria-current={current ? 'true' : undefined}
              >
                <span
                  class={[
                    'line-text block font-600',
                    current
                      ? [
                          compact ? 'text-title' : 'text-headline',
                          line.words ? 'text-neutral-600' : 'text-primary-950',
                        ]
                      : [
                          compact
                            ? 'text-title-sm mouse:group-hover:text-neutral-800'
                            : 'text-title',
                          engaged && i === aimed
                            ? 'text-neutral-800'
                            : 'text-neutral-600',
                        ],
                  ]}
                  lang={langOf(line.text)}
                >
                  {#if line.words}
                    {#each line.words as word, k (k)}
                      {@const sung = current
                        ? wordProgress(word, playhead.now)
                        : 0}
                      <span class="word"
                        >{word.text}{#if sung > 0}<span
                            class="fill pointer-events-none select-none text-primary-950"
                            aria-hidden="true"
                            style:clip-path="inset(-0.25em {100 - sung * 100}%
                            -0.25em 0)">{word.text}</span
                          >{/if}</span
                      >
                    {/each}
                  {:else}
                    {line.text}
                  {/if}
                </span>
                {#if showRomanization && line.romanization}
                  <span
                    class={[
                      'sub mt-1 block',
                      compact ? 'text-caption' : 'text-label',
                      current ? 'text-neutral-800' : 'text-neutral-600',
                    ]}
                    in:fade>{line.romanization}</span
                  >
                {/if}
                {#if showTranslation && line.translation}
                  <span
                    class={[
                      'sub mt-1 block',
                      compact ? 'text-label' : 'text-body',
                      current ? 'text-neutral-800' : 'text-neutral-600',
                    ]}
                    in:fade>{line.translation}</span
                  >
                {/if}
              </div>
            {/each}
          </div>
        </div>
        {#if target}
          {@const at = formatDuration(target.start * 1000)}
          <button
            type="button"
            class={[
              'absolute h-9 inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 text-caption text-neutral-700 font-500 tabular-nums select-none -translate-y-1/2',
              'transition-[background-color,border-color,color,opacity] duration-feedback',
              'mouse:hover:(border-primary-300 bg-primary-200 text-primary-950) focus-visible:(border-primary-300 bg-primary-200 text-primary-950 opacity-100)',
              compact ? 'right-2' : 'jump',
              !engaged && 'opacity-0 pointer-events-none',
            ]}
            style:top="{aimY}px"
            aria-label="从 {at} 开始播放：{target.text}"
            onclick={jump}
            onpointerenter={() => (pointing = true)}
            onpointerleave={() => (pointing = false)}
            onfocus={(event) =>
              (keyed = event.currentTarget.matches(':focus-visible'))}
            onblur={() => (keyed = false)}
          >
            <Play size={16} fill="currentColor" aria-hidden="true" />
            {at}
          </button>
        {/if}
      </div>
    </div>
  {:else if shown?.status === 'shown'}
    <div
      class="col-start-1 row-start-1 flex flex-col items-center justify-center gap-3 text-center"
      transition:fade
    >
      {#if shown.lyrics.kind === 'pureMusic'}
        <span
          class="grid size-12 place-items-center rounded-full bg-white/60 text-primary-950"
        >
          <Music size={22} aria-hidden="true" />
        </span>
        <p class="text-body text-neutral-700">纯音乐</p>
      {:else}
        <p class="text-body text-neutral-700">暂无歌词</p>
      {/if}
    </div>
  {:else if shown?.status === 'failed'}
    <div
      class="col-start-1 row-start-1 flex flex-col justify-center"
      transition:fade
    >
      <StateBlock
        kind="error"
        title="歌词没加载出来"
        body={failureText(shown.failure)}
        action={{
          label: '重试',
          run: () => void view.app.openLyrics(song.id),
        }}
      />
    </div>
  {:else}
    <div
      class="col-start-1 row-start-1 min-h-0 flex flex-col"
      role="status"
      aria-busy="true"
      aria-label="正在加载歌词"
      transition:fade
    >
      <div
        class={['flex flex-none items-center gap-2', compact ? 'pb-1' : 'pb-2']}
      >
        <span class="bone h-9 w-18 rounded-full"></span>
        <span class="bone h-9 w-18 rounded-full"></span>
      </div>
      <div class="scroll min-h-0 flex-1 overflow-hidden">
        <div class="anchor">
          {#each [62, 78, 54, 70, 46] as width, i (i)}
            <div class={compact ? 'py-2' : 'py-3'}>
              <div class={['flex items-center', compact ? 'h-6' : 'h-7']}>
                <span
                  class={['bone rounded-full', compact ? 'h-4' : 'h-5']}
                  style:width="{width}%"
                ></span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .scroll {
    container-type: size;
    mask-image: linear-gradient(
      180deg,
      transparent 0,
      #000 12%,
      #000 82%,
      transparent 100%
    );
  }

  .scroll:focus-visible {
    outline: none;
  }

  .frame:has(> .scroll:focus-visible) {
    outline: 2px solid theme('colors.primary.800');
    outline-offset: -2px;
  }

  .bleed {
    --jump-width: 80px;
    --jump-inset: 16px;

    margin-right: calc(-1 * var(--gutter));
  }

  .bleed .line {
    padding-right: calc(var(--jump-inset) + var(--jump-width) + 8px);
  }

  .jump {
    right: var(--jump-inset);
    width: var(--jump-width);
  }

  .bleed .line-text,
  .bleed .sub {
    max-width: calc(100% * 20 / 28);
    overflow-x: clip;
  }

  .bleed .line[aria-current] .line-text {
    max-width: 100%;
  }

  /* 和脚本里的 ANCHOR 一致 */
  .anchor {
    padding-block: 38cqh 62cqh;
  }

  .line-text {
    transition:
      font-size var(--move-lyric-line) var(--ease-out-soft),
      line-height var(--move-lyric-line) var(--ease-out-soft),
      max-width var(--move-lyric-line) var(--ease-out-soft),
      color var(--duration-lyric-line) var(--ease-out-soft);
  }

  .word {
    position: relative;
  }

  .line[aria-current] .word,
  .bleed .word {
    display: inline-block;
    white-space: pre;
  }

  .fill {
    position: absolute;
    inset: 0;
  }
</style>
