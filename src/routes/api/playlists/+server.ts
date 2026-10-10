import { getAllPlaylists } from '$lib/server/services/playlistService'
import { json } from '@sveltejs/kit'

export async function GET() {
  const playlists = await getAllPlaylists()
  return json(playlists)
}
