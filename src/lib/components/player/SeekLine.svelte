<script lang="ts">
  import { getAppView } from '../shared/app-context.svelte';
  import type { SeekSlider } from './seek-slider.svelte';

  const { slider }: { slider: SeekSlider } = $props();
  const view = getAppView();
  const ratio = $derived(slider.ratio(view.state.player.position));
  const percent = $derived(`${ratio * 100}%`);
</script>

<div
  class={[
    'seek absolute inset-x-0 -top-1.5 h-4 cursor-pointer touch-none',
    slider.dragging !== null && 'dragging',
  ]}
  {...slider.attributes(ratio)}
  {@attach slider.attach}
>
  <div
    class="rail absolute inset-x-0 top-1.5 bg-primary-100"
    aria-hidden="true"
  >
    <div class="fill h-full bg-primary-700" style:width={percent}></div>
  </div>
  <span
    class="thumb absolute top-px h-3.5 w-1 rounded-full bg-primary-900"
    style:left="calc({percent} - 2px)"
    aria-hidden="true"
  ></span>
</div>

<style>
  .seek[aria-disabled='true'] {
    cursor: default;
  }

  .seek:focus-visible {
    outline: none;
  }

  .rail {
    height: 2px;
    transition: height var(--move-feedback) var(--ease-out-soft);
  }

  .fill {
    transition: width var(--move-tick) linear;
  }

  .thumb {
    opacity: 0;
    transition:
      left var(--move-tick) linear,
      opacity var(--duration-feedback) var(--ease-out-soft);
  }

  .seek:focus-visible .rail,
  .dragging .rail {
    height: 4px;
  }

  .seek:focus-visible .thumb,
  .dragging .thumb {
    opacity: 1;
  }

  .seek:focus-visible .thumb {
    outline: 2px solid theme('colors.primary.800');
    outline-offset: 2px;
  }

  .dragging .fill {
    transition: none;
  }

  .dragging .thumb {
    transition: opacity var(--duration-feedback) var(--ease-out-soft);
  }

  @media (hover: hover) and (pointer: fine) {
    .seek:not([aria-disabled='true']):hover .rail {
      height: 4px;
    }

    .seek:not([aria-disabled='true']):hover .thumb {
      opacity: 1;
    }
  }
</style>
