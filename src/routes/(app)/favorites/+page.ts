import type { NcmSong } from '$lib/types'
import type { PageLoad } from './$types'
import { NcmClientError } from '$lib/ncm/client'
import { fetchLikedPage, LIKE_ERROR_TEXT, LIKED_PAGE_SIZE } from '$lib/ncm/likes'

/** 我喜欢的音乐实时拉取（红心快照随账号变化），不走预渲染 */
export const prerender = false

/**
 * 我喜欢的音乐首屏数据：第一页曲目 + 红心总数。
 * 失败时携带按码映射后的页面文案，随 data 下发而非抛错，
 * 页面保持既有内联错误态（不落入 SvelteKit 错误页）。
 */
interface LikedPageData {
  firstPage: NcmSong[]
  total: number
  error: string | null
}

/** 直访首屏供数：服务端经 event.fetch 取第一页，响应内联进 HTML 可水合 */
export const load: PageLoad = async ({ fetch }): Promise<LikedPageData> => {
  try {
    const { songs, total } = await fetchLikedPage({ limit: LIKED_PAGE_SIZE, offset: 0 }, fetch)
    return { firstPage: songs, total, error: null }
  }
  catch (err) {
    return {
      firstPage: [],
      total: 0,
      error: err instanceof NcmClientError
        ? (err.message || LIKE_ERROR_TEXT[err.code])
        : LIKE_ERROR_TEXT.UNKNOWN,
    }
  }
}
