import { describe, expect, it } from 'vitest'
import { listener } from './harness/listener'
import { MUSIC_U, signIn, signInCookies } from './harness/sign-in'
import { REAL_IP, useWorld } from './harness/world'

const world = useWorld()
const { sessionModules } = listener(world)

describe('网易云凭据只在加密 Cookie 里', () => {
  it('每次调网易云都带同一个 deviceId，登录后带上凭据，配了真实国内 IP 就作为 realIP 传入', async () => {
    const device = world.device()
    const { app } = await device.open()
    await world.netease.reply('login/login_qr_key.json')
    await world.netease.reply('login/login_qr_create.json')
    await app.startQrLogin()
    await world.netease.reply('login/login_qr_check.803-success.json', { cookie: signInCookies() })
    await world.netease.reply('login/user_account.vip.json')
    await world.clock.advance(2000)
    await world.netease.reply('login/user_account.vip.json')
    await device.open()
    await world.netease.reply('login/logout.json')
    await app.logout()

    expect(sessionModules()).toEqual(['login_qr_key', 'login_qr_create', 'login_qr_check', 'user_account', 'user_account', 'logout'])
    const deviceId = world.netease.calls[0].config.deviceId
    expect(deviceId).toMatch(/^[0-9A-F]{52}$/)
    for (const { config } of world.netease.calls) {
      expect(config.deviceId).toBe(deviceId)
      expect(config.state?.deviceId).toBe(deviceId)
      expect(config.realIP).toBe(REAL_IP)
    }
    const [key, create, check, ...signedIn] = world.netease.calls
    for (const { config } of [key, create, check])
      expect(config.cookie).toBeUndefined()
    for (const { config } of signedIn)
      expect(config.cookie).toMatchObject({ MUSIC_U, __csrf: '6f1d0c9b8a7e6d5c4b3a29180f1e2d3c', MUSIC_R_T: '1572000000000' })
  })

  it('页面脚本读不到明文凭据：登录 Cookie 是 httpOnly、Secure 的密文，响应里也没有凭据', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)

    const cookies = await device.cookies()
    expect(cookies.map(cookie => cookie.key)).toEqual(['campanula_login'])
    const [login] = cookies
    expect(login).toMatchObject({ httpOnly: true, secure: true, sameSite: 'strict', path: '/' })
    // 只存名字和值，加密后约 2 KB（验证关卡①），离浏览器 4 KB 的上限还远
    expect(login.value.length).toBeLessThan(3000)
    for (const text of [login.value, ...device.responseBodies, JSON.stringify(app.state)])
      expect(text).not.toContain(MUSIC_U.slice(0, 24))
  })

  it('被改过的登录 Cookie 解不开：当作未登录，不带着它调网易云', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)
    const [login] = await device.cookies()
    const middle = Math.floor(login.value.length / 2)
    const flipped = login.value[middle] === 'A' ? 'B' : 'A'
    await device.setCookie(`campanula_login=${login.value.slice(0, middle)}${flipped}${login.value.slice(middle + 1)}; Path=/; Secure; HttpOnly; SameSite=Strict`)

    const { app: reopened } = await device.open()

    expect(reopened.state.session).toEqual({ status: 'signedOut' })
    expect(sessionModules()).toEqual(['captcha_sent', 'login_cellphone'])
  })

  it('凭据大到浏览器存不下时报错，不当作已经登录', async () => {
    const device = world.device()
    const { app } = await device.open()
    await world.netease.reply('login/captcha_sent.json')
    await app.sendCaptcha('13800138000')
    const oversized = Array.from({ length: 40 }, (_, index) => `EXTRA_${index}=${'v'.repeat(80)}; Max-Age=86400; Path=/`)
    await world.netease.reply('login/login_cellphone.200.json', { cookie: [...signInCookies(), ...oversized] })

    await app.loginWithCaptcha('13800138000', '2468')

    expect(app.state.session).toEqual({ status: 'signedOut' })
    expect(app.state.login.sms.submit).toEqual({ status: 'failed', failure: { kind: 'serverError' } })
    const { app: reopened } = await device.open()
    expect(reopened.state.session).toEqual({ status: 'signedOut' })
    expect(sessionModules()).toEqual(['captcha_sent', 'login_cellphone'])
  })
})

describe('服务器日志', () => {
  it('出错和成功都走一遍：日志里没有 Cookie、手机号、验证码', async () => {
    const phone = '13912345678'
    const captcha = '864213'
    const device = world.device()
    const { app } = await device.open()

    await world.netease.reply('login/captcha_sent.502-anonymous-registration.json')
    await app.sendCaptcha(phone)
    await world.netease.reply('login/captcha_sent.json')
    await app.sendCaptcha(phone)
    await world.netease.reply('login/login_cellphone.10004-risk.json')
    await app.loginWithCaptcha(phone, captcha)
    const oversized = Array.from({ length: 40 }, (_, index) => `EXTRA_${index}=${'v'.repeat(80)}; Path=/`)
    await world.netease.reply('login/login_cellphone.200.json', { cookie: [...signInCookies(), ...oversized] })
    await app.loginWithCaptcha(phone, captcha)
    await world.netease.reply('login/login_cellphone.200.json', { cookie: signInCookies() })
    await app.loginWithCaptcha(phone, captcha)
    const [login] = await device.cookies()
    await world.netease.reply('login/user_account.anonymous.json')
    await device.open()
    await world.netease.reply('login/logout.json')
    await app.logout()

    const logs = world.serverLogs.map(log => log.text).join('\n')
    // 出错时确实打了日志（匿名注册失败、风控拒绝、凭据太大）
    expect(world.serverLogs.length).toBeGreaterThanOrEqual(3)
    for (const secret of [phone, captcha, MUSIC_U.slice(0, 24), login.value.slice(0, 24)])
      expect(logs).not.toContain(secret)
  })
})
