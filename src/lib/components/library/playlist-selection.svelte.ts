import type { Playlist, Song } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'
import type { AddToPlaylistRequest, DialogRequest, MenuAnchor } from '../overlay-requests'
import type { OverlayLayer, OverlayResult } from '../overlay-stack'
import type { Checked, SelectionCapabilities } from './selection-core'
import { tick, untrack } from 'svelte'
import { allOn as allVisibleOn, capabilitiesOf, extend, NONE, picked as pickedSongs, selectAll as selectAllVisible, toggle as toggleChecked } from './selection-core'

// 多选（GLOSSARY：一张列表里勾选多首歌，一起加入歌单、下载或移除；自建歌单和我喜欢的音乐还能拖动排序）。
// 生命周期都在这一个文件里：进入、离开（返回手势、Esc、换歌单、离开页面）、焦点归还（按钮入口进入后先落第一行），
// 以及“对勾选的歌做事”。三个工具条只读状态、调用这里的动作；返回和 Esc 仍由 #64 的浮层栈拥有。
// 手机上的那一层经浮层栈登记（history 只在手机压一条浅路由），没有单独的视图组件。

/** 一张歌曲列表给多选的东西：歌单、整张歌单的歌、当前显示的歌（搜索时是结果）、种类和焦点落点 */
export interface SelectionSource {
  /** 这张歌单（跟着页面变） */
  readonly playlistId: number
  /** 整张歌单里的歌：勾选和“加入歌单 / 移除”都用它（搜索时也是整张） */
  readonly songs: () => readonly Song[]
  /** 列表里现在显示的歌（搜索时是搜到的）：Shift 连选和全选只看这些 */
  readonly visible: () => readonly number[]
  /** 歌单种类；不在曲库里的歌单是 null */
  readonly kind: () => Playlist['kind'] | null
  /** 列表还在（加载中、出错、空态、换歌单）：不在了就退出多选 */
  readonly present: () => boolean
  /** 按钮入口被工具条换掉时，进入后焦点落到第一行；行入口不调用（#66 S2） */
  readonly focusFirst: () => void
}

export class PlaylistSelection {
  private readonly layer: OverlayLayer<DialogRequest, HTMLElement>
  private readonly playlistPicker: OverlayLayer<AddToPlaylistRequest, HTMLElement>
  private readonly app: App

  constructor(
    layer: OverlayLayer<DialogRequest, HTMLElement>,
    playlistPicker: OverlayLayer<AddToPlaylistRequest, HTMLElement>,
    app: App,
  ) {
    this.layer = layer
    this.playlistPicker = playlistPicker
    this.app = app
  }

  /** 多选状态：手机长按、点“多选”、桌面 ⌘/Ctrl 点选都会设成 true */
  mode = $state(false)
  /** 勾着哪些歌，Shift 连选从哪一首起；每次改都换一个新对象 */
  private checked = $state.raw<Checked>(NONE)
  /** 列表源：PlaylistSongs 挂载时给，卸载时拿走 */
  private source = $state.raw<SelectionSource | null>(null)
  /** 进入时是哪张歌单：换了一张就退出 */
  private entered: number | null = null
  /** 盯着列表源（换歌单、列表没了）的那一组 effect */
  private watching: (() => void) | null = null
  /** 关掉后焦点回到哪个入口：入口按钮会被工具条换掉，所以给的是“重新找到它”的回调 */
  private returnFocus: (() => HTMLElement | null) | null = null

  get size(): number {
    return this.checked.ids.size
  }

  get allOn(): boolean {
    return allVisibleOn(this.checked, this.source?.visible() ?? [])
  }

  /** 勾着的歌，按整张歌单的先后（搜索时也是整张） */
  readonly picked = $derived.by(() => {
    const source = this.source
    return source ? pickedSongs(source.songs(), this.checked.ids) : []
  })

  get capabilities(): SelectionCapabilities {
    return capabilitiesOf(this.source?.kind() ?? null)
  }

  has(id: number): boolean {
    return this.checked.ids.has(id)
  }

  /**
   * 浮层栈在 rendered 之后、焦点归还时问它交给谁；入口按钮重新挂上了才给。
   * 给 null 时栈回退 request.from（仍 connected 才算）再回退 fallback；离开页面、列表没了时不给这个回调，交给栈处理。
   */
  returnTarget(): HTMLElement | null {
    const target = this.returnFocus?.() ?? null
    // 焦点栈每次关闭只问一次：拿到后就不再把入口/行闭包挂在单例上
    this.returnFocus = null
    return target
  }

  /** 列表挂上来：之后换歌单、列表消失都会自己退出；卸载时调用 detach */
  attach(source: SelectionSource): void {
    this.watching?.()
    this.source = source
    if (this.mode && this.entered !== source.playlistId)
      this.exit()
    this.watching = $effect.root(() => {
      $effect(() => {
        const id = source.playlistId
        const present = source.present()
        untrack(() => {
          if (this.mode && (id !== this.entered || !present))
            this.exit()
        })
      })
    })
  }

  /** 列表卸载：拿走的还是自己挂的那一份时才退出（页面换页时新旧两页可能短暂同时在） */
  detach(source: SelectionSource): void {
    if (this.source !== source)
      return
    this.watching?.()
    this.watching = null
    this.source = null
    if (this.mode)
      this.exit()
  }

  /**
   * 进入多选；id 是长按的那一首，from 是打开它的元素。
   * focusFirst 只给两个按钮入口：它们进入后被工具条/顶栏换掉，焦点先落到第一行；
   * 行上进入（Ctrl/⌘ 点选、长按）不传，焦点留在那一行。
   * focusEntry 是所有入口的退出归还：入口被换掉或行被虚拟列表回收时，用它重新找到。
   */
  enter({ id, from = null, focusFirst = false, focusEntry }: {
    id?: number
    from?: HTMLElement | null
    focusFirst?: boolean
    focusEntry?: () => HTMLElement | null
  } = {}): void {
    const source = this.source
    if (!source || !source.present() || this.mode)
      return
    this.checked = id === undefined ? NONE : toggleChecked(NONE, id)
    this.returnFocus = focusEntry ?? null
    this.entered = source.playlistId
    this.mode = true
    void this.layer.open({ from }).then((result) => {
      // 历史正好在动、会话刚换代时 open 会被取消或作废：别留下一个没有层的多选。
      if (result !== 'committed')
        this.clear()
    }, (error: unknown) => {
      // open 抛错（历史结果 failed 时核心会 reject）：多选没开成，先复位，再报出来
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

  /** Shift 连选：从上次点的那首到这首（按列表里显示着的顺序） */
  range(to: number): void {
    if (!this.mode)
      return
    this.checked = extend(this.checked, this.source?.visible() ?? [], to)
  }

  /** 全选显示着的歌；都勾着了就全不选 */
  selectAll(): void {
    if (!this.mode)
      return
    this.checked = selectAllVisible(this.checked, this.source?.visible() ?? [])
  }

  /**
   * 加入歌单：打开选歌单（目标只有当前歌单以外的自建歌单，收藏的歌单和我喜欢的音乐不出现）。
   * anchor 由调用方按入口给：桌面工具条贴按钮，手机操作条固定底部弹层（null）。
   */
  addPicked(event: MouseEvent, anchor: MenuAnchor | null): void {
    const source = this.source
    if (!source || this.picked.length === 0)
      return
    const from = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    void this.playlistPicker.open({
      mode: 'multi',
      songs: this.picked,
      currentPlaylistId: source.playlistId,
      from,
      anchor,
    })
  }

  /** 选了目标：收起多选（和上面打开的选歌单），再把菜单打开时看到的那几首一次加进去 */
  async addTo(playlistId: number, songs: readonly Song[]): Promise<void> {
    const result = await this.leave()
    if (result === 'committed')
      await this.app.addSongsToPlaylist(playlistId, songs)
  }

  /** 移除勾选的几首：先在本地拿掉，提示条留 5 秒撤销；然后退出多选 */
  removePicked(): void {
    const source = this.source
    const songs = this.picked
    if (!source || songs.length === 0 || !this.capabilities.remove)
      return
    this.app.removeFromPlaylist(source.playlistId, songs.map(song => song.id))
    void this.leave()
  }

  /** 浮层栈把这一层拿掉时（换页、后退、会话清理）复位；不在别处调用 */
  clear(): void {
    this.mode = false
    this.checked = NONE
    this.entered = null
  }

  /**
   * 列表换了、没了，或者离开页面：退出多选，浮层栈会消费掉进入时压的那条历史。
   * 清掉重新找入口的回调；失效时浮层栈仍会按 request.from / fallback 聚焦（可能已断开，落到 main）。
   */
  private exit(): void {
    this.returnFocus = null
    this.clear()
    void this.layer.invalidate()
  }
}
