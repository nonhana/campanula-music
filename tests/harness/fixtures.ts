import type { Outcome } from './netease-sdk'
import * as sdk from 'hana-music-api'
import { field, fixtureOutcome } from '#lib/server/mock/fixture-format.js'
import { readFixture } from '#lib/server/mock/read-fixture.js'

// Standard Schema 接口（https://standardschema.dev），SDK 导出的结构定义只承诺这一层（ADR-0005）
interface StandardSchema {
  '~standard': {
    validate: (value: unknown) => StandardResult | Promise<StandardResult>
  }
}

type StandardResult
  = | { value: unknown, issues?: undefined }
    | { issues: readonly { message: string, path?: readonly (PropertyKey | { key: PropertyKey })[] }[] }

// SDK 另外导出了结构定义的失败返回，按“模块:返回码”找
const REJECTION_SCHEMAS: Record<string, string> = {
  'login_cellphone:10004': 'LoginCellphoneRiskBody', // 短信登录被风控拦下
}

// Effect 的结构定义本身是函数，Standard Schema 接口挂在它的 ~standard 属性上
function isStandardSchema(value: unknown): value is StandardSchema {
  return (typeof value === 'object' || typeof value === 'function') && value !== null && '~standard' in value
}

async function load(path: string): Promise<{ module: string, outcome: Outcome }> {
  const raw = await readFixture(path)
  const { module } = raw
  const { rejected, response } = fixtureOutcome(module, raw.response)
  const code = field(response.body, 'code')
  // 录制时去掉了 Cookie（Spec #11 交付方式第 5 条）
  const outcome = (body: unknown): { module: string, outcome: Outcome } =>
    ({ module, outcome: { rejected, response: { status: response.status, body, cookie: [] } } })

  if (response.retryAfter !== undefined)
    return outcome(response.body)
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
