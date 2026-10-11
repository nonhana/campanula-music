import { describe, expect, it } from 'vitest'
import { useWorld } from './harness/world'

const world = useWorld()

describe('打开 App', () => {
  it('未登录：没有当前账号、没有曲库，只问了服务端一次，没有调网易云', async () => {
    const device = world.device()

    const { app } = await device.open()

    expect(app.state).toEqual({ session: { status: 'signedOut' }, library: null })
    expect(device.requests).toEqual([{ method: 'GET', path: '/api/account' }])
    expect(world.netease.calls).toEqual([])
  })

  it('断网时打开：不知道有没有登录，界面能说明是断网；联网后重新打开就是未登录', async () => {
    const device = world.device()
    device.setOnline(false)

    const { app } = await device.open()

    expect(app.state).toEqual({ session: { status: 'checkFailed', reason: 'offline' }, library: null })
    expect(device.requests).toEqual([])

    device.setOnline(true)
    await app.open()

    expect(app.state).toEqual({ session: { status: 'signedOut' }, library: null })
    expect(device.requests).toEqual([{ method: 'GET', path: '/api/account' }])
  })
})
