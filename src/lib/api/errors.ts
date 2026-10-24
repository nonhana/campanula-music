/** Campanula 的错误约定（Spec #11“服务端：网易云适配层”）：服务端把网易云的结果翻译成这几类，客户端只认这几类；出错的接口回 ErrorBody（状态码见 respond.ts） */
export type NeteaseFailure
  /** 需要登录：网易云回 301，或凭据已经失效、只剩匿名身份 */
  = | { kind: 'needsLogin' }
  /** 操作频繁：网易云要求 retryAfter 秒后再试 */
    | { kind: 'rateLimited', retryAfter: number }
  /** 上游结构变了：网易云的返回和 SDK 认识的不一样 */
    | { kind: 'upstreamChanged' }
  /** 网络或超时：连不上网易云、网易云没回应或自己出了错（包括匿名注册失败） */
    | { kind: 'neteaseUnavailable' }
  /** 业务上的拒绝：原样带上网易云的返回码和说明（可能没有说明） */
    | { kind: 'rejected', code: number, message: string }

/** 站长没有配置加密 Cookie 的密钥（或太短），服务端什么都做不了 */
interface CookieSecretMissing {
  kind: 'cookieSecretMissing'
}

export type ApiError = NeteaseFailure | CookieSecretMissing

/** 出错的接口回的正文 */
export interface ErrorBody {
  error: ApiError
}
