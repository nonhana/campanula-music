import { searchSongs } from '$lib/server/services/songService'
import { json } from '@sveltejs/kit'

export async function GET({ url }) {
  const keyword = url.searchParams.get('keyword')
  const songs = await searchSongs(keyword)
  return json(songs)
}
