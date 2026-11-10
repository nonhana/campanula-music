import { resolve } from '$app/paths';

import type { AccountResponse } from './account.js';
import type {
  CoverTokenResponse,
  SetCoverRequest,
  SetCoverResponse,
} from './cover.js';
import type { DailyResponse } from './discover.js';
import type { GetEndpoint } from './endpoint.js';
import { get, post } from './endpoint.js';
import type {
  AddTracksRequest,
  AlbumResponse,
  ArtistAlbumsResponse,
  ArtistIntroResponse,
  ArtistResponse,
  ArtistSongOrder,
  ArtistSongsResponse,
  CollectedAlbumsResponse,
  CollectedArtistsResponse,
  CollectRequest,
  CreatePlaylistRequest,
  CreatePlaylistResponse,
  DescribePlaylistRequest,
  HeartRequest,
  HeartsResponse,
  PlaylistCollectRequest,
  PlaylistOrderRequest,
  PlaylistPageResponse,
  PlaylistsResponse,
  PlaylistTagsResponse,
  RemoveTracksRequest,
  RenamePlaylistRequest,
  SongOrderRequest,
  SongsRequest,
  SongsResponse,
  TagPlaylistRequest,
  TrackIdsResponse,
} from './library.js';
import type {
  CaptchaRequest,
  CaptchaResponse,
  LogoutResponse,
  QrCheckRequest,
  QrCheckResponse,
  QrResponse,
  SmsLoginRequest,
  SmsLoginResponse,
} from './login.js';
import type {
  CheckInRequest,
  DownloadUrlResponse,
  LyricsResponse,
  PlayUrlResponse,
  Quality,
} from './playback.js';
import type {
  SearchKind,
  SearchPageResponse,
  SuggestionsResponse,
} from './search.js';
import type { WriteResponse } from './write.js';

interface NeteaseIdParams {
  id: number;
}

export const searchPage = <K extends SearchKind>(
  kind: K,
): GetEndpoint<{ keywords: string; offset: number }, SearchPageResponse<K>> =>
  get<SearchPageResponse<K>, { keywords: string; offset: number }>(
    ({ keywords, offset }) =>
      `${resolve('/api/search/[kind]', { kind })}?keywords=${encodeURIComponent(keywords)}&offset=${offset}`,
  );

export const endpoints = {
  account: get<AccountResponse>(() => resolve('/api/account')),

  loginQr: post<QrResponse>(() => resolve('/api/login/qr')),

  checkLoginQr: post<QrCheckResponse, QrCheckRequest>(() =>
    resolve('/api/login/qr/check'),
  ),

  sendCaptcha: post<CaptchaResponse, CaptchaRequest>(() =>
    resolve('/api/login/captcha'),
  ),

  loginSms: post<SmsLoginResponse, SmsLoginRequest>(() =>
    resolve('/api/login/sms'),
  ),

  logout: post<LogoutResponse>(() => resolve('/api/logout')),

  hearts: get<HeartsResponse, { uid: number }>(
    ({ uid }) => `${resolve('/api/hearts')}?uid=${uid}`,
  ),

  heart: post<WriteResponse, HeartRequest>(() => resolve('/api/hearts')),

  playlists: get<PlaylistsResponse, { uid: number }>(
    ({ uid }) => `${resolve('/api/playlists')}?uid=${uid}`,
  ),

  createPlaylist: post<CreatePlaylistResponse, CreatePlaylistRequest>(() =>
    resolve('/api/playlists'),
  ),

  playlist: get<PlaylistPageResponse, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]', { id }),
  ),

  trackIds: get<TrackIdsResponse, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/track-ids', { id }),
  ),

  songs: post<SongsResponse, SongsRequest>(() => resolve('/api/songs')),

  addTracks: post<WriteResponse, AddTracksRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/tracks', { id }),
  ),

  removeTracks: post<WriteResponse, RemoveTracksRequest, NeteaseIdParams>(
    ({ id }) => resolve('/api/playlists/[id=neteaseId]/tracks/remove', { id }),
  ),

  songOrder: post<WriteResponse, SongOrderRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/order', { id }),
  ),

  playlistOrder: post<WriteResponse, PlaylistOrderRequest>(() =>
    resolve('/api/library/order'),
  ),

  collectPlaylist: post<WriteResponse, PlaylistCollectRequest, NeteaseIdParams>(
    ({ id }) => resolve('/api/playlists/[id=neteaseId]/collect', { id }),
  ),

  coverToken: post<CoverTokenResponse, void, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/cover/token', { id }),
  ),

  setCover: post<SetCoverResponse, SetCoverRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/cover', { id }),
  ),

  renamePlaylist: post<WriteResponse, RenamePlaylistRequest, NeteaseIdParams>(
    ({ id }) => resolve('/api/playlists/[id=neteaseId]/name', { id }),
  ),

  describePlaylist: post<
    WriteResponse,
    DescribePlaylistRequest,
    NeteaseIdParams
  >(({ id }) => resolve('/api/playlists/[id=neteaseId]/description', { id })),

  tagPlaylist: post<WriteResponse, TagPlaylistRequest, NeteaseIdParams>(
    ({ id }) => resolve('/api/playlists/[id=neteaseId]/tags', { id }),
  ),

  publishPlaylist: post<WriteResponse, void, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/public', { id }),
  ),

  deletePlaylist: post<WriteResponse, void, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/delete', { id }),
  ),

  playlistTags: get<PlaylistTagsResponse>(() => resolve('/api/playlist-tags')),

  albums: get<CollectedAlbumsResponse>(() => resolve('/api/albums')),

  artists: get<CollectedArtistsResponse>(() => resolve('/api/artists')),

  album: get<AlbumResponse, NeteaseIdParams>(({ id }) =>
    resolve('/api/albums/[id=neteaseId]', { id }),
  ),

  artist: get<ArtistResponse, NeteaseIdParams>(({ id }) =>
    resolve('/api/artists/[id=neteaseId]', { id }),
  ),

  artistSongs: get<
    ArtistSongsResponse,
    { id: number; order: ArtistSongOrder; offset: number }
  >(
    ({ id, order, offset }) =>
      `${resolve('/api/artists/[id=neteaseId]/songs', { id })}?order=${order}&offset=${offset}`,
  ),

  artistAlbums: get<ArtistAlbumsResponse, { id: number; offset: number }>(
    ({ id, offset }) =>
      `${resolve('/api/artists/[id=neteaseId]/albums', { id })}?offset=${offset}`,
  ),

  artistIntro: get<ArtistIntroResponse, NeteaseIdParams>(({ id }) =>
    resolve('/api/artists/[id=neteaseId]/intro', { id }),
  ),

  collectAlbum: post<WriteResponse, CollectRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/albums/[id=neteaseId]/collect', { id }),
  ),

  collectArtist: post<WriteResponse, CollectRequest, NeteaseIdParams>(
    ({ id }) => resolve('/api/artists/[id=neteaseId]/collect', { id }),
  ),

  daily: get<DailyResponse>(() => resolve('/api/daily')),

  suggestions: get<SuggestionsResponse, { keywords: string }>(
    ({ keywords }) =>
      `${resolve('/api/search/suggestions')}?keywords=${encodeURIComponent(keywords)}`,
  ),

  playUrl: get<PlayUrlResponse, { id: number; quality: Quality }>(
    ({ id, quality }) =>
      `${resolve('/api/songs/[id=neteaseId]/play-url', { id })}?quality=${quality}`,
  ),

  downloadUrl: get<DownloadUrlResponse, { id: number; quality: Quality }>(
    ({ id, quality }) =>
      `${resolve('/api/songs/[id=neteaseId]/download-url', { id })}?quality=${quality}`,
  ),

  lyrics: get<LyricsResponse, NeteaseIdParams>(({ id }) =>
    resolve('/api/songs/[id=neteaseId]/lyrics', { id }),
  ),

  checkIn: post<WriteResponse, CheckInRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/songs/[id=neteaseId]/check-in', { id }),
  ),
};
