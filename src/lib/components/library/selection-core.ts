import type { Playlist, Song } from '#lib/api/library.js'
import { canSortPlaylist } from '#lib/api/library.js'

// 多选规则的纯核心（#66）：勾选、Shift 连选、全选可见、能做什么按歌单种类给出。
// 不碰页面、不碰 Svelte；多选模块只把列表源和 App 接上来，三个工具条只读结果、调用动作。

/** 勾着哪些歌，Shift 连选从哪一首起 */
export interface Checked {
  readonly ids: ReadonlySet<number>
  readonly anchor: number | null
}

/** 什么都没勾。只读，调用方不要改这个 Set */
export const NONE: Checked = {
  ids: new Set(),
  anchor: null,
}

/** 对勾选的歌能做什么：加入歌单对哪种歌单都有（不用判断）；移除只有自建；排序是自建和我喜欢的音乐 */
export interface SelectionCapabilities {
  readonly remove: boolean
  readonly sort: boolean
}

export function capabilitiesOf(kind: Playlist['kind'] | null): SelectionCapabilities {
  return {
    remove: kind === 'own',
    sort: kind !== null && canSortPlaylist(kind),
  }
}

/** 点一下：勾上或取消，锚点放在这一首（下次 Shift 连选从这里起） */
export function toggle(state: Checked, id: number): Checked {
  const ids = new Set(state.ids)
  if (ids.has(id))
    ids.delete(id)
  else
    ids.add(id)
  return { ids, anchor: id }
}

/**
 * Shift 连选：从锚点到这一首，按现在显示的顺序，两头都算。
 * 锚点不在现在显示的列表里（搜索换过）时退化为点选这一首，锚点随之改为这一首；
 * 正常连选时锚点不跟着走。
 */
export function extend(state: Checked, visible: readonly number[], to: number): Checked {
  const from = state.anchor === null
    ? -1
    : visible.indexOf(state.anchor)
  const target = visible.indexOf(to)
  if (from < 0 || target < 0)
    return toggle(state, to)
  const ids = new Set(state.ids)
  const [lo, hi] = from < target
    ? [from, target]
    : [target, from]
  for (let index = lo; index <= hi; index += 1)
    ids.add(visible[index]!)
  return { ids, anchor: state.anchor }
}

/** 显示着的歌是不是都勾上了；一首都没有时不算 */
export function allOn(state: Checked, visible: readonly number[]): boolean {
  return visible.length > 0 && visible.every(id => state.ids.has(id))
}

/** 全选显示着的歌；都勾上了就全不选（连搜索前勾的一起清掉） */
export function selectAll(state: Checked, visible: readonly number[]): Checked {
  if (allOn(state, visible))
    return NONE
  const ids = new Set(state.ids)
  for (const id of visible)
    ids.add(id)
  return { ids, anchor: state.anchor }
}

/** 勾着的歌，按整张歌单的先后（搜索时也不按搜到的先后） */
export function picked(songs: readonly Song[], ids: ReadonlySet<number>): readonly Song[] {
  return songs.filter(song => ids.has(song.id))
}
