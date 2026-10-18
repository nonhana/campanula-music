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
  /**
   * 有的话只回查询参数里这几项都相等的调用，别的调用跳过它、轮到后面的：
   * 同一个模块几个请求一起发（搜索结果的综合同时搜四类）时，到服务端的先后不固定，按参数对上
   */
  when?: Record<string, unknown>
  /** 回的是哪份录制（tests/fixtures/netease/ 下的路径）：两个回答是不是同一份，看它 */
  fixture?: string
}

/** 服务端正在处理的一个请求：App 发出它时的序号（nextOrder；设备发请求时盖上，见 device.ts 的 SENT_HEADER） */
export interface RequestSpan {
  start: number
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

/** 正在等 until 了结、还没回的调用 */
let held = 0

/** 当前这次调用属于服务端正在处理的哪个请求（world.ts 设置） */
let currentRequest: () => RequestSpan | undefined = () => undefined

/** 记先后用的序号，只增不减：请求开始和结束（world.ts 记）、每次调用拿走回答，各占一个 */
let order = 0

export function nextOrder(): number {
  return order++
}

/** 每次调用拿走的回答、什么时候拿的、它属于哪个请求，以及拿的那一刻这个模块排着的回答（按先后） */
const taken: { module: string, query: unknown, span: RequestSpan, outcome: Outcome, queue: readonly Outcome[], at: number }[] = []

/** 对不上号的调用：两个同时发出的请求调同一个模块，到服务端的先后一对调，拿到的回答就不一样 */
const ambiguous: string[] = []

/** 这条测试的回答谁拿都行，不查对不上号（随机操作检查：哪个请求拿到哪份回答本来就是随机的一部分） */
let anyOrder = false

export function allowAnyOrder(): void {
  anyOrder = true
}

export function heldCalls(): number {
  return held
}

export function trackRequests(current: () => RequestSpan | undefined): void {
  currentRequest = current
}

export function ambiguities(): readonly string[] {
  return ambiguous
}

export function queueReply(module: string, outcome: Outcome): void {
  outcomes.set(module, [...(outcomes.get(module) ?? []), outcome])
}

export function reset(): void {
  outcomes.clear()
  calls.length = 0
  held = 0
  taken.length = 0
  ambiguous.length = 0
  anyOrder = false
}

/** 两个回答换过来也一样：同一份录制，一样压着（同一个 until，never() 是同一个）、一样成败、一样的 Cookie */
function interchangeable(a: Outcome, b: Outcome): boolean {
  return a.fixture === b.fixture && a.until === b.until && a.rejected === b.rejected
    && JSON.stringify(a.response.cookie) === JSON.stringify(b.response.cookie)
}

/** 这个回答能不能回给这次调用：没写 when，或者 when 里的几项和查询参数都相等 */
function fits(outcome: Outcome, query: unknown): boolean {
  return !outcome.when || Object.entries(outcome.when).every(([key, value]) => (query as Record<string, unknown>)[key] === value)
}

/**
 * 这次调用和别的请求里同一个模块的调用对不对得上号：这次的请求在别的调用拿走回答之前就已经发出来了（两边谁先到服务端不固定），
 * 那一刻排着的回答里这次的回答也在、排在后面，别的调用拿走的又也能回给这次、和这次的不一样——
 * 先后一对调，两边就拿反了（CI 上碰到过：#32 播放地址那条测试）
 */
function checkOrder(module: string, query: unknown, span: RequestSpan, outcome: Outcome): void {
  for (const other of taken) {
    if (other.module !== module || other.span === span || span.start > other.at)
      continue
    const theirs = other.queue.indexOf(other.outcome)
    const mine = other.queue.indexOf(outcome)
    if (mine < 0 || theirs > mine || !fits(other.outcome, query) || interchangeable(outcome, other.outcome))
      continue
    ambiguous.push(`${module}：${JSON.stringify(other.query)} 和 ${JSON.stringify(query)} 两个请求同时发出，先后一对调就拿反（${other.outcome.fixture} / ${outcome.fixture}）`)
  }
}

// 和 SDK 的 invokeModule 同名同参数（config 默认是空对象）
export async function invokeModule(module: string, query: unknown, config: CallConfig = {}): Promise<SdkResponse> {
  calls.push({ module, query, config: structuredClone(config) })
  const queued = outcomes.get(module) ?? []
  const queue = [...queued]
  const at = queued.findIndex(outcome => fits(outcome, query))
  const outcome = at < 0 ? undefined : queued.splice(at, 1)[0]
  if (!outcome)
    throw new Error(`网易云替身：没有为 ${module} 准备录制数据`)
  const span = currentRequest()
  if (span && !anyOrder) {
    checkOrder(module, query, span, outcome)
    taken.push({ module, query, span, outcome, queue, at: nextOrder() })
  }
  if (outcome.until) {
    held += 1
    await outcome.until.finally(() => {
      held -= 1
    })
  }
  const response = structuredClone(outcome.response)
  if (outcome.rejected)
    throw response
  return response
}
