import type { Song } from '$lib/api/library'
import type { PlayerNotice, PlayerState } from '$lib/app/player'
import { failureText } from '../failure'
import { formatDuration } from '../library/view'

// 播放条、晨光行上怎么显示：界面组件只照着画

/** 当前这首；播放队列是空的时是 null */
export function currentSong(player: PlayerState): Song | null {
  return player.current === null ? null : player.queue[player.current].song
}

/** 显示的时长（秒）：音频还没加载出来、还不知道时长时，用歌曲信息里的 */
export function shownDuration(player: PlayerState): number {
  return player.duration ?? (currentSong(player)?.duration ?? 0) / 1000
}

/** 播放进度，0 到 1 */
export function progressOf(player: PlayerState): number {
  const duration = shownDuration(player)
  return duration > 0 ? Math.min(1, player.position / duration) : 0
}

/** 秒 → 分:秒 */
export function formatSeconds(seconds: number): string {
  return formatDuration(seconds * 1000)
}

/** 播放的提示说什么：发生了什么、能怎么办 */
export function noticeText(notice: PlayerNotice, player: PlayerState): string {
  switch (notice.kind) {
    case 'urlFailed':
      return `没取到播放地址，停下了。${failureText(notice.failure)}按播放键重试。`
    case 'streamFailed':
      return `音频没加载下来，停在 ${formatSeconds(player.position)}。网络正常后按播放键，从这里接着放。`
    case 'slow':
      return '网络有点慢，还在缓冲，接上了会接着放。'
    case 'skipped':
      return `网易云没给《${notice.song.name}》的播放地址，跳过了这首。`
    case 'nothingPlayable':
      return '播放队列里的歌都放不了：无版权，或者网易云没给播放地址。换一个列表点歌试试。'
    default: {
      const unhandled: never = notice
      throw new Error(`不认识的播放提示：${JSON.stringify(unhandled)}`)
    }
  }
}
