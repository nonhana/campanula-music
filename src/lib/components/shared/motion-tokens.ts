export const EASINGS = {
  'out-soft': [0.16, 1, 0.3, 1],
  'in-soft': [0.4, 0, 1, 1],
} as const;

export const cssEasing = (name: keyof typeof EASINGS): string =>
  `cubic-bezier(${EASINGS[name].join(', ')})`;

export const DURATIONS = {
  feedback: 120,
  state: 200,
  'state-out': 120,
  panel: 360,
  'panel-out': 200,
  focal: 600,
  'focal-bar': 480,
  reveal: 240,
  'wheel-return': 240,
  'rail-label': 160,
  drawer: 380,
  'wave-flatten': 160,
  'wave-rise': 420,
  'lyric-line': 300,
  'morning-row': 260,
  'wash-out': 300,
  tint: 700,
  tick: 250,
} as const;

export const DELAYS = {
  spinner: 300,
  scrollbar: 1000,
  'rail-label': 60,
} as const;

export const LOOPS = {
  spin: 1000,
  bone: 1600,
  'wave-flow': 1800,
  'now-bars': 1100,
  'qr-dot': 1800,
} as const;

export const REDUCED_FADE_MS = 150;

export const FLOAT_DISTANCE = { in: 12, out: 6 } as const;

export const PAGE_DISTANCE = { in: 16, out: 8, lateral: 24 } as const;

export const STAGGER = { step: 30, count: 6 } as const;

export const AXES = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
} as const;

export const FLOAT_IN_DELAY = 60;

export const LANDING_WAIT = 100;

export const WHEEL = {
  pivot: 1.6,
  pitch: 28,
  textDelay: 80,
  textOut: 12,
  textIn: 16,
} as const;

export const FLIGHT_ARC = 0.12;

export const OPENING = { delay: 160, spread: 320, blur: 6 } as const;

export const PRESS_SCALE = 0.98;
