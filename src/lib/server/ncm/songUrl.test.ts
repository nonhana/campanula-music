import { songUrlV1 as sdkSongUrlV1 } from 'hana-music-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mapSongUrlList, ncmSongUrl } from './songUrl'

vi.mock('hana-music-api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('hana-music-api')>()
  return { ...mod, songUrlV1: vi.fn() }
})

const mockedSongUrl = vi.mocked(sdkSongUrlV1)

/** 与 hana-music-api 的 song_url_v1 返回体一致的最小夹具 */
function sdkBody(data: unknown[]) {
  return { code: 200, data }
}

beforeEach(() => {
  mockedSongUrl.mockReset()
})

describe('mapSongUrlList', () => {
  it('完整可播：url 存在且无试听信息，映射为 playable', () => {
    const sources = mapSongUrlList(sdkBody([
      { id: 186016, url: 'http://m8.music.126.net/a.mp3', br: 128000, fee: 0, payed: 0, freeTrialInfo: null },
    ]), [186016])

    expect(sources).toEqual([
      { id: 186016, status: 'playable', url: 'https://m8.music.126.net/a.mp3', trial: null },
    ])
  })

  it('播放地址统一为 https（上游偶发 http，https 部署下会被浏览器拦截）', () => {
    const sources = mapSongUrlList(sdkBody([
      { id: 7, url: 'http://m8.music.126.net/b.mp3', freeTrialInfo: null },
    ]), [7])

    expect(sources[0]).toMatchObject({ url: 'https://m8.music.126.net/b.mp3' })
  })

  it('试听片段：freeTrialInfo 含起止时如实标记 trial 并携带起止', () => {
    const sources = mapSongUrlList(sdkBody([
      {
        id: 186016,
        url: 'https://m701.music.126.net/trial.mp3',
        freeTrialInfo: { start: 0, end: 60000 },
        freeTrialPrivilege: { resConsumable: false, userConsumable: false },
      },
    ]), [186016])

    expect(sources).toEqual([
      { id: 186016, status: 'trial', url: 'https://m701.music.126.net/trial.mp3', trial: { start: 0, end: 60000 } },
    ])
  })

  it('无版权：url 为空时映射为 unavailable，不伪装成可播', () => {
    const sources = mapSongUrlList(sdkBody([{ id: 6452, url: null, fee: 1 }]), [6452])

    expect(sources).toEqual([{ id: 6452, status: 'unavailable', url: null, trial: null }])
  })

  it('返回体缺失对应条目时按 unavailable 对齐到请求 id', () => {
    const sources = mapSongUrlList(sdkBody([{ id: 1, url: 'https://x.mp3', freeTrialInfo: null }]), [1, 2])

    expect(sources).toEqual([
      { id: 1, status: 'playable', url: 'https://x.mp3', trial: null },
      { id: 2, status: 'unavailable', url: null, trial: null },
    ])
  })

  it('非数组 data 视为无来源', () => {
    expect(mapSongUrlList({ data: null }, [1])).toEqual([{ id: 1, status: 'unavailable', url: null, trial: null }])
  })
})

describe('ncmSongUrl', () => {
  it('按音质档位调用 song_url_v1 并返回对齐的来源列表', async () => {
    mockedSongUrl.mockResolvedValue({
      body: sdkBody([{ id: 186016, url: 'https://m701.music.126.net/a.mp3', freeTrialInfo: null }]),
    } as never)

    const sources = await ncmSongUrl({ cookie: '' }, { ids: [186016], level: 'standard' })

    expect(mockedSongUrl).toHaveBeenCalledWith(
      { id: '186016', level: 'standard' },
      undefined,
    )
    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({ id: 186016, status: 'playable' })
  })

  it('高级音质档位原样传递且携带绑定凭据', async () => {
    mockedSongUrl.mockResolvedValue({ body: sdkBody([]) } as never)

    await ncmSongUrl({ cookie: 'MUSIC_U=abc' }, { ids: [1], level: 'hires' })

    expect(mockedSongUrl).toHaveBeenCalledWith({ id: '1', level: 'hires' }, { cookie: 'MUSIC_U=abc' })
  })

  it('ids 超分片上限时分片请求并合并结果', async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => i + 1)
    mockedSongUrl.mockImplementation(async ({ id }) => ({
      body: sdkBody(String(id).split(',').map(rawId => ({ id: Number(rawId), url: `https://x/${rawId}.mp3`, freeTrialInfo: null }))),
    }) as never)

    const sources = await ncmSongUrl({ cookie: '' }, { ids, level: 'standard' })

    expect(mockedSongUrl).toHaveBeenCalledTimes(2)
    expect(sources).toHaveLength(1001)
    expect(sources[1000]).toMatchObject({ id: 1001, status: 'playable' })
  })

  it('sDK 失败映射为领域错误', async () => {
    mockedSongUrl.mockRejectedValue({ status: 429, body: { code: -460, msg: '操作太频繁' } })

    await expect(ncmSongUrl({ cookie: '' }, { ids: [1], level: 'standard' })).rejects.toMatchObject(
      { name: 'NcmError', code: 'RATE_LIMITED' },
    )
  })
})
