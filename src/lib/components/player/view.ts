import type { Song } from '#lib/api/library.js'
import { songTitle } from '#lib/api/library.js'
import type { LyricLine, LyricWord, PlaySource } from '#lib/api/playback.js'
import type { LibraryState } from '#lib/app/library.js'
import type { PlayerNotice, PlayerState, PlayMode, SongChange } from '#lib/app/player.js'

import { playlistName } from '../playlist/playlist-text'
import { failureText } from '../shared/failure'
import { formatDuration } from '../shared/text'

// 播放条、晨光行、播放页上怎么显示：界面组件只照着画

export const queueEmpty = (player: PlayerState): boolean => player.queue.length === 0

/** 手机播放页拖封面时从两边转进来；没有别的歌可换时是 null */
export const neighborSong = (player: PlayerState, direction: keyof PlayerState['neighbors']): Song | null => {
  const index = player.neighbors[direction]
  return index === null
    ? null
    : player.queue[index].song
}

/** 96px（Cover 的 size）：手机上歌曲行、播放队列的封面，播放页染底、换碟大图加载前也用它；同一地址只下一次，后面几首多半已在列表里加载过 */
export const SMALL_COVER = 48

/** 桌面 420、手机 360；播放条换歌就后台取好（player-page.svelte.ts 的 prefetchPageCover），拉开播放页直接是大图 */
export const PAGE_COVER = { desktop: 420, phone: 360 } as const

/** left 往左转、right 往右转；land 是列表点的歌、封面飞进播放条落下（cover-flight.svelte.ts）：封面直接换，旧歌名往上飘、新的从下飘入 */
export type Turn = 'left' | 'right' | 'land'

export type Place = 'page' | 'bar'

/** 下一首、自动接续、跳过、点选往左，上一首往右；没有原因时直接换。播放页里点选是在队列里点的，播放条上是列表点的、封面飞进来（落定是 land）；飞不了的照常往左 */
export const turnOf = (change: SongChange | null): Turn | null => {
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

export const formatSeconds = (seconds: number): string => formatDuration(seconds * 1000)

/** 曲库里找不到（歌单被删了、专辑页没打开过）时是 null；已下载没登录时也有名字 */
export const sourceName = (library: LibraryState | null, source: PlaySource): string | null => {
  if (source.kind === 'downloads')
    return '已下载'
  if (!library)
    return null
  switch (source.kind) {
    case 'playlist': {
      const playlist = library.playlists?.find(each => each.id === source.id)
      return playlist
        ? playlistName(playlist)
        : null
    }
    case 'album': {
      const page = library.albumPage(source.id)
      return page?.status === 'shown'
        ? page.content.album.name
        : library.albums?.find(album => album.id === source.id)?.name ?? null
    }
    case 'artist': {
      const page = library.artistPage(source.id)
      return page?.status === 'shown'
        ? page.content.artist.name
        : library.artists?.find(artist => artist.id === source.id)?.name ?? null
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

/** 已经开始的最后一行（间奏时还是上一行）；第一行之前是 -1 */
export const lineIndexAt = (lines: readonly LyricLine[], at: number): number => {
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

export const wordProgress = (word: LyricWord, at: number): number => {
  if (at <= word.start)
    return 0
  if (at >= word.end)
    return 1
  return (at - word.start) / (word.end - word.start)
}

export const PLAY_MODE_LABEL: Record<PlayMode, string> = { loop: '列表循环', one: '单曲循环', shuffle: '随机播放' }

/** 列表循环 → 单曲循环 → 随机播放 → 列表循环 */
export const NEXT_PLAY_MODE: Record<PlayMode, PlayMode> = { loop: 'one', one: 'shuffle', shuffle: 'loop' }

/** 一句话，什么没成、为什么；下一步交给播放键 */
export const noticeText = (notice: PlayerNotice): string => {
  switch (notice.kind) {
    case 'urlFailed':
      return `没取到播放地址：${failureText(notice.failure)}`
    case 'streamFailed':
      return '音频没加载下来，按播放键接着放'
    case 'slow':
      return '网络有点慢'
    case 'skipped':
      return `《${songTitle(notice.song)}》放不了，跳过了`
    case 'nothingPlayable':
      return '播放队列里没有能放的歌'
    default: {
      const unhandled: never = notice
      throw new Error(`不认识的播放提示：${JSON.stringify(unhandled)}`)
    }
  }
}
