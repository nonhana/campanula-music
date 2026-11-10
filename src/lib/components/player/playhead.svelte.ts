import type { PlayerState } from '#lib/app/player.js';

import { reducedMotion } from '../shared/motion';

export interface Playhead {
  readonly now: number;
}

export const createPlayhead = (read: () => PlayerState): Playhead => {
  // 只读这两样：别的状态变了不能把时刻拉回报的进度
  const position = $derived(read().position);
  const playing = $derived(read().status === 'playing');
  const duration = $derived(read().duration ?? Number.POSITIVE_INFINITY);
  let now = $state(read().position);

  $effect(() => {
    const from = position;
    const end = duration;
    now = from;
    if (!playing || reducedMotion()) return;
    const since = performance.now();
    let frame = requestAnimationFrame(function tick(at) {
      now = Math.min(end, from + Math.max(0, at - since) / 1000);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  });

  return {
    get now() {
      return now;
    },
  };
};
