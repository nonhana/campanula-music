import type { PageServerLoad } from './$types'
import { getAllPlaylists } from '$lib/server/services/playlistService'

export const load: PageServerLoad = async () => {
  const playlists = await getAllPlaylists()

  return {
    playlists,
  }
}
