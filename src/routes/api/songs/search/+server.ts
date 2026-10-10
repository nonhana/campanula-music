import { searchSongs } from '$lib/server/services/songService'
import { json } from '@sveltejs/kit'

export async function GET({ url }) {
  const keyword = url.searchParams.get('keyword')
  const page = Number.parseInt(url.searchParams.get('page') || '1')
  const pageSize = Number.parseInt(url.searchParams.get('pageSize') || '100')
  const songs = await searchSongs(keyword, page, pageSize)
  return json(songs)
}
