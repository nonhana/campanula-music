import type { Credit, Song } from './library';

export type Suggestion =
  | { kind: 'song'; name: string }
  | { kind: 'artist' | 'album' | 'playlist'; id: number; name: string };

export interface SuggestionsResponse {
  suggestions: Suggestion[];
}

export type SearchKind = 'songs' | 'playlists' | 'artists' | 'albums';

export const SEARCH_KINDS: readonly SearchKind[] = [
  'songs',
  'playlists',
  'artists',
  'albums',
];

export const SEARCH_RESULTS_PER_REQUEST = 30;

export interface SearchedPlaylist {
  id: number;
  name: string | null;
  coverUrl: string | null;
  creator: string | null;
  trackCount: number | null;
  playCount: number | null;
}

interface SearchedArtist {
  id: number;
  name: string | null;
  avatarUrl: string | null;
  songCount: number | null;
}

interface SearchedAlbum {
  id: number;
  name: string | null;
  coverUrl: string | null;
  artists: Credit[];
  publishedAt: number | null;
}

export interface SearchedItems {
  songs: Song;
  playlists: SearchedPlaylist;
  artists: SearchedArtist;
  albums: SearchedAlbum;
}

// total 会变，同一项也可能在后面的页里再出现；没给总数时拿满一页就算还有下一页
export interface SearchPageResponse<K extends SearchKind = SearchKind> {
  items: SearchedItems[K][];
  total: number | null;
}
