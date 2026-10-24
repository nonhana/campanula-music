import type { Account } from './account'

// 登录和退出的接口（Spec #11“服务端：Campanula API”的登录部分）。出错时都回 ErrorBody

/** 一张新的登录二维码 */
export interface QrResponse {
  /** 查询扫码状态时带上 */
  key: string
  /** 二维码图片（data: 地址的 PNG） */
  image: string
}

/** 查询扫码状态的请求 */
export interface QrCheckRequest {
  key: string
}

/** 扫码状态。登录成功时服务端已经设好登录 Cookie */
export type QrCheckResponse
  = | { status: 'waiting' }
  /** 已扫码，等听众在手机上确认；带着扫码的网易云账号的昵称和头像 */
    | { status: 'scanned', nickname: string, avatarUrl: string }
    | { status: 'expired' }
  /** 网易云要求先完成行为验证（8821）：用网易云 App 扫这张图，在手机上验证完再查一次 */
    | { status: 'needsVerification', image: string }
    | { status: 'signedIn', account: Account }

/** 发短信验证码的请求：只支持中国大陆手机号（+86） */
export interface CaptchaRequest {
  phone: string
}

export interface CaptchaResponse {
  sent: true
}

/** 短信验证码登录的请求 */
export interface SmsLoginRequest {
  phone: string
  captcha: string
}

/** 短信验证码登录成功，服务端已经设好登录 Cookie */
export interface SmsLoginResponse {
  account: Account
}

/** 退出登录：服务端已经回了过期的登录 Cookie */
export interface LogoutResponse {
  signedOut: true
}

/** 中国大陆手机号（+86）：1 开头的 11 位数字 */
export const PHONE = /^1\d{10}$/
/** 短信验证码：4 到 6 位数字 */
export const CAPTCHA = /^\d{4,6}$/

export type PhoneProblem = 'phoneEmpty' | 'phoneFormat'
export type CaptchaProblem = 'captchaEmpty' | 'captchaFormat'

/** 手机号不能提交的原因；能提交是 null。界面和服务端共用这一条 */
export const phoneProblem = (phone: string): PhoneProblem | null => {
  if (!phone)
    return 'phoneEmpty'
  return PHONE.test(phone)
    ? null
    : 'phoneFormat'
}

/** 验证码不能提交的原因；能提交是 null。界面和服务端共用这一条 */
export const captchaProblem = (captcha: string): CaptchaProblem | null => {
  if (!captcha)
    return 'captchaEmpty'
  return CAPTCHA.test(captcha)
    ? null
    : 'captchaFormat'
}
