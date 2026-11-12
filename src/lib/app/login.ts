import type { Account } from '#lib/api/account.js';
import { endpoints } from '#lib/api/endpoints.js';
import type { QrCheckResponse } from '#lib/api/login.js';

import type { Api, RequestFailure, Result } from './api-client';
import type { Clock, PageVisibility } from './browser';
import type { SessionRound } from './session-round';

type QrLogin =
  | { step: 'loading' }
  | { step: 'failed'; failure: RequestFailure }
  | { step: 'waiting'; image: string }
  | {
      step: 'scanned';
      image: string;
      nickname: string | null;
      avatarUrl: string | null;
    }
  | { step: 'expired'; image: string }
  | {
      step: 'verifying';
      image: string;
      checking: boolean;
      unverified: boolean;
    };

type CaptchaStatus =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent'; resendAt: number }
  | { status: 'failed'; failure: RequestFailure };

type SubmitStatus =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'failed'; failure: RequestFailure };

export interface LoginState {
  qr: QrLogin | null;
  sms: { captcha: CaptchaStatus; submit: SubmitStatus };
}

export const INITIAL_LOGIN: LoginState = {
  qr: null,
  sms: {
    captcha: { status: 'idle' },
    submit: { status: 'idle' },
  },
};

const QR_POLL_MS = 2000;
const CAPTCHA_RESEND_MS = 60_000;

export interface LoginContext {
  api: Api;
  session: SessionRound;
  clock: Clock;
  page: PageVisibility;
  withLoginCookie: (send: () => Promise<void>) => Promise<void>;
  // 先发完还没发出去的退出，否则它会把新的登录 Cookie 清掉；退出没发成，这次登录就不发
  beforeLogin: () => Promise<RequestFailure | null>;
  discardLogin: () => Promise<void>;
  read: () => LoginState;
  write: (login: LoginState) => void;
  signedIn: (account: Account) => Promise<void>;
}

export interface Login {
  startQr: () => Promise<void>;
  stopQr: () => void;
  continueQr: () => Promise<void>;
  sendCaptcha: (phone: string) => Promise<void>;
  loginWithCaptcha: (phone: string, captcha: string) => Promise<void>;
}

interface ShownQr {
  key: string;
  image: string;
}

export const createLogin = (context: LoginContext): Login => {
  const { api, clock, page } = context;
  let generation = 0;
  let shown: ShownQr | null = null;
  let cancelPoll = (): void => {};

  const setQr = (next: QrLogin | null): void =>
    context.write({
      ...context.read(),
      qr: next,
    });
  const setSms = (next: Partial<LoginState['sms']>): void =>
    context.write({
      ...context.read(),
      sms: {
        ...context.read().sms,
        ...next,
      },
    });

  const forget = (): void => {
    generation += 1;
    shown = null;
    cancelPoll();
    const { captcha, submit } = context.read().sms;
    if (captcha.status === 'sending') setSms({ captcha: { status: 'idle' } });
    if (submit.status === 'submitting') setSms({ submit: { status: 'idle' } });
  };

  const finish = (account: Account): Promise<void> => {
    forget();
    return context.signedIn(account);
  };

  const schedulePoll = (qr: ShownQr): void => {
    const mine = generation;
    cancelPoll = clock.after(QR_POLL_MS, () => void poll(mine, qr));
  };

  const poll = async (mine: number, qr: ShownQr): Promise<void> => {
    if (generation !== mine) return;
    if (page.visibilityState === 'hidden') return schedulePoll(qr);
    await request(
      mine,
      () => api.post(endpoints.checkLoginQr, { key: qr.key }),
      (result) => handleCheck(qr, result, false),
      (check) => check.status === 'signedIn',
    );
  };

  const handleCheck = async (
    qr: ShownQr,
    result: Result<QrCheckResponse>,
    afterVerification: boolean,
  ): Promise<void> => {
    if (!result.ok) return setQr({ step: 'failed', failure: result.failure });
    const check = result.value;
    switch (check.status) {
      case 'waiting':
        setQr({ step: 'waiting', image: qr.image });
        return schedulePoll(qr);
      case 'scanned':
        setQr({
          step: 'scanned',
          image: qr.image,
          nickname: check.nickname,
          avatarUrl: check.avatarUrl,
        });
        return schedulePoll(qr);
      case 'expired':
        return setQr({ step: 'expired', image: qr.image });
      case 'needsVerification':
        return setQr({
          step: 'verifying',
          image: check.image,
          checking: false,
          unverified: afterVerification,
        });
      case 'signedIn':
        return finish(check.account);
      default: {
        const unhandled: never = check;
        throw new Error(`不认识的扫码状态：${JSON.stringify(unhandled)}`);
      }
    }
  };

  const stopQr = (): void => {
    forget();
    setQr(null);
  };

  context.session.onChange((change) => {
    if (change.kind !== 'signedIn') stopQr();
  });

  const request = <T>(
    mine: number,
    send: () => Promise<Result<T>>,
    accept: (result: Result<T>) => void | Promise<void>,
    signedIn: (value: T) => boolean = () => false,
  ): Promise<void> =>
    context.withLoginCookie(async () => {
      if (generation !== mine) return;
      const blocked = await context.beforeLogin();
      if (generation !== mine) return;
      const result: Result<T> = blocked
        ? { ok: false, failure: blocked }
        : await send();
      if (generation !== mine) {
        // 响应头已经写进 Cookie，清掉本次取消的登录后才能让下一个请求接手。
        if (result.ok && signedIn(result.value)) await context.discardLogin();
        return;
      }
      await accept(result);
    });

  return {
    async startQr() {
      forget();
      const mine = generation;
      setQr({ step: 'loading' });
      await request(
        mine,
        () => api.post(endpoints.loginQr),
        (result) => {
          if (!result.ok)
            return setQr({ step: 'failed', failure: result.failure });
          shown = { key: result.value.key, image: result.value.image };
          setQr({ step: 'waiting', image: shown.image });
          schedulePoll(shown);
        },
      );
    },
    stopQr,
    async continueQr() {
      const qr = shown;
      const step = context.read().qr;
      if (!qr || step?.step !== 'verifying' || step.checking)
        throw new Error('只有在等行为验证时才能继续扫码登录');
      const mine = generation;
      setQr({ ...step, checking: true });
      await request(
        mine,
        () => api.post(endpoints.checkLoginQr, { key: qr.key }),
        (result) => handleCheck(qr, result, true),
        (check) => check.status === 'signedIn',
      );
    },
    async sendCaptcha(phone) {
      setSms({
        captcha: { status: 'sending' },
      });
      await request(
        generation,
        () => api.post(endpoints.sendCaptcha, { phone }),
        (result) =>
          setSms({
            captcha: result.ok
              ? { status: 'sent', resendAt: clock.now() + CAPTCHA_RESEND_MS }
              : { status: 'failed', failure: result.failure },
          }),
      );
    },
    async loginWithCaptcha(phone, captcha) {
      forget();
      const mine = generation;
      setSms({
        submit: { status: 'submitting' },
      });
      await request(
        mine,
        () => api.post(endpoints.loginSms, { phone, captcha }),
        (result) => {
          if (result.ok) return finish(result.value.account);
          setSms({ submit: { status: 'failed', failure: result.failure } });
        },
        () => true,
      );
    },
  };
};
