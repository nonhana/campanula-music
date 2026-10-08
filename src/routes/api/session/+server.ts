import type { RequestHandler } from './$types'
import { clearSlot, isSlot, readSlot, SLOTS, viewSlot } from '$lib/server/session'
import { error, json } from '@sveltejs/kit'

/** 只给看槽里有什么（方式、时间、Set-Cookie 属性、MUSIC_U 指纹），不给凭据的值。 */
export const GET: RequestHandler = ({ cookies }) => {
  const slots = SLOTS.flatMap((slot) => {
    const session = readSlot(cookies, slot)
    return session ? [viewSlot(slot, session)] : []
  })
  return json({ slots })
}

export const DELETE: RequestHandler = async ({ request, cookies }) => {
  const { slot } = await request.json() as { slot?: unknown }
  if (!isSlot(slot))
    error(400, 'slot')
  clearSlot(cookies, slot)
  return json({ cleared: slot })
}
