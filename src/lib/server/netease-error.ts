import type { NeteaseFailure } from '#lib/api/errors.js';

// 只写模块与失败种类：请求参数和 Cookie 里有手机号、验证码和凭据，别进日志
const describe = (failure: NeteaseFailure): string => {
  switch (failure.kind) {
    case 'needsLogin':
      return '需要登录';
    case 'rateLimited':
      return `操作频繁，${failure.retryAfter} 秒后再试`;
    case 'upstreamChanged':
      return '返回的结构变了';
    case 'neteaseUnavailable':
      return '连不上、超时或网易云出错';
    case 'rejected':
      return `网易云拒绝（${failure.code}）${failure.message}`;
    default: {
      const unhandled: never = failure;
      throw new Error(`不认识的失败：${JSON.stringify(unhandled)}`);
    }
  }
};

export class NeteaseError extends Error {
  constructor(
    readonly failure: NeteaseFailure,
    readonly body: unknown,
  ) {
    super(describe(failure));
  }
}
