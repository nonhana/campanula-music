import type { LyricItem, NcmSongSource, SongItem } from '$lib/types'
import { NcmClientError } from '$lib/ncm/client'
import { fetchLyric } from '$lib/ncm/lyrics'
import { fetchSongUrls } from '$lib/ncm/songs'
import { currentSoundLevel } from '$lib/soundLevel/currentSoundLevel'
import { DEFAULT_SOUND_LEVEL } from '$lib/soundLevel/levels'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { messages } from './messageStore'
import {
  nowPlaying,
  nowPlayingUrl,
  paused,
  reset,
  setNowPlaying,
  songLoading,
} from './nowPlayingStore'

vi.mock('$lib/ncm/songs', () => ({
  fetchSongUrls: vi.fn(),
  SONG_URL_ERROR_TEXT: {
    UNAUTHENTICATED: '播放歌曲需要账号许可：请先绑定网易云账号',
    RATE_LIMITED: '请求过于频繁，请稍后再试',
    RESOURCE_UNAVAILABLE: '该资源暂不可用',
    UNKNOWN: '获取播放地址失败，请稍后再试',
  },
}))

vi.mock('$lib/ncm/lyrics', () => ({
  fetchLyric: vi.fn(),
  LYRIC_ERROR_TEXT: {
    UNAUTHENTICATED: '获取歌词需要账号许可：请先绑定网易云账号',
    RATE_LIMITED: '请求过于频繁，请稍后再试',
    RESOURCE_UNAVAILABLE: '该歌曲歌词暂不可用（无版权）',
    UNKNOWN: '获取歌词失败，请稍后再试',
  },
}))

const mockedFetchSongUrls = vi.mocked(fetchSongUrls)
const mockedFetchLyric = vi.mocked(fetchLyric)

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

const lyrics: LyricItem[] = [
  { time: 1000, text: '第一句', translate: null },
  { time: 3500, text: '第二句', translate: 'Second line' },
]

beforeEach(() => {
  mockedFetchSongUrls.mockReset()
  mockedFetchLyric.mockReset()
  mockedFetchLyric.mockResolvedValue([])
  messages.set([])
  nowPlaying.set(null)
  nowPlayingUrl.set(null)
  paused.set(true)
  songLoading.set(false)
  currentSoundLevel.set(DEFAULT_SOUND_LEVEL)
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

  it('歌词随歌曲加载并写入 nowPlaying', async () => {
    mockedFetchSongUrls.mockResolvedValue([
      { id: song.id, status: 'playable', url: 'https://m701.music.126.net/a.mp3', trial: null },
    ])
    mockedFetchLyric.mockResolvedValue(lyrics)

    await setNowPlaying(song)

    expect(mockedFetchLyric).toHaveBeenCalledWith(song.id, expect.any(AbortSignal))
    expect(get(nowPlaying)?.lyrics).toEqual(lyrics)
  })

  it('无歌词：如实写入空数组，不伪造歌词', async () => {
    mockedFetchSongUrls.mockResolvedValue([
      { id: song.id, status: 'playable', url: 'https://m701.music.126.net/a.mp3', trial: null },
    ])
    mockedFetchLyric.mockResolvedValue([])

    await setNowPlaying(song)

    expect(get(nowPlaying)?.lyrics).toEqual([])
  })

  it('歌词接口失败：播放不受影响，按领域错误码提示文案', async () => {
    mockedFetchSongUrls.mockResolvedValue([
      { id: song.id, status: 'playable', url: 'https://m701.music.126.net/a.mp3', trial: null },
    ])
    mockedFetchLyric.mockRejectedValue(new NcmClientError('RATE_LIMITED', '请求过于频繁，请稍后再试'))

    await setNowPlaying(song)

    expect(get(nowPlayingUrl)).toBe('https://m701.music.126.net/a.mp3')
    expect(get(nowPlaying)?.lyrics).toBeUndefined()
    expect(get(messages).some(m => /请求过于频繁/.test(m.message ?? ''))).toBe(true)
  })

  it('设置页选定的音质档位用于获取播放地址', async () => {
    currentSoundLevel.set('lossless')
    mockedFetchSongUrls.mockResolvedValue([
      { id: song.id, status: 'playable', url: 'https://m701.music.126.net/a.mp3', trial: null },
    ])

    await setNowPlaying(song)

    expect(mockedFetchSongUrls).toHaveBeenCalledWith([song.id], 'lossless', expect.any(AbortSignal))
    expect(get(nowPlayingUrl)).toBe('https://m701.music.126.net/a.mp3')
  })

  it('切歌后迟到的歌词不覆盖新歌', async () => {
    mockedFetchSongUrls.mockResolvedValue([
      { id: song.id, status: 'playable', url: 'https://m701.music.126.net/a.mp3', trial: null },
    ])
    const { promise: firstLyric, resolve: resolveFirstLyric } = Promise.withResolvers<LyricItem[]>()
    mockedFetchLyric.mockImplementationOnce(() => firstLyric)
    const first = setNowPlaying(song)

    const songB: SongItem = { ...song, id: 347230, name: '七里香' }
    mockedFetchSongUrls.mockResolvedValue([
      { id: songB.id, status: 'playable', url: 'https://m701.music.126.net/b.mp3', trial: null },
    ])
    mockedFetchLyric.mockResolvedValue([{ time: 1000, text: '新歌歌词', translate: null }])
    await setNowPlaying(songB)

    // 上一首歌的歌词迟到归位，不得覆盖新歌（响应对齐到当前播放歌曲）
    resolveFirstLyric([{ time: 1000, text: '旧歌歌词', translate: null }])
    await first

    expect(get(nowPlaying)).toMatchObject({ id: songB.id })
    expect(get(nowPlaying)?.lyrics).toEqual([{ time: 1000, text: '新歌歌词', translate: null }])
  })
})

describe('reset', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'mediaSession')
    vi.unstubAllGlobals()
  })

  it('移除加载中的歌曲：迟到的播放地址不落 store，MediaSession 元数据不复活', async () => {
    const mediaSession = {
      metadata: null,
      playbackState: 'none',
      setActionHandler: vi.fn(),
    }
    Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: mediaSession })
    vi.stubGlobal('MediaMetadata', class {
      constructor(data: Record<string, unknown>) {
        Object.assign(this, data)
      }
    })

    const { promise: pendingFetch, resolve: resolveFetch } = Promise.withResolvers<NcmSongSource[]>()
    mockedFetchSongUrls.mockImplementationOnce(() => pendingFetch)
    const pending = setNowPlaying(song)
    expect(get(songLoading)).toBe(true)

    reset()

    expect(get(nowPlaying)).toBeNull()
    expect(get(nowPlayingUrl)).toBeNull()
    expect(get(songLoading)).toBe(false)
    expect(mediaSession.metadata).toBeNull()

    // 控制器已在 reset 中取消：迟到的成功响应不得写回 url / MediaSession
    resolveFetch([{ id: song.id, status: 'playable', url: 'https://m701.music.126.net/late.mp3', trial: null }])
    await pending

    expect(get(nowPlaying)).toBeNull()
    expect(get(nowPlayingUrl)).toBeNull()
    expect(get(songLoading)).toBe(false)
    expect(mediaSession.metadata).toBeNull()
  })

  it('移除加载中的歌曲：loading 复位为 false，迟到 resolve 后不再变回 true', async () => {
    const { promise: pendingFetch, resolve: resolveFetch } = Promise.withResolvers<NcmSongSource[]>()
    mockedFetchSongUrls.mockImplementationOnce(() => pendingFetch)
    const pending = setNowPlaying(song)
    expect(get(songLoading)).toBe(true)

    reset()
    expect(get(songLoading)).toBe(false)

    resolveFetch([{ id: song.id, status: 'playable', url: 'https://m701.music.126.net/late.mp3', trial: null }])
    await pending

    expect(get(songLoading)).toBe(false)
  })

  it('移除加载中的歌曲：迟到的失败响应不弹错误提示', async () => {
    const { promise: pendingFetch, reject: rejectFetch } = Promise.withResolvers<never>()
    mockedFetchSongUrls.mockImplementationOnce(() => pendingFetch)
    const pending = setNowPlaying(song)

    reset()

    rejectFetch(new NcmClientError('RATE_LIMITED', '请求过于频繁，请稍后再试'))
    await pending

    expect(get(messages)).toEqual([])
    expect(get(songLoading)).toBe(false)
  })
})
