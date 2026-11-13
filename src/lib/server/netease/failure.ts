import { getNcmFailureInfo, isNcmApiResponse } from 'hana-music-api';

import type { NeteaseFailure } from '#lib/api/errors.js';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const describe = (failure: NeteaseFailure): string => {
  switch (failure.kind) {
    case 'checkTokenUnavailable':
      return '安全验证不可用';
    case 'needsLogin':
      return '需要登录';
    case 'rateLimited':
      return `操作频繁，${failure.retryAfter} 秒后再试`;
    case 'upstreamChanged':
      return '返回的结构变了';
    case 'neteaseUnavailable':
      return '连不上、超时或网易云出错';
    case 'rejected':
      return `网易云拒绝（${failure.code}）`;
    default: {
      const unhandled: never = failure;
      throw new Error(`不认识的失败：${JSON.stringify(unhandled)}`);
    }
  }
};

export class NeteaseError extends Error {
  constructor(
    readonly failure: NeteaseFailure,
    readonly detail?: string,
  ) {
    super(describe(failure));
  }
}

export const failureOf = (error: unknown): NeteaseFailure | undefined => {
  if (error instanceof NeteaseError) return error.failure;
  const info = getNcmFailureInfo(error);
  if (!info || !isNcmApiResponse(error)) return undefined;
  switch (info.kind) {
    case 'business':
      return info.code === 301
        ? { kind: 'needsLogin' }
        : {
            kind: 'rejected',
            code: info.code ?? error.status,
            message: info.message ?? '',
          };
    case 'rateLimited':
      return { kind: 'rateLimited', retryAfter: info.retryAfter };
    case 'upstreamShape':
      return { kind: 'upstreamChanged' };
    case 'timeout':
    case 'transport':
    case 'unknown':
      return { kind: 'neteaseUnavailable' };
    case 'cancelled':
    case 'invalidRequest':
      return {
        kind: 'rejected',
        code: error.status,
        message:
          isRecord(error.body) && typeof error.body.msg === 'string'
            ? error.body.msg
            : '',
      };
    default: {
      const unhandled: never = info;
      throw new Error(`不认识的 SDK 失败：${JSON.stringify(unhandled)}`);
    }
  }
};

export const rejection = (error: unknown) => {
  const info = getNcmFailureInfo(error);
  return info?.kind === 'business' ? info : null;
};

export const shapeChanged = (module: string, detail: string): NeteaseError =>
  new NeteaseError({ kind: 'upstreamChanged' }, `${module}：${detail}`);

export const logFailure = (error: unknown, failure: NeteaseFailure): void => {
  const detail =
    error instanceof NeteaseError && error.detail ? `（${error.detail}）` : '';
  console.warn(`网易云调用失败：${describe(failure)}${detail}`);
};
