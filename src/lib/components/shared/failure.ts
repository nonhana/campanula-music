import type { RequestFailure } from '#lib/app/api-client.js'

/** 一个原因短语，不带下一步、不带句号（DESIGN.md 文案）；调用处写“没能 + 动作：原因”，“重试”交给旁边的按钮 */
export const failureText = (failure: RequestFailure): string => {
  switch (failure.kind) {
    case 'offline':
      return '网络已断开'
    case 'unreachable':
      return '连不上 Campanula 的服务器'
    case 'serverError':
      return 'Campanula 的服务器出错了'
    case 'neteaseUnavailable':
      return '网易云没有回应'
    case 'rateLimited':
      // 不写等几秒：retryAfter 多半是 SDK 在网易云没说时填的 30 秒（nonhana/hana-music-api#60），不是网易云说的
      return '操作太频繁，等一会儿再试'
    case 'upstreamChanged':
      // 重试解决不了，只能站长升级
      return 'Campanula 需要升级，请告诉站长'
    case 'rejected':
      return failure.message
        ? `网易云说：${failure.message}`
        : `网易云拒绝了这次操作（${failure.code}）`
    case 'needsLogin':
      return '需要重新登录'
    case 'cookieSecretMissing':
      return '站长还没配置好，暂时不能登录'
    default: {
      const unhandled: never = failure
      throw new Error(`不认识的失败：${JSON.stringify(unhandled)}`)
    }
  }
}
