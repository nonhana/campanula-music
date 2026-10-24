import type { Cookies } from '@sveltejs/kit'

import type { Endpoint } from '#lib/api/endpoint.js'

import type { LoginCookie } from './credentials'
import { readLogin, renewalDue, saveLogin } from './credentials'
import type { Listener, SignedInListener } from './netease'
import { NeteaseError, renewLogin } from './netease'
import { errorResponse, withNetease } from './respond'

export type SignedIn = LoginCookie & { session: NonNullable<LoginCookie['session']> }

/**
 * 以登录的听众身份调网易云（Spec #11“客户端：登录会话”），续期成功就把新凭据写回登录 Cookie。
 * renewIfDue 只给打开 App 时问当前账号的请求用：它用 Web Locks 排队，同一浏览器的标签页不会同时续期；
 * 续期失败但不是需要登录时接着用原凭据。网易云说需要登录就续期一次再重发，续期也失败就把失败交给客户端。
 */
export const asSignedIn = async <T>(cookies: Cookies, login: SignedIn, call: (listener: Listener) => Promise<T>, { renewIfDue = false } = {}): Promise<T> => {
  let listener: SignedInListener = { deviceId: login.deviceId, credentials: login.session.credentials }
  let renewed = false
  const renew = async (): Promise<void> => {
    listener = { ...listener, credentials: await renewLogin(listener) }
    saveLogin(cookies, listener.deviceId, listener.credentials)
    renewed = true
  }
  const needsLogin = (error: unknown) => error instanceof NeteaseError && error.failure.kind === 'needsLogin'

  if (renewIfDue && renewalDue(login.session)) {
    await renew().catch((error: unknown) => {
      if (!(error instanceof NeteaseError) || needsLogin(error))
        throw error
    })
  }
  try {
    return await call(listener)
  }
  catch (error) {
    if (renewed || !needsLogin(error))
      throw error
    await renew()
    return call(listener)
  }
}

/** 没有登录 Cookie 就回“需要登录”，不调网易云；回调的返回和端点目录里那一条的响应类型对不上时编译不过 */
export const respondSignedIn = async <Value>(endpoint: Endpoint<Value>, cookies: Cookies, call: (listener: Listener) => NoInfer<Value> | Promise<NoInfer<Value>>): Promise<Response> => {
  const login = readLogin(cookies)
  if (!login?.session)
    return errorResponse({ kind: 'needsLogin' })
  const signedIn = { ...login, session: login.session }
  return withNetease(endpoint, () => asSignedIn(cookies, signedIn, async listener => call(listener)))
}
