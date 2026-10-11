import type { Reply } from './netease-sdk'
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

// Effect 的结构定义本身是函数，Standard Schema 接口挂在它的 ~standard 属性上
function isStandardSchema(value: unknown): value is StandardSchema {
  return (typeof value === 'object' || typeof value === 'function') && value !== null && '~standard' in value
}

// 模块 user_account 的结构定义导出名是 UserAccountBody
function schemaFor(module: string): StandardSchema | undefined {
  const name = `${module.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join('')}Body`
  const value: unknown = (sdk as Record<string, unknown>)[name]
  return isStandardSchema(value) ? value : undefined
}

/**
 * 读一份录制数据（tests/fixtures/netease/ 下的相对路径），先过 SDK 导出的结构定义校验，
 * 防止测试数据是猜的（Spec #11 Testing Decisions）。SDK 还没有导出这个模块的结构定义时直接报错。
 */
export async function loadFixture(path: string): Promise<{ module: string, reply: Reply }> {
  const text = await readFile(new URL(`../fixtures/netease/${path}`, import.meta.url), 'utf8')
  const fixture = JSON.parse(text) as Fixture
  const schema = schemaFor(fixture.module)
  if (!schema)
    throw new Error(`hana-music-api 没有导出 ${fixture.module} 的结构定义，录制数据 ${path} 没法校验`)

  const result = await schema['~standard'].validate(fixture.response.body)
  if (result.issues) {
    const issues = result.issues.map(({ message, path = [] }) =>
      `  ${path.map(key => String(typeof key === 'object' ? key.key : key)).join('.')}: ${message}`)
    throw new Error(`录制数据 ${path} 不符合 SDK 的结构定义：\n${issues.join('\n')}`)
  }
  // 录制时去掉了 Cookie（Spec #11 交付方式第 5 条）
  return { module: fixture.module, reply: { status: fixture.response.status, body: result.value, cookie: [] } }
}
