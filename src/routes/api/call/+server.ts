import type { IpMode } from '$lib/server/netease'
import type { NeSession, Slot, SlotView } from '$lib/server/session'
import type { RequestHandler } from './$types'
import { callNetease, mergeCookies } from '$lib/server/netease'
import { fingerprint } from '$lib/server/seal'
import { deviceIdOf, isSlot, readSlot, sessionFrom, viewSlot, writeSlot } from '$lib/server/session'
import { error, json } from '@sveltejs/kit'

const IP_MODES: readonly IpMode[] = ['default', 'real', 'none']
const SAVES = ['sms', 'qr', 'refresh'] as const
type Save = typeof SAVES[number]

/**
 * 通用调用口：用指定槽里的凭据调一个 SDK 模块。
 * - save: 'sms' | 'qr'：登录成功（短信 200、扫码 803）且拿到 MUSIC_U 时存进对应槽；
 * - save: 'refresh'：续期成功时把旧凭据挪到 `<槽>_prev`，新凭据叠到原槽。
 * 手机号、验证码只在请求体里，不记日志。
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  const input = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!input || typeof input.module !== 'string' || !/^\w+$/.test(input.module))
    error(400, 'module')
  const query = input.query ?? {}
  if (typeof query !== 'object' || query === null || Array.isArray(query))
    error(400, 'query')
  const ip = (input.ip ?? 'default') as IpMode
  if (!IP_MODES.includes(ip))
    error(400, 'ip')
  const slot = input.slot ?? 'none'
  if (slot !== 'none' && !isSlot(slot))
    error(400, 'slot')
  const save = input.save as Save | undefined
  if (save !== undefined && !SAVES.includes(save))
    error(400, 'save')

  const session = slot === 'none' ? null : readSlot(cookies, slot)
  if (slot !== 'none' && !session)
    return json({ error: `槽 ${slot} 是空的` }, { status: 409 })
  const deviceId = session?.deviceId ?? deviceIdOf(cookies)
  const { result, parsedCookies, code } = await callNetease({
    module: input.module,
    query: query as Record<string, unknown>,
    ip,
    deviceId,
    cookie: session?.cookie,
    summary: input.summary === true,
  })

  const gotMusicU = parsedCookies.some(cookie => cookie.name === 'MUSIC_U' && cookie.value)
  let saved: SlotView | undefined
  if (gotMusicU && ((save === 'sms' && code === 200) || (save === 'qr' && code === 803))) {
    const next = sessionFrom(save, mergeCookies({}, parsedCookies), deviceId, result.setCookie)
    writeSlot(cookies, save, next)
    saved = viewSlot(save, next)
  }
  if (gotMusicU && save === 'refresh' && session && (slot === 'sms' || slot === 'qr') && code === 200) {
    writeSlot(cookies, `${slot}_prev` as Slot, session)
    const merged = mergeCookies(session.cookie, parsedCookies)
    const next: NeSession = { ...session, cookie: merged, refreshedAt: Date.now(), setCookie: result.setCookie, fp: fingerprint(merged.MUSIC_U ?? '') }
    writeSlot(cookies, slot, next)
    saved = viewSlot(slot, next)
  }
  return json({ ...result, slot, sessionFp: session?.fp, saved })
}
