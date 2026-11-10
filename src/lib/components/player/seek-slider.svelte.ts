import type { Attachment } from 'svelte/attachments';

import { getAppView } from '../shared/app-context.svelte';
import { clamp } from '../shared/clamp';
import { attachGrip } from '../shared/press';
import { createSliderCore } from '../shared/slider-core';
import { shownDuration } from './now';
import { formatSeconds } from './view';

const STEP = 5;

export interface SeekSlider {
  readonly dragging: number | null;
  readonly duration: number;
  ratio: (now: number) => number;
  readonly attach: Attachment<HTMLElement>;
  attributes: (ratio: number) => SliderAttributes;
}

interface SliderAttributes {
  role: 'slider';
  tabindex: 0;
  'aria-label': string;
  'aria-valuemin': number;
  'aria-valuemax': number;
  'aria-valuenow': number;
  'aria-valuetext': string;
  'aria-disabled': boolean;
  onkeydown: (event: KeyboardEvent) => void;
}

export const createSeekSlider = (): SeekSlider => {
  const view = getAppView();
  const duration = $derived(shownDuration(view.state.player));
  let dragging = $state<number | null>(null);
  let element: HTMLElement | null = null;

  const ratioAt = (sample: { x: number }): number | null => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return rect.width > 0
      ? clamp((sample.x - rect.left) / rect.width, 0, 1)
      : 0;
  };

  const core = createSliderCore({
    begin: (sample) => {
      if (duration <= 0) return null;
      return ratioAt(sample);
    },
    track: (sample) => ratioAt(sample) ?? 0,
    commit: (value) => {
      if (duration > 0) view.app.seek(value * duration);
    },
    cancel: () => {},
    onValue: (value) => (dragging = value),
  });

  const onkeydown = (event: KeyboardEvent) => {
    if (duration <= 0) return;
    const at = view.state.player.position;
    const to = {
      ArrowRight: at + STEP,
      ArrowUp: at + STEP,
      ArrowLeft: at - STEP,
      ArrowDown: at - STEP,
      Home: 0,
      End: duration,
    }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    view.app.seek(to);
  };

  return {
    get dragging() {
      return dragging;
    },
    get duration() {
      return duration;
    },
    ratio: (now) =>
      dragging ?? (duration > 0 ? clamp(now / duration, 0, 1) : 0),
    attach: (node) => {
      element = node;
      const detach = attachGrip(core)(node);
      return () => {
        if (element === node) element = null;
        detach?.();
      };
    },
    attributes(ratio) {
      const shown = ratio * duration;
      return {
        role: 'slider',
        tabindex: 0,
        'aria-label': '播放进度',
        'aria-valuemin': 0,
        'aria-valuemax': Math.round(duration),
        'aria-valuenow': Math.round(shown),
        'aria-valuetext': `${formatSeconds(shown)} / ${formatSeconds(duration)}`,
        'aria-disabled': duration <= 0,
        onkeydown,
      };
    },
  };
};
