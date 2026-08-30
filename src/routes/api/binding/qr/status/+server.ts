import type { RequestEvent } from '@sveltejs/kit'
import { pollQrBinding } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { json } from '@sveltejs/kit'

/** 扫码状态轮询接口：key 与当前会话不一致时按「二维码已过期」拒绝，路由层不承载业务逻辑 */
export const prerender = false

export async function GET({ url }: RequestEvent) {
  const key = (url.searchParams.get('key') ?? '').trim()
  if (!key) {
    return ncmErrorJson(new NcmError('INVALID_PARAMS', '缺少有效的 key 参数'), '请求参数不合法')
  }

  try {
    const result = await pollQrBinding(key)
    return json(result, { headers: { 'Cache-Control': 'no-store' } })
  }
  catch (err) {
    return ncmErrorJson(err, '扫码状态检查失败')
  }
}
