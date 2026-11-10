import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { quartOut } from 'svelte/easing';
import { Tween } from 'svelte/motion';

import { moveMs } from '../shared/motion';
import { DURATIONS } from '../shared/motion-tokens';
import { attachGrip, createPageHold } from '../shared/press';
import type { GripSource } from './drawer-core';
import { createDrawerCore } from './drawer-core';

export const DRAWER_BLEED = 48;

export const SHEET_HEIGHT = 0.86;

export interface Drawer {
  readonly position: number;
  readonly visible: boolean;
  settle: (open: boolean) => void;
  panel: Attachment<HTMLElement>;
  grip: (source: GripSource) => Attachment<HTMLElement>;
}

export const createDrawer = (estimate: () => number): Drawer => {
  const position = new Tween(1, {
    duration: (from, to) =>
      moveMs(
        Math.max(DURATIONS.feedback, DURATIONS.drawer * Math.abs(to - from)),
      ),
    easing: quartOut,
  });
  let panel: HTMLElement | null = null;
  const holdPage = createPageHold();

  const size = () => (panel ? panel.offsetHeight - DRAWER_BLEED : estimate());

  const core = createDrawerCore({
    size,
    drawnAt: () => position.current,
    onPose(pose) {
      holdPage(pose.dragging);
      if (pose.dragging)
        void position.set(Math.max(pose.position, -DRAWER_BLEED / size()), {
          duration: 0,
        });
      else if (untrack(() => position.target) !== pose.end)
        void position.set(pose.end);
    },
  });

  return {
    get position() {
      return position.current;
    },
    get visible() {
      return position.current < 1;
    },
    settle: core.settle,
    panel(element) {
      panel = element;
      element.style.bottom = `-${DRAWER_BLEED}px`;
      element.style.paddingBottom = `calc(${DRAWER_BLEED}px + env(safe-area-inset-bottom))`;
      // 有 transform 的元素会成为里面 fixed 元素的定位参照：整个拉开时不设
      $effect(() => {
        const at = position.current;
        element.style.transform =
          at === 0
            ? ''
            : `translateY(calc(${at} * (100% - ${DRAWER_BLEED}px)))`;
        element.style.willChange = at === 0 ? '' : 'transform';
      });
      return () => {
        if (panel === element) panel = null;
      };
    },
    grip: (source) => attachGrip(core.grip(source)),
  };
};
