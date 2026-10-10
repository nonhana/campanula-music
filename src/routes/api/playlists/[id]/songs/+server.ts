import { getPlaylistSongs } from '$lib/server/services/playlistService'
import { json } from '@sveltejs/kit'

export async function GET({ params }) {
  const { id } = params
  const songs = await getPlaylistSongs(id)
  return json(songs)
}
