<script lang="ts">
  import { LoaderCircle, Pause, Play } from '@lucide/svelte';

  import { getAppView } from '../shared/app-context.svelte';
  import { iconSwap } from '../shared/motion';
  import { DELAYS } from '../shared/motion-tokens';

  const { size = 44 }: { size?: 44 | 64 | 72 } = $props();
  const view = getAppView();
  const status = $derived(view.state.player.status);
  const busy = $derived(status === 'loading' || status === 'buffering');

  let slow = $state(false);
  $effect(() => {
    if (!busy) return;
    const timer = setTimeout(() => (slow = true), DELAYS.spinner);
    return () => {
      clearTimeout(timer);
      slow = false;
    };
  });
  const icon = $derived(
    status === 'paused' ? 'play' : busy && slow ? 'spinner' : 'pause',
  );

  const LOOKS = {
    44: { button: 'size-11', icon: 20, nudge: 'ml-0.5' },
    64: { button: 'size-16 shadow-ambient', icon: 26, nudge: 'ml-1' },
    72: { button: 'size-18 shadow-ambient', icon: 30, nudge: 'ml-1' },
  };
  const look = $derived(LOOKS[size]);
</script>

<button
  class={[
    'grid flex-none place-items-center rounded-full bg-primary-950 text-white transition-[background-color,transform] duration-feedback press mouse:hover:bg-primary-900',
    look.button,
  ]}
  aria-label={status === 'paused' ? '播放' : busy ? '暂停（正在加载）' : '暂停'}
  onclick={() => view.app.togglePlay()}
>
  {#key icon}
    <span class="grid col-start-1 row-start-1" transition:iconSwap>
      {#if icon === 'spinner'}
        <LoaderCircle
          size={look.icon}
          class="animate-spin"
          aria-hidden="true"
        />
      {:else if icon === 'pause'}
        <Pause size={look.icon} fill="currentColor" aria-hidden="true" />
      {:else}
        <Play
          size={look.icon}
          fill="currentColor"
          class={look.nudge}
          aria-hidden="true"
        />
      {/if}
    </span>
  {/key}
</button>
