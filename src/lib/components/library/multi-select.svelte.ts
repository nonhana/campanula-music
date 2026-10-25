import { tick, untrack } from 'svelte'

import type { Song } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'

import type { AddToPlaylistRequest, DeleteDownloadsRequest, DialogRequest, ExportRequest, MenuAnchor } from '../overlay/overlay-requests'
import type { OverlayLayer, OverlayResult } from '../overlay/overlay-stack'
import type { Checked, SelectionCapabilities, SelectionKind } from './selection-core'
import { allOn as allVisibleOn, capabilitiesOf, extend, NONE, picked as pickedSongs, selectAll as selectAllVisible, toggle as toggleChecked } from './selection-core'

// 多选（GLOSSARY：一张列表里勾选多首歌，一起加入歌单、下载或移除；自建歌单和我喜欢的音乐还能排序；已下载页里导出、删除，#79）。
// 生命周期都在这一个文件：进入、离开（返回手势、Esc、换列表、离开页面）、焦点归还（按钮入口进入后先落第一行），以及“对勾选的歌做事”。
// 三个工具条只读状态、调用这里的动作，返回和 Esc 仍由 #64 的浮层栈拥有；手机那层经浮层栈登记（只压一条浅路由），没有单独视图。

export interface SelectionSource {
  /** 换了列表就退出多选：歌单是它的编号，已下载页是 'downloads' */
  readonly key: number | 'downloads'
  /** 勾选和“加入歌单 / 移除 / 导出 / 删除”都用它（搜索时也是整张） */
  readonly songs: () => readonly Song[]
  /** Shift 连选和全选只看这些 */
  readonly visible: () => readonly number[]
  readonly kind: () => SelectionKind | null
  /** 加载中、出错、空态、换列表：不在了就退出多选 */
  readonly present: () => boolean
  readonly focusFirst: () => void
}

interface Layers {
  selection: OverlayLayer<DialogRequest, HTMLElement>
  playlistPicker: OverlayLayer<AddToPlaylistRequest, HTMLElement>
  exportDialog: OverlayLayer<ExportRequest, HTMLElement>
  deleteDownloads: OverlayLayer<DeleteDownloadsRequest, HTMLElement>
}

export class MultiSelect {
  private readonly layers: Layers
  private readonly app: App

  constructor(layers: Layers, app: App) {
    this.layers = layers
    this.app = app
  }

  mode = $state(false)
  private checked = $state.raw<Checked>(NONE)
  private source = $state.raw<SelectionSource | null>(null)
  private entered: number | 'downloads' | null = null
  private watching: (() => void) | null = null
  /** 入口按钮会被工具条换掉，所以给的是“重新找到它”的回调 */
  private returnFocus: (() => HTMLElement | null) | null = null

  get size(): number {
    return this.checked.ids.size
  }

  get allOn(): boolean {
    return allVisibleOn(this.checked, this.source?.visible() ?? [])
  }

  readonly picked = $derived.by(() => {
    const source = this.source
    return source
? pickedSongs(source.songs(), this.checked.ids)
: []
  })

  get capabilities(): SelectionCapabilities {
    return capabilitiesOf(this.source?.kind() ?? null, this.app.state.exportable)
  }

  has(id: number): boolean {
    return this.checked.ids.has(id)
  }

  /** 浮层栈在 rendered 之后、焦点归还时问它交给谁；入口按钮重新挂上了才给。给 null 时栈回退 request.from、再 fallback；离开页面、列表没了时不给 */
  returnTarget(): HTMLElement | null {
    const target = this.returnFocus?.() ?? null
    // 焦点栈每次关闭只问一次：拿到后就不再把入口/行闭包挂在单例上
    this.returnFocus = null
    return target
  }

  /** 换列表、列表消失都会自己退出；卸载时调用 detach */
  attach(source: SelectionSource): void {
    this.watching?.()
    this.source = source
    if (this.mode && this.entered !== source.key)
      this.exit()
    this.watching = $effect.root(() => {
      $effect(() => {
        const id = source.key
        const present = source.present()
        untrack(() => {
          if (this.mode && (id !== this.entered || !present))
            this.exit()
        })
      })
    })
  }

  /** 拿走的还是自己挂的那一份时才退出（换页时新旧两页可能短暂同时在） */
  detach(source: SelectionSource): void {
    if (this.source !== source)
      return
    this.watching?.()
    this.watching = null
    this.source = null
    if (this.mode)
      this.exit()
  }

  /** 进入多选；id 是长按的那一首，from 是打开它的元素。focusFirst 只给按钮入口（进入后按钮被换掉，焦点先落第一行），行上进入不传；focusEntry 是所有入口的退出归还 */
  enter({ id, from = null, focusFirst = false, focusEntry }: {
    id?: number
    from?: HTMLElement | null
    focusFirst?: boolean
    focusEntry?: () => HTMLElement | null
  } = {}): void {
    const source = this.source
    if (!source || !source.present() || this.mode)
      return
    this.checked = id === undefined
? NONE
: toggleChecked(NONE, id)
    this.returnFocus = focusEntry ?? null
    this.entered = source.key
    this.mode = true
    void this.layers.selection.open({ from }).then((result) => {
      // 历史正好在动、会话刚换代时 open 会被取消或作废：别留下一个没有层的多选
      if (result !== 'committed')
        this.clear()
    }, (error: unknown) => {
      // open 抛错（历史结果 failed 时核心会 reject）：没开成，先复位再报出来
      this.clear()
      console.error('进入多选失败', error)
    })
    if (focusFirst) {
      void tick().then(() => {
        if (this.mode && this.source === source)
          source.focusFirst()
      })
    }
  }

  leave = (): Promise<OverlayResult> => this.layers.selection.closeThrough()

  toggle(id: number): void {
    if (!this.mode)
      return
    this.checked = toggleChecked(this.checked, id)
  }

  range(to: number): void {
    if (!this.mode)
      return
    this.checked = extend(this.checked, this.source?.visible() ?? [], to)
  }

  selectAll(): void {
    if (!this.mode)
      return
    this.checked = selectAllVisible(this.checked, this.source?.visible() ?? [])
  }

  /** 打开选歌单（只有当前歌单以外的自建歌单）；anchor 按入口给：桌面工具条贴按钮，手机操作条固定底部弹层（null） */
  addPicked(event: MouseEvent, anchor: MenuAnchor | null): void {
    const source = this.source
    if (!source || typeof source.key !== 'number' || this.picked.length === 0)
      return
    void this.layers.playlistPicker.open({
      mode: 'multi',
      songs: this.picked,
      currentPlaylistId: source.key,
      from: opener(event),
      anchor,
    })
  }

  /** 收起多选和选歌单，再把菜单打开时看到的那几首一次加进去 */
  async addTo(playlistId: number, songs: readonly Song[]): Promise<void> {
    const result = await this.leave()
    if (result === 'committed')
      await this.app.addSongsToPlaylist(playlistId, songs)
  }

  /** 先在本地拿掉，提示条留 5 秒撤销；然后退出多选 */
  removePicked(): void {
    const source = this.source
    const songs = this.picked
    if (!source || typeof source.key !== 'number' || songs.length === 0 || !this.capabilities.remove)
      return
    this.app.removeFromPlaylist(source.key, songs.map(song => song.id))
    void this.leave()
  }

  /** 打开导出（#79）：先写明首数和大小，选文件夹在弹窗里点 */
  exportPicked(event: MouseEvent): void {
    if (this.picked.length === 0 || !this.capabilities.export)
      return
    void this.layers.exportDialog.open({
songs: this.picked,
multi: true,
from: opener(event),
})
  }

  /** 删除勾选的下载前先确认（#79） */
  deletePicked(event: MouseEvent): void {
    if (this.picked.length === 0 || !this.capabilities.delete)
      return
    void this.layers.deleteDownloads.open({
songs: this.picked,
from: opener(event),
})
  }

  /** 收起确认和多选，再把确认时看到的那几首一次删掉；导出完一键删除也走这里 */
  async deleteDownloads(songs: readonly Song[]): Promise<void> {
    const result = await this.leave()
    if (result === 'committed')
      await this.app.deleteDownloads(songs.map(song => song.id))
  }

  /** 浮层栈把这一层拿掉时（换页、后退、会话清理）复位；不在别处调用 */
  clear(): void {
    this.mode = false
    this.checked = NONE
    this.entered = null
  }

  /** 列表换了、没了或离开页面：退出多选，浮层栈消费掉进入时压的历史。清掉重新找入口的回调；失效时仍按 request.from / fallback 聚焦（可能已断开，落到 main） */
  private exit(): void {
    this.returnFocus = null
    this.clear()
    void this.layers.selection.invalidate()
  }
}

/** 点的那个按钮：关掉后焦点回到它 */
const opener = (event: MouseEvent): HTMLElement | null => event.currentTarget instanceof HTMLElement
  ? event.currentTarget
  : null
