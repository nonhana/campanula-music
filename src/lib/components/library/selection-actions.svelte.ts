import type { LucideIcon } from '@lucide/svelte'
import { CircleArrowDown, FolderDown, ListMinus, ListPlus, Trash2 } from '@lucide/svelte'

import type { Song } from '#lib/api/library.js'
import type { DownloadSource } from '#lib/app/downloads.js'

import { getOverlays } from '../overlay/overlay-context'
import type { MenuAnchor } from '../overlay/overlay-requests'
import { getAppView } from '../shared/app-context.svelte'

// 多选能做的事（#82）：每一件事是一份数据——是什么、现在能不能用、点了做什么，和“更多”菜单的 MenuItem 一个思路。
// 文案和图标只写在这里，两个工具条照这份数据画；不同列表能做的事不一样，调用方从目录里挑自己那几个、给参数，不传就没有多选。
// 动作目录在组件初始化时调用一次（和 songMenuActions 一样从上下文取浮层和 App），调用方各自传这张列表才有的参数。

/** 对勾选的几首歌能做的一件事 */
export interface SelectionAction {
  readonly key: string
  readonly label: string
  readonly icon: LucideIcon
  /** 删除类的动作用出错红 */
  readonly tone?: 'destructive'
  /** 不能点的原因（悬停提示、读屏）；能点时是 null。一首都没勾时都不能点，由工具条统一管，不写进这里 */
  readonly blocked: string | null
  /** from：点的按钮，关掉后焦点回到它；anchor：桌面贴着按钮，手机是 null（底部弹层） */
  readonly run: (picked: readonly Song[], from: HTMLElement | null, anchor: MenuAnchor | null) => void
}

export const selectionActions = () => {
  const { deleteDownloadsConfirm, exportDialog, multiSelect, playlistPicker } = getOverlays()
  const view = getAppView()

  /**
   * 加入歌单（#73）：打开选歌单的多选模式，目标是“新建歌单”和全部自建歌单；currentPlaylistId 是打开时所在的歌单，不是从歌单里进来的给 null。
   * 选好后由选歌单收起两层、退出多选，再一次加进去（多选模块的 addTo）
   */
  const addToPlaylist = (currentPlaylistId: number | null = null): SelectionAction => ({
    key: 'add',
    label: '加入歌单',
    icon: ListPlus,
    blocked: null,
    run: (picked, from, anchor) => {
      if (picked.length === 0)
        return
      void playlistPicker.open({
        mode: 'multi',
        songs: picked,
        currentPlaylistId,
        from,
        anchor,
      })
    },
  })

  /** 整批下载（#39）：来源记成这张列表（规则⑦），然后退出多选；断网时不能点 */
  const download = (source: () => DownloadSource): SelectionAction => ({
    key: 'download',
    label: '下载',
    icon: CircleArrowDown,
    get blocked() {
      return view.state.online
        ? null
        : '断网时不能下载'
    },
    run: (picked) => {
      if (picked.length === 0 || !view.state.online || view.state.session.status !== 'signedIn')
        return
      void view.app.downloadSongs(picked, source())
      void multiSelect.leave()
    },
  })

  /** 从这张歌单移除：先在本地拿掉，提示条留 5 秒撤销（App 现有行为），然后退出多选 */
  const removeFromPlaylist = (playlistId: number): SelectionAction => ({
    key: 'remove',
    label: '移除',
    icon: ListMinus,
    blocked: null,
    run: (picked) => {
      if (picked.length === 0)
        return
      view.app.removeFromPlaylist(playlistId, picked.map(song => song.id))
      void multiSelect.leave()
    },
  })

  /** 导出（#79）：浏览器不能选文件夹时调用方不把这个动作给列表（ADR-0014），导出弹窗照旧由 App 写文件 */
  const exportDownloads = (): SelectionAction => ({
    key: 'export',
    label: '导出',
    icon: FolderDown,
    blocked: null,
    run: (picked, from) => {
      if (picked.length === 0)
        return
      void exportDialog.open({
        songs: picked,
        multi: true,
        from,
      })
    },
  })

  /** 删除下载（#79）：先确认；确认后由多选模块收拾两层、再一次删掉 */
  const removeDownloads = (): SelectionAction => ({
    key: 'delete',
    label: '删除',
    icon: Trash2,
    tone: 'destructive',
    blocked: null,
    run: (picked, from) => {
      if (picked.length === 0)
        return
      void deleteDownloadsConfirm.open({
        songs: picked,
        from,
      })
    },
  })

  return {
addToPlaylist,
download,
exportDownloads,
removeDownloads,
removeFromPlaylist,
}
}
