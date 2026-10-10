import type { LyricItem, SongItem } from '$lib/types'
import { writable } from 'svelte/store'
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
// 获取歌曲 url
export async function getSongUrl(song: SongItem, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`/api/songs/${song.id}/url`, { signal })
  return await res.json()
}
// 获取歌词
export async function getLyrics(song: SongItem, signal?: AbortSignal): Promise<LyricItem[]> {
  const res = await fetch(`/api/songs/${song.id}/lyrics`, { signal })
  return await res.json()
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
    const [source, lyrics] = await Promise.all([
      getSongUrl(song, signal),
      getLyrics(song, signal),
    ])

    if (signal.aborted)
      return

    nowPlayingUrl.set(source)
    updateMediaSessionMetadata(song)

    nowPlaying.update(s =>
      s && s.id === song.id ? { ...s, lyrics } : s,
    )
  }
  catch (err: any) {
    if (err.name === 'AbortError') {
      return
    }
    console.error('加载歌曲失败:', err)
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
