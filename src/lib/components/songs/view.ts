import type { LucideIcon } from '@lucide/svelte';

import type { Song } from '#lib/api/library.js';
import { songTitle } from '#lib/api/library.js';

import type { SelectionAction } from '../library/selection-actions.svelte';
import type { ScrollMark } from '../shared/scroll-marks';
import { formatCount, langOf } from '../shared/text';

export const SONG_ROW_HEIGHT = 56;

export type SongListView =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'failed';
      readonly title: string;
      readonly body?: string;
      readonly retry: () => void;
    }
  | {
      readonly kind: 'empty';
      readonly title: string;
      readonly body?: string;
      readonly icon?: LucideIcon;
      readonly action?: { readonly label: string; readonly run: () => void };
    }
  | { readonly kind: 'songs'; readonly songs: readonly Song[] };

export interface SongSearch {
  readonly term: string;
  readonly incomplete?: boolean;
  readonly incompleteBody?: string;
}

export interface SongSelect {
  readonly actions: readonly SelectionAction[];
  /** 整张列表：列表里搜索时勾选和动作仍按它，显示的只是搜到的那些 */
  readonly songs?: () => readonly Song[];
  readonly entryLabel?: string;
}

export interface SongDragHooks {
  readonly placeOf: (song: Song, index: number) => number;
  readonly keep: (song: Song, index: number) => boolean;
  readonly animatePlace: boolean;
  readonly hidden: (song: Song, index: number) => boolean;
  /** 拖动时滚动条气泡不写（正在快速定位） */
  readonly marks: boolean;
}

export const songMark = (song: Song, index: number): ScrollMark => ({
  caption: `第 ${formatCount(index + 1)} 首`,
  title: songTitle(song),
  lang: langOf(song.name),
});
