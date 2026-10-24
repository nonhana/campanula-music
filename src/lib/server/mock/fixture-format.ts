// 录制数据的读取和成败判断，测试替身和 mock 共用（tests/harness/fixtures.ts 只在这里之外做 SDK 结构定义校验）。
// 照 SDK 2.4.0 的 decodeUpstreamBody、normalizeFailure，以及 SDK 2.7.1 的 classifyConsumedRateLimit。

export interface RawFixture {
  module: string
  query?: unknown
  response: { status: number, body: unknown }
}

// SDK 2.4.0 decodeUpstreamBody 的 codes：模块把哪些 body.code 算成功。没列出来的模块只有 200
const SUCCESS_CODES: Record<string, readonly number[]> = {
  login_qr_check: [800, 801, 802, 803],
}

/**
 * 网易云限流时 SDK 建议等多久（秒）。SDK 2.4.0 的 retryAfterMs 读响应头 Retry-After，没有就是 30 秒；
 * 录制数据没有收录响应头，所以都按没有
 */
const DEFAULT_RETRY_AFTER = 30

export function field(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null && name in body
    ? (body as Record<string, unknown>)[name]
    : undefined
}

/**
 * 照 SDK 2.4.0 判断失败（decodeUpstreamBody、normalizeFailure）：body.code 是数字且不在模块的成功码里，
 * SDK 就抛出，status 在 101~599 时等于 code，否则是 400。录制数据有的是 SDK 1.4.0 录的，
 * 录下的 status 不一定符合这个规矩（例如 status 200、code 400），所以只看 body.code
 */
function failureStatus(module: string, code: unknown): number | undefined {
  if (typeof code !== 'number' || (SUCCESS_CODES[module] ?? [200]).includes(code))
    return undefined
  return code > 100 && code < 600
    ? code
    : 400
}

/**
 * 照 SDK 2.7.1 classifyConsumedRateLimit 认出网易云限流：返回码 429，或 405 且说明里有“操作频繁”“操作过于频繁”
 * （不看 HTTP 状态）
 */
function rateLimited(code: unknown, body: unknown): boolean {
  const message = field(body, 'msg') ?? field(body, 'message')
  return code === 429 || (code === 405 && typeof message === 'string' && /操作(?:过于)?频繁/.test(message))
}

/**
 * SDK 1.4.0 的 playlist_tracks 把返回多包了一层 { status, body: { code, … }, cookie }（tests/fixtures/netease/README.md）。
 * SDK 2.x 的 decodeResponse 遇到这层就取里面的 body 再判断成败、校验结构，这里照做：录制文件保持原样
 */
function unwrapped(module: string, body: unknown): unknown {
  const inner = module === 'playlist_tracks'
    ? field(body, 'body')
    : undefined
  return typeof inner === 'object' && inner !== null
    ? inner
    : body
}

/** 一次录制的成败：失败时 status/body 照 SDK 抛出的样子，限流再加上 retryAfter（秒） */
export interface FixtureOutcome {
  rejected: boolean
  response: { status: number, body: unknown, retryAfter?: number }
}

/** 把一份录制文件（已经解压、解过外层包装）换成 SDK 会返回或抛出的样子 */
export function fixtureOutcome(module: string, response: { status: number, body: unknown }): FixtureOutcome {
  const body = unwrapped(module, response.body)
  const code = field(body, 'code')
  const failedWith = failureStatus(module, code)
  const rejected = failedWith !== undefined
  const status = failedWith ?? response.status
  if (rejected && rateLimited(code, body)) {
    return {
      rejected,
      response: {
        status,
        body: { ...(body as object), retryAfter: DEFAULT_RETRY_AFTER },
        retryAfter: DEFAULT_RETRY_AFTER,
      },
    }
  }
  return {
    rejected,
    response: { status, body },
  }
}
