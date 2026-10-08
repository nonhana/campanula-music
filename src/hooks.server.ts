import type { Handle, HandleServerError } from '@sveltejs/kit'
import { hasPass } from '$lib/server/session'
import { json } from '@sveltejs/kit'

/** 除了输口令的接口，所有 /api 都要先有口令 Cookie。页面壳子本身不含任何数据。 */
export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname
  if (path.startsWith('/api/') && path !== '/api/pass' && !hasPass(event.cookies))
    return json({ error: '需要口令' }, { status: 401, headers: { 'X-Robots-Tag': 'noindex' } })
  const response = await resolve(event)
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  if (path.startsWith('/api/'))
    response.headers.set('Cache-Control', 'no-store')
  return response
}

/** 日志只记错误类型和路径，不记请求体（手机号、验证码在请求体里）。 */
export const handleError: HandleServerError = ({ error, event, status }) => {
  const name = error instanceof Error ? error.name : typeof error
  console.error(`[gate] ${status} ${event.request.method} ${event.url.pathname} ${name}`)
  return { message: '出错了' }
}
