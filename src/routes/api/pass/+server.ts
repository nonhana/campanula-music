import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import { sameSecret } from '$lib/server/seal'
import { grantPass } from '$lib/server/session'
import { json } from '@sveltejs/kit'

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { passcode } = await request.json().catch(() => ({})) as { passcode?: unknown }
  if (typeof passcode !== 'string' || !env.GATE_PASSCODE || !sameSecret(passcode, env.GATE_PASSCODE)) {
    await new Promise(resolve => setTimeout(resolve, 800))
    return json({ ok: false }, { status: 401 })
  }
  grantPass(cookies)
  return json({ ok: true })
}
