import { getPlaylistById } from '$lib/server/services/playlistService'
import { json } from '@sveltejs/kit'

export async function GET({ params }) {
  const { id } = params
  const playlist = await getPlaylistById(id)
  return json(playlist)
}
