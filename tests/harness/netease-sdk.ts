// 网易云替身。测试进程里服务端 import 'hana-music-api' 时拿到的是这个模块（见 world.ts 的 replaceSdk）。
// 只回测试事先放进来的录制数据；没放就报错，服务端永远连不到真的网易云。

export interface Reply {
  status: number
  body: unknown
  cookie: string[]
}

export interface Call {
  module: string
  query: unknown
}

const replies = new Map<string, Reply[]>()

/** 服务端调过的模块，按先后 */
export const calls: Call[] = []

export function queueReply(module: string, reply: Reply): void {
  replies.set(module, [...(replies.get(module) ?? []), reply])
}

export function reset(): void {
  replies.clear()
  calls.length = 0
}

// 和 SDK 的 invokeModule 同名同参数；config（凭据、deviceId、realIP）从 #19 起要记下来
export async function invokeModule(module: string, query: unknown): Promise<Reply> {
  calls.push({ module, query })
  const reply = replies.get(module)?.shift()
  if (!reply)
    throw new Error(`网易云替身：没有为 ${module} 准备录制数据`)
  return structuredClone(reply)
}
