import type { RequestEvent } from '@sveltejs/kit'
import { pollQrBinding } from '$lib/server/binding'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { json } from '@sveltejs/kit'

/** 扫码状态轮询接口：确认即写凭据，路由层不承载业务逻辑 */
export const prerender = false

export async function GET({ url }: RequestEvent) {
  const key = (url.searchParams.get('key') ?? '').trim()
  if (!key) {
    return json({ error: { code: 'INVALID_PARAMS', message: '缺少有效的 key 参数' } }, { status: 400 })
  }

  try {
    const result = await pollQrBinding(key)
    return json(result, { headers: { 'Cache-Control': 'no-store' } })
  }
  catch (err) {
    return ncmErrorJson(err, '扫码状态检查失败')
  }
}
