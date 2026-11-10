<script lang="ts">
  import type { Snippet } from 'svelte';

  import type { Song } from '#lib/api/library.js';

  import type { MotionConfig, TransitionOptions } from '../shared/motion';
  import { float } from '../shared/motion';
  import { FLOAT_IN_DELAY, WHEEL } from '../shared/motion-tokens';
  import type { Place, Turn } from './view';

  interface Props {
    song: Song | null;
    turn: Turn | null;
    place: Place;
    children: Snippet<[Song]>;
  }

  const { song, turn, place, children }: Props = $props();

  const waiting = new WeakSet<Element>();

  const enter = (
    node: Element,
    _params: undefined,
    options: TransitionOptions,
  ): MotionConfig => {
    if (turn === null) return {};
    waiting.add(node);
    if (turn === 'land')
      return float(node, { toward: 'up', delay: FLOAT_IN_DELAY }, options);
    return float(
      node,
      {
        toward: turn,
        distance: place === 'page' ? WHEEL.textIn : undefined,
        delay: WHEEL.textDelay + FLOAT_IN_DELAY,
      },
      options,
    );
  };

  const leave = (
    node: Element,
    _params: undefined,
    options: TransitionOptions,
  ): MotionConfig => {
    if (turn === null || waiting.has(node)) return {};
    if (turn === 'land') return float(node, { toward: 'up' }, options);
    return float(
      node,
      {
        toward: turn,
        distance: place === 'page' ? WHEEL.textOut : undefined,
        delay: WHEEL.textDelay,
      },
      options,
    );
  };
</script>

<span class="swap">
  {#key song?.id}
    <span
      class="slot"
      in:enter
      out:leave
      onintrostart={(event) => waiting.delete(event.currentTarget)}
    >
      {#if song}{@render children(song)}{/if}
    </span>
  {/key}
</span>

<style>
  .swap {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }

  .slot {
    grid-area: 1 / 1;
    min-width: 0;
  }
</style>
