<script lang="ts">
  import { fade } from '../shared/motion';
  import { DURATIONS } from '../shared/motion-tokens';
  import NowBars from './NowBars.svelte';
</script>

<span
  class="pointer-events-none absolute inset-0 grid place-items-center"
  aria-hidden="true"
  in:fade
  out:fade={{ duration: DURATIONS['state-out'] }}
>
  <span
    class="grid size-7 place-items-center rounded-full bg-white/92 shadow-chip"
    ><NowBars /></span
  >
</span>
