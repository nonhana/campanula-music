import type { NcmPlaylistDetail, NcmSong } from '$lib/types'
import type { PageLoad } from './$types'
import { NcmClientError } from '$lib/ncm/client'
import { fetchPlaylistDetail, fetchPlaylistTracks, PLAYLIST_ERROR_TEXT, PLAYLIST_PAGE_SIZE } from '$lib/ncm/playlists'

/** 歌单详情按 id 实时拉取（Ticket 05 接入门面），不走预渲染 */
export const prerender = false

/**
 * 歌单详情页首屏数据：详情头 + 第一页曲目。
 * 失败时 detail 为空并携带按码映射后的页面文案，随 data 下发而非抛错，
 * 页面保持既有内联错误态（不落入 SvelteKit 错误页）。
 */
interface PlaylistPageData {
  detail: NcmPlaylistDetail | null
  firstPage: NcmSong[]
  error: string | null
}

/** 直访首屏供数：服务端经 event.fetch 并行取头信息与第一页，响应内联进 HTML 可水合 */
export const load: PageLoad = async ({ fetch, params }): Promise<PlaylistPageData> => {
  const id = Number(params.id)
  try {
    const [detail, firstPage] = await Promise.all([
      fetchPlaylistDetail(id, fetch),
      fetchPlaylistTracks(id, { limit: PLAYLIST_PAGE_SIZE, offset: 0 }, fetch),
    ])
    return { detail, firstPage, error: null }
  }
  catch (err) {
    return {
      detail: null,
      firstPage: [],
      error: err instanceof NcmClientError
        ? (err.message || PLAYLIST_ERROR_TEXT[err.code])
        : PLAYLIST_ERROR_TEXT.UNKNOWN,
    }
  }
}
