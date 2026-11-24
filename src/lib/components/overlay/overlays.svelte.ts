import type { Component } from 'svelte';
import { onDestroy, onMount, tick } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';

import { createDownloadPanel } from '../downloads/panel.svelte.ts';
import { MultiSelect } from '../library/multi-select.svelte.ts';
import { createDrawer } from '../player/drawer.svelte.ts';
import { createPlayerLayer } from '../player/player-layer.svelte.ts';
import { queueEmpty } from '../player/view.ts';
import { getAppView } from '../shared/app-context.svelte.ts';
import { desktopLayout } from '../shared/layout.ts';
import { createExitGuard } from '../shell/exit-guard.ts';
import { pageHistory } from '../shell/page-history.ts';
import { setSelectionMode } from '../ui/selection-mode.ts';
import { createOverlayHistory } from './overlay-history.svelte.ts';
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
} from './overlay-requests.ts';
import type { LayerOptions } from './overlay-stack.ts';
import { OverlayStack } from './overlay-stack.ts';

type OverlayLoader = () => Promise<{ default: Component }>;

interface MountedOverlay {
  readonly name: string;
  readonly active: () => boolean;
  readonly inert: () => boolean;
  readonly load: OverlayLoader;
}

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
    navigate: (willUnload) => (view.demo && willUnload) || stack.navigate(),
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
  const mounted: MountedOverlay[] = [];
  const register = <R extends DialogRequest>(
    name: string,
    options: LayerOptions<R, HTMLElement>,
    load?: OverlayLoader,
  ) => {
    const layer = stack.register<R>(name, options);
    if (load) {
      mounted.push({
        name,
        active: () => layer.request !== null,
        inert: () => layer.containerInert,
        load,
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

  const songMenu = register<SongMenuRequest>(
    'song-menu',
    menu,
    () => import('../menu/SongMenu.svelte'),
  );
  const artistMenu = register<ArtistMenuRequest>(
    'artist-menu',
    menu,
    () => import('../menu/ArtistMenu.svelte'),
  );
  const playlistPicker = register<AddToPlaylistRequest>(
    'playlist-picker',
    {
      ...menu,
      dependsOn: (request) => (request.mode === 'multi' ? 'selection' : null),
    },
    () => import('../playlist/AddToPlaylist.svelte'),
  );
  const playlistMenu = register<PlaylistMenuRequest>(
    'playlist-menu',
    menu,
    () => import('../playlist/PlaylistMenu.svelte'),
  );
  const playlistEditor = register<EditorRequest>(
    'playlist-editor',
    dialog,
    () => import('../playlist/PlaylistEditor.svelte'),
  );
  const addSongsDialog = register<PlaylistRequest>(
    'add-songs',
    { ...dialog, fallback: '[data-add-songs-entry]' },
    () => import('../playlist/AddSongs.svelte'),
  );
  const downloadPicker = register<DownloadPickerRequest>(
    'download-picker',
    dialog,
    () => import('../downloads/DownloadPicker.svelte'),
  );
  const descriptionDialog = register<DescriptionRequest>(
    'description',
    dialog,
    () => import('../library/DescriptionDialog.svelte'),
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
    () => import('../playlist/CoverEditor.svelte'),
  );
  const logoutConfirm = register<DialogRequest>(
    'logout',
    dialog,
    () => import('../account/LogoutConfirm.svelte'),
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
    () => import('../downloads/ExportDialog.svelte'),
  );
  const deleteDownloadsConfirm = register<DeleteDownloadsRequest>(
    'delete-downloads',
    { ...dialog, dependsOn: 'selection' },
    () => import('../downloads/DeleteDownloadsConfirm.svelte'),
  );
  const downloadsMenu = register<MenuRequest>(
    'downloads-menu',
    menu,
    () => import('../downloads/DownloadsMenu.svelte'),
  );
  const playlistDownloads = register<DialogRequest>(
    'playlist-downloads',
    dialog,
    () => import('../downloads/PlaylistDownloadsDialog.svelte'),
  );
  const deletePlaylistDownloadsConfirm =
    register<DeletePlaylistDownloadsRequest>(
      'delete-playlist-downloads',
      { ...dialog, dependsOn: 'playlist-downloads' },
      () => import('../downloads/DeletePlaylistDownloadsConfirm.svelte'),
    );
  const clearDownloadsConfirm = register<DialogRequest>(
    'clear-downloads',
    dialog,
    () => import('../downloads/ClearDownloadsConfirm.svelte'),
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
    () => import('../player/QueuePanel.svelte'),
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

  let exitConfirming = $state(false);
  const exitGuard = createExitGuard((confirming) => {
    exitConfirming = confirming;
  });

  $effect(() => {
    const { player: playback } = view.state;
    const playing = playback.current !== null && playback.status !== 'paused';
    exitGuard.setActive(
      !view.demo &&
        playing &&
        !pageHistory.hasSameDocumentBack &&
        stack.top === null &&
        !stack.holdsHistory &&
        !downloadPanel.expanded,
    );
  });

  onMount(() => {
    void stack.reconcile();
  });
  onDestroy(() => {
    exitGuard.destroy();
    stack.clear();
  });

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
    exitPrompt: {
      get open() {
        return exitConfirming;
      },
      dismiss: () => exitGuard.dismiss(),
    },
  };
};
