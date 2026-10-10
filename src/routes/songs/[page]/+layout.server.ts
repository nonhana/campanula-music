import type { LayoutServerLoad } from './$types'
import { getSongCount } from '$lib/server/services/songService'

export const load: LayoutServerLoad = async () => {
  const songCount = await getSongCount()
  return { songCount, pageSize: 50 }
}
