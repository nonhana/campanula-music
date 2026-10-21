import type { Clock, MediaSessionCapability } from './browser'
import type { Player, PlayerState } from './player'
import { creditLine, thumbnailUrl } from '#lib/api/library.js'

// 锁屏和通知栏上的播放控件（Media Session，Spec #11“客户端：播放队列与播放”）：显示当前这首的封面、歌名、歌手、专辑和进度，
// 能暂停、接着放、切歌、拖进度条。按钮直接交给播放器，和界面上的按钮一样：上一首、下一首的换歌原因是 previous / next。
// 进度只在跳变时告诉浏览器（换歌、时长变了、暂停和接着放、拖进度条、缓冲卡住后对不上了），中间由浏览器按播放速度自己往前推。
// 下载了的歌（#38）用存在这台设备上的封面缩略图，断网时锁屏上照样有封面

/** 封面取多大的缩略图（px） */
const ARTWORK_SIZE = 512
/** 浏览器推算的进度和实际的差出这么多秒，就重新告诉它 */
const POSITION_DRIFT = 1

export interface MediaSessionContext {
  session: MediaSessionCapability
  MediaMetadata: typeof MediaMetadata
  clock: Clock
  player: Player
  /** 现在的播放状态：按锁屏上的播放、暂停时看要不要换 */
  read: () => PlayerState
  /** 下载了的歌存着的这张封面的本机地址；没有时是 null */
  localCover: (coverUrl: string) => string | null
}

/** 接上锁屏和通知栏上的按钮。返回的函数在播放状态每次变了时调，更新锁屏和通知栏上显示的 */
export function connectMediaSession({ session, MediaMetadata, clock, player, read, localCover }: MediaSessionContext): (state: PlayerState) => void {
  session.setActionHandler('play', () => {
    if (read().status === 'paused')
      player.toggle()
  })
  session.setActionHandler('pause', () => {
    if (read().status !== 'paused')
      player.toggle()
  })
  session.setActionHandler('previoustrack', () => player.previous())
  session.setActionHandler('nexttrack', () => player.next())
  session.setActionHandler('seekto', (details) => {
    if (details.seekTime !== undefined)
      player.seek(details.seekTime)
  })

  /** 锁屏上显示的是哪首歌；播放队列是空的时是 null */
  let shown: number | null = null
  /** 上次告诉浏览器的进度（at：那一刻，毫秒）：浏览器从这里按播放速度往前推 */
  let told: { songId: number, duration: number, position: number, playing: boolean, at: number } | null = null

  return (state) => {
    if (state.current === null) {
      if (shown !== null) {
        shown = null
        told = null
        session.metadata = null
        session.playbackState = 'none'
        session.setPositionState()
      }
      return
    }
    const { song } = state.queue[state.current]
    if (song.id !== shown) {
      shown = song.id
      session.metadata = new MediaMetadata({
        title: song.name,
        artist: creditLine(song.artists),
        album: song.album.name ?? '',
        artwork: [{ src: localCover(song.album.coverUrl) ?? thumbnailUrl(song.album.coverUrl, ARTWORK_SIZE), sizes: `${ARTWORK_SIZE}x${ARTWORK_SIZE}` }],
      })
    }
    // 取地址、缓冲时也算在放：锁屏上一直是暂停键，切歌时不闪成播放键
    const playing = state.status !== 'paused'
    session.playbackState = playing ? 'playing' : 'paused'
    const duration = state.duration ?? song.duration / 1000
    const position = Math.min(state.position, duration)
    const now = clock.now()
    if (told && told.songId === song.id && told.duration === duration && told.playing === playing) {
      const guessed = told.position + (playing ? (now - told.at) / 1000 : 0)
      if (Math.abs(position - guessed) <= POSITION_DRIFT)
        return
    }
    told = { songId: song.id, duration, position, playing, at: now }
    session.setPositionState({ duration, position, playbackRate: 1 })
  }
}
