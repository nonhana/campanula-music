import type { Playlist, Song } from '#lib/api/library.js'
import { canSortPlaylist } from '#lib/api/library.js'

// 多选规则的纯核心（#66）：勾选、Shift 连选、全选可见、能做什么按列表种类给出（歌单的种类，或已下载页，#79）。
// 不碰页面、不碰 Svelte；多选模块只把列表源和 App 接上来，三个工具条只读结果、调用动作。

export interface Checked {
  readonly ids: ReadonlySet<number>
  readonly anchor: number | null
}

/** 只读，调用方不要改这个 Set */
export const NONE: Checked = {
  ids: new Set(),
  anchor: null,
}

/** 在哪种列表里多选：哪一种歌单，或已下载页 */
export type SelectionKind = Playlist['kind'] | 'downloads'

/** 对勾选的歌能做什么：加入歌单是歌单里都有；移除只有自建；排序是自建和我喜欢的音乐；导出、删除只在已下载页（#79） */
export interface SelectionCapabilities {
  readonly add: boolean
  readonly remove: boolean
  readonly sort: boolean
  readonly export: boolean
  readonly delete: boolean
}

/** exportable：浏览器能选文件夹，不能时没有导出（ADR-0014） */
export const capabilitiesOf = (kind: SelectionKind | null, exportable: boolean): SelectionCapabilities => ({
  add: kind !== 'downloads',
  remove: kind === 'own',
  sort: kind !== null && kind !== 'downloads' && canSortPlaylist(kind),
  export: kind === 'downloads' && exportable,
  delete: kind === 'downloads',
})

/** 点一下：勾上或取消，锚点放在这一首（下次 Shift 连选从这里起） */
export const toggle = (state: Checked, id: number): Checked => {
  const ids = new Set(state.ids)
  if (ids.has(id))
    ids.delete(id)
  else
    ids.add(id)
  return { ids, anchor: id }
}

/** 从锚点到这一首，按现在显示的顺序，两头都算；锚点不在当前列表里（搜索换过）时退化为点选这一首并改锚点，正常连选时锚点不动 */
export const extend = (state: Checked, visible: readonly number[], to: number): Checked => {
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

/** 一首都没有时不算 */
export const allOn = (state: Checked, visible: readonly number[]): boolean => visible.length > 0 && visible.every(id => state.ids.has(id))

/** 都勾上了就全不选（连搜索前勾的一起清掉） */
export const selectAll = (state: Checked, visible: readonly number[]): Checked => {
  if (allOn(state, visible))
    return NONE
  const ids = new Set(state.ids)
  for (const id of visible)
    ids.add(id)
  return { ids, anchor: state.anchor }
}

/** 搜索时也不按搜到的先后 */
export const picked = (songs: readonly Song[], ids: ReadonlySet<number>): readonly Song[] => songs.filter(song => ids.has(song.id))
