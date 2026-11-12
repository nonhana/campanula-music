import type { Endpoint } from '#lib/api/endpoint.js';
import type { ApiError, ErrorBody } from '#lib/api/errors.js';

import { failureOf, logFailure } from './netease/failure';

const STATUS = {
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
    const failure = failureOf(error);
    if (failure) {
      logFailure(error, failure);
      return errorResponse(failure);
    }
    throw error;
  }
};
