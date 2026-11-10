import { clamp } from './clamp';

const EDGE = 72;
const MAX_SPEED = 1600;
const ACCEL = 8;
const ACCEL_TIME = 3000;

export const edgeScroll = (
  dt: number,
  pointerY: number,
  top: number,
  bottom: number,
  hold: number,
): { amount: number; hold: number } => {
  let direction = 0;
  let depth = 0;
  if (pointerY < top + EDGE) {
    direction = -1;
    depth = clamp((top + EDGE - pointerY) / EDGE, 0, 1);
  } else if (pointerY > bottom - EDGE) {
    direction = 1;
    depth = clamp((pointerY - (bottom - EDGE)) / EDGE, 0, 1);
  }
  if (direction === 0) return { amount: 0, hold: 0 };
  const nextHold = hold + dt;
  const ramp =
    1 + (ACCEL - 1) * clamp(nextHold / (ACCEL_TIME / 1000), 0, 1) * depth;
  return {
    amount: direction * MAX_SPEED * depth * depth * ramp * dt,
    hold: nextHold,
  };
};
