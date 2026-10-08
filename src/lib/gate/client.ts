export type IpMode = 'default' | 'real' | 'none'

export interface CallOptions {
  slot?: 'none' | 'sms' | 'qr' | 'sms_prev' | 'qr_prev'
  ip?: IpMode
  save?: 'sms' | 'qr' | 'refresh'
  summary?: boolean
  /** 这些查询参数（手机号、验证码）在本地记录里换成占位，只发给服务器。 */
  redact?: string[]
  tag?: string
}

export interface LogEntry {
  at: string
  tag?: string
  module: string
  query: Record<string, unknown>
  options: Omit<CallOptions, 'redact' | 'tag'>
  httpStatus: number
  rttMs: number
  // 服务器回的整包：code、body 或 shape、setCookie 属性、实例信息等
  res: any
}

const STORE = 'gateLog'

function restore(): LogEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? '[]') as LogEntry[]
  }
  catch {
    return []
  }
}

export const gateLog: LogEntry[] = restore()

function persist() {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(gateLog))
  }
  catch {
    // 超过 sessionStorage 配额时只留在内存里
  }
}

export async function call(module: string, query: Record<string, unknown> = {}, options: CallOptions = {}): Promise<LogEntry> {
  const { redact = [], tag, ...rest } = options
  const started = performance.now()
  const response = await fetch('/api/call', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ module, query, ...rest }),
  })
  const res = await response.json().catch(() => ({ error: 'non-json' }))
  const entry: LogEntry = {
    at: new Date().toISOString(),
    tag,
    module,
    query: Object.fromEntries(Object.entries(query).map(([key, value]) => [key, redact.includes(key) ? `<${key}>` : value])),
    options: rest,
    httpStatus: response.status,
    rttMs: Math.round(performance.now() - started),
    res,
  }
  gateLog.push(entry)
  persist()
  return entry
}

export async function ping() {
  const started = performance.now()
  const response = await fetch('/api/ping', { cache: 'no-store' })
  const data = await response.json()
  return { rttMs: Math.round(performance.now() - started), httpStatus: response.status, ...data }
}

export async function rttTest(times = 20) {
  const samples = []
  for (let index = 0; index < times; index += 1)
    samples.push(await ping())
  const sorted = samples.map(sample => sample.rttMs).sort((a, b) => a - b)
  const pick = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))]
  return {
    first: samples[0]?.rttMs,
    min: sorted[0],
    p50: pick(0.5),
    p90: pick(0.9),
    max: sorted.at(-1),
    instances: [...new Set(samples.map(sample => `${sample.region}/${sample.id}`))],
    samples,
  }
}

export async function sessions() {
  const response = await fetch('/api/session')
  return { httpStatus: response.status, ...(await response.json()) }
}

export async function dropSlot(slot: string) {
  const response = await fetch('/api/session', { method: 'DELETE', body: JSON.stringify({ slot }) })
  return response.json()
}
