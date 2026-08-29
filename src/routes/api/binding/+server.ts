import type { RequestEvent } from '@sveltejs/kit'
import { clearBoundUser } from '$lib/server/binding'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { json } from '@sveltejs/kit'

/** 解绑接口实时调用门面，不走预渲染 */
export const prerender = false

/** 解绑：删除本地凭据，应用回到未绑定引导（重新扫码即可再绑定） */
export async function DELETE(_event: RequestEvent) {
  try {
    await clearBoundUser()
    return json({ status: 'unbound' })
  }
  catch (err) {
    return ncmErrorJson(err, '解绑失败')
  }
}
