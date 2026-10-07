<!-- PROTOTYPE（变体 C）：逐字歌词。当前行铺一条极浅的薄荷底，唱过的字由灰变成薄荷深色；点任意一行跳到那里。 -->
<script lang='ts'>
  import { lineIndexAt, wordProgress } from '$lib/prototype/lyrics'
  import { player } from '$lib/prototype/player.svelte'

  interface Props {
    showTranslation: boolean
    showRomaji: boolean
    phone?: boolean
  }

  const { showTranslation, showRomaji, phone = false }: Props = $props()

  let box = $state<HTMLElement>()
  const lines = $derived(player.lyrics)
  const activeIdx = $derived(lines ? lineIndexAt(lines, player.position) : -1)

  $effect(() => {
    const i = activeIdx
    if (!box)
      return
    const el = box.querySelector<HTMLElement>(`[data-line="${Math.max(0, i)}"]`)
    if (!el)
      return
    const target = el.offsetTop - box.clientHeight * 0.38 + el.offsetHeight / 2
    box.scrollTo({ top: Math.max(0, target), behavior: document.querySelector('[data-still]') ? 'instant' : 'smooth' })
  })
</script>

{#if lines}
  <div bind:this={box} class='lyrics' class:phone>
    <div class='pad' aria-hidden='true'></div>
    {#each lines as line, i (line.start)}
      <button type='button' class='line' class:now={i === activeIdx} data-line={i} lang='ja' onclick={() => player.seek(line.start)}>
        <span class='text'>
          {#if i === activeIdx}
            {#each line.words as w, j (j)}<span class='w' data-t={w.text} style:--w='{wordProgress(w, player.position) * 100}%'>{w.text}</span>{/each}
          {:else}
            {line.text}
          {/if}
        </span>
        {#if showTranslation}<span class='sub' lang='zh-CN'>{line.translation}</span>{/if}
        {#if showRomaji}<span class='sub roma' lang='en'>{line.romaji}</span>{/if}
      </button>
    {/each}
    <div class='pad' aria-hidden='true'></div>
  </div>
{:else}
  <div class='grid h-full place-items-center px-6 text-center'>
    <p class='text-[15px] text-neutral-500'>{player.current?.lyric === 'instrumental' ? '纯音乐，请欣赏' : '暂无歌词'}</p>
  </div>
{/if}

<style>
  .lyrics {
    position: relative;
    height: 100%;
    overflow-y: auto;
    padding: 0 12px;
    scrollbar-width: none;
    mask-image: linear-gradient(to bottom, transparent 0, #000 56px, #000 calc(100% - 56px), transparent 100%);
  }

  .pad {
    height: 30%;
  }

  .line {
    display: block;
    width: 100%;
    padding: 10px 16px;
    border-radius: 12px;
    text-align: left;
    transition: background-color 240ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .line.now {
    background: #f5fcf9;
  }

  .text {
    display: block;
    font-size: 20px;
    font-weight: 500;
    line-height: 30px;
    color: #6b7280;
  }

  .phone .text {
    font-size: 18px;
    line-height: 28px;
  }

  /* 逐字高亮：两层同样的字叠在一起，上层深绿按进度裁切（不用渐变文字） */
  .w {
    position: relative;
    color: #6b7280;
  }

  .w::after {
    content: attr(data-t);
    position: absolute;
    inset: 0;
    color: #206f52;
    clip-path: inset(0 calc(100% - var(--w)) 0 0);
    white-space: pre;
  }

  .sub {
    display: block;
    margin-top: 2px;
    font-size: 14px;
    line-height: 20px;
    color: #6b7280;
  }

  .now .sub {
    color: #374151;
  }

  .roma {
    font-size: 13px;
  }

  @media (hover: hover) and (pointer: fine) {
    .line:not(.now):hover {
      background: #f9fafb;
    }
  }
</style>
