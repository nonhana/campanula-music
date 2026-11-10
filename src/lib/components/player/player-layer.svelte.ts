import { untrack } from 'svelte';

import type { DialogRequest } from '../overlay/overlay-requests';
import type { OverlayLayer } from '../overlay/overlay-stack';
import { getAppView } from '../shared/app-context.svelte';
import type { Drawer } from './drawer.svelte';
import { queueEmpty } from './view';

export interface PlayerLayerState {
  readonly hasQueue: boolean;
  readonly open: boolean;
  readonly shown: boolean;
  clearQueue: () => void;
}

export const createPlayerLayer = (
  player: OverlayLayer<DialogRequest, HTMLElement>,
  drawer: Drawer,
): PlayerLayerState => {
  const view = getAppView();
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
