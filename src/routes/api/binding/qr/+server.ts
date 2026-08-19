import type { RequestEvent } from '@sveltejs/kit'
import { startQrBinding } from '$lib/server/binding'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { json } from '@sveltejs/kit'

/** 二维码绑定启动接口：获取 key 并生成二维码，路由层不承载业务逻辑 */
export const prerender = false

export async function GET(_event: RequestEvent) {
  try {
    const qr = await startQrBinding()
    return json(qr, { headers: { 'Cache-Control': 'no-store' } })
  }
  catch (err) {
    return ncmErrorJson(err, '获取绑定二维码失败')
  }
}
