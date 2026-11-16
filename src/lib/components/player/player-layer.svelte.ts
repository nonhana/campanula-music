import { untrack } from 'svelte';

import type { DialogRequest } from '../overlay/overlay-requests.ts';
import type { OverlayLayer } from '../overlay/overlay-stack.ts';
import { getAppView } from '../shared/app-context.svelte.ts';
import { desktopLayout } from '../shared/layout.ts';
import {
  DESKTOP_DOCK_HEIGHT,
  PHONE_DOCK_HEIGHT,
} from '../shell/player-dock.ts';
import type { Drawer } from './drawer.svelte.ts';
import { queueEmpty } from './view.ts';

export interface PlayerLayerState {
  readonly hasQueue: boolean;
  readonly open: boolean;
  readonly shown: boolean;
  dockHeight: number;
  clearQueue: () => void;
}

export const createPlayerLayer = (
  player: OverlayLayer<DialogRequest, HTMLElement>,
  drawer: Drawer,
): PlayerLayerState => {
  const view = getAppView();
  let dockHeight = $state(PHONE_DOCK_HEIGHT);
  const hasQueue = $derived(!queueEmpty(view.state.player));
  const open = $derived(hasQueue && player.request !== null);
  const shown = $derived(hasQueue && (open || drawer.visible));

  $effect(() => drawer.settle(open));
  $effect(() => {
    if (!hasQueue && player.request)
      untrack(() => {
        void player.invalidate();
      });
  });

  let clearing = $state(false);
  $effect(() => {
    if (!clearing) return;
    if (open) {
      clearing = false;
      return;
    }
    if (drawer.visible) return;
    clearing = false;
    untrack(() => view.app.clearQueue());
  });

  return {
    get hasQueue() {
      return hasQueue;
    },
    get open() {
      return open;
    },
    get shown() {
      return shown;
    },
    get dockHeight() {
      return Math.max(
        desktopLayout.current ? DESKTOP_DOCK_HEIGHT : PHONE_DOCK_HEIGHT,
        dockHeight,
      );
    },
    set dockHeight(height) {
      dockHeight = height;
    },
    clearQueue() {
      if (!shown) {
        view.app.clearQueue();
        return;
      }
      if (!open) {
        clearing = true;
        return;
      }
      void player.closeThrough().then((result) => {
        if (result === 'committed') clearing = true;
        else view.app.clearQueue();
      });
    },
  };
};
