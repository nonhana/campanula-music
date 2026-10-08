import type { ModuleCallConfig, ModuleIdentifier, NcmApiResponse, RequestDebugEvent } from 'hana-music-api'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { env } from '$env/dynamic/private'
import { fingerprint } from './seal'

export type IpMode = 'default' | 'real' | 'none'

export interface CookieMeta {
  name: string
  empty: boolean
  maxAge?: number
  expires?: string
  path?: string
  /** 只给 MUSIC_U：值的指纹，用来比较续期前后是不是同一份。 */
  fp?: string
}

/** 这个函数实例的身份：冷启动、实例回收都靠它看出来。 */
const instance = { id: randomUUID().slice(0, 8), bootAt: Date.now(), calls: 0 }
let sdkImportMs: number | undefined
let sdk: Promise<typeof import('hana-music-api')> | undefined

function loadSdk() {
  if (!sdk) {
    const started = performance.now()
    sdk = import('hana-music-api').then((module) => {
      sdkImportMs = Math.round(performance.now() - started)
      return module
    })
  }
  return sdk
}

export function instanceInfo() {
  return {
    id: instance.id,
    region: process.env.VERCEL_REGION ?? 'local',
    bootAt: instance.bootAt,
    uptimeMs: Date.now() - instance.bootAt,
    calls: instance.calls,
    sdkImportMs,
  }
}

const CREDENTIAL_KEYS = new Set(['cookie', 'token', 'tokenJsonStr', 'MUSIC_U', 'MUSIC_A', '__csrf', 'csrf_token', 'accessToken', 'refreshToken'])
const CREDENTIAL_TEXT = /MUSIC_U=|MUSIC_A=|MUSIC_R_T=|MUSIC_A_T=|__csrf=/

/**
 * 凭据绝不离开服务器：返回体里凡是凭据字段、或含凭据的字符串，一律换成占位。
 * 例外：
 * - 扫码遇到 8821 时返回体里的 `token` 是行为验证用的，`verify_getQr` 要用，留着；
 * - `image_upload_token` 的 `token` 是浏览器直传这一张图用的上传凭证（放进 `x-nos-token`），本来就要交给浏览器。
 */
export function scrub(value: unknown, keepToken = false): unknown {
  if (Array.isArray(value))
    return value.map(item => scrub(item, keepToken))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      const secret = CREDENTIAL_KEYS.has(key) && !(keepToken && key === 'token') && item !== null && item !== ''
      return [key, secret ? '<redacted>' : scrub(item, keepToken)]
    }))
  }
  if (typeof value === 'string' && CREDENTIAL_TEXT.test(value))
    return '<redacted>'
  return value
}

export interface ParsedSetCookie {
  name: string
  value: string
  meta: CookieMeta
}

export function parseSetCookie(lines: readonly string[]): ParsedSetCookie[] {
  return lines.map((line) => {
    const [pair = '', ...attributes] = line.split(';')
    const eq = pair.indexOf('=')
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    const meta: CookieMeta = { name, empty: value === '' }
    for (const attribute of attributes) {
      const at = attribute.indexOf('=')
      const key = (at < 0 ? attribute : attribute.slice(0, at)).trim().toLowerCase()
      const raw = at < 0 ? '' : attribute.slice(at + 1).trim()
      if (key === 'max-age')
        meta.maxAge = Number(raw)
      else if (key === 'expires')
        meta.expires = raw
      else if (key === 'path')
        meta.path = raw
    }
    if (name === 'MUSIC_U' && value)
      meta.fp = fingerprint(value)
    return { name, value, meta }
  })
}

/** 把 Set-Cookie 叠到已有的凭据上：同名后者覆盖，空值或 Max-Age<=0 视为删除。 */
export function mergeCookies(base: Record<string, string>, parsed: readonly ParsedSetCookie[]): Record<string, string> {
  const next = { ...base }
  for (const { name, value, meta } of parsed) {
    if (!value || (meta.maxAge !== undefined && meta.maxAge <= 0))
      delete next[name]
    else
      next[name] = value
  }
  return next
}

function isResponse(value: unknown): value is NcmApiResponse {
  return typeof value === 'object' && value !== null && 'status' in value && 'body' in value && 'cookie' in value
}

function codeOf(body: unknown, status: number): number {
  if (body && typeof body === 'object' && 'code' in body)
    return Number((body as { code: unknown }).code)
  return status
}

function shapeOf(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object')
    return { type: typeof body }
  const shape: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (Array.isArray(value))
      shape[key] = `array(${value.length})`
    else if (value && typeof value === 'object')
      shape[key] = shapeOf(value)
    else if (['code', 'message', 'msg', 'more', 'hasMore', 'count', 'trackCount'].includes(key))
      shape[key] = value
  }
  return shape
}

export interface CallInput {
  module: string
  query: Record<string, unknown>
  ip: IpMode
  deviceId: string
  cookie?: Record<string, string>
  summary: boolean
  /** 不传就用 SDK 默认（读写 8 秒，上传类 5 分钟）。验证关卡②的大批量写操作要看真实耗时，才放宽。 */
  timeoutMs?: number
}

export async function callNetease(input: CallInput) {
  instance.calls += 1
  const cold = instance.calls === 1
  const { invokeModule } = await loadSdk()
  const events: Array<Omit<RequestDebugEvent, 'url'> & { path: string }> = []
  // 没配 GATE_REAL_IP 时 SDK 会悄悄退回默认伪装 IP，结果却标成 real，所以直接报错
  if (input.ip === 'real' && !env.GATE_REAL_IP)
    throw new Error('GATE_REAL_IP 未配置')
  // 顶层的 deviceId 不在 SDK 的类型里，但 1.4.0 的隐式匿名注册会用它（不传就每次随机生成，
  // 约一半摘要带 + 或 / 被网易云拒绝）。传入摘要干净的 deviceId，匿名注册就不再随机失败。
  const config = {
    cookie: input.cookie,
    deviceId: input.deviceId,
    state: input.ip === 'none' ? { deviceId: input.deviceId, cnIp: '' } : { deviceId: input.deviceId },
    ...(input.ip === 'real' ? { realIP: env.GATE_REAL_IP } : {}),
    onRequestEvent: ({ url, ...event }: RequestDebugEvent) => events.push({ ...event, path: new URL(url).pathname }),
    timeoutMs: input.timeoutMs,
  } as ModuleCallConfig
  const started = performance.now()
  let threw = false
  let response: NcmApiResponse
  try {
    response = await invokeModule(input.module as ModuleIdentifier, input.query as never, config) as NcmApiResponse
  }
  catch (error) {
    threw = true
    response = isResponse(error)
      ? error
      : { status: 502, cookie: [], body: { code: 502, msg: error instanceof Error ? error.message : String(error) } as never }
  }
  const durationMs = Math.round(performance.now() - started)
  const parsedCookies = parseSetCookie(response.cookie)
  const code = codeOf(response.body, response.status)
  const body = scrub(response.body, code === 8821 || input.module === 'image_upload_token')
  const bytes = Buffer.byteLength(JSON.stringify(response.body ?? null))
  const full = !input.summary || code !== 200 || threw
  return {
    result: {
      module: input.module,
      ip: input.ip,
      instance: { ...instanceInfo(), cold },
      durationMs,
      threw,
      status: response.status,
      code,
      bytes,
      ...(full ? { body } : { shape: shapeOf(response.body) }),
      setCookie: parsedCookies.map(cookie => cookie.meta),
      events,
    },
    parsedCookies,
    code,
  }
}
