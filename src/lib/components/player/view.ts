import type { Song } from '$lib/api/library'
import type { LyricLine, LyricWord } from '$lib/api/playback'
import type { LibraryState } from '$lib/app/library'
import type { PlayerNotice, PlayerState, PlaySource, SongChange } from '$lib/app/player'
import { failureText } from '../failure'
import { formatDuration, playlistName } from '../library/view'

// 播放条、晨光行、播放页上怎么显示：界面组件只照着画

/** 当前这首；播放队列是空的时是 null */
export function currentSong(player: PlayerState): Song | null {
  return player.current === null ? null : player.queue[player.current].song
}

/** 显示的时长（秒）：音频还没加载出来、还不知道时长时，用歌曲信息里的 */
export function shownDuration(player: PlayerState): number {
  return player.duration ?? (currentSong(player)?.duration ?? 0) / 1000
}

/** 换歌时封面、歌名往哪边走（DESIGN.md Cover Wheel）：left 往左转、right 往右转，fade 原地交叉淡化 */
export type Turn = 'left' | 'right' | 'fade'

/** 换碟在哪：page 是播放页，bar 是播放条（桌面底栏、手机迷你条） */
export type Place = 'page' | 'bar'

/**
 * 换碟往哪转，只看 App 发布的换歌原因：下一首、自动接续、跳过往左，上一首往右；没有原因（还没换过歌）时直接换上。
 * 点选：播放页里是在播放队列里点的，往左转；播放条上是在列表里点的，那一行的封面会飞进来（#53），这之前先交叉淡化
 */
export function turnOf(change: SongChange | null, place: Place): Turn | null {
  switch (change) {
    case null:
      return null
    case 'next':
    case 'continue':
    case 'skip':
      return 'left'
    case 'previous':
      return 'right'
    case 'pick':
      return place === 'page' ? 'left' : 'fade'
    default: {
      const unhandled: never = change
      throw new Error(`不认识的换歌原因：${JSON.stringify(unhandled)}`)
    }
  }
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

/** 播放来源叫什么（“来自「我喜欢的音乐」”）；曲库里找不到（歌单在网易云里删掉了、专辑页还没打开过）时是 null */
export function sourceName(library: LibraryState | null, source: PlaySource): string | null {
  if (!library)
    return null
  switch (source.kind) {
    case 'playlist': {
      const playlist = library.playlists?.find(each => each.id === source.id)
      return playlist ? playlistName(playlist) : null
    }
    case 'album': {
      const page = library.albumPage(source.id)
      return page?.status === 'shown' ? page.content.album.name : library.albums?.find(album => album.id === source.id)?.name ?? null
    }
    case 'artist': {
      const page = library.artistPage(source.id)
      return page?.status === 'shown' ? page.content.artist.name : library.artists?.find(artist => artist.id === source.id)?.name ?? null
    }
    default: {
      const unhandled: never = source.kind
      throw new Error(`不认识的播放来源：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 正在唱的那一行：已经开始的最后一行（间奏时还是上一行）；第一行开始之前是 -1 */
export function lineIndexAt(lines: readonly LyricLine[], at: number): number {
  let low = 0
  let high = lines.length - 1
  let found = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (lines[middle].start <= at) {
      found = middle
      low = middle + 1
    }
    else {
      high = middle - 1
    }
  }
  return found
}

/** 一个词唱到了几成，0 到 1 */
export function wordProgress(word: LyricWord, at: number): number {
  if (at <= word.start)
    return 0
  if (at >= word.end)
    return 1
  return (at - word.start) / (word.end - word.start)
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
