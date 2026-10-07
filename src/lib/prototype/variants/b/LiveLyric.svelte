<!--
  PROTOTYPE · 播放条里的一行实时歌词（逐字扫光的缩小版）。没有歌词时显示 fallback（专辑名或歌手）。
-->
<script lang='ts'>
  import { lineIndexAt } from '$lib/prototype/lyrics'
  import { player } from '$lib/prototype/player.svelte'
  import { clock } from './clock.svelte'
  import Sweep from './Sweep.svelte'

  interface Props {
    fallback: string
    fallbackLang?: string
    class?: string
  }

  const { fallback, fallbackLang, class: klass = '' }: Props = $props()

  const lines = $derived(player.lyrics)
  const index = $derived(lines ? Math.max(0, lineIndexAt(lines, clock.t)) : -1)
  const line = $derived(lines && index >= 0 ? lines[index] : null)
</script>

<span class={['live', klass]}>
  {#if line}
    {#key index}
      <span class='in' lang='ja'><Sweep {line} t={clock.t} /></span>
    {/key}
  {:else}
    <span class='plain' lang={fallbackLang}>{fallback}</span>
  {/if}
</span>

<style>
  .live {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent);
    mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent);
  }

  .in {
    display: inline-block;
    animation: rise 420ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .plain {
    color: #4b5563;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
</style>
