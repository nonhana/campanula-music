import type { LyricItem, NcmSongSource, SongItem } from '$lib/types'
import { NcmClientError } from '$lib/ncm/client'
import { fetchLyric, LYRIC_ERROR_TEXT } from '$lib/ncm/lyrics'
import { fetchSongUrls, SONG_URL_ERROR_TEXT } from '$lib/ncm/songs'
import { currentSoundLevel } from '$lib/soundLevel'
import { durationFormatter } from '$lib/utils'
import { get, writable } from 'svelte/store'
import { addMessage } from './messageStore'
import { addSongToPlaylist } from './playlistStore'

type PlayMode = 'repeatAll' | 'shuffle' | 'repeatOne' | 'sequential'
export const PLAY_MODE_MAP: Record<PlayMode, string> = {
  repeatAll: '循环播放',
  shuffle: '随机播放',
  repeatOne: '单曲循环',
  sequential: '顺序播放',
}

/** 正在加载 */
export const songLoading = writable(false)
/** 正在播放的歌曲 */
export const nowPlaying = writable<SongItem & { lyrics?: LyricItem[] } | null>(null)
/** 当前正在播放的歌曲的 url */
export const nowPlayingUrl = writable<string | null>(null)
/** 当前播放时间，单位：秒 */
export const currentTime = writable(0)
/** 是否正在拖动进度条 */
export const seeking = writable(false)
/** 是否暂停 */
export const paused = writable(true)
/** 播放模式 */
export const playMode = writable<PlayMode>('sequential')
/** 音量，初始为 10% */
export const volume = writable(0.1)
/** 是否静音 */
export const muted = writable(false)
/** 抽屉当前选中的菜单 */
export const selectedMenu = writable<'lyrics' | 'playlist'>('lyrics')
/** 是否正在查看歌曲信息（移动端） */
export const showDetail = writable(false)

// 变更 showDetail 状态
export function toggleShowDetail() {
  showDetail.update(v => !v)
}
// 设置 showDetail 状态
export function setShowDetail(value: boolean) {
  showDetail.set(value)
}
// 设置抽屉当前选中的菜单
export function setSelectedMenu(value: 'lyrics' | 'playlist') {
  selectedMenu.set(value)
}
// 设置歌曲加载状态
export function setSongLoading(value: boolean) {
  songLoading.set(value)
}
// 重置歌曲播放状态
export function reset() {
  nowPlaying.set(null)
  nowPlayingUrl.set(null)
  currentTime.set(0)
  setSeeking(false)
  setPaused(true)
  updateMediaSessionMetadata(null)
  updateMediaSessionPlaybackState(true)
}
// 请求控制器，用于取消请求
let controller: AbortController | null = null
// 设置当前播放的歌曲
export async function setNowPlaying(song: SongItem) {
  // 如果上一次还在加载，先取消掉
  if (controller)
    controller.abort('歌曲在加载过程中发生变化')
  controller = new AbortController()
  const signal = controller.signal

  setSongLoading(true)
  nowPlaying.set({ ...song })

  try {
    // 播放地址与歌词并行获取；歌词失败不阻断播放（fetchSongLyrics 内部消化）。
    // 音质档位取设置页当前所选（默认 standard）
    const [sources, lyrics] = await Promise.all([
      fetchSongUrls([song.id], get(currentSoundLevel), signal),
      fetchSongLyrics(song.id, signal),
    ])
    if (signal.aborted)
      return
    applySongSource(song, sources[0])
    // null = 歌词拉取失败（留空呈现占位）；空数组 = 无歌词（如实呈现）
    if (lyrics !== null)
      nowPlaying.update(current => (current ? { ...current, lyrics } : current))
  }
  catch (err) {
    if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
      return
    }
    console.error('加载歌曲失败:', err)
    setSongLoading(false)
    nowPlayingUrl.set(null)
    presentPlayError(err)
  }
}

/** 把门面返回的单曲来源落到播放器状态；命中试听片段/无版权时如实提示，不伪装成完整播放 */
function applySongSource(song: SongItem, source: NcmSongSource) {
  setSongLoading(false)

  if (source.status === 'unavailable') {
    nowPlayingUrl.set(null)
    setPaused(true)
    // 同步媒体会话：锁屏/系统媒体控制不残留上一首的标题与封面
    updateMediaSessionMetadata(song)
    addMessage({ message: `「${song.name}」无版权或资源不可用，无法播放`, type: 'warning' })
    return
  }

  nowPlayingUrl.set(source.url)
  updateMediaSessionMetadata(song)

  if (source.status === 'trial') {
    addMessage({
      message: `「${song.name}」为试听片段（${durationFormatter(source.trial.start)}–${durationFormatter(source.trial.end)}），非完整播放`,
      type: 'warning',
    })
  }
}

/** 门面调用失败：按领域错误码呈现文案（错误消息优先，缺失时回落按码文案） */
function presentPlayError(err: unknown) {
  const message = err instanceof NcmClientError
    ? (err.message || SONG_URL_ERROR_TEXT[err.code])
    : SONG_URL_ERROR_TEXT.UNKNOWN
  addMessage({ message, type: 'error' })
}

/** 歌词拉取：失败不阻断播放，按领域错误码提示并留空歌词（歌词视图如实呈现占位） */
async function fetchSongLyrics(id: number, signal: AbortSignal): Promise<LyricItem[] | null> {
  try {
    return await fetchLyric(id, signal)
  }
  catch (err) {
    if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
      return null
    }
    console.error('加载歌词失败:', err)
    const message = err instanceof NcmClientError
      ? (err.message || LYRIC_ERROR_TEXT[err.code])
      : LYRIC_ERROR_TEXT.UNKNOWN
    addMessage({ message, type: 'error' })
    return null
  }
}
// 添加到播放列表并立即播放
export function addToPlaylistAndPlay(song: SongItem) {
  addSongToPlaylist(song)
  setNowPlaying(song)
}
// 设置当前播放时间
export function setCurrentTime(time: number) {
  currentTime.set(time)
}
// 设置播放模式
export function setPlayMode(mode: PlayMode) {
  playMode.set(mode)
}
// 静音
export function mute() {
  muted.update(v => !v)
}
// 设置是否正在拖动进度条
export function setSeeking(value: boolean) {
  seeking.set(value)
}
// 设置是否暂停
export function setPaused(value: boolean) {
  paused.set(value)
}
// 更新 Media Session 元数据
export function updateMediaSessionMetadata(song: SongItem | null) {
  if (!('mediaSession' in navigator))
    return

  if (!song) {
    navigator.mediaSession.metadata = null
    return
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name,
      artist: song.artists.map(artist => artist.name).join(' / '),
      album: song.album.name,
      artwork: [
        {
          src: song.album.cover,
          sizes: '384x384',
          type: 'image/jpeg',
        },
      ],
    })
  }
  catch (error) {
    console.warn('Failed to update Media Session metadata:', error)
  }
}
// 注册 Media Session 事件处理器
export function registerMediaSessionHandlers(handlers: {
  onPlay: () => void
  onPause: () => void
  onPreviousTrack: () => void
  onNextTrack: () => void
}) {
  if (!('mediaSession' in navigator))
    return

  try {
    navigator.mediaSession.setActionHandler('play', () => {
      handlers.onPlay()
    })

    navigator.mediaSession.setActionHandler('pause', () => {
      handlers.onPause()
    })

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      handlers.onPreviousTrack()
    })

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      handlers.onNextTrack()
    })

    navigator.mediaSession.playbackState = 'none'
  }
  catch (error) {
    console.warn('Failed to register Media Session handlers:', error)
  }
}
// 更新 Media Session 的播放状态
export function updateMediaSessionPlaybackState(isPaused: boolean) {
  if (!('mediaSession' in navigator))
    return

  try {
    navigator.mediaSession.playbackState = isPaused ? 'paused' : 'playing'
  }
  catch (error) {
    console.warn('Failed to update Media Session playback state:', error)
  }
}
