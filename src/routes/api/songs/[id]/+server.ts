import { getSongDetail } from '$lib/server/services/songService'
import { json } from '@sveltejs/kit'

export async function GET({ params }) {
  const { id } = params
  const song = await getSongDetail(id)
  return json(song)
}
