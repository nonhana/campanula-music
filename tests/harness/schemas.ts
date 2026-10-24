import * as sdk from 'hana-music-api'

// SDK 导出的结构定义只承诺 Standard Schema 接口（ADR-0005）。mock 的合成返回也要过这一层。
export const validateBody = async (name: string, body: unknown): Promise<void> => {
  const schema = (sdk as Record<string, unknown>)[name]
  if (!schema || (typeof schema !== 'object' && typeof schema !== 'function'))
    throw new Error(`hana-music-api 没有导出 ${name}`)
  const result = await (schema as { '~standard': { validate: (value: unknown) => Promise<{ issues?: { message: string, path?: { key: PropertyKey }[] }[] }> } })[
    '~standard'
  ].validate(body)
  if (result.issues) {
    const detail = result.issues.map(issue => `${issue.path?.map(key => String(key.key)).join('.') ?? ''}: ${issue.message}`).join('\n')
    throw new Error(`${name} 不符合 SDK 的结构定义：\n${detail}`)
  }
}
