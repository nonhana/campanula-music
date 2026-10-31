import type { Song } from '#lib/api/library.js'
import type { PlaySource } from '#lib/api/playback.js'

// 多选规则的纯核心（#66）：勾选、Shift 连选、全选可见，以及列表的标识（换了列表就退出）。
// 能做什么由调用方从动作目录里挑（#82），这里不再按列表种类给一张表。
// 不碰页面、不碰 Svelte；多选模块只把列表源和 App 接上来，两个工具条只读结果、调用动作。

export interface Checked {
  readonly ids: ReadonlySet<number>
  readonly anchor: number | null
}

/** 只读，调用方不要改这个 Set */
export const NONE: Checked = {
  ids: new Set(),
  anchor: null,
}

/** 列表的标识：歌单、专辑、歌手按编号，搜索按词，每日推荐和已下载只有一张。换了它（编号、搜索词）就退出多选 */
export const selectionKeyOf = (source: PlaySource): string => {
  switch (source.kind) {
    case 'playlist': return `playlist:${source.id}`
    case 'album': return `album:${source.id}`
    case 'artist': return `artist:${source.id}`
    case 'search': return `search:${source.keyword}`
    case 'daily': return 'daily'
    case 'downloads': return 'downloads'
  }
}

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
