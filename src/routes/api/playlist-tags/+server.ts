import type { RequestHandler } from './$types'
import { endpoints } from '#lib/api/endpoints.js'
import { fetchPlaylistTags } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

// 歌单的标签库：编辑歌单的标签只能从这里选，每次都从网易云取
export const GET: RequestHandler = ({ cookies }) =>
  respondSignedIn(endpoints.playlistTags, cookies, async listener => ({ groups: await fetchPlaylistTags(listener) }))
