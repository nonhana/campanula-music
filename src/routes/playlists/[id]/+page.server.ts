import type { PageServerLoad } from './$types'
import { getPlaylistById, getPlaylistSongs } from '$lib/server/services/playlistService'

export const load: PageServerLoad = async ({ params }) => {
  const playlist = await getPlaylistById(params.id)
  const songs = await getPlaylistSongs(params.id)
  return { curPlaylist: playlist, curPlaylistSongs: songs }
}
