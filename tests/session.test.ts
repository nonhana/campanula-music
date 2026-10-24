import { describe, expect, it, vi } from 'vitest'

import { listener } from './harness/listener'
import { RECORDED_ACCOUNT as ACCOUNT, MUSIC_U, renewCookies, RENEWED_MUSIC_U, signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()
const { sessionCalls, sessionModules } = listener(world)

/** 从第 since 次调用起，每次调网易云的模块和带的 MUSIC_U */
const credentialsUsed = (since: number) => sessionCalls(since).map(({ module, config }) => [module, (config.cookie as Record<string, string>).MUSIC_U])

const HOUR = 3600_000

describe('打开 App', () => {
  it('未登录：没有当前账号、没有曲库，只问了服务端一次，没有调网易云', async () => {
    const device = world.device()

    const { app } = await device.open()

    expect(app.state.session).toEqual({ status: 'signedOut' })
    expect(app.state.library).toBeNull()
    expect(device.requests).toEqual([
      { method: 'GET', path: '/api/account' },
    ])
    expect(sessionModules()).toEqual([])
  })

  it('断网时打开：不知道有没有登录，界面能说明是断网；联网后重新打开就是未登录', async () => {
    const device = world.device()
    device.setOnline(false)

    const { app } = await device.open()

    expect(app.state.session).toEqual({
      status: 'checkFailed',
      failure: { kind: 'offline' },
    })
    expect(device.requests).toEqual([])

    device.setOnline(true)
    await app.open()

    expect(app.state.session).toEqual({ status: 'signedOut' })
    expect(device.requests).toEqual([
      { method: 'GET', path: '/api/account' },
    ])
  })

  it('已登录：问网易云当前账号，显示头像和昵称', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)

    await world.netease.reply('login/user_account.vip.json')
    const { app: reopened } = await device.open()

    expect(reopened.state.session).toEqual({ status: 'signedIn', account: ACCOUNT })
  })

  it('网易云那边登录已经失效、续期也被拒：App 显示需要重新登录，只续期了一次，登录 Cookie 留着', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)
    const signedIn = world.netease.calls.length

    await world.netease.reply('login/user_account.invalid.json')
    await world.netease.reply('login/login_refresh.301-invalid.json')
    const { app: reopened } = await device.open()

    expect(reopened.state.session).toEqual({ status: 'loginExpired' })
    expect(sessionCalls(signedIn).map(call => call.module)).toEqual(['user_account', 'login_refresh'])
    expect((await device.cookies()).map(cookie => cookie.key)).toEqual(['campanula_login'])
  })

  it('网易云那边登录已经失效（只认出匿名身份）、续期也被拒：同样是需要重新登录', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)

    await world.netease.reply('login/user_account.anonymous.json')
    await world.netease.reply('login/login_refresh.301-invalid.json')
    const { app: reopened } = await device.open()

    expect(reopened.state.session).toEqual({ status: 'loginExpired' })
  })
})

describe('退出登录', () => {
  it('服务端带着这个听众的凭据调网易云退出，回过期的登录 Cookie；重新打开是未登录，不调网易云', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)

    await world.netease.reply('login/logout.json')
    await app.logout()

    expect(app.state.session).toEqual({ status: 'signedOut' })
    expect(await device.cookies()).toEqual([])
    const logout = sessionCalls().at(-1)
    expect(logout?.module).toBe('logout')
    expect(logout?.config.cookie).toMatchObject({ MUSIC_U })

    const { app: reopened } = await device.open()
    expect(reopened.state.session).toEqual({ status: 'signedOut' })
    expect(sessionModules()).toEqual(['captcha_sent', 'login_cellphone', 'logout'])
  })

  it('断网时退出：App 马上当作未登录；Cookie 删不掉，联网后服务端才清掉它', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)

    device.setOnline(false)
    await app.logout()

    expect(app.state.session).toEqual({ status: 'signedOut' })
    expect((await device.cookies()).map(cookie => cookie.key)).toEqual(['campanula_login'])

    await world.netease.reply('login/logout.json')
    device.setOnline(true)

    await vi.waitFor(async () => expect(await device.cookies()).toEqual([]))
    expect(sessionModules()).toEqual(['captcha_sent', 'login_cellphone', 'logout'])
  })

  it('断网时退出后重新打开（仍断网）：仍是未登录，不用登录 Cookie 发请求', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)
    device.setOnline(false)
    await app.logout()
    const sent = device.requests.length

    const { app: reopened } = await device.open()

    expect(reopened.state.session).toEqual({ status: 'signedOut' })
    expect(device.requests).toHaveLength(sent)
  })

  it('一个标签页退出：同一设备上开着的其他标签页跟着变成未登录，不再调网易云', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)
    await world.netease.reply('login/user_account.vip.json')
    const { app: other } = await device.open()
    expect(other.state.session).toEqual({ status: 'signedIn', account: ACCOUNT })

    await world.netease.reply('login/logout.json')
    await app.logout()
    await device.idle()

    expect(other.state.session).toEqual({ status: 'signedOut' })
    expect(sessionModules()).toEqual([
      'captcha_sent',
      'login_cellphone',
      'user_account',
      'logout',
    ])
  })

  it('另一个标签页正在打开、续期时退出：续期回来的新登录 Cookie 不会把刚退出的登录又带回来', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)
    await world.clock.advance(24 * HOUR)

    let renewalArrives!: () => void
    await world.netease.reply('login/login_refresh.sms.json', {
      cookie: renewCookies(),
      until: new Promise(resolve => (renewalArrives = resolve)),
    })
    await world.netease.reply('login/user_account.vip.json')
    await world.netease.reply('login/logout.json')
    const opening = device.open()
    // 等另一个标签页问出去、服务端开始续期，再退出；退出发出去以后网易云才回续期
    await vi.waitFor(() => expect(sessionModules().at(-1)).toBe('login_refresh'))
    const loggingOut = app.logout()
    await vi.waitFor(() => expect(app.state.session).toEqual({ status: 'signedOut' }))
    renewalArrives()
    await loggingOut
    const { app: other } = await opening
    await device.idle()

    expect(other.state.session).toEqual({ status: 'signedOut' })
    expect(await device.cookies()).toEqual([])
    const { app: reopened } = await device.open()
    expect(reopened.state.session).toEqual({ status: 'signedOut' })
  })

  it('另一台设备上退出：这台设备上的标签页不受影响', async () => {
    const phone = world.device()
    const { app: onPhone } = await phone.open()
    await signIn(world, onPhone)
    const desktop = world.device()
    const { app: onDesktop } = await desktop.open()
    await signIn(world, onDesktop)

    await world.netease.reply('login/logout.json')
    await onDesktop.logout()
    await desktop.idle()
    await phone.idle()

    expect(onPhone.state.session).toEqual({ status: 'signedIn', account: ACCOUNT })
  })
})

describe('续期', () => {
  it('打开 App 时离上次续期满 24 小时就续期一次，之后带着新凭据；不满 24 小时不续期', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)
    const signedIn = world.netease.calls.length

    await world.clock.advance(24 * HOUR - 1)
    await world.netease.reply('login/user_account.vip.json')
    await device.open()

    await world.clock.advance(1)
    await world.netease.reply('login/login_refresh.sms.json', {
      cookie: renewCookies(),
    })
    await world.netease.reply('login/user_account.vip.json')
    const { app: renewed } = await device.open()

    await world.clock.advance(24 * HOUR - 1)
    await world.netease.reply('login/user_account.vip.json')
    await device.open()

    expect(renewed.state.session).toEqual({ status: 'signedIn', account: ACCOUNT })
    expect(credentialsUsed(signedIn)).toEqual([
      ['user_account', MUSIC_U],
      ['login_refresh', MUSIC_U],
      ['user_account', RENEWED_MUSIC_U],
      ['user_account', RENEWED_MUSIC_U],
    ])
  })

  it('同一设备上几个标签页同时打开：只有一个去续期，其余带着续期后的凭据问账号，都不误报登录失效', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)
    const signedIn = world.netease.calls.length
    await world.clock.advance(24 * HOUR)

    await world.netease.reply('login/login_refresh.sms.json', {
      cookie: renewCookies(),
    })
    for (let tab = 0; tab < 3; tab += 1)
      await world.netease.reply('login/user_account.vip.json')
    const tabs = await Promise.all([
      device.open(),
      device.open(),
      device.open(),
    ])

    for (const { app: opened } of tabs)
      expect(opened.state.session).toEqual({ status: 'signedIn', account: ACCOUNT })
    expect(credentialsUsed(signedIn)).toEqual([
      ['login_refresh', MUSIC_U],
      ['user_account', RENEWED_MUSIC_U],
      ['user_account', RENEWED_MUSIC_U],
      ['user_account', RENEWED_MUSIC_U],
    ])
  })

  it('网易云说需要登录：不到 24 小时也续期一次，成功就带着新凭据重发，照常是已登录', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)
    const signedIn = world.netease.calls.length

    await world.netease.reply('login/user_account.anonymous.json')
    await world.netease.reply('login/login_refresh.sms.json', {
      cookie: renewCookies(),
    })
    await world.netease.reply('login/user_account.vip.json')
    const { app: reopened } = await device.open()

    expect(reopened.state.session).toEqual({ status: 'signedIn', account: ACCOUNT })
    expect(credentialsUsed(signedIn)).toEqual([
      ['user_account', MUSIC_U],
      ['login_refresh', MUSIC_U],
      ['user_account', RENEWED_MUSIC_U],
    ])

    // 续期的时间也记下了：接下来 24 小时内不再续期
    await world.clock.advance(24 * HOUR - 1)
    await world.netease.reply('login/user_account.vip.json')
    await device.open()
    expect(sessionCalls().at(-1)?.module).toBe('user_account')
  })

  it('续期回了 200 却没下发新的 MUSIC_U：不算续期成功，接着用原来的凭据，服务器日志写明，下次打开再续', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)
    const signedIn = world.netease.calls.length
    await world.clock.advance(24 * HOUR)

    await world.netease.reply('login/login_refresh.sms.json')
    await world.netease.reply('login/user_account.vip.json')
    const { app: reopened } = await device.open()

    expect(reopened.state.session).toEqual({ status: 'signedIn', account: ACCOUNT })
    expect(world.serverLogs).toContainEqual({
      level: 'warn',
      text: expect.stringContaining('login_refresh'),
    })

    await world.netease.reply('login/login_refresh.sms.json', {
      cookie: renewCookies(),
    })
    await world.netease.reply('login/user_account.vip.json')
    await device.open()

    expect(credentialsUsed(signedIn)).toEqual([
      ['login_refresh', MUSIC_U],
      ['user_account', MUSIC_U],
      ['login_refresh', MUSIC_U],
      ['user_account', RENEWED_MUSIC_U],
    ])
  })
})
