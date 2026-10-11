import type { Account } from './account'

// 登录和退出的接口（Spec #11“服务端：Campanula API”的登录部分）。出错时都回 ErrorBody

/** POST /api/login/qr：一张新的登录二维码 */
export interface QrResponse {
  /** 查询扫码状态时带上 */
  key: string
  /** 二维码图片（data: 地址的 PNG） */
  image: string
}

/** POST /api/login/qr/check 的请求 */
export interface QrCheckRequest {
  key: string
}

/** POST /api/login/qr/check：扫码状态。登录成功时服务端已经设好登录 Cookie */
export type QrCheckResponse
  = | { status: 'waiting' }
  /** 已扫码，等听众在手机上确认；带着扫码的网易云账号的昵称和头像 */
    | { status: 'scanned', nickname: string, avatarUrl: string }
    | { status: 'expired' }
  /** 网易云要求先完成行为验证（8821）：用网易云 App 扫这张图，在手机上验证完再查一次 */
    | { status: 'needsVerification', image: string }
    | { status: 'signedIn', account: Account }

/** POST /api/login/captcha 的请求：只支持中国大陆手机号（+86） */
export interface CaptchaRequest {
  phone: string
}

export interface CaptchaResponse {
  sent: true
}

/** POST /api/login/sms 的请求 */
export interface SmsLoginRequest {
  phone: string
  captcha: string
}

/** POST /api/login/sms：登录成功，服务端已经设好登录 Cookie */
export interface SmsLoginResponse {
  account: Account
}

/** POST /api/logout：服务端已经回了过期的登录 Cookie */
export interface LogoutResponse {
  signedOut: true
}
