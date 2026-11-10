<script lang="ts">
  import { untrack } from 'svelte';
  import type { Attachment } from 'svelte/attachments';

  import { fadeMs } from '../shared/motion';
  import { cssEasing, DURATIONS } from '../shared/motion-tokens';
  import { coverSource } from '../ui/Cover.svelte';
  import { SMALL_COVER } from './view';

  const { coverUrl }: { coverUrl: string | null } = $props();
  const wanted = $derived(
    coverUrl === null ? null : coverSource(coverUrl, SMALL_COVER),
  );

  interface Layer {
    key: number;
    src: string | null;
  }

  let layers = $state.raw<Layer[]>([
    {
      key: 0,
      src: untrack(() => wanted),
    },
  ]);
  let keys = 1;
  let covering = false;

  const advance = async (): Promise<void> => {
    const src = wanted;
    if (layers.at(-1)!.src === src) return;
    if (src !== null) {
      const probe = new Image();
      probe.src = src;
      try {
        await probe.decode();
      } catch {
        return;
      }
    }
    if (src !== wanted || covering || layers.at(-1)!.src === src) return;
    const layer = { key: keys++, src };
    if (fadeMs(DURATIONS.tint) === 0) {
      layers = [layer];
      return;
    }
    covering = true;
    layers = [...layers, layer];
  };

  const enter =
    (key: number): Attachment<HTMLElement> =>
    (element) => {
      if (key === 0) return;
      const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: fadeMs(DURATIONS.tint),
        easing: cssEasing('out-soft'),
      });
      animation.onfinish = () => {
        layers = layers.filter((layer) => layer.key >= key);
        covering = false;
        void advance();
      };
      return () => animation.cancel();
    };

  $effect(() => {
    void wanted;
    untrack(() => void advance());
  });
</script>

<div class="tint" aria-hidden="true">
  {#each layers as layer (layer.key)}
    {#if layer.src === null}
      <div class="blank" {@attach enter(layer.key)}></div>
    {:else}
      <img
        src={layer.src}
        alt=""
        draggable="false"
        {@attach enter(layer.key)}
      />
    {/if}
  {/each}
  <div class="veil"></div>
</div>

<style>
  .tint {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: theme('colors.primary.50');
    pointer-events: none;
  }

  img {
    position: absolute;
    inset: -20%;
    width: 140%;
    height: 140%;
    max-width: none;
    object-fit: cover;
    filter: blur(64px) saturate(1.15);
    transform: translateZ(0);
  }

  .blank {
    position: absolute;
    inset: 0;
    background: theme('colors.primary.50');
  }

  .veil {
    position: absolute;
    inset: 0;
    background: rgb(255 255 255 / 0.8);
  }
</style>
