import type {
  ModuleCallConfig,
  ModuleResponseOf,
  UserAccountBody,
} from 'hana-music-api';
import {
  captchaSent,
  isNcmApiResponse,
  loginCellphone,
  loginQrCheck,
  loginQrCreate,
  loginQrKey,
  loginRefresh,
  logout as neteaseLogout,
  userAccount,
  verifyGetQr,
} from 'hana-music-api';

import type { Account } from '#lib/api/account.js';
import type { QrResponse } from '#lib/api/login.js';

import { credentialsFrom } from './cookies';
import { isRecord, NeteaseError, rejection } from './failure';

export const createLoginQr = async (
  config: ModuleCallConfig,
): Promise<QrResponse> => {
  const {
    body: {
      data: { unikey: key },
    },
  } = await loginQrKey({}, config);
  const { body } = await loginQrCreate({ key, qrimg: true }, config);
  return { key, image: body.data.qrimg };
};

export type QrCheck =
  | {
      status: 'waiting';
    }
  | {
      status: 'scanned';
      nickname: string | null;
      avatarUrl: string | null;
    }
  | {
      status: 'expired';
    }
  | {
      status: 'needsVerification';
      image: string;
    }
  | {
      status: 'confirmed';
      credentials: Record<string, string>;
    };

const verificationOf = (
  body: unknown,
): {
  vid: string;
  type: number;
  token: string;
  evid: string;
  sign: string;
} | null => {
  const data = isRecord(body) && isRecord(body.data) ? body.data : null;
  if (!data) return null;
  let params: unknown = data.params;
  if (typeof params === 'string') {
    try {
      params = JSON.parse(params);
    } catch {
      return null;
    }
  }
  const { verifyId, verifyType, verifyToken } = data;
  const isId = (value: unknown) =>
    typeof value === 'string' || typeof value === 'number';
  if (
    !isId(verifyId) ||
    !isId(verifyType) ||
    !Number.isSafeInteger(Number(verifyType)) ||
    typeof verifyToken !== 'string' ||
    !verifyToken ||
    !isRecord(params) ||
    typeof params.event_id !== 'string' ||
    typeof params.sign !== 'string'
  ) {
    return null;
  }
  return {
    vid: String(verifyId),
    type: Number(verifyType),
    token: verifyToken,
    evid: params.event_id,
    sign: params.sign,
  };
};

export const checkLoginQr = async (
  key: string,
  config: ModuleCallConfig,
): Promise<QrCheck> => {
  let response: ModuleResponseOf<'login_qr_check'>;
  try {
    response = await loginQrCheck({ key }, config);
  } catch (error) {
    if (!(rejection(error)?.code === 8821)) throw error;
    const verification = verificationOf(
      isNcmApiResponse(error) ? error.body : null,
    );
    if (!verification) throw error;
    const { body } = await verifyGetQr(verification, config);
    return { status: 'needsVerification', image: body.data.qrimg };
  }
  const { body, cookie } = response;
  switch (body.code) {
    case 800:
      return { status: 'expired' };
    case 801:
      return { status: 'waiting' };
    case 802:
      return {
        status: 'scanned',
        nickname: body.nickname ?? null,
        avatarUrl: body.avatarUrl ?? null,
      };
    case 803:
      return {
        status: 'confirmed',
        credentials: credentialsFrom('login_qr_check', cookie),
      };
    default: {
      const unhandled: never = body;
      throw new Error(`不认识的扫码状态：${JSON.stringify(unhandled)}`);
    }
  }
};

export const sendCaptcha = async (
  phone: string,
  config: ModuleCallConfig,
): Promise<void> => {
  await captchaSent({ phone, ctcode: 86 }, config);
};

const accountOf = (
  profile: NonNullable<UserAccountBody['profile']>,
): Account => ({
  id: profile.userId,
  nickname: profile.nickname ?? null,
  avatarUrl: profile.avatarUrl ?? null,
});

export const loginWithCaptcha = async (
  phone: string,
  captcha: string,
  config: ModuleCallConfig,
): Promise<{
  credentials: Record<string, string>;
  account: Account;
}> => {
  const { body, cookie } = await loginCellphone(
    { phone, captcha, countrycode: 86 },
    config,
  );
  return {
    credentials: credentialsFrom('login_cellphone', cookie),
    account: accountOf(body.profile),
  };
};

export const fetchAccount = async (
  config: ModuleCallConfig,
): Promise<Account> => {
  const { body } = await userAccount({}, config);
  if (!body.account || body.account.anonimousUser || !body.profile)
    throw new NeteaseError({ kind: 'needsLogin' });
  return accountOf(body.profile);
};

export const renewLogin = async (
  config: ModuleCallConfig,
): Promise<string[]> => {
  const { cookie } = await loginRefresh({}, config);
  return cookie;
};

export const logout = async (config: ModuleCallConfig): Promise<void> => {
  await neteaseLogout({}, config);
};
