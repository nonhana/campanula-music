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
})
