<!--
  PROTOTYPE · 歌词舞台：左对齐的歌词行，当前行放大加深并逐字扫光，其余行降到四成；
  整列平滑滚动，让当前行停在舞台高度约 38% 的位置。桌面点某一行跳到那一句；手机整块是一个按钮。
-->
<script lang='ts'>
  import { lineIndexAt } from '$lib/prototype/lyrics'
  import { player } from '$lib/prototype/player.svelte'
  import { clock } from './clock.svelte'
  import Sweep from './Sweep.svelte'
  import { ui } from './ui.svelte'

  interface Props {
    /** phone：手机全屏歌词的字号 */
    size?: 'stage' | 'phone'
    /** 当前行的位置（舞台高度的比例） */
    anchor?: number
  }

  const { size = 'stage', anchor = 0.38 }: Props = $props()

  let height = $state(0)
  let shift = $state(0)
  const lineEls: HTMLElement[] = $state([])

  const lines = $derived(player.lyrics)
  const current = $derived(lines ? Math.max(0, lineIndexAt(lines, clock.t)) : 0)
  const song = $derived(player.current)

  $effect(() => {
    const el = lineEls[current]
    // 依赖：舞台高度、翻译/音译开关都会改变行的位置
    void height
    void ui.showTranslation
    void ui.showRomaji
    if (el)
      shift = Math.round(height * anchor - el.offsetTop)
  })
</script>

<div class={['stage', size]} bind:clientHeight={height}>
  {#if lines}
    <ol class='track' style:transform='translateY({shift}px)' lang='ja'>
      {#each lines as line, i (line.start)}
        <li class={['line', i === current && 'cur', i < current && 'past']} bind:this={lineEls[i]}>
          {#if size === 'stage'}
            <button type='button' class='seek' aria-label='从这一句开始播放：{line.text}' onclick={() => player.seek(line.start)}></button>
          {/if}
          <span class='orig'>
            {#if i === current}
              <Sweep {line} t={clock.t} />
            {:else}
              {line.text}
            {/if}
          </span>
          {#if ui.showRomaji}
            <span class='romaji' lang='ja-Latn'>{line.romaji}</span>
          {/if}
          {#if ui.showTranslation}
            <span class='trans' lang='zh-CN'>{line.translation}</span>
          {/if}
        </li>
      {/each}
    </ol>
  {:else}
    <div class='empty' style:padding-top='{Math.round(height * anchor)}px'>
      <p class='empty-title'>{song?.lyric === 'instrumental' ? '纯音乐，请欣赏' : '暂无歌词'}</p>
      {#if song}
        <p class='empty-sub' lang={song.lang}>{song.title}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .stage {
    position: relative;
    height: 100%;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 16%, #000 78%, transparent 100%);
    mask-image: linear-gradient(to bottom, transparent 0, #000 16%, #000 78%, transparent 100%);
  }

  .track {
    margin: 0;
    padding: 0;
    list-style: none;
    position: relative;
    transition: transform 760ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .line {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 26px;
    opacity: 0.4;
    color: #111827;
    transition: opacity 360ms;
  }

  .orig {
    font-size: 22px;
    line-height: 1.45;
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  .cur {
    opacity: 1;
    --unsung: #9ca3af;
  }

  .cur .orig {
    font-size: 32px;
    line-height: 1.4;
    font-weight: 600;
    animation: rise 620ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .trans {
    font-size: 15px;
    line-height: 1.5;
    color: #4b5563;
  }

  .romaji {
    font-size: 13px;
    line-height: 1.45;
    color: #6b7280;
    letter-spacing: 0.01em;
  }

  .seek {
    position: absolute;
    inset: -6px -12px;
    border-radius: 12px;
  }

  .seek:focus-visible {
    outline-offset: 0;
  }

  .orig,
  .trans,
  .romaji {
    position: relative;
    pointer-events: none;
  }

  /* 手机全屏歌词 */
  .phone .line {
    gap: 4px;
    margin-bottom: 20px;
  }

  .phone .orig {
    font-size: 18px;
  }

  .phone .cur .orig {
    font-size: 24px;
  }

  .phone .trans {
    font-size: 14px;
  }

  .phone .romaji {
    font-size: 12px;
  }

  .empty-title {
    margin: 0;
    font-size: 26px;
    line-height: 1.4;
    font-weight: 600;
    color: #1f2937;
  }

  .phone .empty-title {
    font-size: 20px;
  }

  .empty-sub {
    margin: 8px 0 0;
    font-size: 15px;
    color: #4b5563;
  }

  @media (hover: hover) and (pointer: fine) {
    .line:not(.cur):hover {
      opacity: 0.7;
    }

    .seek:hover {
      background: rgb(255 255 255 / 0.45);
    }
  }

  @keyframes rise {
    from {
      transform: translateY(8px);
      opacity: 0.6;
    }
  }
</style>
