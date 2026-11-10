import type { RequestFailure } from '#lib/app/api-client.js';

export const failureText = (failure: RequestFailure): string => {
  switch (failure.kind) {
    case 'offline':
      return '网络已断开';
    case 'unreachable':
      return '连不上 Campanula 的服务器';
    case 'serverError':
      return 'Campanula 的服务器出错了';
    case 'neteaseUnavailable':
      return '网易云没有回应';
    case 'rateLimited':
      return '操作太频繁，等一会儿再试';
    case 'upstreamChanged':
      return 'Campanula 需要升级，请告诉站长';
    case 'rejected':
      return failure.message
        ? `网易云说：${failure.message}`
        : `网易云拒绝了这次操作（${failure.code}）`;
    case 'needsLogin':
      return '需要重新登录';
    case 'cookieSecretMissing':
      return '站长还没配置好，暂时不能登录';
    default: {
      const unhandled: never = failure;
      throw new Error(`不认识的失败：${JSON.stringify(unhandled)}`);
    }
  }
};
