import { page } from '$app/state'
import { tick } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'
import { desktopLayout } from '../layout'
import { pushShallowState } from '../shallow-state'

// 多选（#35，Spec #11“多选、拖拽与换封面”方案 C）：一张歌单里的勾选状态，歌单页、歌曲列表、两种工具条共用。
// - 手机上长按一行 400ms、点“多选”进入，顶栏换成选择栏，底部换成操作条；压一条浅路由历史，返回手势先退出多选
// - 桌面上点“多选”、⌘/Ctrl 点选都能进入；进入后 Shift 连选。两个入口设的是同一个 mode
// - 工具条只有一套；退出：手机点关闭、返回手势，桌面点“取消选择”、按 Esc
// - 关闭、“取消选择”、Esc 用 history.back() 把浅路由用掉
// 换到别的歌单、离开歌单时清掉

class PlaylistSelection {
  /** 这张歌单（跟着歌曲列表变） */
  playlistId = $state<number | null>(null)
  /** 多选状态：手机长按、点“多选”、桌面 ⌘/Ctrl 点选都会设成 true */
  mode = $state(false)
  ids = new SvelteSet<number>()
  /** Shift 连选从这一首起 */
  anchor = $state<number | null>(null)
  /** 列表里显示着的歌（搜索时是搜到的），全选用 */
  visible = $state.raw<readonly number[]>([])
  /** 打开多选的那个按钮：退出后焦点还给它 */
  from: HTMLElement | null = null

  get size(): number {
    return this.ids.size
  }

  get allOn(): boolean {
    return this.visible.length > 0 && this.visible.every(id => this.ids.has(id))
  }

  has(id: number): boolean {
    return this.ids.has(id)
  }

  /** 换了歌单：清掉上一张的勾选 */
  follow(playlistId: number): void {
    if (this.playlistId === playlistId)
      return
    this.playlistId = playlistId
    this.exit()
  }

  setVisible(ids: readonly number[]): void {
    this.visible = ids
  }

  toggle(id: number): void {
    if (this.ids.has(id))
      this.ids.delete(id)
    else
      this.ids.add(id)
    this.anchor = id
  }

  /** Shift 连选：从上次点的那首到这首（按列表里显示着的顺序） */
  range(to: number): void {
    const a = this.anchor === null ? -1 : this.visible.indexOf(this.anchor)
    const b = this.visible.indexOf(to)
    if (a < 0 || b < 0) {
      this.toggle(to)
      return
    }
    const [lo, hi] = a < b ? [a, b] : [b, a]
    for (let index = lo; index <= hi; index += 1)
      this.ids.add(this.visible[index]!)
  }

  /** 全选显示着的歌；都选中了就全不选 */
  selectAll(): void {
    if (this.allOn) {
      this.ids.clear()
      this.anchor = null
      return
    }
    for (const id of this.visible)
      this.ids.add(id)
  }

  clear(): void {
    this.mode = false
    this.ids.clear()
    this.anchor = null
    this.from = null
  }

  /**
   * 不是听众主动退出（列表没了、换了歌单）：清掉勾选，并把当前历史记录上的 playlistSelect 标记换掉，
   * 不另退一条历史。听众主动退出走 leaveSelection()，由它退掉那条浅路由
   */
  exit(): void {
    this.clear()
    if (!page.state.playlistSelect)
      return
    const state = { ...page.state }
    delete state.playlistSelect
    pushShallowState(state, { replace: true })
  }
}

export const playlistSelection = new PlaylistSelection()

/**
 * 进入多选：手机长按一行、点“多选”、桌面 ⌘/Ctrl 点选。设置了 id 就同时选中这一首。
 * 手机布局上压一条浅路由历史，返回手势先退出多选（验证关卡③）
 */
export function enterSelection(playlistId: number, id?: number, from: HTMLElement | null = null): void {
  playlistSelection.follow(playlistId)
  playlistSelection.mode = true
  playlistSelection.from = from
  if (id !== undefined) {
    playlistSelection.ids.add(id)
    playlistSelection.anchor = id
  }
  if (!desktopLayout.current && !page.state.playlistSelect)
    pushShallowState({ ...page.state, playlistSelect: true })
  // 点按钮进的（不是长按）：焦点移到第一行的勾选框，Tab 不会掉到 body
  if (from) {
    void tick().then(() => {
      document.querySelector<HTMLElement>('[data-select-row]')?.focus({ preventScroll: true })
    })
  }
}

/** 听众主动退出（关闭、取消选择、Esc、操作完）：清掉勾选，焦点还给打开它的按钮；手机上进多选时压的那条历史也退掉 */
export function leaveSelection(): void {
  const from = playlistSelection.from
  const shallow = page.state.playlistSelect === true
  playlistSelection.clear()
  if (shallow)
    history.back()
  // 入口按钮在多选时被卸载了：等界面换回来，焦点回到入口（或它重新出现的那一个）
  void tick().then(() => {
    const target = from?.isConnected ? from : document.querySelector<HTMLElement>('[data-multiselect-entry]')
    target?.focus({ preventScroll: true })
  })
}
