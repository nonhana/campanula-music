import type { RequestFailure } from '#lib/app/api.js'

/** 一句话说清请求为什么没成功、能怎么办（文案平实，不卖萌） */
export function failureText(failure: RequestFailure): string {
  switch (failure.kind) {
    case 'offline':
      return '网络已断开，连上网络后再试。'
    case 'unreachable':
      return '连不上 Campanula 的服务器，可能是网络不稳定，稍后再试。'
    case 'serverError':
      return 'Campanula 的服务器出错了，稍后再试；一直这样的话，请告诉站长。'
    case 'neteaseUnavailable':
      return '网易云暂时没有回应，稍后再试。'
    case 'rateLimited':
      // 不写等几秒：retryAfter 多半是 SDK 在网易云没说时填的 30 秒（nonhana/hana-music-api#60），不是网易云说的
      return '网易云说操作太频繁，稍等一会儿再试。'
    case 'upstreamChanged':
      return '网易云返回的内容和 Campanula 认识的不一样了，需要升级 Campanula，请告诉站长。'
    case 'rejected':
      return failure.message ? `网易云说：${failure.message}` : `网易云拒绝了这次操作（返回码 ${failure.code}）。`
    case 'needsLogin':
      return '网易云说需要重新登录。'
    case 'cookieSecretMissing':
      return '站长还没有配置加密 Cookie 的密钥，暂时不能登录。'
    default: {
      const unhandled: never = failure
      throw new Error(`不认识的失败：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 取二维码、发验证码都要先向网易云匿名注册，会间歇性失败：网易云没回应时多说一句，让听众知道重试通常就好 */
export function loginFailureText(failure: RequestFailure): string {
  return failure.kind === 'neteaseUnavailable'
    ? '网易云暂时没有回应。登录前要先向网易云匿名注册，偶尔会失败，再试一次通常就好。'
    : failureText(failure)
}
