import type { ApiResponse, SongUrlQuery, SongUrlResponse } from './types/index.js'
import { getSongUrlV1 } from './core/songUrl.js'

export async function getSongUrl(options: SongUrlQuery): Promise<ApiResponse<SongUrlResponse>> {
  const query: SongUrlQuery = {
    level: 'standard',
    crypto: 'eapi',
    ...options,
  }

  return await getSongUrlV1(query)
}

export async function getSongUrlSimple(options: SongUrlQuery): Promise<string | null> {
  try {
    const result = await getSongUrl(options)
    return result.body.data?.[0]?.url || null
  }
  catch {
    return null
  }
}

export { getSongUrlV1 } from './core/songUrl.js'

export type { ApiResponse, SongUrlQuery, SongUrlResponse } from './types/index.js'
