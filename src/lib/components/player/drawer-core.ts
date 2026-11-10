import type { Grip } from '../shared/press';
import { rightButtonDown } from '../shared/press';

type DrawerEnd = 0 | 1;

export type DrawerPose =
  | { dragging: true; position: number }
  | { dragging: false; end: DrawerEnd };

export interface GripSource {
  from: 'open' | 'closed';
  commit: () => void;
  tap?: () => void;
}

export interface DrawerCore {
  readonly pose: DrawerPose;
  settle: (open: boolean) => void;
  grip: (source: GripSource) => Grip;
}

export interface DrawerCoreOptions {
  size: () => number;
  drawnAt: () => number;
  onPose: (pose: DrawerPose) => void;
}

const THRESHOLD = 0.25;
const FLICK = 0.4;
const SLOP = { touch: 10, other: 2 };

interface Press {
  pointerId: number;
  x: number;
  y: number;
  time: number;
  from: number | null;
}

const dampened = (overdrag: number): number =>
  Math.max(0, 8 * (Math.log(overdrag + 1) - 2));

const dragged = (at: number, dy: number, size: number): number => {
  const position = at + dy / size;
  if (position > 1) return 1;
  return position < 0 ? 0 - dampened(-position * size) / size : position;
};

export const createDrawerCore = ({
  size,
  drawnAt,
  onPose,
}: DrawerCoreOptions): DrawerCore => {
  let pose: DrawerPose = { dragging: false, end: 1 };
  let wanted: DrawerEnd = 1;

  const setPose = (next: DrawerPose) => {
    pose = next;
    onPose(next);
  };

  return {
    get pose() {
      return pose;
    },
    settle(open) {
      wanted = open ? 0 : 1;
      if (!pose.dragging) setPose({ dragging: false, end: wanted });
    },
    grip({ from, commit, tap }) {
      const target: DrawerEnd = from === 'open' ? 1 : 0;
      const toward = target === 1 ? 1 : -1;
      let press: Press | null = null;
      let swallowClick = false;

      const abandon = (pointerId?: number) => {
        if (
          !press ||
          (pointerId !== undefined && pointerId !== press.pointerId)
        )
          return;
        const wasDragging = press.from !== null;
        press = null;
        swallowClick = true;
        if (wasDragging) setPose({ dragging: false, end: wanted });
      };

      return {
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
            from: null,
          };
          return true;
        },
        move(sample) {
          if (press?.pointerId !== sample.pointerId) return;
          if (rightButtonDown(sample.buttons)) return abandon();
          const dy = sample.y - press.y;
          if (press.from === null) {
            const dx = sample.x - press.x;
            if (
              Math.hypot(dx, dy) <
              (sample.pointerType === 'touch' ? SLOP.touch : SLOP.other)
            ) {
              return;
            }
            if (Math.abs(dy) < Math.abs(dx)) {
              press = null;
              swallowClick = true;
              return;
            }
            press.from = drawnAt();
          }
          setPose({
            dragging: true,
            position: dragged(press.from, dy, size()),
          });
        },
        release(sample) {
          if (press?.pointerId !== sample.pointerId) return;
          const ended = press;
          press = null;
          if (ended.from === null) return;
          swallowClick = true;
          const distance = sample.y - ended.y;
          const velocity =
            Math.abs(distance) / Math.max(1, sample.time - ended.time);
          const far =
            Math.sign(distance) === toward &&
            (velocity > FLICK || Math.abs(distance) >= size() * THRESHOLD);
          if (far && wanted !== target) {
            setPose({ dragging: false, end: target });
            commit();
          } else {
            setPose({ dragging: false, end: wanted });
          }
        },
        abandon,
        click(detail) {
          const swallow = swallowClick && detail > 0;
          swallowClick = false;
          if (!swallow) tap?.();
          return swallow;
        },
      };
    },
  };
};
