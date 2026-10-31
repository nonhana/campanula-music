import { tick, untrack } from 'svelte'

import type { Song } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'

import type { DialogRequest } from '../overlay/overlay-requests'
import type { OverlayLayer, OverlayResult } from '../overlay/overlay-stack'
import type { SelectionAction } from './selection-actions.svelte'
import type { Checked } from './selection-core'
import { allOn as allVisibleOn, extend, NONE, picked as pickedSongs, selectAll as selectAllVisible, toggle as toggleChecked } from './selection-core'

// 多选（GLOSSARY：一张列表里勾选多首歌，一起做这张列表能做的事；能做什么由调用方从动作目录里挑，#82）。
// 生命周期都在这一个文件：进入、离开（返回手势、Esc、换列表、离开页面）、焦点归还（按钮入口进入后先落第一行），
// 以及“先退出多选、再提交”的那两条提交路径。两个工具条只读状态、调用这里的动作或目录里的动作，返回和 Esc 仍由 #64 的浮层栈拥有；
// 手机那层经浮层栈登记（只压一条浅路由），没有单独视图。

export interface SelectionSource {
  /** 换了列表就退出多选：playlist:1、album:2、artist:3、daily、search:关键词、downloads（selection-core 的 selectionKeyOf） */
  readonly key: string
  /** 勾选和动作都用它（搜索时也是整张） */
  readonly songs: () => readonly Song[]
  /** Shift 连选和全选只看这些 */
  readonly visible: () => readonly number[]
  /** 这张列表能做的事，按调用方给的先后画 */
  readonly actions: readonly SelectionAction[]
  /** 加载中、出错、空态、换列表：不在了就退出多选 */
  readonly present: () => boolean
  readonly focusFirst: () => void
}

export class MultiSelect {
  private readonly layer: OverlayLayer<DialogRequest, HTMLElement>
  private readonly app: App

  constructor(layer: OverlayLayer<DialogRequest, HTMLElement>, app: App) {
    this.layer = layer
    this.app = app
  }

  mode = $state(false)
  private checked = $state.raw<Checked>(NONE)
  private source = $state.raw<SelectionSource | null>(null)
  private entered: string | null = null
  private watching: (() => void) | null = null
  /** 入口按钮会被工具条换掉，所以给的是“重新找到它”的回调 */
  private returnFocus: (() => HTMLElement | null) | null = null

  get size(): number {
    return this.checked.ids.size
  }

  get allOn(): boolean {
    return allVisibleOn(this.checked, this.source?.visible() ?? [])
  }

  /** 当前这张列表能做的事：手机操作条在列表外面，从这里读；桌面工具条直接用自己的那份（同一个数组） */
  get actions(): readonly SelectionAction[] {
    return this.source?.actions ?? []
  }

  readonly picked = $derived.by(() => {
    const source = this.source
    return source
      ? pickedSongs(source.songs(), this.checked.ids)
      : []
  })

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
    void this.layer.open({ from }).then((result) => {
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

  leave = (): Promise<OverlayResult> => this.layer.closeThrough()

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

  /** 收起多选和选歌单，再把菜单打开时看到的那几首一次加进去 */
  async addTo(playlistId: number, songs: readonly Song[]): Promise<void> {
    const result = await this.leave()
    if (result === 'committed')
      await this.app.addSongsToPlaylist(playlistId, songs)
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
    void this.layer.invalidate()
  }
}
