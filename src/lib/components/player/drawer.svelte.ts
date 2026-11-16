import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { quartOut } from 'svelte/easing';
import { Tween } from 'svelte/motion';

import { DURATIONS } from '../shared/motion-tokens.ts';
import { moveMs } from '../shared/motion.ts';
import { attachGrip, createPageHold } from '../shared/press.ts';
import type { GripSource } from './drawer-core.ts';
import { createDrawerCore } from './drawer-core.ts';

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
  let measuredSize = 1;
  let dragging = false;
  let moving = false;
  let revision = 0;
  const holdPage = createPageHold();

  const size = () => {
    measuredSize = panel ? panel.offsetHeight - DRAWER_BLEED : estimate();
    return measuredSize;
  };

  const paint = (at: number) => {
    if (!panel) return;
    // 跨过原点时保持变换，静止后再撤销，让内部 fixed 元素恢复相对视口定位。
    const transformed = moving || at !== 0;
    panel.style.transform = transformed
      ? dragging
        ? `translateY(${at * measuredSize}px)`
        : `translateY(calc(${at} * (100% - ${DRAWER_BLEED}px)))`
      : '';
    panel.style.willChange = transformed ? 'transform' : '';
  };

  const core = createDrawerCore({
    size,
    drawnAt: () => position.current,
    onPose(pose) {
      holdPage(pose.dragging);
      const wasDragging = dragging;
      dragging = pose.dragging;
      if (pose.dragging) {
        const at = Math.max(pose.position, -DRAWER_BLEED / measuredSize);
        if (wasDragging && untrack(() => position.current) === at) return;
        revision += 1;
        moving = true;
        void position.set(at, { duration: 0 });
        paint(at);
        return;
      }
      if (!wasDragging && untrack(() => position.target) === pose.end) return;
      let current = untrack(() => position.current);
      if (wasDragging) {
        const pixels = current * measuredSize;
        current = pixels / size();
        void position.set(current, { duration: 0 });
        paint(current);
      }
      const version = ++revision;
      moving = true;
      const finish = () => {
        if (revision !== version) return;
        moving = false;
        paint(pose.end);
      };
      if (current === pose.end) {
        void position.set(pose.end, { duration: 0 });
        finish();
      } else {
        void position.set(pose.end).then(finish);
      }
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
      paint(untrack(() => position.current));
      $effect(() => {
        const at = position.current;
        // 跟手由事件当场写入，effect 只负责松手后的动画，不能覆盖拖动中的位置。
        if (!dragging) paint(at);
      });
      return () => {
        if (panel === element) {
          panel = null;
          holdPage(false);
        }
      };
    },
    grip: (source) => attachGrip(core.grip(source)),
  };
};
