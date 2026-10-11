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
}

export interface Call {
  module: string
  query: unknown
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

// 和 SDK 的 invokeModule 同名同参数；config（凭据、deviceId、realIP）从 #19 起要记下来
export async function invokeModule(module: string, query: unknown): Promise<SdkResponse> {
  calls.push({ module, query })
  const outcome = outcomes.get(module)?.shift()
  if (!outcome)
    throw new Error(`网易云替身：没有为 ${module} 准备录制数据`)
  const response = structuredClone(outcome.response)
  if (outcome.rejected)
    throw response
  return response
}
