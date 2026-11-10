<script lang="ts">
  import { Heart } from '@lucide/svelte';

  import type { Song } from '#lib/api/library.js';
  import { songTitle } from '#lib/api/library.js';

  import { getAppView } from '../shared/app-context.svelte';
  import { iconSwap } from '../shared/motion';

  const {
    song,
    size,
  }: { song: Song; size: 'row' | 'desktop' | 'phone' | 'phone-page' } =
    $props();
  const view = getAppView();
  const hearts = $derived(view.state.library?.hearts ?? null);
  const hearted = $derived(hearts?.has(song.id) ?? false);

  const LOOKS = {
    row: {
      button: 'relative z-1 size-9 rounded-lg text-neutral-600',
      icon: 16,
    },
    desktop: { button: 'size-10 rounded-full text-neutral-700', icon: 20 },
    phone: { button: 'size-11 rounded-full text-neutral-700', icon: 20 },
    'phone-page': {
      button: 'size-11 rounded-full text-neutral-700 active:bg-white/60',
      icon: 22,
    },
  };
  const look = $derived(LOOKS[size]);
</script>

{#if view.state.library}
  <button
    type="button"
    class={[
      'grid flex-none place-items-center transition-[background-color,color,opacity,transform] duration-feedback enabled:press disabled:(cursor-not-allowed opacity-50) mouse:enabled:hover:(bg-primary-100 text-primary-950)',
      look.button,
    ]}
    aria-label="红心《{songTitle(song)}》"
    aria-pressed={hearted}
    disabled={hearts === null}
    onclick={() => view.app.heart(song, !hearted)}
  >
    {#key hearted}
      <span class="grid col-start-1 row-start-1" transition:iconSwap>
        {#if hearted}
          <Heart
            size={look.icon}
            class="text-accent-600"
            fill="currentColor"
            aria-hidden="true"
          />
        {:else}
          <Heart size={look.icon} aria-hidden="true" />
        {/if}
      </span>
    {/key}
  </button>
{/if}
