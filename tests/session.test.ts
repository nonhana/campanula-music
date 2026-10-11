import { describe, expect, it, vi } from 'vitest'
import { RECORDED_ACCOUNT as ACCOUNT, MUSIC_U, signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()

const modules = () => world.netease.calls.map(call => call.module)

describe('打开 App', () => {
  it('未登录：没有当前账号、没有曲库，只问了服务端一次，没有调网易云', async () => {
    const device = world.device()

    const { app } = await device.open()

    expect(app.state.session).toEqual({ status: 'signedOut' })
    expect(app.state.library).toBeNull()
    expect(device.requests).toEqual([{ method: 'GET', path: '/api/account' }])
    expect(modules()).toEqual([])
  })

  it('断网时打开：不知道有没有登录，界面能说明是断网；联网后重新打开就是未登录', async () => {
    const device = world.device()
    device.setOnline(false)

    const { app } = await device.open()

    expect(app.state.session).toEqual({ status: 'checkFailed', failure: { kind: 'offline' } })
    expect(device.requests).toEqual([])

    device.setOnline(true)
    await app.open()

    expect(app.state.session).toEqual({ status: 'signedOut' })
    expect(device.requests).toEqual([{ method: 'GET', path: '/api/account' }])
  })

  it('已登录：问网易云当前账号，显示头像和昵称', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)

    await world.netease.reply('login/user_account.vip.json')
    const { app: reopened } = await device.open()

    expect(reopened.state.session).toEqual({ status: 'signedIn', account: ACCOUNT })
  })

  it('网易云那边登录已经失效（只认出匿名身份）：App 显示登录已失效，登录 Cookie 留着', async () => {
    const device = world.device()
    const { app } = await device.open()
    await signIn(world, app)

    await world.netease.reply('login/user_account.anonymous.json')
    const { app: reopened } = await device.open()

    expect(reopened.state.session).toEqual({ status: 'loginExpired' })
    expect((await device.cookies()).map(cookie => cookie.key)).toEqual(['campanula_login'])
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
    const logout = world.netease.calls.at(-1)
    expect(logout?.module).toBe('logout')
    expect(logout?.config.cookie).toMatchObject({ MUSIC_U })

    const { app: reopened } = await device.open()
    expect(reopened.state.session).toEqual({ status: 'signedOut' })
    expect(modules()).toEqual(['captcha_sent', 'login_cellphone', 'logout'])
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
    expect(modules()).toEqual(['captcha_sent', 'login_cellphone', 'logout'])
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
})
