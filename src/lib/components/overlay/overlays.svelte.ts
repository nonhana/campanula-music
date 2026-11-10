import type { Component } from 'svelte';
import { onDestroy, onMount, tick } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';

import LogoutConfirm from '../account/LogoutConfirm.svelte';
import ClearDownloadsConfirm from '../downloads/ClearDownloadsConfirm.svelte';
import DeleteDownloadsConfirm from '../downloads/DeleteDownloadsConfirm.svelte';
import DeletePlaylistDownloadsConfirm from '../downloads/DeletePlaylistDownloadsConfirm.svelte';
import DownloadPicker from '../downloads/DownloadPicker.svelte';
import DownloadsMenu from '../downloads/DownloadsMenu.svelte';
import ExportDialog from '../downloads/ExportDialog.svelte';
import { createDownloadPanel } from '../downloads/panel.svelte';
import PlaylistDownloadsDialog from '../downloads/PlaylistDownloadsDialog.svelte';
import DescriptionDialog from '../library/DescriptionDialog.svelte';
import { MultiSelect } from '../library/multi-select.svelte';
import ArtistMenu from '../menu/ArtistMenu.svelte';
import SongMenu from '../menu/SongMenu.svelte';
import { createDrawer } from '../player/drawer.svelte';
import { createPlayerLayer } from '../player/player-layer.svelte';
import QueuePanel from '../player/QueuePanel.svelte';
import { queueEmpty } from '../player/view';
import AddSongs from '../playlist/AddSongs.svelte';
import AddToPlaylist from '../playlist/AddToPlaylist.svelte';
import CoverEditor from '../playlist/CoverEditor.svelte';
import PlaylistEditor from '../playlist/PlaylistEditor.svelte';
import PlaylistMenu from '../playlist/PlaylistMenu.svelte';
import { getAppView } from '../shared/app-context.svelte';
import { desktopLayout } from '../shared/layout';
import { setSelectionMode } from '../ui/selection-mode';
import { createOverlayHistory } from './overlay-history.svelte';
import type {
  AddToPlaylistRequest,
  ArtistMenuRequest,
  DeleteDownloadsRequest,
  DeletePlaylistDownloadsRequest,
  DescriptionRequest,
  DialogRequest,
  DownloadPickerRequest,
  EditorRequest,
  ExportRequest,
  MenuRequest,
  PlaylistMenuRequest,
  PlaylistRequest,
  SongMenuRequest,
} from './overlay-requests';
import type { LayerOptions } from './overlay-stack';
import { OverlayStack } from './overlay-stack';

export const createOverlays = () => {
  const view = getAppView();
  let notify = () => {};
  const read = createSubscriber((update) => {
    notify = update;
    return () => {
      notify = () => {};
    };
  });
  let stack!: OverlayStack<HTMLElement>;
  let multiSelect!: MultiSelect;
  const history = createOverlayHistory({
    changed: (phase) => {
      void stack.reconcile(phase);
    },
    navigate: () => stack.navigate(),
  });
  stack = new OverlayStack<HTMLElement>(
    history,
    {
      read,
      changed: () => notify(),
      rendered: tick,
      focus(target, fallback) {
        // 归还顺序：focusReturn / request.from（仍 connected、不在 inert 里）-> fallback -> main
        const available = (node: HTMLElement | null) =>
          node?.isConnected && !node.closest('[inert]') ? node : null;
        const active =
          stack.top &&
          document.querySelector<HTMLElement>(
            `[data-overlay="${stack.top.name}"]`,
          );
        const next =
          available(target) ??
          (fallback
            ? available(document.querySelector<HTMLElement>(fallback))
            : null) ??
          active?.querySelector<HTMLElement>(
            '[data-autofocus], button:not(:disabled), input, [tabindex]',
          ) ??
          document.querySelector<HTMLElement>('main');
        if (next) {
          if (!next.hasAttribute('tabindex') && next.tagName === 'MAIN')
            next.tabIndex = -1;
          next.focus({ preventScroll: true });
        }
      },
    },
    crypto.randomUUID(),
  );
  const mounted: {
    name: string;
    component: Component;
    inert: () => boolean;
  }[] = [];
  const register = <R extends DialogRequest>(
    name: string,
    options: LayerOptions<R, HTMLElement>,
    component?: Component,
  ) => {
    const layer = stack.register<R>(name, options);
    if (component) {
      mounted.push({
        name,
        component,
        inert: () => layer.containerInert,
      });
    }
    return layer;
  };
  const menu = {
    history: (request: MenuRequest) => request.anchor === null,
    modal: false,
  };
  const dialog = {
    history: () => !desktopLayout.current,
    modal: true,
  };

  const songMenu = register<SongMenuRequest>('song-menu', menu, SongMenu);
  const artistMenu = register<ArtistMenuRequest>(
    'artist-menu',
    menu,
    ArtistMenu,
  );
  const playlistPicker = register<AddToPlaylistRequest>(
    'playlist-picker',
    {
      ...menu,
      dependsOn: (request) => (request.mode === 'multi' ? 'selection' : null),
    },
    AddToPlaylist,
  );
  const playlistMenu = register<PlaylistMenuRequest>(
    'playlist-menu',
    menu,
    PlaylistMenu,
  );
  const playlistEditor = register<EditorRequest>(
    'playlist-editor',
    dialog,
    PlaylistEditor,
  );
  const addSongsDialog = register<PlaylistRequest>(
    'add-songs',
    { ...dialog, fallback: '[data-add-songs-entry]' },
    AddSongs,
  );
  const downloadPicker = register<DownloadPickerRequest>(
    'download-picker',
    dialog,
    DownloadPicker,
  );
  const descriptionDialog = register<DescriptionRequest>(
    'description',
    dialog,
    DescriptionDialog,
  );
  const coverEditor = register<PlaylistRequest>(
    'cover-editor',
    {
      ...dialog,
      dependsOn: 'playlist-editor',
      beforeClose: () => {
        const cover = view.state.cover;
        if (cover?.status !== 'uploading') return true;
        if (cover.upload.step !== 'set') view.app.cancelCover();
        return false;
      },
      dismissed: () => view.app.closeCover(),
    },
    CoverEditor,
  );
  const logoutConfirm = register<DialogRequest>(
    'logout',
    dialog,
    LogoutConfirm,
  );
  const exportDialog = register<ExportRequest>(
    'export',
    {
      ...dialog,
      dependsOn: (request) => (request.multi ? 'selection' : null),
      beforeClose: () => {
        if (view.state.exporting?.status !== 'writing') return true;
        view.app.cancelExport();
        return false;
      },
      dismissed: () => view.app.closeExport(),
    },
    ExportDialog,
  );
  const deleteDownloadsConfirm = register<DeleteDownloadsRequest>(
    'delete-downloads',
    { ...dialog, dependsOn: 'selection' },
    DeleteDownloadsConfirm,
  );
  const downloadsMenu = register<MenuRequest>(
    'downloads-menu',
    menu,
    DownloadsMenu,
  );
  const playlistDownloads = register<DialogRequest>(
    'playlist-downloads',
    dialog,
    PlaylistDownloadsDialog,
  );
  const deletePlaylistDownloadsConfirm =
    register<DeletePlaylistDownloadsRequest>(
      'delete-playlist-downloads',
      { ...dialog, dependsOn: 'playlist-downloads' },
      DeletePlaylistDownloadsConfirm,
    );
  const clearDownloadsConfirm = register<DialogRequest>(
    'clear-downloads',
    dialog,
    ClearDownloadsConfirm,
  );
  const canRestorePlayer = () => !queueEmpty(view.state.player);
  const player = register<DialogRequest>('player', {
    history: () => true,
    modal: true,
    restore: canRestorePlayer,
    fallback: '[data-player-bar] button',
  });
  const queue = register<DialogRequest>('queue', {
    history: () => true,
    modal: true,
    restore: canRestorePlayer,
    dependsOn: 'player',
    parent: 'player',
    fallback: '[data-queue-entry]',
  });
  const queuePanel = register<DialogRequest>(
    'queue-panel',
    {
      history: () => false,
      modal: false,
      fallback: '[data-queue-toggle]',
    },
    QueuePanel,
  );
  const selection = register<DialogRequest>('selection', {
    history: () => !desktopLayout.current,
    modal: false,
    focusReturn: () => multiSelect.returnTarget(),
    dismissed: () => multiSelect.clear(),
  });
  multiSelect = new MultiSelect(selection, view.app);
  setSelectionMode(() => multiSelect.mode);
  const playerDrawer = createDrawer(() => window.innerHeight);
  const playerLayer = createPlayerLayer(player, playerDrawer);
  const downloadPanel = createDownloadPanel();

  onMount(() => {
    void stack.reconcile();
  });
  onDestroy(() => stack.clear());

  return {
    stack,
    mounted,
    songMenu,
    artistMenu,
    playlistPicker,
    playlistMenu,
    playlistEditor,
    addSongsDialog,
    downloadPicker,
    descriptionDialog,
    coverEditor,
    logoutConfirm,
    exportDialog,
    deleteDownloadsConfirm,
    downloadsMenu,
    playlistDownloads,
    deletePlaylistDownloadsConfirm,
    clearDownloadsConfirm,
    player,
    queue,
    queuePanel,
    selection,
    multiSelect,
    playerDrawer,
    playerLayer,
    downloadPanel,
  };
};
