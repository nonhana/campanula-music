import { songDetail as sdkSongDetail } from 'hana-music-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSongsInOrderByIds } from './songDetail'

vi.mock('hana-music-api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('hana-music-api')>()
  return { ...mod, songDetail: vi.fn() }
})

const mockedSongDetail = vi.mocked(sdkSongDetail)

/** 与 hana-music-api 的 song/detail 返回体一致的最小夹具 */
function songDetailBody(ids: number[]) {
  return {
    code: 200,
    songs: ids.map(id => ({
      id,
      name: `歌曲${id}`,
      dt: 180000,
      ar: [{ id: 6452, name: '周杰伦' }],
      al: { id: 21349, name: '叶惠美', picUrl: 'http://p1.music.126.net/c.jpg' },
    })),
  }
}

beforeEach(() => {
  mockedSongDetail.mockReset()
})

describe('fetchSongsInOrderByIds', () => {
  it('失败分片重试一次成功后整体返回，成功分片不重复请求', async () => {
    // 1001 个 id 强制分两片（TRACK_CHUNK_SIZE = 1000）：第二片首次失败、重试成功
    const ids = Array.from({ length: 1001 }, (_, i) => i + 1)
    let secondChunkCalls = 0
    mockedSongDetail.mockImplementation(async (query) => {
      const raw = query && typeof query === 'object' && 'ids' in query ? String(query.ids) : ''
      const chunkIds = raw.split(',').map(Number)
      if (chunkIds[0] === 1001) {
        secondChunkCalls++
        if (secondChunkCalls === 1) {
          // SDK 传输层超时失败形状（Error 载体 + SdkFailure 字段）
          throw Object.assign(new Error('Request timed out after 10000ms'), {
            status: 504,
            body: { code: 504, msg: 'Request timed out after 10000ms' },
          })
        }
      }
      return { body: songDetailBody(chunkIds) } as never
    })

    const songs = await fetchSongsInOrderByIds({ cookie: '' }, ids)

    expect(secondChunkCalls).toBe(2)
    expect(songs).toHaveLength(1001)
    // 归位到输入顺序：末尾仍是 id 1001
    expect(songs[1000]).toMatchObject({ id: 1001, name: '歌曲1001' })
  })

  it('分片重试仍失败 → 整体抛 RESOURCE_UNAVAILABLE，不静默缺歌', async () => {
    mockedSongDetail.mockRejectedValue({ status: 504, body: { code: 504, msg: 'Request timed out after 10000ms' } })

    await expect(fetchSongsInOrderByIds({ cookie: '' }, [1, 2])).rejects.toMatchObject(
      { name: 'NcmError', code: 'RESOURCE_UNAVAILABLE' },
    )
    // 首次请求 + 1 次重试
    expect(mockedSongDetail).toHaveBeenCalledTimes(2)
  })
})
