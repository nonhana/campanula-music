<!--
  播放页的歌词（DESIGN.md Lyrics，ADR-0016）：挂上时取（桌面右栏一直挂着，手机换到歌词才挂），换歌跟着换。逐字歌词每个词两层同样的字，上层按唱到的比例
  从左往右露出，唱到一半的字只亮一半；逐行歌词整行高亮。当前行更大更深、停在约 38% 的高度；听众自己滚动后 3 秒内不跟着走，选着歌词里的字时一直不跟。
  字能拖选、复制。右边一个“▶ 3:10”胶囊，固定在当前行停的那条线上、不跟着行跳，写停在这条线上的那一句从几分几秒开始，点它从那一句开始放。
  桌面只在听众自己滚过歌词以后（停手 1 秒内，鼠标在歌词上移动、指着胶囊都续上）出现，那一句同时变深；自动跟着当前行滚、只是悬停都不出现。
  键盘聚焦时出现；手机布局只在键盘聚焦时出现。
  触屏在哪种布局都是轻点一行跳过去，手机布局用鼠标点也是。桌面两层宽度：其他行在窄宽里换行，当前行（28/36）用长宽，长宽正好是窄宽的 28/20 倍，
  所以当前行和它做普通行时断在同一个字上，只是行高变了；胶囊放在长宽右边，不压字。滚动区向右借出页面留白（--gutter，DesktopPlayerPage 给）。
  不显示滚动条（DESIGN.md Scrollbar）：滚轮、触控板、键盘滚。
  翻译、音译各一个开关，没有时禁用并写明；纯音乐、没有歌词时说明；加载中是骨架，没取到说明原因、能重试。字色不浅于石墨
  （封面染底上石墨淡不到 4.5:1，The Light-Only Fog Rule）。减少动态效果时滚到当前行不平滑、字号直接变、颜色 150ms 渐变、逐字跟着报的进度跳；
  compact 是手机播放页换掉封面那块时的字号。四种状态之间交叉淡化（新旧叠在同一格），打开翻译、音译时那几行淡入。
-->
<script lang='ts'>
  import { Check, Music, Play } from '@lucide/svelte'
  import type { ClassValue } from 'svelte/elements'

  import type { Song } from '#lib/api/library.js'
  import type { LyricLine } from '#lib/api/playback.js'

  import { getAppView } from '../shared/app-context.svelte'
  import { failureText } from '../shared/failure'
  import { fade, scrollBehavior } from '../shared/motion'
  import { DELAYS, DURATIONS } from '../shared/motion-tokens'
  import { formatDuration, langOf } from '../shared/text'
  import FilterChip from '../ui/FilterChip.svelte'
  import StateBlock from '../ui/StateBlock.svelte'
  import { playerPageChoices as choices } from './player-page.svelte'
  import type { Playhead } from './playhead.svelte'
  import { lineIndexAt, wordProgress } from './view'

  interface Props {
    song: Song
    playhead: Playhead
    compact?: boolean
    class?: ClassValue
  }

  const { song, playhead, compact = false, class: klass }: Props = $props()

  /** 这么久不跟着当前行走 */
  const FOLLOW_PAUSE_MS = 3000
  /** 滚动区高度的这个位置 */
  const ANCHOR = 0.38
  /** 换行时会过渡、会挪动下面各行的属性 */
  const LAYOUT_TRANSITIONS = new Set(['font-size', 'line-height', 'max-width'])

  const view = getAppView()
  const shown = $derived(view.state.lyrics?.songId === song.id
    ? view.state.lyrics
    : null)
  const lyrics = $derived(shown?.status === 'shown' && (shown.lyrics.kind === 'word' || shown.lyrics.kind === 'line')
    ? shown.lyrics
    : null)
  const lines = $derived(lyrics?.lines ?? null)
  const translated = $derived(lyrics?.translated ?? false)
  const romanized = $derived(lyrics?.romanized ?? false)
  const showTranslation = $derived(choices.translation && translated)
  const showRomanization = $derived(choices.romanization && romanized)
  const active = $derived(lines
    ? lineIndexAt(lines, playhead.now)
    : -1)

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
  ])

  $effect(() => {
    void view.app.openLyrics(song.id)
  })

  let scroller = $state<HTMLElement>()
  let height = $state(0)
  /** 听众自己滚过歌词（停手 1 秒内；这期间鼠标在歌词上移动也续上） */
  let rolling = $state(false)
  let rollTimer: ReturnType<typeof setTimeout> | undefined
  /** 鼠标指着胶囊：胶囊不收，歌词也先不跟着当前行走（不然要点的那一句被拉走） */
  let pointing = $state(false)
  /** 键盘聚焦在胶囊上 */
  let keyed = $state(false)
  /** 停在胶囊那条线上的是第几行 */
  let aimed = $state(-1)
  let scrolledAt = Number.NEGATIVE_INFINITY
  let resume: ReturnType<typeof setTimeout> | undefined
  /** 换了一份（换歌）时第一次直接跳过去，不平滑滚动 */
  let placedLines: readonly LyricLine[] | null = null

  /** 胶囊固定在滚动区的这个高度：38% 那条线往下，到停在那里的一行第一行字的中间（行的上内边距 + 半个行高，和下面的 py-3 / py-2、字号一致） */
  const aimY = $derived(height * ANCHOR + (compact
    ? 8 + 14
    : 12 + 18))
  /** 桌面：听众自己滚过、指着胶囊、键盘聚焦在胶囊上时，胶囊出来、那条线上的一行变深；手机布局只在键盘聚焦时出来 */
  const engaged = $derived(compact
    ? keyed
    : rolling || pointing || keyed)
  const target = $derived(lines?.[aimed] ?? null)

  /** 听众在歌词里选着字（拖选、长按选中） */
  const selecting = () => {
    const selection = document.getSelection()
    return !!scroller && !!selection && !selection.isCollapsed && selection.containsNode(scroller, true)
  }

  /**
   * 这一行停稳以后的 offsetTop。换行时上一句正从大字缩回去，当下量会多出它还没缩掉的那几像素（一行 8px），
   * 过渡走完再量又是另一个数：跟着当前行停的位置就不止一个，之后再跟一次（停手 3 秒、开关翻译）会“回落”一下。
   * 把正在过渡的字号、行高、宽度拨到终点量完再拨回去（同一帧里，看不到），同一行不论什么时候量都停在同一个位置
   */
  const restingTop = (container: HTMLElement, row: HTMLElement) => {
    const moving = container.getAnimations({ subtree: true })
      .filter(animation => animation instanceof CSSTransition && LAYOUT_TRANSITIONS.has(animation.transitionProperty))
    const times = moving.map(animation => animation.currentTime)
    for (const animation of moving) {
      const end = animation.effect?.getComputedTiming().endTime
      if (end !== undefined)
        animation.currentTime = end
    }
    const top = row.offsetTop
    moving.forEach((animation, index) => (animation.currentTime = times[index]))
    return top
  }

  const follow = (smooth: boolean) => {
    // 选着字时不滚走（复制到一半不被拉开），也不定时恢复；取消选中后下一次换行再跟。鼠标指着、键盘聚焦在胶囊上时也不滚走（要点的那一句不被换掉）
    if (!scroller || pointing || keyed || performance.now() - scrolledAt < FOLLOW_PAUSE_MS || selecting())
      return
    const line = active < 0
      ? null
      : scroller.querySelector<HTMLElement>(`[data-line="${active}"]`)
    const top = line
      ? restingTop(scroller, line) - scroller.clientHeight * ANCHOR
      : 0
    scroller.scrollTo({
      top,
      behavior: smooth
        ? scrollBehavior()
        : 'auto',
    })
  }

  /** 找停在胶囊那条线上的行：行一个挨一个、没有空隙，上沿在这条线上或线上方的最后一行就是 */
  const aim = () => {
    if (!scroller)
      return
    const y = scroller.scrollTop + aimY
    aimed = Math.max(0, [
      ...scroller.querySelectorAll<HTMLElement>('[data-line]'),
    ].findLastIndex(row => row.offsetTop <= y))
  }

  // 换了一份歌词（换歌）：胶囊收起，上一首留下的滚过、指着、聚焦都作废。歌词区卸下时胶囊收不到 pointerleave、blur，只能在这里清
  $effect(() => {
    void lines
    clearTimeout(rollTimer)
    rolling = false
    pointing = false
    keyed = false
  })

  // 换了当前行、开关翻译音译（行高变了）、滚动区高度变了：把当前行放回 38%
  $effect(() => {
    void active
    void showTranslation
    void showRomanization
    void height
    if (!lines)
      return
    follow(placedLines === lines)
    placedLines = lines
    aim()
  })

  $effect(() => () => clearTimeout(resume))

  const roll = () => {
    rolling = true
    clearTimeout(rollTimer)
    rollTimer = setTimeout(() => (rolling = false), DELAYS.scrollbar)
  }

  /** 滚轮、触摸、键盘、Tab 到歌词区：先不跟着走，停手 3 秒后回到当前行；胶囊这时才能露出来 */
  const scrolledByListener = () => {
    scrolledAt = performance.now()
    clearTimeout(resume)
    resume = setTimeout(follow, FOLLOW_PAUSE_MS, true)
    roll()
  }

  /** 键盘滚动也算 */
  const SCROLL_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'PageUp',
    'PageDown',
    'Home',
    'End',
    ' ',
  ])

  // 只是看有没有自己滚动，不是操作，直接挂在滚动区上
  const watchListenerScroll = (target: HTMLElement) => {
    const onkey = (event: KeyboardEvent) => SCROLL_KEYS.has(event.key) && scrolledByListener()
    const onfocus = (event: FocusEvent) => event.target instanceof HTMLElement && event.target.matches(':focus-visible') && scrolledByListener()
    // 滚过以后鼠标还在歌词上、往胶囊那边挪：续上，不在半路收起；没滚过时移动鼠标不算
    const onmove = () => rolling && roll()
    target.addEventListener('wheel', scrolledByListener, { passive: true })
    target.addEventListener('touchmove', scrolledByListener, { passive: true })
    target.addEventListener('keydown', onkey)
    target.addEventListener('focusin', onfocus)
    target.addEventListener('pointermove', onmove, { passive: true })
    target.addEventListener('scroll', aim, { passive: true })
    return () => {
      target.removeEventListener('wheel', scrolledByListener)
      target.removeEventListener('touchmove', scrolledByListener)
      target.removeEventListener('keydown', onkey)
      target.removeEventListener('focusin', onfocus)
      target.removeEventListener('pointermove', onmove)
      target.removeEventListener('scroll', aim)
      clearTimeout(rollTimer)
    }
  }

  /** 轻点一行从这行开始放：触屏在哪种布局都算，手机布局没有胶囊、鼠标点也算。拖选完松手、按下时还选着字（这一下是取消选中）都不算 */
  const tapLines = (target: HTMLElement) => {
    let tap = false
    const ondown = (event: PointerEvent) => {
      tap = (event.pointerType === 'touch' || compact) && !selecting()
    }
    const onclick = (event: MouseEvent) => {
      const row = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-line]')
        : null
      const line = row && lines?.[Number(row.dataset.line)]
      if (tap && line && !selecting())
        playFrom(line)
      tap = false
    }
    target.addEventListener('pointerdown', ondown)
    target.addEventListener('click', onclick)
    return () => {
      target.removeEventListener('pointerdown', ondown)
      target.removeEventListener('click', onclick)
    }
  }

  /** 从这一行开始放（停着的也接着放），歌词马上跟回当前行：选着的字一起取消，不然它拦着不跟；之前滚动留下的“3 秒后回来”也作废 */
  const playFrom = (line: LyricLine) => {
    view.app.playFrom(line.start)
    if (selecting())
      document.getSelection()?.removeAllRanges()
    scrolledAt = Number.NEGATIVE_INFINITY
    clearTimeout(resume)
  }

  /** 点胶囊：从停在那条线上的一句开始放。找到了，胶囊收起来，歌词跟回当前行（就是这一句） */
  const jump = () => {
    if (!target)
      return
    playFrom(target)
    clearTimeout(rollTimer)
    rolling = false
    pointing = false
  }
</script>

<div class={['grid min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]', klass]}>
  {#if lines}
    <div class='col-start-1 row-start-1 min-h-0 flex flex-col' transition:fade>
      <div class={[
        'flex flex-none flex-wrap items-center gap-2',
        compact ? 'pb-1' : 'pb-2',
      ]}>
        {#each toggles as toggle (toggle.label)}
          <FilterChip
            selected={toggle.on}
            disabled={!toggle.has}
            class='gap-1.5'
            onclick={() => toggle.set(!toggle.on)}
          >
            {#if toggle.on}<span class='grid' transition:fade={{ duration: DURATIONS.feedback }}><Check size={16} strokeWidth={2.4} aria-hidden='true' /></span>{/if}
            {toggle.has
              ? toggle.label
              : `无${toggle.label}`}
            {#if !toggle.has}<span class='sr-only'>：{toggle.reason}</span>{/if}
          </FilterChip>
        {/each}
      </div>

      <!-- 滚动区左边伸出 8px，字和上面的开关对齐。桌面右边借出页面留白（--gutter）；胶囊在滚动区外面，固定在当前行停的那条线上，
           不跟着上下渐隐一起淡。手机右边也只伸出 8px。键盘聚焦在滚动区上时焦点环画在这一层的边内（滚动区带渐隐，右边又贴着裁切边） -->
      <div class={[
        'frame relative min-h-0 flex flex-1 flex-col -ml-2',
        compact ? '-mr-2' : 'bleed',
      ]}>
        <div
          {@attach watchListenerScroll}
          {@attach tapLines}
          bind:this={scroller}
          bind:clientHeight={height}
          class='scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain'
          role='group'
          aria-label='歌词'
        >
          <div class='anchor'>
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
                        compact ? 'text-title-sm mouse:group-hover:text-neutral-800' : 'text-title',
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
                      <span class='word'>{word.text}{#if sung > 0}<span class='fill pointer-events-none select-none text-primary-950' aria-hidden='true' style:clip-path='inset(-0.25em {100 - sung * 100}% -0.25em 0)'>{word.text}</span>{/if}</span>
                    {/each}
                  {:else}
                    {line.text}
                  {/if}
                </span>
                {#if showRomanization && line.romanization}
                  <span class={[
                    'sub mt-1 block',
                    compact ? 'text-caption' : 'text-label',
                    current ? 'text-neutral-800' : 'text-neutral-600',
                  ]} in:fade>{line.romanization}</span>
                {/if}
                {#if showTranslation && line.translation}
                  <span class={[
                    'sub mt-1 block',
                    compact ? 'text-label' : 'text-body',
                    current ? 'text-neutral-800' : 'text-neutral-600',
                  ]} in:fade>{line.translation}</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
        {#if target}
          {@const at = formatDuration(target.start * 1000)}
          <!-- 一个胶囊，固定在当前行停的那条线上（不跟着行跳）：里面写停在这条线上的那一句从几分几秒开始 -->
          <button
            type='button'
            class={[
              'absolute h-9 inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 text-caption text-neutral-700 font-500 tabular-nums select-none -translate-y-1/2',
              'transition-[background-color,border-color,color,opacity] duration-feedback',
              'mouse:hover:(border-primary-300 bg-primary-200 text-primary-950) focus-visible:(border-primary-300 bg-primary-200 text-primary-950 opacity-100)',
              compact ? 'right-2' : 'jump',
              !engaged && 'opacity-0 pointer-events-none',
            ]}
            style:top='{aimY}px'
            aria-label='从 {at} 开始播放：{target.text}'
            onclick={jump}
            onpointerenter={() => (pointing = true)}
            onpointerleave={() => (pointing = false)}
            onfocus={event => (keyed = event.currentTarget.matches(':focus-visible'))}
            onblur={() => (keyed = false)}
          >
            <Play size={16} fill='currentColor' aria-hidden='true' />
            {at}
          </button>
        {/if}
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
      <StateBlock kind='error' title='歌词没加载出来' body={failureText(shown.failure)} action={{
        label: '重试',
        run: () => void view.app.openLyrics(song.id),
      }} />
    </div>
  {:else}
    <div class={[
      'col-start-1 row-start-1 flex flex-col justify-center',
      compact ? 'gap-5' : 'gap-7',
    ]} role='status' aria-busy='true' aria-label='正在加载歌词' transition:fade>
      {#each [62, 78, 54, 70, 46] as width, i (i)}
        <span class={[
          'bone rounded-full',
          compact ? 'h-4' : 'h-5',
        ]} style:width='{width}%'></span>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* 滚动区自己当尺寸容器：上下留白按高度算，第一行、最后一行也能停在 38% */
  .scroll {
    container-type: size;
    mask-image: linear-gradient(180deg, transparent 0, #000 12%, #000 82%, transparent 100%);
  }

  .scroll:focus-visible {
    outline: none;
  }

  .frame:has(> .scroll:focus-visible) {
    outline: 2px solid theme('colors.primary.800');
    outline-offset: -2px;
  }

  /* 桌面：滚动区向右借出页面留白；行的右边让出胶囊那一块（胶囊 80px 放得下“▶ 12:34”，离边 16px，和字隔 8px），剩下的是长宽 */
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

  /* 两层宽度：当前行用长宽，其他行和翻译、音译只用它的 20/28（窄宽）。字号 title 20 → headline 28 正好放大 28/20 倍，
     所以当前行放大后正好放得下、断在同一个字上，不多换一行，只是行高变了。宽度和字号一起过渡，放大途中也不临时多换、少换一行 */
  .bleed .line-text,
  .bleed .sub {
    max-width: calc(100% * 20 / 28);
    /* 一个词比这一行还宽（外语长单词）时在自己的边上裁掉：不从胶囊底下穿过去，也不产生横向滚动 */
    overflow-x: clip;
  }

  .bleed .line[aria-current] .line-text {
    max-width: 100%;
  }

  /* 和脚本里的 ANCHOR 一致 */
  .anchor {
    padding-block: 38cqh 62cqh;
  }

  /* 换到下一行：字号、宽度是移动（减少动态效果时直接变），颜色是淡入淡出（最多 150ms） */
  .line-text {
    transition:
      font-size var(--move-lyric-line) var(--ease-out-soft),
      line-height var(--move-lyric-line) var(--ease-out-soft),
      max-width var(--move-lyric-line) var(--ease-out-soft),
      color var(--duration-lyric-line) var(--ease-out-soft);
  }

  /* 逐字的行一直拆成词：换到下一行时还是那几个字的节点，选着的字不丢。当前行的词各自成块，好盖上点亮的那层；
     桌面所有行的词都成块，当前行和其他行能断开的地方一样 */
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
