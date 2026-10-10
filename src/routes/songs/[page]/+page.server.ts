import type { PageServerLoad } from './$types'
import { getSongCount, getSongList } from '$lib/server/services/songService'

export const prerender = 'auto'
export async function entries() {
  const songCount = await getSongCount()
  const pagesToPrerender = Math.min(10, Math.ceil(songCount / 50))
  return Array.from({ length: pagesToPrerender }, (_, i) => ({ page: String(i + 1) }))
}

export const load: PageServerLoad = async ({ params }) => {
  const page = Number(params.page)
  const pageSize = 50
  const songList = await getSongList(page, pageSize)

  return {
    songList,
  }
}
