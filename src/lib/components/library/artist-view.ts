import type { ArtistSongOrder } from '#lib/api/library.js';
import { ARTIST_SONG_ORDERS } from '#lib/api/library.js';
import type { ArtistTab } from '#lib/app/library.js';

export const ARTIST_TABS: readonly { key: ArtistTab; label: string }[] = [
  { key: 'songs', label: '歌曲' },
  { key: 'albums', label: '专辑' },
  { key: 'intro', label: '简介' },
];

export const ARTIST_ORDERS: readonly { key: ArtistSongOrder; label: string }[] =
  [
    { key: 'hot', label: '热门' },
    { key: 'time', label: '最新' },
  ];

export const artistTabOf = (value: string | null): ArtistTab =>
  ARTIST_TABS.find((tab) => tab.key === value)?.key ?? 'songs';

export const artistOrderOf = (value: string | null): ArtistSongOrder =>
  ARTIST_SONG_ORDERS.find((order) => order === value) ?? 'hot';

export const artistSearch = (
  tab: ArtistTab,
  order: ArtistSongOrder,
): '' | `?${string}` => {
  const query = new URLSearchParams();
  if (tab !== 'songs') query.set('tab', tab);
  if (order !== 'hot') query.set('order', order);
  return query.size > 0 ? `?${query.toString()}` : '';
};

export const ARTIST_PANEL_ID = 'artist-panel';
export const artistTabId = (tab: ArtistTab): string => `artist-tab-${tab}`;
