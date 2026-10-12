import type { HeartsResponse } from '$lib/api/library'
import type { RequestHandler } from './$types'
import { fetchHearts } from '$lib/server/netease'
import { readId } from '$lib/server/request'
import { respondSignedIn } from '$lib/server/session'

// 红心了哪些歌：曲库同步的第一步，凭据失效时它最先认出来（网易云回 301）
export const GET: RequestHandler = ({ url, cookies }) => {
  const uid = readId('uid', url.searchParams.get('uid'))
  return respondSignedIn(cookies, async listener => ({ songIds: await fetchHearts(uid, listener) } satisfies HeartsResponse))
}
