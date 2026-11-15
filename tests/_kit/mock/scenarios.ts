import type { SeedName } from './seed.ts';

export type ScenarioName =
  | 'default'
  | 'after'
  | 'deleted'
  | 'login-expired'
  | 'rate-limited'
  | 'deleted-playlist'
  | 'empty-playlist'
  | 'partial-sync'
  | 'slow'
  | 'offline';

export interface MockConfig {
  name: ScenarioName;
  seed: SeedName;
  latencyMs: number;
  offline: boolean;
  loginExpired: boolean;
  rateLimited: boolean;
  deletedPlaylist: boolean;
  emptyPlaylist: boolean;
  partialSync: boolean;
}

const DEFAULTS = {
  seed: 'before',
  latencyMs: 0,
  offline: false,
  loginExpired: false,
  rateLimited: false,
  deletedPlaylist: false,
  emptyPlaylist: false,
  partialSync: false,
} as const;

const PRESETS: Record<ScenarioName, Partial<Omit<MockConfig, 'name'>>> = {
  default: {},
  after: { seed: 'after' },
  deleted: { seed: 'deleted' },
  'login-expired': { loginExpired: true },
  'rate-limited': { rateLimited: true },
  'deleted-playlist': { deletedPlaylist: true },
  'empty-playlist': { emptyPlaylist: true },
  'partial-sync': { partialSync: true },
  slow: { latencyMs: 800 },
  offline: { offline: true },
};

export const isScenarioName = (value: unknown): value is ScenarioName =>
  typeof value === 'string' && Object.hasOwn(PRESETS, value);

export const configOf = (name: ScenarioName): MockConfig => ({
  ...DEFAULTS,
  ...PRESETS[name],
  name,
});
