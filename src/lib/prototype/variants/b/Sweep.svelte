<!--
  PROTOTYPE · 变体 B 的标志动作“逐字晨光”：每个词两层文字叠放，底层是未唱的浅灰，
  上层是已唱的深墨，按 wordProgress 从左往右露出（遮罩前沿带一点柔边，像晨光扫过）。
-->
<script lang='ts'>
  import type { LyricLine } from '$lib/prototype/lyrics'
  import { wordProgress } from '$lib/prototype/lyrics'

  interface Props {
    line: LyricLine
    t: number
    class?: string
  }

  const { line, t, class: klass = '' }: Props = $props()
</script>

<span class={['sweep', klass]}>
  {#each line.words as word, i (i)}
    {@const p = wordProgress(word, t)}
    <span class={['w', p >= 1 && 'done']} style:--p='{p * 100}%'>
      <span class='unsung'>{word.text}</span>
      {#if p > 0}
        <span class='sung' aria-hidden='true'>{word.text}</span>
      {/if}
    </span>
  {/each}
</span>

<style>
  .sweep {
    display: inline;
  }

  .w {
    position: relative;
    display: inline-block;
    white-space: pre;
  }

  .unsung {
    color: var(--unsung, #9ca3af);
  }

  .sung {
    position: absolute;
    inset: 0;
    color: var(--sung, #121c1a);
    -webkit-mask-image: linear-gradient(90deg, #000 calc(var(--p) - 0.35em), transparent var(--p));
    mask-image: linear-gradient(90deg, #000 calc(var(--p) - 0.35em), transparent var(--p));
  }

  .done .sung {
    -webkit-mask-image: none;
    mask-image: none;
  }
</style>
