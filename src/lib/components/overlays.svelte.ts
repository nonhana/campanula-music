import type { Component } from 'svelte'
import type { BatchPickerRequest, DialogRequest, EditorRequest, MenuRequest, PlaylistMenuRequest, PlaylistRequest, SongMenuRequest } from './overlay-requests'
import type { LayerOptions } from './overlay-stack'
import { onDestroy, onMount, tick } from 'svelte'
import { createSubscriber } from 'svelte/reactivity'
import AddSongs from './AddSongs.svelte'
import AddToPlaylist from './AddToPlaylist.svelte'
import { getAppView } from './app-context.svelte'
import BatchAddToPlaylist from './BatchAddToPlaylist.svelte'
import CoverEditor from './CoverEditor.svelte'
import { desktopLayout } from './layout'
import { PlaylistSelection } from './library/playlist-selection.svelte'
import LogoutConfirm from './LogoutConfirm.svelte'
import { createOverlayHistory } from './overlay-history.svelte'
import { OverlayStack } from './overlay-stack'
import { createDrawer } from './player/drawer.svelte'
import PlayerOverlay from './player/PlayerOverlay.svelte'
import PlaylistEditor from './PlaylistEditor.svelte'
import PlaylistMenu from './PlaylistMenu.svelte'
import SongMenu from './SongMenu.svelte'
import { setSelectionMode } from './ui/selection-mode'

export function createOverlays() {
  const view = getAppView()
  let notify = () => {}
  const read = createSubscriber((update) => {
    notify = update
    return () => {
      notify = () => {}
    }
  })
  let stack!: OverlayStack<HTMLElement>
  let playlistSelection!: PlaylistSelection
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
      // -> fallback（层内元素）-> main。多选入口被工具条换掉时由 focusReturn 重新找到（#66）。
      const available = (node: HTMLElement | null) => node?.isConnected && !node.closest('[inert]') ? node : null
      const active = stack.top && document.querySelector<HTMLElement>(`[data-overlay="${stack.top.name}"]`)
      const next = available(target)
        ?? (fallback ? available(document.querySelector<HTMLElement>(fallback)) : null)
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
  function register<R extends DialogRequest>(name: string, options: LayerOptions<R, HTMLElement>, component?: Component) {
    const layer = stack.register<R>(name, options)
    if (component)
      mounted.push({ name, component, inert: () => layer.containerInert })
    return layer
  }
  // 菜单类层（浮动菜单、底部弹层）都不是 modal：和基线一样，开着时背景与提示条照常可交互（#64 行为不变）。
  // Esc、返回、焦点归还都由栈按栈顶处理，不依赖 modal；弹窗、换封面、编辑、播放页仍是 modal。
  const menu = { history: (request: MenuRequest) => request.anchor === null, modal: false }
  const dialog = { history: () => !desktopLayout.current, modal: true }

  // 每一层只登记一次：历史策略、组件、焦点和业务的关闭钩子。
  const songMenu = register<SongMenuRequest>('song-menu', menu, SongMenu)
  const playlistPicker = register<SongMenuRequest>('playlist-picker', menu, AddToPlaylist)
  const playlistMenu = register<PlaylistMenuRequest>('playlist-menu', menu, PlaylistMenu)
  const batchPicker = register<BatchPickerRequest>('batch-picker', { ...menu, dependsOn: 'selection' }, BatchAddToPlaylist)
  const playlistEditor = register<EditorRequest>('playlist-editor', dialog, PlaylistEditor)
  const addSongsDialog = register<PlaylistRequest>('add-songs', { ...dialog, fallback: '[data-add-songs-entry]' }, AddSongs)
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
  const canRestorePlayer = () => view.state.player.queue.length > 0
  const player = register<DialogRequest>('player', { history: () => true, modal: true, restore: canRestorePlayer, fallback: '[data-player-bar] button' }, PlayerOverlay)
  const queue = register<DialogRequest>('queue', { history: () => true, modal: true, restore: canRestorePlayer, dependsOn: 'player', parent: 'player', fallback: '[data-queue-entry]' })
  const selection = register<DialogRequest>('selection', {
    history: () => !desktopLayout.current,
    // 多选只是列表上的一层状态（顶栏 / 底部操作条），不是 modal：和基线一样不压暗、不 inert 背景。
    // 焦点归还给打开它的元素（按钮或行）；按钮在层开着时被工具条换掉，所以由多选给重新挂上的入口。
    // 没有全局兜底查询（#66）。
    modal: false,
    focusReturn: () => playlistSelection.returnTarget(),
    dismissed: () => playlistSelection.clear(),
  })
  playlistSelection = new PlaylistSelection(selection, batchPicker, view.app)
  // 滚动条从这里知道“正在多选”，让开右边的触屏把手（#66）
  setSelectionMode(() => playlistSelection.mode)
  const playerDrawer = createDrawer(() => window.innerHeight)

  onMount(() => {
    void stack.reconcile()
  })
  onDestroy(() => stack.clear())

  return { stack, mounted, songMenu, playlistPicker, playlistMenu, batchPicker, playlistEditor, addSongsDialog, coverEditor, logoutConfirm, player, queue, selection, playlistSelection, playerDrawer }
}
