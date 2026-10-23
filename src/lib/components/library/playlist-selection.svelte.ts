import type { DialogRequest } from '../overlay-requests'
import type { OverlayLayer, OverlayResult } from '../overlay-stack'
import { tick } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'

// 多选的勾选与排序业务保持原样；返回、Esc、焦点和历史由会话内的浮层栈拥有（#64）。

export class PlaylistSelection {
  constructor(private readonly layer: OverlayLayer<DialogRequest, HTMLElement>) {}
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

  /** 列表消失或换页：让多选失效。多选在最上层时浮层栈会回到底页，也就是消费掉进多选时压的那条历史。 */
  exit(): void {
    this.clear()
    void this.layer.invalidate()
  }

  enter(playlistId: number, id?: number, from: HTMLElement | null = null): void {
    this.follow(playlistId)
    this.mode = true
    this.from = from
    if (id !== undefined) {
      this.ids.add(id)
      this.anchor = id
    }
    void this.layer.open({ from }).then((result) => {
      // 历史正好在动、会话刚换代时 open 会被取消或作废：别留下一个没有层的多选。
      if (result !== 'committed')
        this.clear()
    }, (error: unknown) => {
      // open 抛错（历史结果 failed 时核心会 reject）：多选没开成，先复位，再报出来
      this.clear()
      console.error('进入多选失败', error)
    })
    if (from) {
      void tick().then(() => {
        document.querySelector<HTMLElement>('[data-select-row]')?.focus({ preventScroll: true })
      })
    }
  }

  leave = (): Promise<OverlayResult> => this.layer.closeThrough()
}
