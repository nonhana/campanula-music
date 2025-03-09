import { getSongUrl } from '$lib/server/services/songService'
import { json } from '@sveltejs/kit'

export async function GET({ params }) {
  const { id } = params
  const url = await getSongUrl(id)
  return json(url)
}
