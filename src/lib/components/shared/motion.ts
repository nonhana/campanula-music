import { flushSync } from 'svelte';
import { prefersReducedMotion } from 'svelte/motion';
import type { TransitionConfig } from 'svelte/transition';

import {
  AXES,
  cssEasing,
  DURATIONS,
  EASINGS,
  FLIGHT_ARC,
  FLOAT_DISTANCE,
  REDUCED_FADE_MS,
  STAGGER,
} from './motion-tokens';

export const reducedMotion = (): boolean => prefersReducedMotion.current;

export const unseen = (): boolean => document.visibilityState === 'hidden';

let settling = false;

// 状态直接到位、不播过渡；不能在 effect 里调（flushSync）
export const atOnce = (change: () => void): void => {
  settling = true;
  try {
    flushSync(change);
  } finally {
    settling = false;
  }
};

const instant = (): boolean => settling || unseen();

export const fadeMs = (ms: number): number => {
  if (instant()) return 0;
  return reducedMotion() ? Math.min(ms, REDUCED_FADE_MS) : ms;
};

export const moveMs = (ms: number): number =>
  reducedMotion() || instant() ? 0 : ms;

export const scrollBehavior = (): ScrollBehavior =>
  reducedMotion() ? 'auto' : 'smooth';

export const animateHeight = (
  element: HTMLElement,
  from: number,
  to: number,
  duration: number,
): Animation | null => {
  const ms = moveMs(duration);
  if (ms === 0 || Math.abs(to - from) < 1) return null;
  return element.animate(
    [
      { height: `${from}px`, overflowY: 'clip' },
      { height: `${to}px`, overflowY: 'clip' },
    ],
    {
      duration: ms,
      easing: cssEasing('out-soft'),
    },
  );
};

const FLIGHT_STEPS = 12;

// 元素摆在 to 上、缩放原点在左上角（translate 是相对 to 的）
export const flightArc = (from: DOMRect, to: DOMRect): Keyframe[] => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const bend = FLIGHT_ARC * length * (dx < 0 ? -1 : 1);
  const cx = from.x + dx / 2 + (dy / length) * bend;
  const cy = from.y + dy / 2 - (dx / length) * bend;
  return Array.from({ length: FLIGHT_STEPS + 1 }, (_, i) => {
    const t = i / FLIGHT_STEPS;
    const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t ** 2 * to.x;
    const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t ** 2 * to.y;
    const scale = (from.width + (to.width - from.width) * t) / to.width;
    return {
      transform: `translate(${x - to.x}px, ${y - to.y}px) scale(${scale})`,
    };
  });
};

const cubicBezier = ([x1, y1, x2, y2]: readonly [
  number,
  number,
  number,
  number,
]): ((t: number) => number) => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (s: number) => ((ax * s + bx) * s + cx) * s;
  const y = (s: number) => ((ay * s + by) * s + cy) * s;
  const slope = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  const solve = (t: number): number => {
    let s = t;
    for (let i = 0; i < 8; i += 1) {
      const error = x(s) - t;
      if (Math.abs(error) < 1e-6) return s;
      const d = slope(s);
      if (Math.abs(d) < 1e-6) break;
      s -= error / d;
    }
    let low = 0;
    let high = 1;
    s = t;
    while (high - low > 1e-6) {
      if (x(s) < t) low = s;
      else high = s;
      s = (low + high) / 2;
    }
    return s;
  };
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : y(solve(t)));
};

export const easeOutSoft = cubicBezier(EASINGS['out-soft']);
const easeInSoft = cubicBezier(EASINGS['in-soft']);

export interface TransitionOptions {
  direction?: 'in' | 'out' | 'both';
}

export type MotionConfig =
  | TransitionConfig
  | ((options?: { direction?: 'in' | 'out' }) => TransitionConfig);

const twoWay = <P>(
  motion: (
    node: Element,
    params: P,
    options: TransitionOptions,
  ) => TransitionConfig,
  node: Element,
  params: P,
  options: TransitionOptions,
): MotionConfig => {
  if (options.direction !== 'both') return motion(node, params, options);
  if (instant()) return {};
  let path: TransitionConfig['css'];
  return ({ direction } = {}) => {
    const config = motion(node, params, { direction });
    const turning = path !== undefined;
    path ??= config.css;
    return {
      ...config,
      css: path,
      delay: direction === 'out' || turning ? 0 : config.delay,
    };
  };
};

const easingOf = (options: TransitionOptions): ((t: number) => number) =>
  options.direction === 'out' ? easeInSoft : easeOutSoft;

interface FadeParams {
  duration?: number;
  delay?: number;
}

export const fade = (
  node: Element,
  params: FadeParams = {},
  options: TransitionOptions = {},
): MotionConfig => twoWay(fadeOnce, node, params, options);

const fadeOnce = (
  _node: Element,
  { duration, delay = 0 }: FadeParams,
  options: TransitionOptions,
): TransitionConfig => {
  const out = options.direction === 'out';
  return {
    delay: instant() ? 0 : delay,
    duration: fadeMs(
      duration ?? (out ? DURATIONS['state-out'] : DURATIONS.state),
    ),
    easing: easingOf(options),
    css: (t) => `opacity: ${t}`,
  };
};

export const fadeThrough = (
  node: Element,
  _params?: undefined,
  options: TransitionOptions = {},
): MotionConfig => twoWay(fadeThroughOnce, node, undefined, options);

const fadeThroughOnce = (
  node: Element,
  _params: undefined,
  options: TransitionOptions,
): TransitionConfig =>
  options.direction === 'out'
    ? fadeOnce(node, {}, options)
    : fadeOnce(
        node,
        {
          duration: DURATIONS.reveal,
          delay: fadeMs(DURATIONS['state-out']),
        },
        options,
      );

export const fadeAway = (
  node: HTMLElement,
  { duration = DURATIONS['state-out'] }: { duration?: number } = {},
  options: TransitionOptions = {},
): TransitionConfig => {
  if (import.meta.env.DEV) checkSingleFadeAway(node);
  node.style.marginBottom = `calc(${getComputedStyle(node).marginBottom} - ${node.offsetHeight}px)`;
  node.style.pointerEvents = 'none';
  return {
    duration: fadeMs(duration),
    easing: easingOf(options),
    css: (t) => `opacity: ${t}`,
  };
};

const checkSingleFadeAway = (node: HTMLElement): void => {
  const nested =
    node.parentElement?.closest('[data-fading-away]') ??
    node.querySelector('[data-fading-away]');
  if (nested)
    console.error(
      'out:fadeAway 套在另一个 out:fadeAway 里：只在骨架的最外层写一次（motion.ts fadeAway 的注释）',
      node,
    );
  node.dataset.fadingAway = '';
};

export const REVEAL_GROUP = '[data-reveal-group]';

export const reveal = (node: HTMLElement): TransitionConfig => {
  const found = [...node.querySelectorAll(REVEAL_GROUP)];
  const groups = found.length > 0 ? found : [node];
  for (const group of groups) group.classList.add('revealing');
  node.addEventListener(
    'introend',
    () => {
      for (const group of groups) group.classList.remove('revealing');
    },
    { once: true },
  );
  return { duration: STAGGER.step * (STAGGER.count - 1) + DURATIONS.reveal };
};

export type Toward = keyof typeof AXES;

export interface FloatParams {
  toward: Toward;
  distance?: number;
  duration?: number;
  panel?: boolean;
  delay?: number;
}

export const float = (
  node: Element,
  params: FloatParams,
  options: TransitionOptions = {},
): MotionConfig => twoWay(floatOnce, node, params, options);

const floatOnce = (
  _node: Element,
  { toward, distance, duration, panel = false, delay = 0 }: FloatParams,
  options: TransitionOptions,
): TransitionConfig => {
  if (instant()) return { duration: 0 };
  const out = options.direction === 'out';
  const ms =
    duration ??
    DURATIONS[
      panel ? (out ? 'panel-out' : 'panel') : out ? 'state-out' : 'state'
    ];
  const easing = easingOf(options);
  if (reducedMotion()) {
    return {
      delay,
      duration: fadeMs(ms),
      easing,
      css: (t) => `opacity: ${t}`,
    };
  }
  const [x, y] = AXES[toward];
  const reach =
    (distance ?? (out ? FLOAT_DISTANCE.out : FLOAT_DISTANCE.in)) *
    (out ? 1 : -1);
  return {
    delay,
    duration: ms,
    easing,
    css: (t, u) =>
      `opacity: ${t}; translate: ${x * reach * u}px ${y * reach * u}px`,
  };
};

const ICON_FROM_SCALE = 0.85;

export const iconSwap = (
  node: Element,
  _params?: undefined,
  options: TransitionOptions = {},
): MotionConfig => twoWay(iconSwapOnce, node, undefined, options);

const iconSwapOnce = (
  _node: Element,
  _params: undefined,
  options: TransitionOptions,
): TransitionConfig => {
  const out = options.direction === 'out';
  const scaled = !out && !reducedMotion();
  return {
    duration: fadeMs(DURATIONS.feedback),
    easing: easingOf(options),
    css: (t, u) =>
      scaled
        ? `opacity: ${t}; scale: ${1 - u * (1 - ICON_FROM_SCALE)}`
        : `opacity: ${t}`,
  };
};

export const grow = (
  _node: Element,
  _params?: undefined,
  options: TransitionOptions = {},
): TransitionConfig => {
  const ms =
    options.direction === 'out' ? DURATIONS['state-out'] : DURATIONS.state;
  const easing = easingOf(options);
  if (reducedMotion()) {
    return {
      duration: fadeMs(ms),
      easing,
      css: (t) => `opacity: ${t}`,
    };
  }
  return {
    duration: moveMs(ms),
    easing,
    css: (t) => `scale: 1 ${t}`,
  };
};

const RECEDE_SCALE = 0.96;

export const recede = (
  _node: Element,
  { delay = 0 }: { delay?: number } = {},
  options: TransitionOptions = {},
): TransitionConfig => {
  if (instant()) return { duration: 0 };
  const ms =
    options.direction === 'out' ? DURATIONS['panel-out'] : DURATIONS.panel;
  const easing = easingOf(options);
  if (reducedMotion()) {
    return {
      delay,
      duration: fadeMs(ms),
      easing,
      css: (t) => `opacity: ${t}`,
    };
  }
  return {
    delay,
    duration: ms,
    easing,
    css: (t, u) => `opacity: ${t}; scale: ${1 - u * (1 - RECEDE_SCALE)}`,
  };
};

export const dock = (
  node: Element,
  { gone = true }: { gone?: boolean } = {},
  options: TransitionOptions = {},
): MotionConfig => {
  const out = options.direction === 'out';
  if (out && !gone) return {};
  const distance = innerHeight - node.getBoundingClientRect().top;
  return float(
    node,
    {
      toward: out ? 'down' : 'up',
      distance,
      duration: DURATIONS[out ? 'panel-out' : 'panel'],
    },
    options,
  );
};

const POP_DISTANCE = 4;
const POP_FROM_SCALE = 0.98;

export const pop = (
  node: Element,
  params: { below: boolean },
  options: TransitionOptions = {},
): MotionConfig => twoWay(popOnce, node, params, options);

const popOnce = (
  node: Element,
  { below }: { below: boolean },
  options: TransitionOptions,
): TransitionConfig => {
  if (options.direction === 'out') return fadeOnce(node, {}, options);
  const moved = !reducedMotion();
  const from = (below ? -1 : 1) * POP_DISTANCE;
  return {
    duration: fadeMs(DURATIONS.state),
    easing: easingOf(options),
    css: (t, u) =>
      moved
        ? `opacity: ${t}; translate: 0 ${from * u}px; scale: ${1 - u * (1 - POP_FROM_SCALE)}`
        : `opacity: ${t}`,
  };
};

const DIALOG_DISTANCE = 8;

export const dialog = (
  node: Element,
  _params?: undefined,
  options: TransitionOptions = {},
): MotionConfig => twoWay(dialogOnce, node, undefined, options);

const dialogOnce = (
  node: Element,
  _params: undefined,
  options: TransitionOptions,
): TransitionConfig => {
  if (options.direction === 'out')
    return fadeOnce(node, { duration: DURATIONS['panel-out'] }, options);
  const moved = !reducedMotion();
  return {
    duration: fadeMs(DURATIONS.panel),
    easing: easingOf(options),
    css: (t, u) =>
      moved
        ? `opacity: ${t}; translate: 0 ${DIALOG_DISTANCE * u}px; scale: ${1 - u * (1 - POP_FROM_SCALE)}`
        : `opacity: ${t}`,
  };
};

interface ToastParams {
  edge: 'top' | 'bottom';
  moved?: boolean;
}

export const toast = (
  node: Element,
  params: ToastParams,
  options: TransitionOptions = {},
): MotionConfig => twoWay(toastOnce, node, params, options);

const toastOnce = (
  node: Element,
  { edge, moved = false }: ToastParams,
  options: TransitionOptions,
): TransitionConfig =>
  options.direction === 'out' || moved
    ? fadeOnce(node, {}, options)
    : floatOnce(
        node,
        {
          toward: edge === 'bottom' ? 'up' : 'down',
        },
        options,
      );

export const unfold = (
  node: Element,
  _params?: undefined,
  options: TransitionOptions = {},
): MotionConfig => twoWay(unfoldOnce, node, undefined, options);

const unfoldOnce = (
  node: Element,
  _params: undefined,
  options: TransitionOptions,
): TransitionConfig => {
  if (reducedMotion() || instant()) return fadeOnce(node, {}, options);
  const height = node.scrollHeight;
  const reach = FLOAT_DISTANCE.in;
  return {
    duration: DURATIONS.state,
    easing: easingOf(options),
    css: (t) => {
      const shown = Math.max(0, t * 2 - 1);
      return `height: ${t * height}px; overflow: hidden; opacity: ${shown}; translate: 0 ${(shown - 1) * reach}px`;
    },
  };
};

export const stagger = (
  node: Element,
  { order }: { order: number },
  options: TransitionOptions = {},
): MotionConfig =>
  float(
    node,
    {
      toward: 'up',
      duration: DURATIONS.reveal,
      delay: Math.min(order, STAGGER.count - 1) * STAGGER.step,
    },
    options,
  );
