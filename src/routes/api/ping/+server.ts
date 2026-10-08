import type { RequestHandler } from './$types'
import { instanceInfo } from '$lib/server/netease'
import { json } from '@sveltejs/kit'

/** 测往返时间用：不碰 SDK，不碰网易云。 */
export const GET: RequestHandler = () => json({ ...instanceInfo(), now: Date.now() })
