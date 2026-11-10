import type { Account } from '#lib/api/account.js';
import type { GetEndpoint, PostEndpoint } from '#lib/api/endpoint.js';
import { endpoints } from '#lib/api/endpoints.js';

import type {
  Api,
  BodyArg,
  ParamsArg,
  PostOptions,
  RequestFailure,
  Result,
} from './api-client';
import type { BackgroundLane, Waiting } from './pacing';

export type SessionFailure = Exclude<RequestFailure, { kind: 'needsLogin' }>;
export type SessionResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: SessionFailure }
  | null;
export type BackgroundFailure = Exclude<
  SessionFailure,
  { kind: 'rateLimited' | 'offline' }
>;
export type BackgroundSessionResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: BackgroundFailure }
  | null;

export type Session =
  | { status: 'checking' }
  | { status: 'checkFailed'; failure: SessionFailure }
  | { status: 'signedOut' }
  | { status: 'loginExpired' }
  | { status: 'signedIn'; account: Account };

type SessionChange =
  | { kind: 'anonymous' }
  | { kind: 'signedIn'; account: Account }
  | { kind: 'signedOut'; by: 'this-tab' | 'other-tab' }
  | { kind: 'loginExpired' };

export interface SessionApi {
  get: <Params, Response>(
    endpoint: GetEndpoint<Params, Response>,
    ...args: ParamsArg<Params>
  ) => Promise<SessionResult<Response>>;
  post: <Params, Request, Response>(
    endpoint: PostEndpoint<Params, Request, Response>,
    ...args: [...ParamsArg<Params>, ...BodyArg<Request>, options?: PostOptions]
  ) => Promise<SessionResult<Response>>;
  request: <T>(send: () => Promise<Result<T>>) => Promise<SessionResult<T>>;
}

export interface SessionRound {
  readonly api: SessionApi;
  readonly current: number;
  isCurrent: (round: number) => boolean;
  background: <T>(
    send: () => Promise<Result<T>>,
    onWaiting: (waiting: Waiting | null) => void,
    giveUp?: AbortSignal,
  ) => Promise<BackgroundSessionResult<T> | 'gaveUp'>;
  checkAccount: () => Promise<Session | null>;
  onChange: (
    listener: (change: SessionChange) => void | Promise<void>,
  ) => () => void;
  change: (change: SessionChange) => Promise<void>;
}

const withoutNeedsLogin = (failure: RequestFailure): SessionFailure | null =>
  failure.kind === 'needsLogin' ? null : failure;

export const createSessionRound = ({
  api,
  lane,
  expired,
}: {
  api: Api;
  lane: BackgroundLane;
  expired: () => void;
}): SessionRound => {
  let current = 1;
  let signedIn = false;
  const listeners = new Set<(change: SessionChange) => void | Promise<void>>();

  const settle = async <T>(
    pending: Promise<Result<T>>,
    mine: number,
  ): Promise<SessionResult<T>> => {
    const result = await pending;
    if (mine !== current) return null;
    if (result.ok) return result;
    const failure = withoutNeedsLogin(result.failure);
    if (!failure) {
      if (signedIn) expired();
      return null;
    }
    return { ok: false, failure };
  };

  const request = <T>(
    send: () => Promise<Result<T>>,
  ): Promise<SessionResult<T>> => {
    const mine = current;
    if (!signedIn) return Promise.resolve(null);
    return settle(send(), mine);
  };

  const apiRound: SessionApi = {
    get(endpoint, ...args) {
      return request(() => api.get(endpoint, ...args));
    },
    post(endpoint, ...args) {
      return request(() => api.post(endpoint, ...args));
    },
    request,
  };

  const background = async <T>(
    send: () => Promise<Result<T>>,
    onWaiting: (waiting: Waiting | null) => void,
    giveUp?: AbortSignal,
  ): Promise<BackgroundSessionResult<T> | 'gaveUp'> => {
    const mine = current;
    if (!signedIn) return null;
    const result = await lane.send(send, onWaiting, giveUp);
    if (!result) return 'gaveUp';
    const settled = await settle(Promise.resolve(result), mine);
    if (!settled) return null;
    if (settled.ok) return settled;
    switch (settled.failure.kind) {
      case 'rateLimited':
      case 'offline':
        return null;
      default:
        return { ok: false, failure: settled.failure };
    }
  };

  const checkAccount = async (): Promise<Session | null> => {
    const mine = current;
    const result = await api.get(endpoints.account);
    if (mine !== current) return null;
    if (result.ok) {
      return result.value.account
        ? { status: 'signedIn', account: result.value.account }
        : { status: 'signedOut' };
    }
    if (result.failure.kind === 'needsLogin') return { status: 'loginExpired' };
    const failure = withoutNeedsLogin(result.failure);
    return failure ? { status: 'checkFailed', failure } : null;
  };

  const change = async (next: SessionChange): Promise<void> => {
    // 必须同步加一：同一轮里后来的 401 靠它被 settle 丢掉
    current += 1;
    signedIn = next.kind === 'signedIn';
    if (signedIn) lane.resume();
    else lane.stop();
    const settled = await Promise.allSettled(
      [...listeners].map(async (listener) => listener(next)),
    );
    for (const result of settled) {
      if (result.status === 'rejected')
        console.error('会话切换清理失败', next.kind, result.reason);
    }
  };

  return {
    api: apiRound,
    get current() {
      return current;
    },
    isCurrent: (round) => round === current,
    background,
    checkAccount,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    change,
  };
};
