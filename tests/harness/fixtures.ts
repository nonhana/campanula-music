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

// 正常返回用模块自己的结构定义：模块 user_account 的导出名是 UserAccountBody
function schemaNameFor(module: string, rejected: boolean, code: unknown): string | undefined {
  if (rejected)
    return REJECTION_SCHEMAS[`${module}:${String(code)}`]
  return `${module.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join('')}Body`
}

/**
 * 读一份录制数据（tests/fixtures/netease/ 下的相对路径），先过 SDK 导出的结构定义校验，
 * 防止测试数据是猜的（Spec #11 Testing Decisions）。
 *
 * 录下的 status 是 SDK 给的：正常返回时是 2xx；网易云拒绝、上游出错、超时时 SDK 抛出
 * { status, cookie, body }，status 不是 2xx，替身也照样抛出。
 * - 正常返回：必须符合模块的结构定义；SDK 还没导出时直接报错。
 * - 失败返回：SDK 另外导出了结构定义的（见 REJECTION_SCHEMAS）必须符合它；
 *   其余 SDK 不校验结构，只保证 body.code 是数字。
 */
export async function loadFixture(path: string): Promise<{ module: string, outcome: Outcome }> {
  const text = await readFile(new URL(`../fixtures/netease/${path}`, import.meta.url), 'utf8')
  const { module, response: { status, body } } = JSON.parse(text) as Fixture
  const rejected = status < 200 || status >= 300
  const code = codeOf(body)
  // 录制时去掉了 Cookie（Spec #11 交付方式第 5 条）
  const outcome = (validated: unknown): { module: string, outcome: Outcome } =>
    ({ module, outcome: { rejected, response: { status, body: validated, cookie: [] } } })

  const name = schemaNameFor(module, rejected, code)
  if (!name) {
    if (typeof code !== 'number')
      throw new Error(`录制数据 ${path} 是失败返回，但 body.code 不是数字（${String(code)}）`)
    return outcome(body)
  }

  const schema: unknown = (sdk as Record<string, unknown>)[name]
  if (!isStandardSchema(schema))
    throw new Error(`hana-music-api 没有导出 ${name}，录制数据 ${path}（${module}）没法校验`)
  const result = await schema['~standard'].validate(body)
  if (result.issues) {
    const issues = result.issues.map(({ message, path = [] }) =>
      `  ${path.map(key => String(typeof key === 'object' ? key.key : key)).join('.')}: ${message}`)
    throw new Error(`录制数据 ${path} 不符合 SDK 的结构定义 ${name}：\n${issues.join('\n')}`)
  }
  return outcome(result.value)
}
