import type { Attachment } from 'svelte/attachments';

import type { Glide } from './drag-scroll-core';
import {
  createDragScrollCore,
  frictionGlide,
  glideEnd,
  glideTolerance,
  springGlide,
} from './drag-scroll-core';
import { reducedMotion } from './motion';
import { attachWindowGrip, createPageHold } from './press';

export const dragScroll: Attachment<HTMLElement> = (element) => {
  const holdPage = createPageHold();
  // 有吸附时拖着、滑着要关掉，不然每写一次 scrollLeft 浏览器都吸一下
  const snapping = getComputedStyle(element).scrollSnapType !== 'none';
  let dragging = false;
  let frame = 0;
  // 滑行上一帧写进去的位置：这帧读出来不一样就是别人在滚
  let written = 0;
  let stoppedByPress = false;

  const max = () => element.scrollWidth - element.clientWidth;

  const settle = () => {
    element.style.scrollSnapType = '';
  };

  const stopGlide = (): boolean => {
    if (!frame) return false;
    cancelAnimationFrame(frame);
    frame = 0;
    window.removeEventListener('pointerdown', onOutsideDown, true);
    return true;
  };

  const onOutsideDown = (event: PointerEvent) => {
    if (event.target instanceof Node && element.contains(event.target)) return;
    stopGlide();
    settle();
  };

  const glide = (motion: Glide) => {
    stopGlide();
    const start = performance.now();
    written = element.scrollLeft;
    window.addEventListener('pointerdown', onOutsideDown, true);
    const step = (now: number) => {
      if (Math.abs(element.scrollLeft - written) > 1) {
        stopGlide();
        settle();
        return;
      }
      const t = Math.max(0, now - start) / 1000;
      element.scrollLeft = motion.at(t);
      written = element.scrollLeft;
      if (motion.done(t)) {
        stopGlide();
        settle();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };

  const snapOf = (to: number): number => {
    const from = element.scrollLeft;
    element.style.scrollSnapType = '';
    element.scrollLeft = to;
    const landed = element.scrollLeft;
    element.style.scrollSnapType = 'none';
    element.scrollLeft = from;
    return landed;
  };

  const release = (velocity: number) => {
    if (reducedMotion()) return settle();
    const position = element.scrollLeft;
    const tolerance = glideTolerance(window.devicePixelRatio);
    if (snapping) {
      const target = snapOf(glideEnd(position, velocity, max()));
      return target === position
        ? settle()
        : glide(springGlide(position, target, velocity, tolerance));
    }
    if (velocity === 0) return settle();
    glide(frictionGlide(position, velocity, max(), tolerance));
  };

  const core = createDragScrollCore({
    begin(sample) {
      if (
        sample.target instanceof Element &&
        sample.target.closest('[data-scrollbar]')
      )
        return null;
      const limit = max();
      return limit >= 1
        ? { position: element.scrollLeft, max: limit, stopped: stoppedByPress }
        : null;
    },
    onPose(pose) {
      if (pose.dragging) {
        if (!dragging) {
          dragging = true;
          holdPage(true);
          document.getSelection()?.removeAllRanges();
          element.style.scrollSnapType = 'none';
        }
        element.scrollLeft = pose.position;
        return;
      }
      dragging = false;
      holdPage(false);
      release(pose.velocity);
    },
  });

  const onDownFirst = () => {
    stoppedByPress = stopGlide();
  };
  const onDownAfter = () => {
    if (stoppedByPress && !core.holding) settle();
    stoppedByPress = false;
  };
  const onWheel = () => {
    if (stopGlide()) settle();
  };
  element.addEventListener('pointerdown', onDownFirst, true);
  const detach = attachWindowGrip(core, { touchAction: false })(element);
  element.addEventListener('pointerdown', onDownAfter);
  element.addEventListener('wheel', onWheel, { passive: true });
  return () => {
    element.removeEventListener('pointerdown', onDownFirst, true);
    element.removeEventListener('pointerdown', onDownAfter);
    element.removeEventListener('wheel', onWheel);
    detach?.();
    stopGlide();
    core.abandon();
  };
};
