import type { NcmFailureInfo } from 'hana-music-api';

export interface RawFixture {
  module: string;
  query?: unknown;
  response: { status: number; body: unknown; failure?: NcmFailureInfo };
}

const SUCCESS_CODES: Record<string, readonly number[]> = {
  login_qr_check: [800, 801, 802, 803],
};

const DEFAULT_RETRY_AFTER = 30;

export const field = (body: unknown, name: string): unknown =>
  typeof body === 'object' && body !== null && name in body
    ? (body as Record<string, unknown>)[name]
    : undefined;

// 只看 body.code：老录制是 SDK 1.4.0 录的，HTTP status 不合现在的规矩
const failureStatus = (module: string, code: unknown): number | undefined => {
  if (
    typeof code !== 'number' ||
    (SUCCESS_CODES[module] ?? [200]).includes(code)
  )
    return undefined;
  return code > 100 && code < 600 ? code : 400;
};

const rateLimited = (code: unknown, body: unknown): boolean => {
  const message = field(body, 'msg') ?? field(body, 'message');
  return (
    code === 429 ||
    (code === 405 &&
      typeof message === 'string' &&
      /操作(?:过于)?频繁/.test(message))
  );
};

const unwrapped = (module: string, body: unknown): unknown => {
  const inner = module === 'playlist_tracks' ? field(body, 'body') : undefined;
  return typeof inner === 'object' && inner !== null ? inner : body;
};

export const fixtureFailure = (
  body: unknown,
  source?: string,
): NcmFailureInfo => {
  if (source === 'login/captcha_sent.502-anonymous-registration.json')
    return { kind: 'unknown' };
  const shape = field(body, 'upstreamShape');
  const module = field(shape, 'module');
  const path = field(shape, 'path');
  const expected = field(shape, 'expected');
  const actual = field(shape, 'actual');
  if (
    typeof module === 'string' &&
    typeof path === 'string' &&
    typeof expected === 'string' &&
    typeof actual === 'string'
  )
    return { kind: 'upstreamShape', module, path, expected, actual };
  const code = field(body, 'code');
  const message = field(body, 'message') ?? field(body, 'msg');
  return {
    kind: 'business',
    code: typeof code === 'number' ? code : null,
    ...(typeof message === 'string' ? { message } : {}),
  };
};

export interface FixtureOutcome {
  rejected: boolean;
  response: {
    status: number;
    body: unknown;
    retryAfter?: number;
    failure?: NcmFailureInfo;
  };
}

export const fixtureOutcome = (
  module: string,
  response: RawFixture['response'],
  source?: string,
): FixtureOutcome => {
  if (response.failure) return { rejected: true, response };
  const body = unwrapped(module, response.body);
  const code = field(body, 'code');
  const failedWith = failureStatus(module, code);
  const rejected = failedWith !== undefined;
  const status = failedWith ?? response.status;
  if (rejected && rateLimited(code, body)) {
    return {
      rejected,
      response: {
        status,
        body: { ...(body as object), retryAfter: DEFAULT_RETRY_AFTER },
        retryAfter: DEFAULT_RETRY_AFTER,
        failure: {
          kind: 'rateLimited',
          code: status,
          retryAfter: DEFAULT_RETRY_AFTER,
        },
      },
    };
  }
  return {
    rejected,
    response: {
      status,
      body,
      ...(rejected ? { failure: fixtureFailure(body, source) } : {}),
    },
  };
};
