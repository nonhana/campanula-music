import { getSongCount } from '$lib/server/services/songService'
import { json } from '@sveltejs/kit'

export async function GET() {
  const count = await getSongCount()
  return json({ count })
}
