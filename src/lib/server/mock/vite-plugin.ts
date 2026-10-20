// mock 的 Vite 插件：只在 CAMPANULA_MOCK=1 的 dev 服务器里把服务端 import 'hana-music-api' 换成 mock，
// 并挂上自动登录、重置、场景、覆盖报告和本地资源的路由。生产构建不加载这个插件（#58）。
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, RunnableDevEnvironment, ViteDevServer } from 'vite'
import type { MockConfig, ScenarioName } from './scenarios.ts'
import { Buffer } from 'node:buffer'
import { fileURLToPath } from 'node:url'
import { audioWav, coverSvg, saveUpload, uploadOf } from './assets.ts'
import { isScenarioName } from './scenarios.ts'

const RUNTIME = fileURLToPath(new URL('./runtime.ts', import.meta.url))
const CREDENTIALS = fileURLToPath(new URL('../credentials.ts', import.meta.url))

interface Configured {
  status: () => { enabled: true, scenario: ScenarioName, seed: string, offline: boolean }
  loginCredentials: () => { deviceId: string, credentials: Record<string, string> }
  configure: (input: ScenarioName | (Partial<MockConfig> & { name?: ScenarioName })) => Promise<void>
  reset: () => Promise<void>
  coverage: () => Promise<Record<string, unknown>>
}

function runtimeOf(server: ViteDevServer): Promise<Configured> {
  const runner = (server.environments.ssr as RunnableDevEnvironment).runner
  return runner.import(RUNTIME) as Promise<Configured>
}

function credentialsOf(server: ViteDevServer): Promise<{ loginCookieHeader: (deviceId: string, credentials: Record<string, string>) => string }> {
  const runner = (server.environments.ssr as RunnableDevEnvironment).runner
  return runner.import(CREDENTIALS) as Promise<{ loginCookieHeader: (deviceId: string, credentials: Record<string, string>) => string }>
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req)
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return Buffer.concat(chunks)
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(value))
}

function redirect(res: ServerResponse, location: string, cookie: string): void {
  res.statusCode = 303
  res.setHeader('set-cookie', cookie)
  res.setHeader('location', location)
  res.end()
}

function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

async function handle(server: ViteDevServer, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  if (!path.startsWith('/api/mock/') && path !== '/mock/login' && path !== '/mock' && !path.startsWith('/mock-assets/'))
    return false

  const runtime = await runtimeOf(server)

  if (path === '/mock' || path === '/mock/login' || path === '/api/mock/login') {
    if (req.method !== 'GET' && req.method !== 'POST') {
      json(res, 405, { error: '只支持 GET 或 POST' })
      return true
    }
    const { deviceId, credentials } = runtime.loginCredentials()
    const { loginCookieHeader } = await credentialsOf(server)
    redirect(res, safeNext(url.searchParams.get('next')), loginCookieHeader(deviceId, credentials))
    return true
  }

  if (path === '/api/mock/status' && req.method === 'GET') {
    json(res, 200, runtime.status())
    return true
  }

  if (path === '/api/mock/coverage' && req.method === 'GET') {
    json(res, 200, await runtime.coverage())
    return true
  }

  if (path === '/api/mock/reset' && req.method === 'POST') {
    await runtime.reset()
    json(res, 200, { reset: true })
    return true
  }

  if (path === '/api/mock/scenario' && req.method === 'POST') {
    const body = (await readBody(req)).toString('utf8')
    const input = body ? JSON.parse(body) as ScenarioName | (Partial<MockConfig> & { name?: ScenarioName }) : 'default'
    if (typeof input === 'object' && input.name !== undefined && !isScenarioName(input.name)) {
      json(res, 400, { error: `不认识的 mock 场景：${String(input.name)}` })
      return true
    }
    await runtime.configure(input)
    json(res, 200, runtime.status())
    return true
  }

  if (path.startsWith('/api/mock/upload/') && (req.method === 'PUT' || req.method === 'POST')) {
    const imgId = decodeURIComponent(path.slice('/api/mock/upload/'.length))
    const bytes = await readBody(req)
    saveUpload(imgId, req.headers['content-type'] ?? 'application/octet-stream', bytes)
    json(res, 200, { code: 200 })
    return true
  }

  if (path.startsWith('/mock-assets/cover/') && path.endsWith('.svg')) {
    res.statusCode = 200
    res.setHeader('content-type', 'image/svg+xml; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.end(coverSvg(path.slice('/mock-assets/cover/'.length, -'.svg'.length)))
    return true
  }

  if (path.startsWith('/mock-assets/audio/') && path.endsWith('.wav')) {
    const id = Number(path.slice('/mock-assets/audio/'.length, -'.wav'.length))
    const bytes = audioWav(Number.isFinite(id) ? id : 0)
    res.statusCode = 200
    res.setHeader('content-type', 'audio/wav')
    res.setHeader('content-length', String(bytes.length))
    res.setHeader('cache-control', 'no-store')
    res.end(bytes)
    return true
  }

  if (path.startsWith('/mock-assets/uploads/')) {
    const upload = uploadOf(path.slice('/mock-assets/uploads/'.length))
    if (!upload) {
      res.statusCode = 404
      res.end('没有这张上传的图片')
      return true
    }
    res.statusCode = 200
    res.setHeader('content-type', upload.type)
    res.setHeader('cache-control', 'no-store')
    res.end(upload.bytes)
    return true
  }

  if (path.startsWith('/api/mock/')) {
    json(res, 404, { error: `没有 ${path}` })
    return true
  }
  return false
}

/** 只在 dev + CAMPANULA_MOCK=1 时加到 vite 插件里；生产构建不会加载 mock 代码 */
export function mockPlugin(): Plugin {
  return {
    name: 'campanula:mock-sdk',
    enforce: 'pre',
    config: () => ({ ssr: { noExternal: ['hana-music-api'] } }),
    resolveId(id) {
      if (id === 'hana-music-api')
        return RUNTIME
      if (id.startsWith('hana-music-api/'))
        throw new Error(`mock 只替换了 hana-music-api 本身，服务端不能引用 ${id}`)
      return null
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handle(server, req, res).then((handled) => {
          if (!handled)
            next()
        }, (error: unknown) => {
          console.error('mock 路由出错', error)
          if (!res.headersSent)
            json(res, 500, { error: 'mock 路由出错', message: String(error) })
          else
            res.end()
        })
      })
    },
  }
}
