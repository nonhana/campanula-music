import { clamp } from './clamp';
import type { Grip, PointerSample } from './press';
import { rightButtonDown } from './press';

export interface DragScrollSpan {
  position: number;
  max: number;
  stopped: boolean;
}

export type DragScrollPose =
  | { dragging: true; position: number }
  | { dragging: false; velocity: number };

export interface DragScrollCore extends Grip {
  readonly pose: DragScrollPose;
}

export interface DragScrollCoreOptions {
  begin: (sample: PointerSample) => DragScrollSpan | null;
  onPose: (pose: DragScrollPose) => void;
}

const SLOP = 5;
const SAMPLES = 20;
const STOPPED_MS = 40;
const WEIGHTS = [0.15, 0.65, 0.2] as const;
const MIN_FLING_VELOCITY = 100;
const MIN_FLING_DISTANCE = 1;
const MAX_FLING_VELOCITY = 64_000;

interface Mark {
  x: number;
  time: number;
}

interface Press {
  pointerId: number;
  from: Mark & { y: number };
  max: number;
  dragging: boolean;
  stopped: boolean;
  position: number;
  x: number;
  marks: Mark[];
}

export const releaseVelocity = (
  marks: readonly Mark[],
  releasedAt: number,
): number => {
  const newest = marks.at(-1);
  const oldest = marks[0];
  if (!newest || !oldest || releasedAt - newest.time > STOPPED_MS) return 0;
  const between = (end: number): number => {
    const start = marks[end - 1];
    const stop = marks[end];
    if (!start || !stop || stop.time <= start.time) return 0;
    return ((stop.x - start.x) * 1000) / (stop.time - start.time);
  };
  const last = marks.length - 1;
  const velocity = WEIGHTS.reduce(
    (sum, weight, i) => sum + weight * between(last - (WEIGHTS.length - 1) + i),
    0,
  );
  if (
    Math.abs(velocity) <= MIN_FLING_VELOCITY ||
    Math.abs(newest.x - oldest.x) <= MIN_FLING_DISTANCE
  )
    return 0;
  return clamp(velocity, -MAX_FLING_VELOCITY, MAX_FLING_VELOCITY);
};

export const createDragScrollCore = ({
  begin,
  onPose,
}: DragScrollCoreOptions): DragScrollCore => {
  let pose: DragScrollPose = { dragging: false, velocity: 0 };
  let press: Press | null = null;
  let swallowClick = false;

  const setPose = (next: DragScrollPose) => {
    pose = next;
    onPose(next);
  };

  const abandon = (pointerId?: number) => {
    if (!press || (pointerId !== undefined && pointerId !== press.pointerId))
      return;
    const { dragging, stopped } = press;
    press = null;
    swallowClick = true;
    if (dragging || stopped) setPose({ dragging: false, velocity: 0 });
  };

  return {
    get pose() {
      return pose;
    },
    get holding() {
      return press !== null;
    },
    press(sample) {
      if (
        sample.pointerType !== 'mouse' ||
        !sample.isPrimary ||
        sample.button !== 0
      )
        return false;
      abandon();
      swallowClick = false;
      const span = begin(sample);
      if (!span) return false;
      const from = { x: sample.x, y: sample.y, time: sample.time };
      press = {
        pointerId: sample.pointerId,
        from,
        max: span.max,
        dragging: false,
        stopped: span.stopped,
        position: span.position,
        x: sample.x,
        marks: [from],
      };
      swallowClick = span.stopped;
      return true;
    },
    move(sample) {
      if (press?.pointerId !== sample.pointerId) return;
      if (rightButtonDown(sample.buttons)) return abandon();
      press.marks.push({ x: sample.x, time: sample.time });
      if (press.marks.length > SAMPLES) press.marks.shift();
      if (!press.dragging) {
        if (Math.hypot(sample.x - press.from.x, sample.y - press.from.y) < SLOP)
          return;
        press.dragging = true;
      }
      press.position = clamp(
        press.position - (sample.x - press.x),
        0,
        press.max,
      );
      press.x = sample.x;
      setPose({ dragging: true, position: press.position });
    },
    release(sample) {
      if (press?.pointerId !== sample.pointerId) return;
      const ended = press;
      press = null;
      if (ended.dragging) {
        swallowClick = true;
        const pointerVelocity = releaseVelocity(ended.marks, sample.time);
        setPose({
          dragging: false,
          velocity: pointerVelocity === 0 ? 0 : -pointerVelocity,
        });
      } else if (ended.stopped) {
        setPose({ dragging: false, velocity: 0 });
      }
    },
    abandon,
    click(detail) {
      const swallow = swallowClick && detail > 0;
      swallowClick = false;
      return swallow;
    },
  };
};

export interface Glide {
  at: (t: number) => number;
  done: (t: number) => boolean;
}

export interface GlideTolerance {
  velocity: number;
  distance: number;
}

export const glideTolerance = (devicePixelRatio: number): GlideTolerance => ({
  velocity: 1 / (0.05 * devicePixelRatio),
  distance: 1 / devicePixelRatio,
});

const DRAG = 0.135;
const CONSTANT_DECELERATION = 1400;
// 过阻尼（ratio > 1）：不来回晃，sqrt 里不能为负
const SPRING = { mass: 0.3, stiffness: 75, ratio: 1.3 };

export const frictionGlide = (
  position: number,
  velocity: number,
  max: number,
  tolerance: GlideTolerance,
): Glide => {
  const dragLog = Math.log(DRAG);
  const deceleration = CONSTANT_DECELERATION * Math.sign(velocity);
  const velocityAt = (t: number) => velocity * DRAG ** t - deceleration * t;
  let finalTime = 0;
  for (let i = 0; i < 10; i++)
    finalTime -=
      velocityAt(finalTime) /
      (velocity * DRAG ** finalTime * dragLog - deceleration);
  const at = (t: number) => {
    const s = Math.min(t, finalTime);
    return clamp(
      position +
        (velocity * DRAG ** s) / dragLog -
        velocity / dragLog -
        (deceleration / 2) * s * s,
      0,
      max,
    );
  };
  return {
    at,
    done: (t) =>
      t >= finalTime ||
      Math.abs(velocityAt(t)) < tolerance.velocity ||
      (velocity < 0 && at(t) <= 0) ||
      (velocity > 0 && at(t) >= max),
  };
};

export const springGlide = (
  position: number,
  target: number,
  velocity: number,
  tolerance: GlideTolerance,
): Glide => {
  const { mass, stiffness, ratio } = SPRING;
  const damping = ratio * 2 * Math.sqrt(mass * stiffness);
  const root = Math.sqrt(damping * damping - 4 * mass * stiffness);
  const r1 = (-damping - root) / (2 * mass);
  const r2 = (-damping + root) / (2 * mass);
  const distance = position - target;
  const c2 = (velocity - r1 * distance) / (r2 - r1);
  const c1 = distance - c2;
  const offset = (t: number) => c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  const speed = (t: number) =>
    c1 * r1 * Math.exp(r1 * t) + c2 * r2 * Math.exp(r2 * t);
  const done = (t: number) =>
    Math.abs(offset(t)) < tolerance.distance &&
    Math.abs(speed(t)) < tolerance.velocity;
  return {
    at: (t) => (done(t) ? target : target + offset(t)),
    done,
  };
};

export const glideEnd = (
  position: number,
  velocity: number,
  max: number,
): number => {
  if (velocity === 0) return position;
  const glide = frictionGlide(position, velocity, max, {
    velocity: 0,
    distance: 0,
  });
  return glide.at(Number.POSITIVE_INFINITY);
};
