import { Buffer } from 'node:buffer';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

import { COOKIE_SECRET, LOGIN_COOKIE_NAME } from '$app/env/private';
import type { Cookies } from '@sveltejs/kit';
import { generateDeviceId } from 'hana-music-api';

export interface LoginCookie {
  deviceId: string;
  session: {
    credentials: Record<string, string>;
    renewedAt: number;
  } | null;
}

const COOKIE_NAME = LOGIN_COOKIE_NAME;
// 名字加值超过 4096 字节的 Cookie 浏览器会悄悄丢掉
const MAX_COOKIE_BYTES = 4096;
const RENEW_INTERVAL_MS = 24 * 3600_000;
export const MIN_SECRET_LENGTH = 32;
const OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 400 * 24 * 3600, // Chrome 允许的最长有效期
} as const;

export const cookieSecretConfigured = (): boolean =>
  COOKIE_SECRET.length >= MIN_SECRET_LENGTH;

const key = (): Buffer => {
  const secret = COOKIE_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH)
    throw new Error('没有配置 COOKIE_SECRET，不能加密登录 Cookie');
  return Buffer.from(
    hkdfSync('sha256', secret, '', 'campanula login cookie', 32),
  );
};

const seal = (login: LoginCookie): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(login), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, data, cipher.getAuthTag()]).toString('base64url');
};

const unseal = (value: string): LoginCookie | null => {
  const raw = Buffer.from(value, 'base64url');
  if (raw.length < 12 + 16) return null;
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key(),
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const text = Buffer.concat([
      decipher.update(raw.subarray(12, raw.length - 16)),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(text) as LoginCookie;
  } catch {
    return null;
  }
};

export const readLogin = (cookies: Cookies): LoginCookie | null => {
  const value = cookies.get(COOKIE_NAME);
  return value ? unseal(value) : null;
};

const sealedValue = (login: LoginCookie): string => {
  const value = seal(login);
  const bytes = COOKIE_NAME.length + 1 + value.length;
  if (bytes > MAX_COOKIE_BYTES)
    throw new Error(
      `登录 Cookie 有 ${bytes} 字节，超过浏览器的上限 ${MAX_COOKIE_BYTES}，存不进去`,
    );
  return value;
};

const cookieAttributes = (): string =>
  [
    `Path=${OPTIONS.path}`,
    OPTIONS.httpOnly && 'HttpOnly',
    `SameSite=${OPTIONS.sameSite}`,
    `Max-Age=${OPTIONS.maxAge}`,
    OPTIONS.secure && 'Secure',
  ]
    .filter(Boolean)
    .join('; ');

const writeLogin = (cookies: Cookies, login: LoginCookie): void => {
  cookies.set(COOKIE_NAME, sealedValue(login), OPTIONS);
};

export const saveLogin = (
  cookies: Cookies,
  deviceId: string,
  credentials: Record<string, string>,
): void => {
  writeLogin(cookies, {
    deviceId,
    session: {
      credentials,
      renewedAt: Date.now(),
    },
  });
};

export const loginCookieHeader = (
  deviceId: string,
  credentials: Record<string, string>,
): string => {
  const value = sealedValue({
    deviceId,
    session: {
      credentials,
      renewedAt: Date.now(),
    },
  });
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; ${cookieAttributes()}`;
};

export const renewalDue = (
  session: NonNullable<LoginCookie['session']>,
): boolean => Date.now() - session.renewedAt >= RENEW_INTERVAL_MS;

export const clearLogin = (cookies: Cookies): void => {
  cookies.delete(COOKIE_NAME, OPTIONS);
};

export const deviceIdFor = (cookies: Cookies): string => {
  const login = readLogin(cookies);
  if (login) return login.deviceId;
  const deviceId = generateDeviceId();
  writeLogin(cookies, { deviceId, session: null });
  return deviceId;
};
