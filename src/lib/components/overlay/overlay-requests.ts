import type { Song } from '#lib/api/library.js';
import type { PlaySource } from '#lib/api/playback.js';

import type { CreditLink } from '../songs/credit-link';

export interface DialogRequest {
  readonly from: HTMLElement | null;
}

export interface MenuAnchor {
  readonly x: number;
  readonly y: number;
  readonly top: number;
  readonly end: boolean;
}

export interface MenuRequest extends DialogRequest {
  readonly anchor: MenuAnchor | null;
}

export interface SongMenuRequest extends MenuRequest {
  readonly song: Song;
  readonly source: PlaySource;
}

export interface PlaylistMenuRequest extends MenuRequest {
  readonly playlistId: number;
  readonly compact: boolean;
}

export interface ArtistMenuRequest extends MenuRequest {
  readonly artists: readonly CreditLink[];
}

export type AddToPlaylistRequest =
  | (MenuRequest & {
      readonly mode: 'song';
      readonly song: Song;
      readonly songs: readonly Song[];
      readonly currentPlaylistId: number | null;
    })
  | (MenuRequest & {
      readonly mode: 'multi';
      readonly songs: readonly Song[];
      readonly currentPlaylistId: number | null;
    });

export type EditorRequest =
  | (DialogRequest & { readonly mode: 'new'; readonly songs: readonly Song[] })
  | (DialogRequest & {
      readonly mode: 'info' | 'public' | 'delete';
      readonly playlistId: number;
    });

export interface PlaylistRequest extends DialogRequest {
  readonly playlistId: number;
}

export interface DescriptionRequest extends DialogRequest {
  readonly name: string;
  readonly text: string;
}

export type DownloadPickerRequest =
  | (DialogRequest & { readonly kind: 'playlist'; readonly playlistId: number })
  | (DialogRequest & { readonly kind: 'album'; readonly albumId: number });

export interface ExportRequest extends DialogRequest {
  readonly songs: readonly Song[];
  readonly multi: boolean;
}

export interface DeleteDownloadsRequest extends DialogRequest {
  readonly songs: readonly Song[];
}

export interface DeletePlaylistDownloadsRequest extends DialogRequest {
  readonly playlistId: number;
  readonly name: string;
}
