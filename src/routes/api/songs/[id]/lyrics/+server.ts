import { getSongLyric } from '$lib/server/services/songService'
import { json } from '@sveltejs/kit'

export async function GET({ params }) {
  const { id } = params
  const lyric = await getSongLyric(id)
  return json(lyric)
}
