<!--
  播放页的歌词（DESIGN.md Lyrics）。挂上时去取（App.openLyrics：桌面右栏里一直挂着，手机上换成歌词时才挂上），换歌时跟着换。
  逐字歌词：当前行里每个词两层同样的字叠在一起，上层按唱到的比例从左往右露出，唱到一半的字只亮一半；逐行歌词整行高亮。
  当前行更大、更深，停在高度约 38% 的位置；听众自己滚动后 3 秒内不跟着走。点一行就从这一行开始放。
  翻译、音译各一个开关，这首歌没有时开关禁用，写明“无翻译”“无音译”。纯音乐、没有歌词时说明；加载中是骨架，没取到时说明原因、能重试。
  字色不浅于石墨（封面染底上石墨淡不到 4.5:1，The Light-Only Fog Rule）。
  减少动态效果时：滚到当前行不平滑滚动，字号直接变，颜色 150ms 内渐变，逐字点亮跟着报的进度跳。compact：手机播放页里换掉封面那块时的字号。
  加载中、歌词、纯音乐、没取到之间交叉淡化（新旧叠在同一格里）；打开翻译、音译时那几行淡入（DESIGN.md Motion）
-->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import type { Song } from '#lib/api/library.js'
  import type { LyricLine } from '#lib/api/playback.js'
  import type { Playhead } from './playhead.svelte'
  import { Check, Music } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { failureText } from '../failure'
  import { langOf } from '../library/view'
  import { fade, scrollBehavior } from '../motion'
  import { DURATIONS } from '../motion-tokens'
  import FilterChip from '../ui/FilterChip.svelte'
  import StateBlock from '../ui/StateBlock.svelte'
  import { playerPageChoices as choices } from './player-page.svelte'
  import { lineIndexAt, wordProgress } from './view'

  interface Props {
    song: Song
    playhead: Playhead
    compact?: boolean
    class?: ClassValue
  }

  const { song, playhead, compact = false, class: klass }: Props = $props()

  /** 听众自己滚动后，这么久不跟着当前行走 */
  const FOLLOW_PAUSE_MS = 3000
  /** 当前行停在滚动区高度的这个位置 */
  const ANCHOR = 0.38

  const view = getAppView()
  const shown = $derived(view.state.lyrics?.songId === song.id ? view.state.lyrics : null)
  const lyrics = $derived(shown?.status === 'shown' && (shown.lyrics.kind === 'word' || shown.lyrics.kind === 'line') ? shown.lyrics : null)
  const lines = $derived(lyrics?.lines ?? null)
  const translated = $derived(lyrics?.translated ?? false)
  const romanized = $derived(lyrics?.romanized ?? false)
  const showTranslation = $derived(choices.translation && translated)
  const showRomanization = $derived(choices.romanization && romanized)
  const active = $derived(lines ? lineIndexAt(lines, playhead.now) : -1)

  const toggles = $derived([
    { label: '翻译', has: translated, on: showTranslation, reason: '这首歌没有翻译', set: (on: boolean) => (choices.translation = on) },
    { label: '音译', has: romanized, on: showRomanization, reason: '这首歌没有音译', set: (on: boolean) => (choices.romanization = on) },
  ])

  $effect(() => {
    void view.app.openLyrics(song.id)
  })

  let scroller = $state<HTMLElement>()
  let height = $state(0)
  /** 听众最近一次自己滚动歌词的时刻 */
  let scrolledAt = Number.NEGATIVE_INFINITY
  let resume: ReturnType<typeof setTimeout> | undefined
  /** 已经滚到过当前行的那份歌词：换了一份（换歌）时第一次直接跳过去，不平滑滚动 */
  let placedLines: readonly LyricLine[] | null = null

  function follow(smooth: boolean) {
    if (!scroller || performance.now() - scrolledAt < FOLLOW_PAUSE_MS)
      return
    const line = active < 0 ? null : scroller.querySelector<HTMLElement>(`[data-line="${active}"]`)
    const top = line ? line.offsetTop - scroller.clientHeight * ANCHOR : 0
    scroller.scrollTo({ top, behavior: smooth ? scrollBehavior() : 'auto' })
  }

  // 换了当前行、开关了翻译音译（行高变了）、滚动区高度变了：把当前行放回 38%
  $effect(() => {
    void active
    void showTranslation
    void showRomanization
    void height
    if (!lines)
      return
    follow(placedLines === lines)
    placedLines = lines
  })

  $effect(() => () => clearTimeout(resume))

  /** 听众自己滚动（滚轮、触摸、键盘、Tab 到某一行）：先不跟着走，停手 3 秒后回到当前行 */
  function scrolledByListener() {
    scrolledAt = performance.now()
    clearTimeout(resume)
    resume = setTimeout(follow, FOLLOW_PAUSE_MS, true)
  }

  /** 键盘滚动、Tab 到某一行也算听众自己在看 */
  const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

  // 只是看听众有没有自己滚动，不是操作，所以直接挂在滚动区上
  $effect(() => {
    if (!scroller)
      return
    const onkey = (event: KeyboardEvent) => SCROLL_KEYS.has(event.key) && scrolledByListener()
    const onfocus = (event: FocusEvent) => event.target instanceof HTMLElement && event.target.matches(':focus-visible') && scrolledByListener()
    const target = scroller
    target.addEventListener('wheel', scrolledByListener, { passive: true })
    target.addEventListener('touchmove', scrolledByListener, { passive: true })
    target.addEventListener('keydown', onkey)
    target.addEventListener('focusin', onfocus)
    return () => {
      target.removeEventListener('wheel', scrolledByListener)
      target.removeEventListener('touchmove', scrolledByListener)
      target.removeEventListener('keydown', onkey)
      target.removeEventListener('focusin', onfocus)
    }
  })

  /** 点一行：从这一行开始放（停着的也接着放），歌词马上跟回当前行 */
  function playFrom(line: LyricLine) {
    view.app.playFrom(line.start)
    scrolledAt = Number.NEGATIVE_INFINITY
  }
</script>

<div class={['grid min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]', klass]}>
  {#if lines}
    <div class='col-start-1 row-start-1 min-h-0 flex flex-col' transition:fade>
      <div class={['flex flex-none flex-wrap items-center gap-2', compact ? 'pb-1' : 'pb-2']}>
        {#each toggles as toggle (toggle.label)}
          <FilterChip
            selected={toggle.on}
            disabled={!toggle.has}
            class='gap-1.5'
            title={toggle.has ? undefined : toggle.reason}
            onclick={() => toggle.set(!toggle.on)}
          >
            {#if toggle.on}<span class='grid' transition:fade={{ duration: DURATIONS.feedback }}><Check size={16} strokeWidth={2.4} aria-hidden='true' /></span>{/if}
            {toggle.has ? toggle.label : `无${toggle.label}`}
            {#if !toggle.has}<span class='sr-only'>：{toggle.reason}</span>{/if}
          </FilterChip>
        {/each}
        <span class='ml-1 text-caption text-neutral-600'>{lyrics?.kind === 'word' ? '逐字歌词' : '逐行歌词'}</span>
      </div>

      <!-- 滚动区往两边各伸出 8px，行的焦点环有地方画，字和上面的开关对齐 -->
      <div
        bind:this={scroller}
        bind:clientHeight={height}
        class='scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain -mx-2'
        role='group'
        aria-label='歌词'
      >
        <div class='anchor'>
          {#each lines as line, i (i)}
            {@const current = i === active}
            <button
              type='button'
              data-line={i}
              class={['line group block w-full rounded-xl px-2 text-left', compact ? 'py-2' : 'py-3']}
              aria-current={current ? 'true' : undefined}
              onclick={() => playFrom(line)}
            >
              <span
                class={[
                  'line-text block font-600',
                  current
                    ? [compact ? 'text-title' : 'text-headline', line.words ? 'text-neutral-600' : 'text-primary-950']
                    : [compact ? 'text-title-sm' : 'text-title', 'text-neutral-600 mouse:group-hover:text-neutral-800'],
                ]}
                lang={langOf(line.text)}
              >
                {#if current && line.words}
                  {#each line.words as word, k (k)}
                    {@const sung = wordProgress(word, playhead.now)}
                    <span class='word'>{word.text}{#if sung > 0}<span class='fill text-primary-950' aria-hidden='true' style:clip-path='inset(-0.25em {100 - sung * 100}% -0.25em 0)'>{word.text}</span>{/if}</span>
                  {/each}
                {:else}
                  {line.text}
                {/if}
              </span>
              {#if showRomanization && line.romanization}
                <span class={['mt-1 block', compact ? 'text-caption' : 'text-label', current ? 'text-neutral-800' : 'text-neutral-600']} in:fade>{line.romanization}</span>
              {/if}
              {#if showTranslation && line.translation}
                <span class={['mt-1 block', compact ? 'text-label' : 'text-body', current ? 'text-neutral-800' : 'text-neutral-600']} in:fade>{line.translation}</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {:else if shown?.status === 'shown'}
    <div class='col-start-1 row-start-1 flex flex-col items-center justify-center gap-3 text-center' transition:fade>
      {#if shown.lyrics.kind === 'pureMusic'}
        <span class='grid size-12 place-items-center rounded-full bg-white/60 text-primary-950'>
          <Music size={22} aria-hidden='true' />
        </span>
        <p class='text-body text-neutral-700'>纯音乐，请欣赏</p>
      {:else}
        <p class='text-body text-neutral-700'>暂无歌词</p>
      {/if}
    </div>
  {:else if shown?.status === 'failed'}
    <div class='col-start-1 row-start-1 flex flex-col justify-center' transition:fade>
      <StateBlock kind='error' title='歌词没加载出来' body={failureText(shown.failure)} action={{ label: '重试', run: () => void view.app.openLyrics(song.id) }} />
    </div>
  {:else}
    <div class={['col-start-1 row-start-1 flex flex-col justify-center', compact ? 'gap-5' : 'gap-7']} role='status' aria-busy='true' aria-label='正在加载歌词' transition:fade>
      {#each [62, 78, 54, 70, 46] as width, i (i)}
        <span class={['bone rounded-full', compact ? 'h-4' : 'h-5']} style:width='{width}%'></span>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* 滚动区自己当尺寸容器：上下留白按它的高度算，第一行、最后一行也能停在 38% */
  .scroll {
    container-type: size;
    mask-image: linear-gradient(180deg, transparent 0, #000 12%, #000 82%, transparent 100%);
  }

  /* 和脚本里的 ANCHOR 一致 */
  .anchor {
    padding-block: 38cqh 62cqh;
  }

  /* 换到下一行：当前行变大变深（字号是移动，减少动态效果时直接变；颜色是淡入淡出，最多 150ms） */
  .line-text {
    transition:
      font-size var(--move-lyric-line) var(--ease-out-soft),
      line-height var(--move-lyric-line) var(--ease-out-soft),
      color var(--duration-lyric-line) var(--ease-out-soft);
  }

  .word {
    position: relative;
    display: inline-block;
    white-space: pre;
  }

  .fill {
    position: absolute;
    inset: 0;
  }

  .line:focus-visible {
    outline-offset: -2px;
  }
</style>
