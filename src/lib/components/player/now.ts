import type { Song } from '#lib/api/library.js'
import type { PlayerState } from '#lib/app/player.js'

// 播放队列里“现在这一首”在界面上怎么读：歌曲行、播放条、播放页共用

/** 当前这首；播放队列是空的时是 null */
export const currentSong = (player: PlayerState): Song | null => player.current === null
  ? null
  : player.queue[player.current].song

/** 显示的时长（秒）：音频还没加载出来、还不知道时长时，用歌曲信息里的 */
export const shownDuration = (player: PlayerState): number => player.duration ?? (currentSong(player)?.duration ?? 0) / 1000

/** 播放进度，0 到 1 */
export const progressOf = (player: PlayerState): number => {
  const duration = shownDuration(player)
  return duration > 0
    ? Math.min(1, player.position / duration)
    : 0
}
