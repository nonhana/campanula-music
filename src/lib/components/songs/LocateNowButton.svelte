<script lang="ts">
  import { LocateFixed } from '@lucide/svelte';
  import type { ClassValue } from 'svelte/elements';

  import { fade } from '../shared/motion';
  import type { NowLocate } from '../shared/now-locate.svelte';

  interface Props {
    locate: NowLocate;
    hidden?: boolean;
    class?: ClassValue;
  }

  const { locate, hidden = false, class: klass }: Props = $props();
</script>

{#if locate.away && !hidden}
  <button
    type="button"
    class={[
      'size-10 grid place-items-center rounded-full bg-white text-neutral-700 shadow-float transition-[background-color,color,transform] duration-feedback press mouse:hover:(bg-primary-100 text-primary-950)',
      'before:absolute before:-inset-0.5 before:rounded-full before:content-empty',
      klass,
    ]}
    aria-label="定位到正在播放"
    title="定位到正在播放"
    onclick={() => locate.go()}
    transition:fade
  >
    <LocateFixed size={20} aria-hidden="true" />
  </button>
{/if}
