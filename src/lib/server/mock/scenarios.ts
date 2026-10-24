// mock 场景：默认种子、登录失效、限流、歌单已删除、空歌单、部分同步、延迟、断网；只影响 mock 的返回和状态，不改 App 代码（#58）。
import type { SeedName } from './seed.ts'

export type ScenarioName
  = | 'default'
    | 'after'
    | 'deleted'
    | 'login-expired'
    | 'rate-limited'
    | 'deleted-playlist'
    | 'empty-playlist'
    | 'partial-sync'
    | 'slow'
    | 'offline'

export interface MockConfig {
  name: ScenarioName
  seed: SeedName
  /** 每次 SDK 调用先等这么久，模拟网易云回得慢 */
  latencyMs: number
  /** 所有 API 请求回 503（连不上）；真断网用 scripts/browser offline on */
  offline: boolean
  /** 打开 App 时网易云说需要登录，续期也回 301 */
  loginExpired: boolean
  /** 同步的第一步就回“操作频繁”，写入也一样 */
  rateLimited: boolean
  /** poems 从歌单列表里删掉，详情 status 10 */
  deletedPlaylist: boolean
  /** poems 清空曲目 */
  emptyPlaylist: boolean
  /** 第二次取歌曲信息失败，曲库停在同步了一半 */
  partialSync: boolean
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
} as const

const PRESETS: Record<ScenarioName, Partial<Omit<MockConfig, 'name'>>> = {
  'default': {},
  'after': { seed: 'after' },
  'deleted': { seed: 'deleted' },
  'login-expired': { loginExpired: true },
  'rate-limited': { rateLimited: true },
  'deleted-playlist': { deletedPlaylist: true },
  'empty-playlist': { emptyPlaylist: true },
  'partial-sync': { partialSync: true },
  'slow': { latencyMs: 800 },
  'offline': { offline: true },
}

export const isScenarioName = (value: unknown): value is ScenarioName => typeof value === 'string' && Object.hasOwn(PRESETS, value)

export const configOf = (name: ScenarioName): MockConfig => ({
  ...DEFAULTS,
  ...PRESETS[name],
  name,
})
