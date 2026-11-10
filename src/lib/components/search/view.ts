import type { SearchedItems, SearchKind, Suggestion } from '#lib/api/search.js';
import { SEARCH_KINDS } from '#lib/api/search.js';
import type { SearchFailure } from '#lib/app/search.js';

import { failureText } from '../shared/failure';

export const SUGGESTION_KINDS: Record<Suggestion['kind'], string> = {
  song: '单曲',
  artist: '歌手',
  album: '专辑',
  playlist: '歌单',
};

export type SearchTab = 'all' | SearchKind;

export type KindItems = {
  [K in SearchKind]: { kind: K; items: readonly SearchedItems[K][] };
}[SearchKind];

export const KIND_WORDS: Record<SearchKind, { label: string; unit: string }> = {
  songs: { label: '单曲', unit: '首' },
  playlists: { label: '歌单', unit: '张' },
  artists: { label: '歌手', unit: '位' },
  albums: { label: '专辑', unit: '张' },
};

export const SEARCH_TABS: readonly { key: SearchTab; label: string }[] = [
  { key: 'all', label: '综合' },
  ...SEARCH_KINDS.map((kind) => ({ key: kind, label: KIND_WORDS[kind].label })),
];

export const searchTabOf = (type: string | null): SearchTab =>
  SEARCH_KINDS.find((kind) => kind === type) ?? 'all';

export const searchPath = (
  keyword: string,
  tab: SearchTab,
): `/search?q=${string}` =>
  `/search?q=${encodeURIComponent(keyword)}${
    tab === 'all' ? '' : `&type=${tab}`
  }`;

export const SEARCH_PANEL_ID = 'search-results';
export const searchTabId = (tab: SearchTab): string => `search-tab-${tab}`;

export const OVERVIEW_COUNTS: Record<SearchKind, number> = {
  songs: 5,
  playlists: 6,
  artists: 12,
  albums: 12,
};

export const matchedParts = (
  name: string,
  typed: string,
): [string, string, string] => {
  const at = typed ? name.toLowerCase().indexOf(typed.toLowerCase()) : -1;
  if (at < 0) return [name, '', ''];
  return [
    name.slice(0, at),
    name.slice(at, at + typed.length),
    name.slice(at + typed.length),
  ];
};

export const searchFailure = (
  failure: SearchFailure,
): { title: string; body?: string } => {
  if (failure.kind === 'offline') return { title: '搜索要联网' };
  return {
    title: '这次没搜成',
    body: failureText(failure),
  };
};
