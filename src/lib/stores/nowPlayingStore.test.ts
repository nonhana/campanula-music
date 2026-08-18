import type { SongItem } from '$lib/types'
import { NcmClientError } from '$lib/ncm/client'
import { fetchSongUrls } from '$lib/ncm/songs'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { messages } from './messageStore'
import {
  nowPlaying,
  nowPlayingUrl,
  paused,
  setNowPlaying,
  songLoading,
} from './nowPlayingStore'

vi.mock('$lib/ncm/songs', () => ({
  fetchSongUrls: vi.fn(),
  DEFAULT_SOUND_LEVEL: 'standard',
  SONG_URL_ERROR_TEXT: {
    UNAUTHENTICATED: '播放歌曲需要账号许可：请先绑定网易云账号',
    RATE_LIMITED: '请求过于频繁，请稍后再试',
    RESOURCE_UNAVAILABLE: '该资源暂不可用',
    UNKNOWN: '获取播放地址失败，请稍后再试',
  },
}))

const mockedFetchSongUrls = vi.mocked(fetchSongUrls)

const song: SongItem = {
  id: 186016,
  name: '晴天',
  cover: '',
  alias: [],
  artists: [{ id: 6452, name: '周杰伦' }],
  album: { id: 21349, name: '叶惠美', cover: '' },
  duration: 269000,
  sourceId: '186016',
}

beforeEach(() => {
  mockedFetchSongUrls.mockReset()
  messages.set([])
  nowPlaying.set(null)
  nowPlayingUrl.set(null)
  paused.set(true)
  songLoading.set(false)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('setNowPlaying', () => {
  it('可播歌曲：写入播放地址并呈现歌曲，无试听提示', async () => {
    mockedFetchSongUrls.mockResolvedValue([
      { id: song.id, status: 'playable', url: 'https://m701.music.126.net/a.mp3', trial: null },
    ])

    await setNowPlaying(song)

    expect(mockedFetchSongUrls).toHaveBeenCalledWith([song.id], 'standard', expect.any(AbortSignal))
    expect(get(nowPlayingUrl)).toBe('https://m701.music.126.net/a.mp3')
    expect(get(nowPlaying)).toMatchObject({ id: song.id, name: '晴天' })
    expect(get(songLoading)).toBe(false)
    expect(get(messages).some(m => /试听片段/.test(m.message ?? ''))).toBe(false)
  })

  it('试听片段：如实播放并提示非完整歌曲', async () => {
    mockedFetchSongUrls.mockResolvedValue([
      { id: song.id, status: 'trial', url: 'https://m701.music.126.net/trial.mp3', trial: { start: 0, end: 60000 } },
    ])

    await setNowPlaying(song)

    expect(get(nowPlayingUrl)).toBe('https://m701.music.126.net/trial.mp3')
    expect(get(messages).some(m => /试听片段.*非完整播放/.test(m.message ?? ''))).toBe(true)
  })

  it('无版权：不设播放地址并提示资源不可用', async () => {
    mockedFetchSongUrls.mockResolvedValue([
      { id: song.id, status: 'unavailable', url: null, trial: null },
    ])

    await setNowPlaying(song)

    expect(get(nowPlayingUrl)).toBeNull()
    expect(get(paused)).toBe(true)
    expect(get(songLoading)).toBe(false)
    expect(get(messages).some(m => /无版权|资源不可用/.test(m.message ?? ''))).toBe(true)
  })

  it('门面失败：按领域错误码提示文案', async () => {
    mockedFetchSongUrls.mockRejectedValue(new NcmClientError('RATE_LIMITED', '请求过于频繁，请稍后再试'))

    await setNowPlaying(song)

    expect(get(nowPlayingUrl)).toBeNull()
    expect(get(songLoading)).toBe(false)
    expect(get(messages).some(m => /请求过于频繁/.test(m.message ?? ''))).toBe(true)
  })

  it('快速切歌：上一次未完成请求被取消，不覆盖新歌', async () => {
    const { promise: firstFetch, reject: rejectFirst } = Promise.withResolvers<never>()
    mockedFetchSongUrls.mockImplementationOnce(() => firstFetch)
    const first = setNowPlaying(song)

    const songB: SongItem = { ...song, id: 347230, name: '七里香' }
    mockedFetchSongUrls.mockResolvedValueOnce([
      { id: songB.id, status: 'playable', url: 'https://m701.music.126.net/b.mp3', trial: null },
    ])
    await setNowPlaying(songB)

    rejectFirst(new DOMException('aborted', 'AbortError'))
    await first

    expect(get(nowPlaying)).toMatchObject({ id: songB.id, name: '七里香' })
    expect(get(nowPlayingUrl)).toBe('https://m701.music.126.net/b.mp3')
  })
})
