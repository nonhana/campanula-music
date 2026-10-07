<!--
  PROTOTYPE：播放页歌词。逐字歌词（yrc）当前行里已唱的部分用薄荷色从左往右露出（两层文字叠放 + clip-path，唱到一半的字被切开）；
  逐行歌词（lrc）只整行高亮。当前行保持在离顶部约 38% 的位置；点一行跳到那一行。
  翻译、音译各一个开关，这首歌没有对应内容时开关禁用并写明原因；没有歌词时按 lyric 类型给出“纯音乐，请欣赏”或“暂无歌词”。
-->
<script lang='ts'>
  import { lineIndexAt, wordProgress } from '$lib/prototype/lyrics'
  import { player } from '$lib/prototype/player.svelte'
  import { Check, Music } from '@lucide/svelte'

  interface Props {
    /** 手机播放页里替换封面区域时的紧凑尺寸 */
    compact?: boolean
    class?: string
  }

  const { compact = false, class: klass = '' }: Props = $props()

  let wantTranslation = $state(true)
  let wantRomaji = $state(false)
  let scroller = $state<HTMLElement>()

  const lines = $derived(player.lyrics)
  const word = $derived(player.lyricKind === 'yrc')
  const t = $derived(player.position)
  const active = $derived(lines ? lineIndexAt(lines, t) : -1)
  const showTranslation = $derived(wantTranslation && player.hasTranslation)
  const showRomaji = $derived(wantRomaji && player.hasRomaji)

  const chips = $derived([
    { label: '翻译', has: player.hasTranslation, on: showTranslation, none: '这首歌没有翻译', set: (v: boolean) => (wantTranslation = v) },
    { label: '音译', has: player.hasRomaji, on: showRomaji, none: '这首歌没有音译', set: (v: boolean) => (wantRomaji = v) },
  ])

  $effect(() => {
    const i = active
    void showTranslation
    void showRomaji
    if (!scroller || i < 0)
      return
    const el = scroller.querySelector<HTMLElement>(`[data-line="${i}"]`)
    if (!el)
      return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const top = el.offsetTop - scroller.clientHeight * 0.38 + 16
    scroller.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
  })
</script>

<div class={['flex min-h-0 flex-col', klass]}>
  {#if lines}
    <div class={['flex flex-none items-center gap-2', compact ? 'pb-1' : 'pb-2']}>
      {#each chips as chip (chip.label)}
        <button
          class={[
            'chip inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-500 transition-colors duration-150',
            chip.on ? 'bg-primary-100 text-primary-950' : 'border border-neutral-300/80 bg-white/70 text-neutral-700',
          ]}
          aria-pressed={chip.on}
          disabled={!chip.has}
          title={chip.has ? undefined : chip.none}
          onclick={() => chip.set(!chip.on)}
        >
          {#if chip.on}<Check size={14} strokeWidth={2.4} aria-hidden='true' />{/if}
          {chip.has ? chip.label : `无${chip.label}`}
          {#if !chip.has}<span class='sr-only'>：{chip.none}</span>{/if}
        </button>
      {/each}
      <span class='ml-1 text-[12px] text-neutral-600'>{word ? '逐字歌词' : '逐行歌词'}</span>
    </div>
    <div
      bind:this={scroller}
      class='lyric-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain'
    >
      <div class='pb-[60%] pt-[38%]'>
        {#each lines as line, i (line.start)}
          {@const now = i === active}
          <button
            data-line={i}
            class={['line block w-full rounded-xl text-left', compact ? 'py-2' : 'py-3', now && 'is-now']}
            aria-current={now ? 'true' : undefined}
            onclick={() => player.seek(line.start + 0.01)}
          >
            <span
              class={[
                'block leading-[1.4] transition-[font-size,color] duration-300',
                now
                  ? (compact ? 'text-[21px] font-600' : 'text-[28px] font-600')
                  : (compact ? 'text-[17px] font-500 text-neutral-600' : 'text-[21px] font-500 text-neutral-600'),
                now && !word && 'text-primary-950',
              ]}
              lang={player.current?.lang}
            >
              {#if now && word}
                {#each line.words as w, k (k)}
                  {@const p = wordProgress(w, t)}
                  <span class='word'>
                    <span class='text-neutral-500'>{w.text}</span>
                    {#if p > 0}
                      <span class='fill text-primary-900' aria-hidden='true' style:clip-path='inset(-0.2em {100 - p * 100}% -0.2em 0)'>{w.text}</span>
                    {/if}
                  </span>
                {/each}
              {:else}
                {line.text}
              {/if}
            </span>
            {#if showRomaji && line.romaji}
              <span class={['mt-1 block leading-snug', compact ? 'text-[13px]' : 'text-[15px]', now ? 'text-neutral-700' : 'text-neutral-600']}>{line.romaji}</span>
            {/if}
            {#if showTranslation && line.translation}
              <span class={['mt-1 block leading-snug', compact ? 'text-[14px]' : 'text-[16px]', now ? 'text-neutral-800' : 'text-neutral-600']}>{line.translation}</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <div class='flex flex-1 flex-col items-center justify-center gap-3 text-neutral-600'>
      {#if player.current?.lyric === 'instrumental'}
        <span class='grid size-12 place-items-center rounded-full bg-white/60 text-primary-900'>
          <Music size={22} aria-hidden='true' />
        </span>
        <p class='text-[16px]'>纯音乐，请欣赏</p>
      {:else}
        <p class='text-[16px]'>暂无歌词</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .lyric-scroll {
    mask-image: linear-gradient(180deg, transparent 0, #000 14%, #000 80%, transparent 100%);
    scrollbar-width: none;
  }

  .word {
    position: relative;
    display: inline-block;
    white-space: pre;
  }

  .word .fill {
    position: absolute;
    inset: 0;
    transition: clip-path 250ms linear;
  }

  .chip:disabled {
    cursor: not-allowed;
    border-style: dashed;
    background: transparent;
  }

  @media (prefers-reduced-motion: reduce) {
    .word .fill {
      transition: none;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .line:not(.is-now):hover > span:first-child {
      color: #1f2937;
    }

    .chip:not(:disabled):hover {
      border-color: #80dbb9;
    }
  }
</style>
