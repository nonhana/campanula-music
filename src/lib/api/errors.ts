export type NeteaseFailure =
  | { kind: 'checkTokenUnavailable' }
  | { kind: 'needsLogin' }
  // retryAfter 单位是秒
  | { kind: 'rateLimited'; retryAfter: number }
  | { kind: 'upstreamChanged' }
  | { kind: 'neteaseUnavailable' }
  | { kind: 'rejected'; code: number; message: string };

interface CookieSecretMissing {
  kind: 'cookieSecretMissing';
}

export type ApiError = NeteaseFailure | CookieSecretMissing;

export interface ErrorBody {
  error: ApiError;
}
