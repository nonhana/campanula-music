import { describe, expect, it, vi } from 'vitest'

import { never } from './harness/hold'
import { current, listener } from './harness/listener'
import { RECORDED_ACCOUNT as ACCOUNT, MUSIC_U, renewCookies, RENEWED_MUSIC_U, signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()
const { downloadLiked, replyLibrary, sessionCalls, sessionModules, signInAtHearts, signInWithLiked } = listener(world)

/** 我喜欢的音乐里的第 1 首：录了极高音质的下载地址 */
const FIRST = { id: 3433267939, downloadUrl: 'playback/downloads/002-song_download_url_v1.json.gz' }
const LIKED = { kind: 'playlist', id: 900000001 } as const

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

  it('从没登录过的设备断网时打开：当作未登录，不发请求；联网后重新打开能问到账号', async () => {
    const device = world.device()
    device.setOnline(false)

    const { app } = await device.open()

    expect(app.state.session).toEqual({ status: 'signedOut' })
    expect(device.requests).toEqual([])

    device.setOnline(true)
    await app.open()

    expect(app.state.session).toEqual({ status: 'signedOut' })
    expect(device.requests).toEqual([
      { method: 'GET', path: '/api/account' },
    ])
  })

  it('登录过、断网后重新打开：直接显示本机曲库副本和播放队列，只放下载了的歌；联网后接着同步，不重新登录', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const first = await downloadLiked(device, app, FIRST)
    app.play(LIKED, first.id)
    await world.settle()
    await world.settle()
    tab.close()
    const before = device.requests.length

    device.setOnline(false)
    const reopened = await device.open()
    const offline = reopened.app
    await world.settle()

    expect(offline.state.session).toEqual({ status: 'signedIn', account: ACCOUNT })
    expect(offline.state.online).toBe(false)
    expect(device.requests.slice(before)).toEqual([])
    expect(offline.state.library?.hearts?.size).toBeGreaterThan(0)
    expect(offline.state.library?.liked?.songs.map(song => song.id)).toContain(FIRST.id)
    expect(current(offline)).toBe(FIRST.id)
    expect(offline.state.downloads.has(FIRST.id)).toBe(true)
    expect(offline.state.library?.sync).toEqual({ status: 'offline' })
    expect(offline.state.playable(first)).toBe(true)
    const other = offline.state.library!.liked!.songs.find(song => song.id !== FIRST.id)!
    expect(offline.state.playable(other)).toBe(false)

    // 联网后接着同步：只发曲库同步的请求，不再问当前账号（本机账号已经显示出来了）
    await replyLibrary({
      through: 'hearts',
      until: never(),
    })
    device.setOnline(true)
    await world.settle()

    const resumed = device.requests.slice(before).map(request => request.path)
    expect(resumed.some(path => path.startsWith('/api/hearts'))).toBe(true)
    expect(resumed).not.toContain('/api/account')
  })

  it('退出登录后断网打开：仍是未登录，不会拿本机的旧账号显示曲库', async () => {
    const device = world.device()
    const tab = await signInAtHearts(device)
    await world.netease.reply('login/logout.json')
    await tab.app.logout()
    await world.settle()
    tab.close()

    device.setOnline(false)
    const { app } = await device.open()

    expect(app.state.session).toEqual({ status: 'signedOut' })
    expect(app.state.library).toBeNull()
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

  it('服务端说登录已经失效后断网打开：不会拿本机记着的旧账号冒充登录', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)

    await world.netease.reply('login/user_account.invalid.json')
    await world.netease.reply('login/login_refresh.301-invalid.json')
    const { app: reopened } = await device.open()
    expect(reopened.state.session).toEqual({ status: 'loginExpired' })

    device.setOnline(false)
    const { app: offline } = await device.open()

    expect(offline.state.session).toEqual({ status: 'signedOut' })
    expect(offline.state.library).toBeNull()
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
