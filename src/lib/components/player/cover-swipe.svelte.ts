import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';

import { WHEEL } from '../shared/motion-tokens';
import { attachGrip, createPageHold } from '../shared/press';
import type { WheelDirection } from './wheel-core';
import { createWheelCore } from './wheel-core';

export interface CoverSwipeOptions {
  current: () => number;
  has: (direction: WheelDirection) => boolean;
  commit: (direction: WheelDirection) => void;
  tap: () => void;
}

export interface CoverSwipe {
  readonly turned: number | null;
  grip: Attachment<HTMLElement>;
}

export const createCoverSwipe = ({
  current,
  has,
  commit,
  tap,
}: CoverSwipeOptions): CoverSwipe => {
  let turned = $state<number | null>(null);
  let width = 0;
  const holdPage = createPageHold();

  const core = createWheelCore({
    notch: () => (WHEEL.pivot * width * WHEEL.pitch * Math.PI) / 180,
    has,
    commit,
    tap,
    onPose(pose) {
      holdPage(pose.dragging);
      turned = pose.dragging ? pose.turned : null;
    },
  });
  const attach = attachGrip(core);

  $effect(() => {
    current();
    untrack(() => core.abandon());
  });

  return {
    get turned() {
      return turned;
    },
    grip(element) {
      const detach = attach(element);
      const observer = new ResizeObserver(
        ([entry]) => (width = entry.borderBoxSize[0].inlineSize),
      );
      observer.observe(element);
      return () => {
        detach?.();
        observer.disconnect();
      };
    },
  };
};
