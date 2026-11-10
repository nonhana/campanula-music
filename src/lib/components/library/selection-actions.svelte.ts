import type { LucideIcon } from '@lucide/svelte';
import {
  CircleArrowDown,
  FolderDown,
  ListMinus,
  ListPlus,
  Trash2,
} from '@lucide/svelte';

import type { Song } from '#lib/api/library.js';
import type { DownloadSource } from '#lib/app/downloads.js';

import { getOverlays } from '../overlay/overlay-context';
import type { MenuAnchor } from '../overlay/overlay-requests';
import { getAppView } from '../shared/app-context.svelte';

export interface SelectionAction {
  readonly key: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly tone?: 'destructive';
  /** 能点时为 null；一首都没勾时由工具条统一禁用，这里不管 */
  readonly blocked: string | null;
  readonly run: (
    picked: readonly Song[],
    from: HTMLElement | null,
    anchor: MenuAnchor | null,
  ) => void;
}

export const selectionActions = () => {
  const { deleteDownloadsConfirm, exportDialog, multiSelect, playlistPicker } =
    getOverlays();
  const view = getAppView();

  const addToPlaylist = (
    currentPlaylistId: number | null = null,
  ): SelectionAction => ({
    key: 'add',
    label: '加入歌单',
    icon: ListPlus,
    blocked: null,
    run: (picked, from, anchor) => {
      if (picked.length === 0) return;
      void playlistPicker.open({
        mode: 'multi',
        songs: picked,
        currentPlaylistId,
        from,
        anchor,
      });
    },
  });

  const download = (source: () => DownloadSource): SelectionAction => ({
    key: 'download',
    label: '下载',
    icon: CircleArrowDown,
    get blocked() {
      return view.state.online ? null : '断网时不能下载';
    },
    run: (picked) => {
      if (
        picked.length === 0 ||
        !view.state.online ||
        view.state.session.status !== 'signedIn'
      )
        return;
      void view.app.downloadSongs(picked, source());
      void multiSelect.leave();
    },
  });

  const removeFromPlaylist = (playlistId: number): SelectionAction => ({
    key: 'remove',
    label: '移除',
    icon: ListMinus,
    blocked: null,
    run: (picked) => {
      if (picked.length === 0) return;
      view.app.removeFromPlaylist(
        playlistId,
        picked.map((song) => song.id),
      );
      void multiSelect.leave();
    },
  });

  const exportDownloads = (): SelectionAction => ({
    key: 'export',
    label: '导出',
    icon: FolderDown,
    blocked: null,
    run: (picked, from) => {
      if (picked.length === 0) return;
      void exportDialog.open({
        songs: picked,
        multi: true,
        from,
      });
    },
  });

  const removeDownloads = (): SelectionAction => ({
    key: 'delete',
    label: '删除',
    icon: Trash2,
    tone: 'destructive',
    blocked: null,
    run: (picked, from) => {
      if (picked.length === 0) return;
      void deleteDownloadsConfirm.open({
        songs: picked,
        from,
      });
    },
  });

  return {
    addToPlaylist,
    download,
    exportDownloads,
    removeDownloads,
    removeFromPlaylist,
  };
};
