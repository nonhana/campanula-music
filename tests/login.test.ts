import { describe, expect, it } from 'vitest'
import { listener } from './harness/listener'
import { RECORDED_ACCOUNT as ACCOUNT, signInCookies } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()
const { sessionCalls, sessionModules } = listener(world)

const PHONE = '13800138000'
const CAPTCHA = '2468'

describe('短信验证码登录', () => {
  it('发验证码，填验证码登录，显示账号的头像和昵称', async () => {
    const device = world.device()
    const { app } = await device.open()

    await world.netease.reply('login/captcha_sent.json')
    await app.sendCaptcha(PHONE)

    expect(app.state.login.sms.captcha).toEqual({ status: 'sent', resendAt: Date.now() + 60_000 })

    await world.netease.reply('login/login_cellphone.200.json', { cookie: signInCookies() })
    await app.loginWithCaptcha(PHONE, CAPTCHA)

    expect(app.state.session).toEqual({ status: 'signedIn', account: ACCOUNT })
    expect(sessionCalls().map(({ module, query }) => ({ module, query }))).toEqual([
      { module: 'captcha_sent', query: { phone: PHONE, ctcode: '86' } },
      { module: 'login_cellphone', query: { phone: PHONE, captcha: CAPTCHA, countrycode: '86' } },
    ])
  })

  it('网易云因为风控拒绝登录：原样说明，仍是未登录，重新打开也不是已登录', async () => {
    const device = world.device()
    const { app } = await device.open()
    await world.netease.reply('login/captcha_sent.json')
    await app.sendCaptcha(PHONE)

    await world.netease.reply('login/login_cellphone.10004-risk.json')
    await app.loginWithCaptcha(PHONE, CAPTCHA)

    expect(app.state.session).toEqual({ status: 'signedOut' })
    expect(app.state.login.sms.submit).toEqual({
      status: 'failed',
      failure: { kind: 'rejected', code: 10004, message: '当前登录存在安全风险，请稍后再试' },
    })
    const { app: reopened } = await device.open()
    expect(reopened.state.session).toEqual({ status: 'signedOut' })
    expect(sessionCalls().map(call => call.module)).toEqual(['captcha_sent', 'login_cellphone'])
  })

  it('匿名注册失败、验证码没发出去：说明是网易云暂时没回应，重试就发出去了', async () => {
    const { app } = await world.device().open()

    await world.netease.reply('login/captcha_sent.502-anonymous-registration.json')
    await app.sendCaptcha(PHONE)

    expect(app.state.login.sms.captcha).toEqual({ status: 'failed', failure: { kind: 'neteaseUnavailable' } })

    await world.netease.reply('login/captcha_sent.json')
    await app.sendCaptcha(PHONE)

    expect(app.state.login.sms.captcha).toEqual({ status: 'sent', resendAt: Date.now() + 60_000 })
  })
})

describe('扫码登录', () => {
  /** 录下的二维码 key */
  const KEY = 'f124a8be-db3f-42f9-a236-30cc4130ed2c'

  async function showQr() {
    const device = world.device()
    const { app } = await device.open()
    await world.netease.reply('login/login_qr_key.json')
    await world.netease.reply('login/login_qr_create.json')
    await app.startQrLogin()
    const qr = app.state.login.qr
    if (qr?.step !== 'waiting')
      throw new Error(`没显示出二维码：${JSON.stringify(qr)}`)
    return { device, app, image: qr.image }
  }

  it('等待扫码 → 已扫码（显示扫码的账号）→ 在手机上确认后登录，之后不再查', async () => {
    const { app, image } = await showQr()

    expect(image).toMatch(/^data:image\/png;base64,/)

    await world.netease.reply('login/login_qr_check.801-waiting.json')
    await world.clock.advance(2000)
    expect(app.state.login.qr).toEqual({ step: 'waiting', image })

    await world.netease.reply('login/login_qr_check.802-scanned.json')
    await world.clock.advance(2000)
    expect(app.state.login.qr).toEqual({ step: 'scanned', image, nickname: ACCOUNT.nickname, avatarUrl: ACCOUNT.avatarUrl })

    await world.netease.reply('login/login_qr_check.803-success.json', { cookie: signInCookies() })
    await world.netease.reply('login/user_account.vip.json')
    await world.clock.advance(2000)
    expect(app.state.session).toEqual({ status: 'signedIn', account: ACCOUNT })
    expect(app.state.login.qr).toBeNull()

    await world.clock.advance(10_000)
    expect(sessionModules()).toEqual(['login_qr_key', 'login_qr_create', 'login_qr_check', 'login_qr_check', 'login_qr_check', 'user_account'])
    expect(world.netease.calls.filter(call => call.module === 'login_qr_check').map(call => call.query)).toEqual([{ key: KEY }, { key: KEY }, { key: KEY }])
  })

  it('二维码过期：停在“已过期”不再查，刷新后换一张新的接着查', async () => {
    const { app, image } = await showQr()

    await world.netease.reply('login/login_qr_check.800-expired.json')
    await world.clock.advance(2000)
    expect(app.state.login.qr).toEqual({ step: 'expired', image })

    await world.clock.advance(10_000)
    expect(sessionModules()).toEqual(['login_qr_key', 'login_qr_create', 'login_qr_check'])

    await world.netease.reply('login/login_qr_key.json')
    await world.netease.reply('login/login_qr_create.json')
    await app.startQrLogin()
    expect(app.state.login.qr).toEqual({ step: 'waiting', image })

    await world.netease.reply('login/login_qr_check.801-waiting.json')
    await world.clock.advance(2000)
    expect(sessionModules()).toEqual(['login_qr_key', 'login_qr_create', 'login_qr_check', 'login_qr_key', 'login_qr_create', 'login_qr_check'])
  })

  it('换成短信验证码后不再查扫码状态', async () => {
    const { app } = await showQr()

    app.stopQrLogin()
    await world.clock.advance(10_000)

    expect(app.state.login.qr).toBeNull()
    expect(sessionModules()).toEqual(['login_qr_key', 'login_qr_create'])
  })

  it('页面在后台时不查扫码状态，回到前台接着查', async () => {
    const device = world.device()
    const tab = await device.open()
    await world.netease.reply('login/login_qr_key.json')
    await world.netease.reply('login/login_qr_create.json')
    await tab.app.startQrLogin()

    tab.hide()
    await world.clock.advance(10_000)
    expect(sessionModules()).toEqual(['login_qr_key', 'login_qr_create'])

    tab.show()
    await world.netease.reply('login/login_qr_check.802-scanned.json')
    await world.clock.advance(2000)
    expect(tab.app.state.login.qr).toMatchObject({ step: 'scanned' })
  })

  it('取二维码时断网：说明是断网，联网后重试就显示出来', async () => {
    const device = world.device()
    const { app } = await device.open()

    device.setOnline(false)
    await app.startQrLogin()
    expect(app.state.login.qr).toEqual({ step: 'failed', failure: { kind: 'offline' } })

    device.setOnline(true)
    await world.netease.reply('login/login_qr_key.json')
    await world.netease.reply('login/login_qr_create.json')
    await app.startQrLogin()
    expect(app.state.login.qr).toMatchObject({ step: 'waiting' })
  })

  // 8821 没录到过，这两份是构造的数据（tests/fixtures/netease/README.md“构造的数据”）
  describe('网易云要求行为验证（8821）', () => {
    it('显示验证用的二维码、不再自动查；没验证完点继续，换一张并说明还没通过；验证完点继续就登录', async () => {
      const { app } = await showQr()

      await world.netease.reply('login/login_qr_check.8821-verify.constructed.json')
      await world.netease.reply('login/verify_getQr.constructed.json')
      await world.clock.advance(2000)

      const verifying = app.state.login.qr
      expect(verifying).toEqual({ step: 'verifying', image: expect.stringMatching(/^data:image\/png;base64,/), checking: false, unverified: false })
      expect(sessionCalls().at(-1)).toMatchObject({
        module: 'verify_getQr',
        query: { vid: '61', type: '2', token: '00.verify-token.placeholder', evid: 'risk-event-placeholder', sign: 'risk-sign-placeholder' },
      })
      await world.clock.advance(10_000)
      expect(sessionModules()).toEqual(['login_qr_key', 'login_qr_create', 'login_qr_check', 'verify_getQr'])

      await world.netease.reply('login/login_qr_check.8821-verify.constructed.json')
      await world.netease.reply('login/verify_getQr.constructed.json')
      await app.continueQrLogin()
      expect(app.state.login.qr).toEqual({ ...verifying, unverified: true })

      await world.netease.reply('login/login_qr_check.803-success.json', { cookie: signInCookies() })
      await world.netease.reply('login/user_account.vip.json')
      await app.continueQrLogin()
      expect(app.state.session).toEqual({ status: 'signedIn', account: ACCOUNT })
      expect(world.netease.calls.filter(call => call.module === 'login_qr_check').map(call => call.query)).toEqual([{ key: KEY }, { key: KEY }, { key: KEY }])
    })

    it('网易云没给验证的办法：原样说明网易云的拒绝，不再查', async () => {
      const { app } = await showQr()

      await world.netease.reply('login/login_qr_check.8821-no-params.constructed.json')
      await world.clock.advance(2000)

      expect(app.state.login.qr).toEqual({ step: 'failed', failure: { kind: 'rejected', code: 8821, message: '需要行为验证码验证' } })
      await world.clock.advance(10_000)
      expect(sessionModules()).toEqual(['login_qr_key', 'login_qr_create', 'login_qr_check'])
    })
  })
})
