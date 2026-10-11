import type { Outcome } from './netease-sdk'
import { readFile } from 'node:fs/promises'
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

// SDK 2.2.0 decodeUpstreamBody 的 codes：模块把哪些 body.code 算成功。没列出来的模块只有 200
const SUCCESS_CODES: Record<string, readonly number[]> = {
  login_qr_check: [800, 801, 802, 803],
}

// SDK 另外导出了结构定义的失败返回，按“模块:返回码”找
const REJECTION_SCHEMAS: Record<string, string> = {
  'login_cellphone:10004': 'LoginCellphoneRiskBody', // 短信登录被风控拦下
}

// Effect 的结构定义本身是函数，Standard Schema 接口挂在它的 ~standard 属性上
function isStandardSchema(value: unknown): value is StandardSchema {
  return (typeof value === 'object' || typeof value === 'function') && value !== null && '~standard' in value
}

function codeOf(body: unknown): unknown {
  return typeof body === 'object' && body !== null && 'code' in body ? body.code : undefined
}

// 照 SDK 2.2.0 判断失败（decodeUpstreamBody、normalizeFailure）：body.code 是数字且不在模块的成功码里，
// SDK 就抛出，status 在 101~599 时等于 code，否则是 400。录制数据是 SDK 1.4.0 录的，
// 录下的 status 不一定符合这个规矩（例如 status 200、code 400），所以只看 body.code
function failureStatus(module: string, code: unknown): number | undefined {
  if (typeof code !== 'number' || (SUCCESS_CODES[module] ?? [200]).includes(code))
    return undefined
  return code > 100 && code < 600 ? code : 400
}

/**
 * 读一份录制数据（tests/fixtures/netease/ 下的相对路径），照 SDK 2.2.0 的规矩决定替身是返回还是抛出，
 * 并先过 SDK 导出的结构定义校验，防止测试数据是猜的（Spec #11 Testing Decisions）。
 * - 成功：必须符合模块的结构定义 <模块名>Body；SDK 还没导出时直接报错。
 * - 失败：SDK 不校验失败返回的结构；另外导出了结构定义的（REJECTION_SCHEMAS）照样校验。
 */
export async function loadFixture(path: string): Promise<{ module: string, outcome: Outcome }> {
  const text = await readFile(new URL(`../fixtures/netease/${path}`, import.meta.url), 'utf8')
  const { module, response } = JSON.parse(text) as Fixture
  const code = codeOf(response.body)
  const failedWith = failureStatus(module, code)
  const rejected = failedWith !== undefined
  // 录制时去掉了 Cookie（Spec #11 交付方式第 5 条）
  const outcome = (body: unknown): { module: string, outcome: Outcome } =>
    ({ module, outcome: { rejected, response: { status: failedWith ?? response.status, body, cookie: [] } } })

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
