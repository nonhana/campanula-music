import type { RequestEvent } from '@sveltejs/kit'
import { resolveBindingStatus } from '$lib/server/binding'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { json } from '@sveltejs/kit'

/** 绑定心跳接口：绑定状态实时判定，路由层不承载业务逻辑 */
export const prerender = false

export async function GET(_event: RequestEvent) {
  try {
    const status = await resolveBindingStatus()
    return json(status, { headers: { 'Cache-Control': 'no-store' } })
  }
  catch (err) {
    return ncmErrorJson(err, '绑定状态检查失败')
  }
}
