// 网易云替身。测试进程里服务端 import 'hana-music-api' 时拿到的是这个模块（见 world.ts 的 replaceSdk）。
// 只回测试事先放进来的录制数据；没放就报错，服务端永远连不到真的网易云。

/** SDK 的返回：正常时 resolve 它，失败时 throw 它（网易云拒绝、上游出错、超时都一样） */
export interface SdkResponse {
  status: number
  body: unknown
  cookie: string[]
}

export interface Outcome {
  /** true：像真的 SDK 一样把 response 抛出来 */
  rejected: boolean
  response: SdkResponse
  /** 有的话等它了结才回：模拟网易云回得慢，测请求之间的先后 */
  until?: Promise<void>
}

/**
 * 调用配置里替身关心的部分，照 SDK 的 ModuleCallConfig：凭据（Cookie 的名字和值）、realIP，
 * 以及 deviceId（顶层的给隐式匿名注册用，state 里的给每次请求的 Cookie 头用）
 */
export interface CallConfig {
  cookie?: Record<string, string | number | boolean | undefined> | string
  deviceId?: string
  realIP?: string
  state?: { deviceId?: string }
}

export interface Call {
  module: string
  query: unknown
  config: CallConfig
}

const outcomes = new Map<string, Outcome[]>()

/** 服务端调过的模块，按先后 */
export const calls: Call[] = []

export function queueReply(module: string, outcome: Outcome): void {
  outcomes.set(module, [...(outcomes.get(module) ?? []), outcome])
}

export function reset(): void {
  outcomes.clear()
  calls.length = 0
}

// 和 SDK 的 invokeModule 同名同参数（config 默认是空对象）
export async function invokeModule(module: string, query: unknown, config: CallConfig = {}): Promise<SdkResponse> {
  calls.push({ module, query, config: structuredClone(config) })
  const outcome = outcomes.get(module)?.shift()
  if (!outcome)
    throw new Error(`网易云替身：没有为 ${module} 准备录制数据`)
  await outcome.until
  const response = structuredClone(outcome.response)
  if (outcome.rejected)
    throw response
  return response
}
