import type { LayoutServerLoad } from './$types'
import { getAllPlaylists } from '$lib/server/services/playlistService'

export const load: LayoutServerLoad = async () => {
  const playlists = await getAllPlaylists()

  return {
    playlists,
  }
}
