import type { AddressInfo } from 'node:net'
import type { Plugin } from 'vite'
import type { Device } from './device'
import type { Call } from './netease-sdk'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createServer as createHttpServer } from 'node:http'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { format } from 'node:util'
import { withGlobal } from '@sinonjs/fake-timers'
import { sveltekit } from '@sveltejs/kit/vite'
import { createServer } from 'vite'
import { afterAll, beforeAll, beforeEach } from 'vitest'
import { clockOn } from './browser'
import { createDevice } from './device'
import { loadFixture } from './fixtures'

// 测试接入点“去掉界面的整个 App”（Spec #11 Testing Decisions）：
// 世界里有一个在测试进程里真实运行的服务端、一个网易云替身和一个共用的时钟；
// 每台设备有自己的 Cookie、本机数据库、联网状态和存储空间；每个标签页是一个 App。

const FAKE_SDK = fileURLToPath(new URL('./netease-sdk.ts', import.meta.url))
const START = new Date('2026-10-12T00:00:00Z') // 北京时间 08:00

/** 站长配置的真实国内 IP（文档用的保留地址 TEST-NET-3），服务端调网易云时要作为 realIP 传入 */
export const REAL_IP = '203.0.113.7'

// 站长的配置（Spec #11 部署与发布）。服务端在启动时读一次环境变量，所以要在启动世界之前设好
const SITE_ENV = {
  COOKIE_SECRET: 'campanula-test-secret-0123456789abcdefghijklmnopqrstuv',
  NETEASE_REAL_IP: REAL_IP,
}
const LOG_METHODS = ['debug', 'log', 'info', 'warn', 'error'] as const

export interface ServerLog {
  level: typeof LOG_METHODS[number]
  text: string
}

export interface World {
  /** 一台新设备 */
  device: () => Device
  netease: {
    /** 服务端调过的网易云模块，按先后 */
    readonly calls: readonly Call[]
    /**
     * 网易云对这个模块的下一次调用，回这份录制数据（tests/fixtures/netease/ 下的相对路径）。
     * 录下的是失败返回时，替身像真的 SDK 一样把它抛出来。
     * 录制数据去掉了 Cookie（Spec #11 交付方式第 5 条）；要网易云下发 Cookie（例如登录成功）时，用 cookie 放进 Set-Cookie。
     * until：等它了结才回，模拟网易云回得慢
     */
    reply: (fixture: string, options?: { cookie?: string[], until?: Promise<void> }) => Promise<void>
  }
  /** 服务端打的日志 */
  readonly serverLogs: readonly ServerLog[]
  /**
   * 服务端、Cookie 过期和所有 App 共用的时钟，只有 advance 才会走；
   * 走的过程中 App 的定时按到期先后触发，触发时 Date.now() 正好是到期的时刻。
   * 走完后等各台设备上被定时触发的请求都回来、App 处理完
   */
  clock: { advance: (ms: number) => Promise<void> }
}

// 自检用的模块：和服务端路由一样，在模块里用裸名字 import SDK
const SDK_PROBE = 'virtual:campanula-sdk-probe'

/** 服务端 import 'hana-music-api' 时换成网易云替身 */
function replaceSdk(): Plugin {
  return {
    name: 'campanula:netease-fake',
    enforce: 'pre',
    // Vite 跑服务端代码时，node_modules 里的包默认绕过插件直接加载，替身就失效了
    config: () => ({ ssr: { noExternal: ['hana-music-api'] } }),
    resolveId(id) {
      if (id === 'hana-music-api')
        return FAKE_SDK
      if (id.startsWith('hana-music-api/'))
        throw new Error(`网易云替身只替换了 hana-music-api 本身，服务端不能引用 ${id}`)
      if (id === SDK_PROBE)
        return `\0${SDK_PROBE}`
    },
    load(id) {
      if (id === `\0${SDK_PROBE}`)
        return `export { invokeModule } from 'hana-music-api'`
    },
  }
}

/* eslint-disable no-console -- 依赖库也可能用 console.log 打日志，都算服务器日志，所以接管全部方法 */
/** 记下服务端处理请求时打的日志，照常打印出来方便排查 */
function captureServerLogs(serving: AsyncLocalStorage<true>) {
  const logs: ServerLog[] = []
  const originals = LOG_METHODS.map(level => [level, console[level]] as const)
  for (const [level, original] of originals) {
    console[level] = (...args: unknown[]) => {
      if (serving.getStore())
        logs.push({ level, text: format(...args) })
      original.apply(console, args)
    }
  }
  return {
    logs,
    restore: () => {
      for (const [level, original] of originals)
        console[level] = original
    },
  }
}
/* eslint-enable no-console */

async function startWorld() {
  Object.assign(process.env, SITE_ENV)
  const vite = await createServer({
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    plugins: [replaceSdk(), sveltekit()],
  })
  const serving = new AsyncLocalStorage<true>()
  const http = createHttpServer((req, res) => serving.run(true, () => vite.middlewares(req, res)))
  await new Promise<void>(resolve => http.listen(0, 'localhost', resolve))
  const { port } = http.address() as AddressInfo
  const closeServers = async () => {
    http.closeAllConnections()
    await new Promise(resolve => http.close(resolve))
    await vite.close()
  }

  const fake = await vite.ssrLoadModule(FAKE_SDK) as typeof import('./netease-sdk')
  const probe = await vite.ssrLoadModule(SDK_PROBE) as Pick<typeof import('./netease-sdk'), 'invokeModule'>
  if (probe.invokeModule !== fake.invokeModule) {
    await closeServers()
    throw new Error('服务端代码 import 的 hana-music-api 不是网易云替身，测试可能连到真的网易云')
  }

  const serverLogs = captureServerLogs(serving)
  // 只换掉全局的 Date（服务端和 Cookie 过期用它）；App 的定时用这个时钟自己的 setTimeout。
  // 全局的 setTimeout 不换：Vite 和 HTTP 连接也在用它
  const timers = withGlobal(globalThis).install({ now: START, toFake: ['Date'] })

  return {
    origin: `http://localhost:${port}`,
    fake,
    timers,
    serverLogs: serverLogs.logs,
    reset() {
      fake.reset()
      serverLogs.logs.length = 0
      timers.reset() // 清掉没到期的定时，时间回到 START
    },
    async close() {
      timers.uninstall()
      serverLogs.restore()
      await closeServers()
    },
  }
}

/** 在测试文件顶层调用：整个文件共用一个世界，每条测试开始前清空网易云替身、日志和时钟 */
export function useWorld(): World {
  let started: Awaited<ReturnType<typeof startWorld>> | undefined
  const current = () => {
    if (!started)
      throw new Error('世界还没启动：useWorld() 要在测试文件顶层调用')
    return started
  }

  beforeAll(async () => {
    started = await startWorld()
  }, 30_000)
  afterAll(async () => {
    await started?.close()
  })
  /** 这条测试开出来的设备 */
  let devices: Device[] = []
  beforeEach(() => {
    current().reset()
    devices = []
  })

  return {
    device: () => {
      const device = createDevice(current().origin, clockOn(current().timers))
      devices.push(device)
      return device
    },
    netease: {
      get calls() {
        return current().fake.calls
      },
      async reply(path, { cookie = [], until } = {}) {
        const { module, outcome } = await loadFixture(path)
        current().fake.queueReply(module, { ...outcome, response: { ...outcome.response, cookie }, until })
      },
    },
    get serverLogs() {
      return current().serverLogs
    },
    clock: {
      advance: async (ms) => {
        await current().timers.tickAsync(ms)
        await Promise.all(devices.map(device => device.idle()))
      },
    },
  }
}
