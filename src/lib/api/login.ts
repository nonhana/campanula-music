import type { Account } from './account';

export interface QrResponse {
  key: string;
  // data: 地址的 PNG
  image: string;
}

export interface QrCheckRequest {
  key: string;
}

export type QrCheckResponse =
  | { status: 'waiting' }
  | { status: 'scanned'; nickname: string | null; avatarUrl: string | null }
  | { status: 'expired' }
  // 要先用网易云 App 扫这张图做行为验证，验证完再查一次
  | { status: 'needsVerification'; image: string }
  | { status: 'signedIn'; account: Account };

export interface CaptchaRequest {
  phone: string;
}

export interface CaptchaResponse {
  sent: true;
}

export interface SmsLoginRequest {
  phone: string;
  captcha: string;
}

export interface SmsLoginResponse {
  account: Account;
}

export interface LogoutResponse {
  signedOut: true;
}

export const PHONE = /^1\d{10}$/;
export const CAPTCHA = /^\d{4,6}$/;

export type PhoneProblem = 'phoneEmpty' | 'phoneFormat';
export type CaptchaProblem = 'captchaEmpty' | 'captchaFormat';

export const phoneProblem = (phone: string): PhoneProblem | null => {
  if (!phone) return 'phoneEmpty';
  return PHONE.test(phone) ? null : 'phoneFormat';
};

export const captchaProblem = (captcha: string): CaptchaProblem | null => {
  if (!captcha) return 'captchaEmpty';
  return CAPTCHA.test(captcha) ? null : 'captchaFormat';
};
