import type { PageServerLoad } from './$types'
import { getSongCount, getSongList } from '$lib/server/services/songService'

export const prerender = true
export async function entries() {
  const songCount = await getSongCount()
  return Array.from({ length: Math.ceil(songCount / 50) }, (_, i) => ({ page: String(i + 1) }))
}

export const load: PageServerLoad = async ({ params }) => {
  const page = Number(params.page)
  const songList = await getSongList(page, 50)

  return {
    songList,
  }
}
