<script lang="ts">
  import { fade, grow } from '../shared/motion';
  import { DURATIONS } from '../shared/motion-tokens';
  import NowBars from './NowBars.svelte';

  const {
    n,
    now,
    onGround = false,
  }: { n: number; now: boolean; onGround?: boolean } = $props();
</script>

<span
  class={[
    'grid place-items-center text-caption tabular-nums',
    onGround ? 'text-neutral-600' : 'text-neutral-500',
  ]}
>
  {#if now}
    <span class="grid col-start-1 row-start-1 origin-bottom" in:grow out:grow
      ><NowBars /></span
    >
  {:else}
    <span
      class="col-start-1 row-start-1"
      in:fade
      out:fade={{ duration: DURATIONS['state-out'] }}>{n}</span
    >
  {/if}
</span>
