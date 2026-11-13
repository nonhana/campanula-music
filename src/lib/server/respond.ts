import { RENEWAL_REQUIRED_HEADER } from '#lib/api/check-token.js';
import type { Endpoint } from '#lib/api/endpoint.js';
import type { ApiError, ErrorBody } from '#lib/api/errors.js';

import { failureOf, logFailure } from './netease/failure';

export class RenewalRequired extends Error {
  constructor(readonly reason: 'due' | 'expired') {
    super('需要续期后再查询');
  }
}

const STATUS = {
  checkTokenUnavailable: 503,
  needsLogin: 401,
  rateLimited: 429,
  upstreamChanged: 502,
  neteaseUnavailable: 503,
  rejected: 422,
  cookieSecretMissing: 500,
} satisfies Record<ApiError['kind'], number>;

export const errorResponse = (error: ApiError): Response => {
  const headers: Record<string, string> =
    error.kind === 'rateLimited'
      ? {
          'retry-after': String(error.retryAfter),
        }
      : {};
  return Response.json({ error } satisfies ErrorBody, {
    status: STATUS[error.kind],
    headers,
  });
};

// NoInfer 不能去掉：否则 unknown 会反过来盖掉端点的响应类型
export const json = <Value>(
  _endpoint: Endpoint<Value>,
  body: NoInfer<Value>,
): Response => Response.json(body);

export const withNetease = async <Value>(
  endpoint: Endpoint<Value>,
  handle: () => NoInfer<Value> | Promise<NoInfer<Value>>,
): Promise<Response> => {
  try {
    return json(endpoint, await handle());
  } catch (error) {
    if (error instanceof RenewalRequired)
      return Response.json(
        { renewalRequired: error.reason },
        {
          status: 428,
          headers: {
            [RENEWAL_REQUIRED_HEADER]: error.reason,
            'cache-control': 'no-store',
          },
        },
      );
    const failure = failureOf(error);
    if (failure) {
      logFailure(error, failure);
      return errorResponse(failure);
    }
    throw error;
  }
};
