import type { Song } from '#lib/api/library.js'
import type { LyricLine, LyricWord, PlaySource } from '#lib/api/playback.js'
import type { LibraryState } from '#lib/app/library.js'
import type { PlayerNotice, PlayerState, PlayMode, SongChange } from '#lib/app/player.js'
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

/** 按上一首、下一首会换到的那首（手机播放页拖封面时从两边转进来）；没有别的歌可换时是 null */
export function neighborSong(player: PlayerState, direction: keyof PlayerState['neighbors']): Song | null {
  const index = player.neighbors[direction]
  return index === null ? null : player.queue[index].song
}

/**
 * 封面的小缩略图按多大取（Cover 的 size，取的是 96px 的图）：手机上歌曲行、播放队列里的封面就是它。播放页的封面染底、
 * 换碟时大图加载好以前先铺的也用它：同一个地址只下载一次，从歌单里点着放、往下切时，后面几首的多半已经在列表里加载过了
 */
export const SMALL_COVER = 48

/**
 * 播放页的大封面按多大取（Cover 的 size）：桌面 420，手机 360。播放条上换了歌就在后台取好（player-page.svelte.ts 的 prefetchPageCover），
 * 拉开播放页时封面直接是大图
 */
export const PAGE_COVER = { desktop: 420, phone: 360 } as const

/**
 * 换歌时封面、歌名往哪边走（DESIGN.md Cover Wheel）：left 往左转、right 往右转；
 * land 是列表里点的歌、那一行的封面飞进播放条落下了（cover-flight.svelte.ts）：封面直接换上，旧歌名往上飘出、新的从下面飘入
 */
export type Turn = 'left' | 'right' | 'land'

/** 换碟在哪：page 是播放页，bar 是播放条（桌面底栏、手机迷你条） */
export type Place = 'page' | 'bar'

/**
 * 换碟往哪转，只看 App 发布的换歌原因：下一首、自动接续、跳过、点选往左，上一首往右；没有原因（还没换过歌）时直接换上。
 * 点选在播放页里是在播放队列里点的；在播放条上是在列表里点的，那一行的封面飞进来、落下时是 land（cover-flight.svelte.ts），
 * 飞不了的（减少动态效果、那一行的封面还没加载出来）照常往左转（The Cover Leads Rule：退回普通的换歌）
 */
export function turnOf(change: SongChange | null): Turn | null {
  switch (change) {
    case null:
      return null
    case 'next':
    case 'continue':
    case 'skip':
    case 'pick':
      return 'left'
    case 'previous':
      return 'right'
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

/** 播放来源叫什么（“来自「我喜欢的音乐」”）；曲库里找不到（歌单在网易云里删掉了、专辑页还没打开过）时是 null。已下载没登录时也有名字 */
export function sourceName(library: LibraryState | null, source: PlaySource): string | null {
  if (source.kind === 'downloads')
    return '已下载'
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
    case 'daily':
      return '每日推荐'
    case 'search':
      return `搜索“${source.keyword}”`
    default: {
      const unhandled: never = source
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

/** 播放模式叫什么（原型 playModeLabel） */
export const PLAY_MODE_LABEL: Record<PlayMode, string> = { loop: '列表循环', one: '单曲循环', shuffle: '随机播放' }

/** 播放条上的播放模式键按一下换成哪一种：列表循环 → 单曲循环 → 随机播放 → 列表循环 */
export const NEXT_PLAY_MODE: Record<PlayMode, PlayMode> = { loop: 'one', one: 'shuffle', shuffle: 'loop' }

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
