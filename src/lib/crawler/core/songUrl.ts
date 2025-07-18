import type { ApiResponse, SongUrlQuery, SongUrlResponse } from '../types/index.js'
import { createNeteaseRequest } from './request.js'

export async function getSongUrlV1(query: SongUrlQuery): Promise<ApiResponse<SongUrlResponse>> {
  const data: Record<string, any> = {
    ids: `[${query.id}]`,
    level: query.level,
    encodeType: 'flac',
  }

  if (data.level === 'sky') {
    data.immerseType = 'c51'
  }

  return createNeteaseRequest('/api/song/enhance/player/url/v1', data, query)
}
