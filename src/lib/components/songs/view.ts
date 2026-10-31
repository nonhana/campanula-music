import type { LucideIcon } from '@lucide/svelte'

import type { Song } from '#lib/api/library.js'
import { songTitle } from '#lib/api/library.js'

import type { SelectionAction } from '../library/selection-actions.svelte'
import type { ScrollMark } from '../shared/scroll-marks'
import { formatCount, langOf } from '../shared/text'

/** 歌曲列表一行的高度（px，DESIGN.md Song Row）：列表、拖动、已下载、播放队列、添加歌曲共用 */
export const SONG_ROW_HEIGHT = 56

/** 列表那一块显示什么：加载 / 失败 + 重试 / 空 / 歌曲 */
export type SongListView
  = | { readonly kind: 'loading' }
    | { readonly kind: 'failed', readonly title: string, readonly body?: string, readonly retry: () => void }
    | { readonly kind: 'empty', readonly title: string, readonly body?: string, readonly icon?: LucideIcon, readonly action?: { readonly label: string, readonly run: () => void } }
    | { readonly kind: 'songs', readonly songs: readonly Song[] }

/** 在列表里搜（歌单内搜索、已下载页搜索）：表头写“找到 N 首”，没搜到时只有标题 */
export interface SongSearch {
  readonly term: string
  /** 歌单还没同步全 / 没加载完：结果可能不全 */
  readonly incomplete?: boolean
  /** 没搜到、又可能不全时下面那句 */
  readonly incompleteBody?: string
}

/** 多选（#82）：给了才有多选，挂载、勾选、入口、工具条和焦点都在 SongList 里，页面不再自己接线 */
export interface SongSelect {
  /** 这张列表能做的事，按这个顺序画进工具条和手机操作条（library/selection-actions） */
  readonly actions: readonly SelectionAction[]
  /** 整张列表的歌：歌单、已下载在列表里搜索时，勾选和动作仍按整张，显示的只是搜到的那些；不给时就是列表里的这些 */
  readonly songs?: () => readonly Song[]
  /** 入口的读屏名字和悬停提示：默认“多选”，能排序的歌单传“多选和排序” */
  readonly entryLabel?: string
}

/** 拖动排序（#36）交给列表的几何：留给 `library/PlaylistSongs` 用 */
export interface SongDragHooks {
  readonly placeOf: (song: Song, index: number) => number
  readonly keep: (song: Song, index: number) => boolean
  readonly animatePlace: boolean
  readonly hidden: (song: Song, index: number) => boolean
  /** 拖动时滚动条气泡不写（正在快速定位） */
  readonly marks: boolean
}

/** 歌曲列表里的一首在滚动条气泡里怎么写：第几首、歌名 */
export const songMark = (song: Song, index: number): ScrollMark => ({
  caption: `第 ${formatCount(index + 1)} 首`,
  title: songTitle(song),
  lang: langOf(song.name),
})
