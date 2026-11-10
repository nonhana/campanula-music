import type { Attachment } from 'svelte/attachments';

import type { Song } from '#lib/api/library.js';

import { getOverlays } from '../overlay/overlay-context';
import { preloadCover } from '../ui/Cover.svelte';

export const playerPageActions = () => {
  const { player, queue, queuePanel, playerDrawer } = getOverlays();
  const openPlayerPage = (
    from: HTMLElement | null = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  ) => {
    if (queuePanel.request) void queuePanel.close(false);
    void player.open({ from });
  };
  const closePlayerPage = () => {
    void player.closeThrough();
  };
  const openQueueSheet = () => {
    if (player.request) {
      void queue.open({
        from: document.querySelector<HTMLElement>('[data-queue-entry]'),
      });
    }
  };
  const closeQueueSheet = () => {
    void queue.close();
  };
  const gripToOpenPlayerPage = (): Attachment<HTMLElement> => (node) =>
    playerDrawer.grip({
      from: 'closed',
      commit: () => openPlayerPage(node),
      tap: () => openPlayerPage(node),
    })(node);
  return {
    openPlayerPage,
    closePlayerPage,
    openQueueSheet,
    closeQueueSheet,
    gripToOpenPlayerPage,
  };
};

export const prefetchPageCover = (
  song: () => Song | null,
  size: () => number,
): void => {
  const { playerDrawer } = getOverlays();
  const url = $derived(song()?.album.coverUrl);
  const pageShown = $derived(playerDrawer.visible);
  $effect(() => {
    if (url && !pageShown) void preloadCover(url, size());
  });
};

export const playerPageChoices: {
  panel: 'lyrics' | 'queue';
  phoneLyrics: boolean;
  translation: boolean;
  romanization: boolean;
} = $state({
  panel: 'lyrics',
  phoneLyrics: false,
  translation: true,
  romanization: false,
});
