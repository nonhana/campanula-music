import type { PageServerLoad } from './$types'
import { getAllPlaylists } from '$lib/server/services/playlistService'
import { getSongList } from '$lib/server/services/songService'

export const load: PageServerLoad = async () => {
  const playlists = await getAllPlaylists()
  const songList = await getSongList(1, 60)

  return {
    playlists,
    songList,
  }
}
