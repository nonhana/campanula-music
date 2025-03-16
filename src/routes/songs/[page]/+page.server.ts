import type { PageServerLoad } from './$types'
import { getSongList } from '$lib/server/services/songService'

export const load: PageServerLoad = async ({ params }) => {
  const page = Number(params.page)
  const songList = await getSongList(page, 50)

  return {
    songList,
  }
}
