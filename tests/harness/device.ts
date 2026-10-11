import type { App } from '$lib/app/app'
import type { BrowserCapabilities } from '$lib/app/browser'
import type { Cookie } from 'tough-cookie'
import { createApp } from '$lib/app/app'
import { CookieJar } from 'tough-cookie'

export interface SentRequest {
  method: string
  path: string
}

export interface Tab {
  app: App
}

/** 一台设备上的浏览器：自己的 Cookie，开出来的标签页共用 */
export interface Device {
  /** 打开一个标签页，等 App 打开完 */
  open: () => Promise<Tab>
  /** 这台设备向 Campanula 服务端发出的请求，按先后 */
  readonly requests: readonly SentRequest[]
  /** 这台设备存着的 Cookie（包括 httpOnly 的） */
  cookies: () => Promise<Cookie[]>
}

/** origin：测试进程里服务端的地址 */
export function createDevice(origin: string): Device {
  const jar = new CookieJar()
  const requests: SentRequest[] = []

  const capabilities: BrowserCapabilities = {
    // 和浏览器的同源请求一样：带上这台设备的 Cookie，存下服务端设的 Cookie
    async fetch(path, init) {
      const request = new Request(new URL(path, origin), init)
      const url = new URL(request.url)
      requests.push({ method: request.method, path: url.pathname + url.search })
      const cookie = await jar.getCookieString(request.url)
      if (cookie)
        request.headers.set('cookie', cookie)
      const response = await fetch(request)
      for (const setCookie of response.headers.getSetCookie())
        await jar.setCookie(setCookie, response.url)
      return response
    },
  }

  return {
    requests,
    async open() {
      const app = createApp(capabilities)
      await app.open()
      return { app }
    },
    cookies: () => jar.getCookies(origin),
  }
}
