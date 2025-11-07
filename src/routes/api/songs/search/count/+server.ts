import { getSearchSongCount } from '$lib/server/services/songService'
import { json } from '@sveltejs/kit'

export async function GET({ url }) {
  const keyword = url.searchParams.get('keyword')
  const count = await getSearchSongCount(keyword)
  return json({ count })
}
