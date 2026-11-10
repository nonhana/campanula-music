import type { Grip } from '../shared/press';
import { rightButtonDown } from '../shared/press';

export type WheelDirection = 'previous' | 'next';

export type WheelPose =
  | { dragging: true; turned: number }
  | { dragging: false };

export interface WheelCore extends Grip {
  readonly pose: WheelPose;
}

export interface WheelCoreOptions {
  notch: () => number;
  has: (direction: WheelDirection) => boolean;
  commit: (direction: WheelDirection) => void;
  tap: () => void;
  onPose: (pose: WheelPose) => void;
}

const SLOP = 6;
const THRESHOLD = 0.25;
const FLICK = 1;

interface Press {
  pointerId: number;
  x: number;
  y: number;
  time: number;
  dragging: boolean;
}

export const createWheelCore = ({
  notch,
  has,
  commit,
  tap,
  onPose,
}: WheelCoreOptions): WheelCore => {
  let pose: WheelPose = { dragging: false };
  let press: Press | null = null;
  let swallowClick = false;

  const setPose = (next: WheelPose) => {
    pose = next;
    onPose(next);
  };

  const abandon = (pointerId?: number) => {
    if (!press || (pointerId !== undefined && pointerId !== press.pointerId))
      return;
    const wasDragging = press.dragging;
    press = null;
    swallowClick = true;
    if (wasDragging) setPose({ dragging: false });
  };

  return {
    get pose() {
      return pose;
    },
    get holding() {
      return press !== null;
    },
    press(sample) {
      if (!sample.isPrimary || sample.button !== 0) return false;
      abandon();
      swallowClick = false;
      press = {
        pointerId: sample.pointerId,
        x: sample.x,
        y: sample.y,
        time: sample.time,
        dragging: false,
      };
      return true;
    },
    move(sample) {
      if (press?.pointerId !== sample.pointerId) return;
      if (rightButtonDown(sample.buttons)) return abandon();
      const dx = sample.x - press.x;
      if (!press.dragging) {
        const across = Math.abs(dx);
        const down = Math.abs(sample.y - press.y);
        if (across < SLOP && down < SLOP) return;
        if (across <= down) {
          press = null;
          swallowClick = true;
          return;
        }
        press.dragging = true;
      }
      setPose({ dragging: true, turned: dx / notch() });
    },
    release(sample) {
      if (press?.pointerId !== sample.pointerId) return;
      const ended = press;
      press = null;
      if (!ended.dragging) return;
      swallowClick = true;
      const distance = sample.x - ended.x;
      const velocity =
        Math.abs(distance) / Math.max(1, sample.time - ended.time);
      const direction: WheelDirection = distance > 0 ? 'previous' : 'next';
      setPose({ dragging: false });
      if (
        (velocity > FLICK || Math.abs(distance) >= notch() * THRESHOLD) &&
        has(direction)
      )
        commit(direction);
    },
    abandon,
    click(detail) {
      const swallow = swallowClick && detail > 0;
      swallowClick = false;
      if (!swallow) tap();
      return swallow;
    },
  };
};
