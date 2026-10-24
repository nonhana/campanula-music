import type { Account } from '#lib/api/account.js'
import { endpoints } from '#lib/api/endpoints.js'
import type { QrCheckResponse } from '#lib/api/login.js'

import type { Api, RequestFailure, Result } from './api-client'
import type { Clock, PageVisibility } from './browser'
import type { SessionRound } from './session-round'

// 登录页的两种方式（Spec #11“客户端：登录会话”）：扫码、短信验证码。不做账号密码登录。

type QrLogin
  = | { step: 'loading' }
    /** 重试就重新取一张 */
    | { step: 'failed', failure: RequestFailure }
    | { step: 'waiting', image: string }
    /** 已扫码，等听众在手机上确认 */
    | { step: 'scanned', image: string, nickname: string, avatarUrl: string }
    | { step: 'expired', image: string }
    /** 网易云要求先完成行为验证（8821）：image 是验证用的二维码；checking 是正在查，unverified 是查过了还没通过 */
    | { step: 'verifying', image: string, checking: boolean, unverified: boolean }

type CaptchaStatus
  = | { status: 'idle' }
    | { status: 'sending' }
    /** resendAt（毫秒）之前不能重发 */
    | { status: 'sent', resendAt: number }
    | { status: 'failed', failure: RequestFailure }

type SubmitStatus
  = | { status: 'idle' }
    | { status: 'submitting' }
    | { status: 'failed', failure: RequestFailure }

export interface LoginState {
  qr: QrLogin | null
  sms: { captcha: CaptchaStatus, submit: SubmitStatus }
}

export const INITIAL_LOGIN: LoginState = {
  qr: null,
  sms: {
    captcha: { status: 'idle' },
    submit: { status: 'idle' },
  },
}

const QR_POLL_MS = 2000
/** 发出验证码后多久才能重发 */
const CAPTCHA_RESEND_MS = 60_000

export interface LoginContext {
  api: Api
  session: SessionRound
  clock: Clock
  page: PageVisibility
  /** 先发完还没发出去的退出，免得它把新的登录 Cookie 清掉；退出没发成时返回原因，这次登录就不发了 */
  beforeLogin: () => Promise<RequestFailure | null>
  read: () => LoginState
  write: (login: LoginState) => void
  /** 服务端已经设好登录 Cookie：App 拿出这个账号的曲库副本，切到登录后 */
  signedIn: (account: Account) => Promise<void>
}

export interface Login {
  startQr: () => Promise<void>
  stopQr: () => void
  continueQr: () => Promise<void>
  sendCaptcha: (phone: string) => Promise<void>
  loginWithCaptcha: (phone: string, captcha: string) => Promise<void>
}

interface ShownQr {
  key: string
  image: string
}

export const createLogin = (context: LoginContext): Login => {
  const { api, clock, page } = context
  /** 每换一张二维码、不再显示或登录成功就加一：旧请求回来时代数对不上就不要 */
  let generation = 0
  let shown: ShownQr | null = null
  let cancelPoll = (): void => {}

  const setQr = (next: QrLogin | null): void => context.write({
    ...context.read(),
    qr: next,
  })
  const setSms = (next: Partial<LoginState['sms']>): void =>
    context.write({
      ...context.read(),
      sms: {
        ...context.read().sms,
        ...next,
      },
    })

  const forget = (): void => {
    generation += 1
    shown = null
    cancelPoll()
  }

  const finish = (account: Account): Promise<void> => {
    forget()
    return context.signedIn(account)
  }

  const schedulePoll = (qr: ShownQr): void => {
    const mine = generation
    cancelPoll = clock.after(QR_POLL_MS, () => void poll(mine, qr))
  }

  const poll = async (mine: number, qr: ShownQr): Promise<void> => {
    if (generation !== mine)
      return
    // 页面在后台（手机上切去网易云 App 扫码、桌面切了标签页）时不查，回到前台接着查
    if (page.visibilityState === 'hidden')
      return schedulePoll(qr)
    const result = await api.post(endpoints.checkLoginQr, { key: qr.key })
    if (generation === mine)
      await handleCheck(qr, result, false)
  }

  const handleCheck = async (qr: ShownQr, result: Result<QrCheckResponse>, afterVerification: boolean): Promise<void> => {
    if (!result.ok)
      return setQr({ step: 'failed', failure: result.failure })
    const check = result.value
    switch (check.status) {
      case 'waiting':
        setQr({ step: 'waiting', image: qr.image })
        return schedulePoll(qr)
      case 'scanned':
        setQr({
          step: 'scanned',
          image: qr.image,
          nickname: check.nickname,
          avatarUrl: check.avatarUrl,
        })
        return schedulePoll(qr)
      case 'expired':
        return setQr({ step: 'expired', image: qr.image })
      case 'needsVerification':
        return setQr({
          step: 'verifying',
          image: check.image,
          checking: false,
          unverified: afterVerification,
        })
      case 'signedIn':
        return finish(check.account)
      default: {
        const unhandled: never = check
        throw new Error(`不认识的扫码状态：${JSON.stringify(unhandled)}`)
      }
    }
  }

  const stopQr = (): void => {
    forget()
    setQr(null)
  }

  context.session.onChange((change) => {
    if (change.kind !== 'signedIn')
      stopQr()
  })

  /** 先发完还没发出去的退出，再发登录请求；退出没发成，这次就当作同样原因的失败 */
  const afterPendingLogout = async <T>(send: () => Promise<Result<T>>): Promise<Result<T>> => {
    const blocked = await context.beforeLogin()
    return blocked
      ? { ok: false, failure: blocked }
      : send()
  }

  return {
    async startQr() {
      forget()
      const mine = generation
      setQr({ step: 'loading' })
      const result = await afterPendingLogout(() => api.post(endpoints.loginQr))
      if (generation !== mine)
        return
      if (!result.ok)
        return setQr({ step: 'failed', failure: result.failure })
      shown = { key: result.value.key, image: result.value.image }
      setQr({ step: 'waiting', image: shown.image })
      schedulePoll(shown)
    },
    stopQr,
    async continueQr() {
      const qr = shown
      const step = context.read().qr
      if (!qr || step?.step !== 'verifying' || step.checking)
        throw new Error('只有在等行为验证时才能继续扫码登录')
      const mine = generation
      setQr({ ...step, checking: true })
      const result = await api.post(endpoints.checkLoginQr, { key: qr.key })
      if (generation === mine)
        await handleCheck(qr, result, true)
    },
    async sendCaptcha(phone) {
      setSms({
        captcha: { status: 'sending' },
      })
      const result = await afterPendingLogout(() => api.post(endpoints.sendCaptcha, { phone }))
      setSms({
        captcha: result.ok
          ? { status: 'sent', resendAt: clock.now() + CAPTCHA_RESEND_MS }
          : { status: 'failed', failure: result.failure },
      })
    },
    async loginWithCaptcha(phone, captcha) {
      setSms({
        submit: { status: 'submitting' },
      })
      const result = await afterPendingLogout(() => api.post(endpoints.loginSms, { phone, captcha }))
      if (result.ok) {
        await finish(result.value.account)
      }
      else {
        setSms({
          submit: { status: 'failed', failure: result.failure },
        })
      }
    },
  }
}
