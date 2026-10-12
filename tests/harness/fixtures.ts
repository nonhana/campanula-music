import type { Outcome } from './netease-sdk'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import * as sdk from 'hana-music-api'

// Standard Schema 接口（https://standardschema.dev），SDK 导出的结构定义只承诺这一层（ADR-0005）
interface StandardSchema {
  '~standard': {
    validate: (value: unknown) => StandardResult | Promise<StandardResult>
  }
}

type StandardResult
  = | { value: unknown, issues?: undefined }
    | { issues: readonly { message: string, path?: readonly (PropertyKey | { key: PropertyKey })[] }[] }

interface Fixture {
  module: string
  response: { status: number, body: unknown }
}

// SDK 2.4.0 decodeUpstreamBody 的 codes：模块把哪些 body.code 算成功。没列出来的模块只有 200
const SUCCESS_CODES: Record<string, readonly number[]> = {
  login_qr_check: [800, 801, 802, 803],
}

// SDK 另外导出了结构定义的失败返回，按“模块:返回码”找
const REJECTION_SCHEMAS: Record<string, string> = {
  'login_cellphone:10004': 'LoginCellphoneRiskBody', // 短信登录被风控拦下
}

/**
 * 网易云限流时 SDK 建议等多久（秒）。SDK 2.4.0 的 retryAfterMs 读响应头 Retry-After，没有就是 30 秒；
 * 录制数据没有收录响应头，所以都按没有
 */
const DEFAULT_RETRY_AFTER = 30

// Effect 的结构定义本身是函数，Standard Schema 接口挂在它的 ~standard 属性上
function isStandardSchema(value: unknown): value is StandardSchema {
  return (typeof value === 'object' || typeof value === 'function') && value !== null && '~standard' in value
}

function field(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null && name in body ? (body as Record<string, unknown>)[name] : undefined
}

// 照 SDK 2.4.0 判断失败（decodeUpstreamBody、normalizeFailure）：body.code 是数字且不在模块的成功码里，
// SDK 就抛出，status 在 101~599 时等于 code，否则是 400。录制数据有的是 SDK 1.4.0 录的，
// 录下的 status 不一定符合这个规矩（例如 status 200、code 400），所以只看 body.code
function failureStatus(module: string, code: unknown): number | undefined {
  if (typeof code !== 'number' || (SUCCESS_CODES[module] ?? [200]).includes(code))
    return undefined
  return code > 100 && code < 600 ? code : 400
}

// 照 SDK 2.4.0 classifyConsumedRateLimit 认出网易云限流：返回码 429，或 405 且说明里有“操作频繁”“操作过于频繁”
function rateLimited(code: unknown, body: unknown): boolean {
  const message = field(body, 'msg') ?? field(body, 'message')
  return code === 429 || (code === 405 && typeof message === 'string' && /操作(?:过于)?频繁/.test(message))
}

/** 录制数据的文件：以 .gz 结尾的是 gzip 压缩的（几千首的整页录制，见 tests/fixtures/netease/README.md） */
async function readFixture(path: string): Promise<Fixture> {
  const bytes = await readFile(new URL(`../fixtures/netease/${path}`, import.meta.url))
  return JSON.parse((path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8')) as Fixture
}

async function load(path: string): Promise<{ module: string, outcome: Outcome }> {
  const { module, response } = await readFixture(path)
  const code = field(response.body, 'code')
  const failedWith = failureStatus(module, code)
  const rejected = failedWith !== undefined
  // 录制时去掉了 Cookie（Spec #11 交付方式第 5 条）
  const outcome = (body: unknown): { module: string, outcome: Outcome } =>
    ({ module, outcome: { rejected, response: { status: failedWith ?? response.status, body, cookie: [] } } })

  if (rejected && rateLimited(code, response.body))
    return outcome({ ...(response.body as object), retryAfter: DEFAULT_RETRY_AFTER })
  const name = rejected
    ? REJECTION_SCHEMAS[`${module}:${String(code)}`]
    : `${module.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join('')}Body`
  if (!name)
    return outcome(response.body)

  const schema: unknown = (sdk as Record<string, unknown>)[name]
  if (!isStandardSchema(schema))
    throw new Error(`hana-music-api 没有导出 ${name}，录制数据 ${path}（${module}）没法校验`)
  const result = await schema['~standard'].validate(response.body)
  if (result.issues) {
    const issues = result.issues.map(({ message, path = [] }) =>
      `  ${path.map(key => String(typeof key === 'object' ? key.key : key)).join('.')}: ${message}`)
    throw new Error(`录制数据 ${path} 不符合 SDK 的结构定义 ${name}：\n${issues.join('\n')}`)
  }
  return outcome(result.value)
}

/** 读过的录制数据：几 MB 的整页录制每条测试都要用好几次，只读、只校验一次（替身每次回之前会复制一份） */
const loaded = new Map<string, Promise<{ module: string, outcome: Outcome }>>()

/**
 * 读一份录制数据（tests/fixtures/netease/ 下的相对路径），照 SDK 2.4.0 的规矩决定替身是返回还是抛出，
 * 并先过 SDK 导出的结构定义校验，防止测试数据是猜的（Spec #11 Testing Decisions）。
 * - 成功：必须符合模块的结构定义 <模块名>Body；SDK 还没导出时直接报错。
 * - 失败：SDK 不校验失败返回的结构；另外导出了结构定义的（REJECTION_SCHEMAS）照样校验。
 *   网易云限流的失败，像 SDK 一样在 body 里加上 retryAfter。
 */
export function loadFixture(path: string): Promise<{ module: string, outcome: Outcome }> {
  let fixture = loaded.get(path)
  if (!fixture) {
    fixture = load(path)
    loaded.set(path, fixture)
  }
  return fixture
}
