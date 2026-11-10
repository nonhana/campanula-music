import type { Song } from '#lib/api/library.js';
import type { PlaySource } from '#lib/api/playback.js';

export interface Checked {
  readonly ids: ReadonlySet<number>;
  readonly anchor: number | null;
}

/** 共享常量，调用方不要改这个 Set */
export const NONE: Checked = {
  ids: new Set(),
  anchor: null,
};

export const selectionKeyOf = (source: PlaySource): string => {
  switch (source.kind) {
    case 'playlist':
      return `playlist:${source.id}`;
    case 'album':
      return `album:${source.id}`;
    case 'artist':
      return `artist:${source.id}`;
    case 'search':
      return `search:${source.keyword}`;
    case 'daily':
      return 'daily';
    case 'downloads':
      return 'downloads';
  }
};

export const toggle = (state: Checked, id: number): Checked => {
  const ids = new Set(state.ids);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  return { ids, anchor: id };
};

export const extend = (
  state: Checked,
  visible: readonly number[],
  to: number,
): Checked => {
  const from = state.anchor === null ? -1 : visible.indexOf(state.anchor);
  const target = visible.indexOf(to);
  if (from < 0 || target < 0) return toggle(state, to);
  const ids = new Set(state.ids);
  const [lo, hi] = from < target ? [from, target] : [target, from];
  for (let index = lo; index <= hi; index += 1) ids.add(visible[index]!);
  return { ids, anchor: state.anchor };
};

export const allOn = (state: Checked, visible: readonly number[]): boolean =>
  visible.length > 0 && visible.every((id) => state.ids.has(id));

export const selectAll = (
  state: Checked,
  visible: readonly number[],
): Checked => {
  if (allOn(state, visible)) return NONE;
  const ids = new Set(state.ids);
  for (const id of visible) ids.add(id);
  return { ids, anchor: state.anchor };
};

export const picked = (
  songs: readonly Song[],
  ids: ReadonlySet<number>,
): readonly Song[] => songs.filter((song) => ids.has(song.id));
