import type { WriteResponse } from '#lib/api/write.js'
import { describe, expect, it } from 'vitest'
import { post } from '#lib/api/endpoint.js'
import { createApi } from '#lib/app/api.js'

// Api.post 自己管 64 KiB keepalive 上限（#70）：请求体按 UTF-8 字节数算，正好 64 KiB 可以用 keepalive，
// 多一个字节就退回普通请求；other init（method/headers/body）不变。
// 这是 Api 模块的接缝：App 接缝的两条 >64 KiB 测试只能证明最终行为，测不到 65536/65537 的边界。

const endpoint = post<WriteResponse, { data: string }>(() => '/api/fake')

function setup() {
  const inits: RequestInit[] = []
  const api = createApi({
    fetch: async (_path: string, init?: RequestInit) => {
      inits.push(init ?? {})
      return new Response(JSON.stringify({ kind: 'done' }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
    network: {
      onLine: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  })
  return { api, inits }
}

/** JSON.stringify({ data }) 的长度是 data 长度 + 11（已核对 65525 -> 65536、65526 -> 65537） */
function bodyOf(dataLength: number): string {
  return JSON.stringify({ data: 'x'.repeat(dataLength) })
}

describe('api.post 的 keepalive 64 KiB 边界', () => {
  it('正好 65536 字节带 keepalive；65537 字节只去掉 keepalive，method/headers/body 不变', async () => {
    const { api, inits } = setup()

    const exact = bodyOf(65_525)
    expect(new TextEncoder().encode(exact).byteLength).toBe(64 * 1024)
    await api.post(endpoint, { data: 'x'.repeat(65_525) }, { keepalive: true })
    expect(inits[0]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: exact,
      keepalive: true,
    })

    const over = bodyOf(65_526)
    expect(new TextEncoder().encode(over).byteLength).toBe(64 * 1024 + 1)
    await api.post(endpoint, { data: 'x'.repeat(65_526) }, { keepalive: true })
    expect(inits[1]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: over,
      keepalive: false,
    })
  })
})
