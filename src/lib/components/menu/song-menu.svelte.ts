import type { Song } from '#lib/api/library.ts';
import type { PlaySource } from '#lib/api/playback.ts';

import { getOverlays } from '../overlay/overlay-context.ts';
import { getAppView } from '../shared/app-context.svelte.ts';
import { anchorBelow } from './menu-anchor.ts';

// 在组件初始化时调用一次：用的是所属外框的层会话
export const songMenuActions = () => {
  const { songMenu, playlistPicker } = getOverlays();
  const view = getAppView();

  const openSongMenuFrom = (
    event: MouseEvent,
    song: Song,
    source: PlaySource,
  ): void => {
    if (view.demo) return;
    const button = event.currentTarget as HTMLElement;
    const shown = [songMenu, playlistPicker].find(
      (layer) => layer.request?.from === button,
    );
    if (shown) {
      void shown.close();
      return;
    }
    void songMenu.open({
      song,
      source,
      from: button,
      anchor: anchorBelow(event),
    });
  };

  const openSongMenuAt = (
    event: MouseEvent,
    song: Song,
    source: PlaySource,
  ): void => {
    if (view.demo) return;
    if (event instanceof PointerEvent && event.pointerType === 'touch') {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const row = event.currentTarget as HTMLElement;
    const keyboard = event.clientX === 0 && event.clientY === 0;
    const rect = row.getBoundingClientRect();
    const anchor = keyboard
      ? {
          x: rect.right - 8,
          y: rect.bottom,
          top: rect.top,
          end: true,
        }
      : {
          x: event.clientX,
          y: event.clientY,
          top: event.clientY,
          end: false,
        };
    const focused =
      document.activeElement instanceof HTMLElement &&
      row.contains(document.activeElement)
        ? document.activeElement
        : null;
    void songMenu.open({ song, source, from: focused, anchor });
  };

  return { openSongMenuFrom, openSongMenuAt };
};
