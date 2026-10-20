// mock 场景：默认种子、登录失效、限流、歌单已删除、空歌单、部分同步、延迟、断网。
// 场景只影响 mock 的返回和状态，不改 App 代码（#58）。
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

const PRESETS: Record<ScenarioName, Omit<MockConfig, 'name'>> = {
  'default': { seed: 'before', latencyMs: 0, offline: false, loginExpired: false, rateLimited: false, deletedPlaylist: false, emptyPlaylist: false, partialSync: false },
  'after': { seed: 'after', latencyMs: 0, offline: false, loginExpired: false, rateLimited: false, deletedPlaylist: false, emptyPlaylist: false, partialSync: false },
  'deleted': { seed: 'deleted', latencyMs: 0, offline: false, loginExpired: false, rateLimited: false, deletedPlaylist: false, emptyPlaylist: false, partialSync: false },
  'login-expired': { seed: 'before', latencyMs: 0, offline: false, loginExpired: true, rateLimited: false, deletedPlaylist: false, emptyPlaylist: false, partialSync: false },
  'rate-limited': { seed: 'before', latencyMs: 0, offline: false, loginExpired: false, rateLimited: true, deletedPlaylist: false, emptyPlaylist: false, partialSync: false },
  'deleted-playlist': { seed: 'before', latencyMs: 0, offline: false, loginExpired: false, rateLimited: false, deletedPlaylist: true, emptyPlaylist: false, partialSync: false },
  'empty-playlist': { seed: 'before', latencyMs: 0, offline: false, loginExpired: false, rateLimited: false, deletedPlaylist: false, emptyPlaylist: true, partialSync: false },
  'partial-sync': { seed: 'before', latencyMs: 0, offline: false, loginExpired: false, rateLimited: false, deletedPlaylist: false, emptyPlaylist: false, partialSync: true },
  'slow': { seed: 'before', latencyMs: 800, offline: false, loginExpired: false, rateLimited: false, deletedPlaylist: false, emptyPlaylist: false, partialSync: false },
  'offline': { seed: 'before', latencyMs: 0, offline: true, loginExpired: false, rateLimited: false, deletedPlaylist: false, emptyPlaylist: false, partialSync: false },
}

export function isScenarioName(value: unknown): value is ScenarioName {
  return typeof value === 'string' && value in PRESETS
}

export function configOf(name: ScenarioName): MockConfig {
  return { name, ...PRESETS[name] }
}
