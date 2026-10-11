/**
 * App 用到的浏览器能力。App 只从这里拿，不直接用 window、navigator 这些全局对象，
 * 测试接入点里整个换成替身（Spec #11 Testing Decisions）。
 */
export interface BrowserCapabilities {
  /** 向 Campanula 自己的服务端发请求：同源，浏览器自动带上 Cookie */
  fetch: (path: string, init?: RequestInit) => Promise<Response>
}

export function realBrowserCapabilities(): BrowserCapabilities {
  return {
    fetch: (path, init) => window.fetch(path, init),
  }
}
