<script lang="ts">
  import { afterNavigate } from '$app/navigation';

  import { atOnce, fade } from '../shared/motion';
  import { langOf } from '../shared/text';
  import { backBar, backTitle } from './back-title.svelte';

  afterNavigate(() => atOnce(backTitle.measure));
</script>

<svelte:window onscroll={backTitle.measure} onresize={backTitle.measure} />

<span class="min-w-0 flex-1" {@attach backBar}>
  {#key backTitle.heading}
    {#if backTitle.shown}
      <span
        class="block truncate text-title-sm text-neutral-900 font-500"
        lang={langOf(backTitle.text)}
        aria-hidden="true"
        transition:fade>{backTitle.text}</span
      >
    {/if}
  {/key}
</span>
