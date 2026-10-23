import type { Cookies } from '@sveltejs/kit'
import type { Endpoint } from '#lib/api/endpoint.js'
import type { LoginCookie } from './credentials'
import type { Listener, SignedInListener } from './netease'
import { readLogin, renewalDue, saveLogin } from './credentials'
import { NeteaseError, renewLogin } from './netease'
import { errorResponse, withNetease } from './respond'

/** 登录 Cookie 里登录以后的部分 */
export type SignedIn = LoginCookie & { session: NonNullable<LoginCookie['session']> }

/**
 * 以登录的听众身份调网易云（Spec #11“客户端：登录会话”），续期成功就把新凭据写回登录 Cookie：
 * - renewIfDue：离上次续期满 24 小时就先续期。只给打开 App 时问当前账号的请求用：浏览器里它用 Web Locks 排队，
 *   同一浏览器的标签页不会同时续期；别的请求可能同时发出很多个，各自续期就不止一次了。
 *   续期没成功、但网易云没说需要登录（连不上、出错）时，接着用原来的凭据：它还能用，下次打开再续。
 * - 网易云说需要登录：续期一次，成功就带着新凭据重发；续期也没成功，就把续期的失败交给客户端。
 */
export async function asSignedIn<T>(cookies: Cookies, login: SignedIn, call: (listener: Listener) => Promise<T>, { renewIfDue = false } = {}): Promise<T> {
  let listener: SignedInListener = { deviceId: login.deviceId, credentials: login.session.credentials }
  let renewed = false
  async function renew(): Promise<void> {
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

/**
 * 要登录的接口：没有登录 Cookie 就回“需要登录”，不调网易云；有就以登录的听众身份调网易云，结果按端点的响应类型回 JSON。
 * 回调返回的东西和端点目录里那一条的响应类型对不上时编译不过
 */
export async function respondSignedIn<Value>(endpoint: Endpoint<Value>, cookies: Cookies, call: (listener: Listener) => NoInfer<Value> | Promise<NoInfer<Value>>): Promise<Response> {
  const login = readLogin(cookies)
  if (!login?.session)
    return errorResponse({ kind: 'needsLogin' })
  const signedIn = { ...login, session: login.session }
  return withNetease(endpoint, () => asSignedIn(cookies, signedIn, async listener => call(listener)))
}
