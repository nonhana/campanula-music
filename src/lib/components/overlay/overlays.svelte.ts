import type { Component } from 'svelte'
import { onDestroy, onMount, tick } from 'svelte'
import { createSubscriber } from 'svelte/reactivity'

import LogoutConfirm from '../account/LogoutConfirm.svelte'
import DeleteDownloadsConfirm from '../downloads/DeleteDownloadsConfirm.svelte'
import DownloadPicker from '../downloads/DownloadPicker.svelte'
import ExportDialog from '../downloads/ExportDialog.svelte'
import { MultiSelect } from '../library/multi-select.svelte'
import SongMenu from '../menu/SongMenu.svelte'
import { createDrawer } from '../player/drawer.svelte'
import { createPlayerLayer } from '../player/player-layer.svelte'
import { queueEmpty } from '../player/view'
import AddSongs from '../playlist/AddSongs.svelte'
import AddToPlaylist from '../playlist/AddToPlaylist.svelte'
import CoverEditor from '../playlist/CoverEditor.svelte'
import PlaylistEditor from '../playlist/PlaylistEditor.svelte'
import PlaylistMenu from '../playlist/PlaylistMenu.svelte'
import { getAppView } from '../shared/app-context.svelte'
import { desktopLayout } from '../shared/layout'
import { setSelectionMode } from '../ui/selection-mode'
import { createOverlayHistory } from './overlay-history.svelte'
import type { AddToPlaylistRequest, DeleteDownloadsRequest, DialogRequest, DownloadPickerRequest, EditorRequest, ExportRequest, MenuRequest, PlaylistMenuRequest, PlaylistRequest, SongMenuRequest } from './overlay-requests'
import type { LayerOptions } from './overlay-stack'
import { OverlayStack } from './overlay-stack'

export const createOverlays = () => {
  const view = getAppView()
  let notify = () => {}
  const read = createSubscriber((update) => {
    notify = update
    return () => {
      notify = () => {}
    }
  })
  let stack!: OverlayStack<HTMLElement>
  let multiSelect!: MultiSelect
  const history = createOverlayHistory({
    changed: (phase) => {
      void stack.reconcile(phase)
    },
    navigate: () => stack.navigate(),
  })
  stack = new OverlayStack<HTMLElement>(history, {
    read,
    changed: () => notify(),
    rendered: tick,
    focus(target, fallback) {
      // 归还顺序：focusReturn 找到的入口 / request.from（仍 connected、不在 inert 里才算）
      // -> fallback（层内元素）-> main；多选入口被工具条换掉时由 focusReturn 重新找到（#66）
      const available = (node: HTMLElement | null) => node?.isConnected && !node.closest('[inert]')
? node
: null
      const active = stack.top && document.querySelector<HTMLElement>(`[data-overlay="${stack.top.name}"]`)
      const next = available(target)
        ?? (fallback
? available(document.querySelector<HTMLElement>(fallback))
: null)
?? active?.querySelector<HTMLElement>('[data-autofocus], button:not(:disabled), input, [tabindex]')
?? document.querySelector<HTMLElement>('main')
      if (next) {
        if (!next.hasAttribute('tabindex') && next.tagName === 'MAIN')
          next.tabIndex = -1
        next.focus({ preventScroll: true })
      }
    },
  }, crypto.randomUUID())
  const mounted: { name: string, component: Component, inert: () => boolean }[] = []
  const register = <R extends DialogRequest>(name: string, options: LayerOptions<R, HTMLElement>, component?: Component) => {
    const layer = stack.register<R>(name, options)
    if (component) {
      mounted.push({
name,
component,
inert: () => layer.containerInert,
})
}
    return layer
  }
  // 菜单类层（浮动菜单、底部弹层）都不是 modal：开着时背景与提示条照常可交互（#64 行为不变）
  // Esc、返回、焦点归还由栈按栈顶处理；弹窗、换封面、编辑、播放页仍是 modal
  const menu = {
history: (request: MenuRequest) => request.anchor === null,
modal: false,
}
  const dialog = {
history: () => !desktopLayout.current,
modal: true,
}

  // 每一层只登记一次：历史策略、组件、焦点和业务的关闭钩子
  const songMenu = register<SongMenuRequest>('song-menu', menu, SongMenu)
  // 单曲和多选共用一个选择器（#73）：多选的请求不能比多选层活得更久，单曲不依赖它
  const playlistPicker = register<AddToPlaylistRequest>('playlist-picker', {
    ...menu,
    dependsOn: request => request.mode === 'multi'
? 'selection'
: null,
  }, AddToPlaylist)
  const playlistMenu = register<PlaylistMenuRequest>('playlist-menu', menu, PlaylistMenu)
  const playlistEditor = register<EditorRequest>('playlist-editor', dialog, PlaylistEditor)
  const addSongsDialog = register<PlaylistRequest>('add-songs', { ...dialog, fallback: '[data-add-songs-entry]' }, AddSongs)
  const downloadPicker = register<DownloadPickerRequest>('download-picker', dialog, DownloadPicker)
  const coverEditor = register<PlaylistRequest>('cover-editor', {
    ...dialog,
    dependsOn: 'playlist-editor',
    beforeClose: () => {
      const cover = view.state.cover
      if (cover?.status !== 'uploading')
        return true
      if (cover.upload.step !== 'set')
        view.app.cancelCover()
      return false
    },
    dismissed: () => view.app.closeCover(),
  }, CoverEditor)
  const logoutConfirm = register<DialogRequest>('logout', dialog, LogoutConfirm)
  // 导出（#79）：多选打开的不能比多选层活得更久，歌曲菜单转交的不依赖它。正在写时 Esc、返回、关闭键都是取消：
  // 正在写的这首丢弃，弹窗留着给结果（和换封面的上传中一样钉住）
  const exportDialog = register<ExportRequest>('export', {
    ...dialog,
    dependsOn: request => request.multi
      ? 'selection'
      : null,
    beforeClose: () => {
      if (view.state.exporting?.status !== 'writing')
        return true
      view.app.cancelExport()
      return false
    },
    dismissed: () => view.app.closeExport(),
  }, ExportDialog)
  const deleteDownloadsConfirm = register<DeleteDownloadsRequest>('delete-downloads', { ...dialog, dependsOn: 'selection' }, DeleteDownloadsConfirm)
  const canRestorePlayer = () => !queueEmpty(view.state.player)
  // 播放页这一层不挂组件：播放页、播放提示由 PlayerLayer 挂载（提供 data-overlay="player"）。mounted 只收有组件的层，
  // OverlayHost 不渲染空容器；历史、Esc/返回、忙时钉住、焦点兜底、containerInert 只认登记表。回焦目标仍是播放条按钮。
  const player = register<DialogRequest>('player', {
history: () => true,
modal: true,
restore: canRestorePlayer,
fallback: '[data-player-bar] button',
})
  const queue = register<DialogRequest>('queue', {
history: () => true,
modal: true,
restore: canRestorePlayer,
dependsOn: 'player',
parent: 'player',
fallback: '[data-queue-entry]',
})
  const selection = register<DialogRequest>('selection', {
    history: () => !desktopLayout.current,
    // 多选只是列表上的一层状态（顶栏 / 底部操作条），不是 modal：不压暗、不 inert 背景；焦点还给打开它的元素，
    // 按钮被工具条换掉时由多选给重新挂上的入口（没有全局兜底查询，#66）。
    modal: false,
    focusReturn: () => multiSelect.returnTarget(),
    dismissed: () => multiSelect.clear(),
  })
  multiSelect = new MultiSelect({
selection,
playlistPicker,
exportDialog,
deleteDownloads: deleteDownloadsConfirm,
}, view.app)
  // 滚动条从这里知道“正在多选”，让开右边的触屏把手（#66）
  setSelectionMode(() => multiSelect.mode)
  const playerDrawer = createDrawer(() => window.innerHeight)
  /** 播放页层：队列非空 × 播放页开着 × 抽屉可见（两个外框共用这一份推导） */
  const playerLayer = createPlayerLayer(player, playerDrawer)

  onMount(() => {
    void stack.reconcile()
  })
  onDestroy(() => stack.clear())

  return {
stack,
mounted,
songMenu,
playlistPicker,
playlistMenu,
playlistEditor,
addSongsDialog,
downloadPicker,
coverEditor,
logoutConfirm,
exportDialog,
deleteDownloadsConfirm,
player,
queue,
selection,
multiSelect,
playerDrawer,
playerLayer,
}
}
