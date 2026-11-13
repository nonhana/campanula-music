export interface HeartsResponse {
  songIds: number[];
}

export interface HeartRequest {
  songId: number;
  hearted: boolean;
}

export const TRACKS_PER_CHANGE = 9000;

export interface AddTracksRequest {
  songIds: number[];
}

export interface RemoveTracksRequest {
  songIds: number[];
}

export const SONGS_PER_ORDER = 20000;

export interface SongOrderRequest {
  songIds: number[];
}

export const PLAYLISTS_PER_ORDER = 1000;

export interface PlaylistOrderRequest {
  playlistIds: number[];
}

export interface CollectRequest {
  collected: boolean;
}

export type PlaylistCollectRequest = CollectRequest;

export interface PlaylistInfo {
  id: number;
  name: string | null;
  coverUrl: string | null;
  creator: string | null;
  creatorAvatarUrl: string | null;
  playCount: number | null;
  description: string | null;
  tags: string[];
}

export interface Playlist extends PlaylistInfo {
  kind: 'liked' | 'own' | 'collected';
  private: boolean;
  trackCount: number | null;
  tracksUpdatedAt: number | null;
}

const LIKED_SPECIAL_TYPE = 5;

export const playlistKindOf = (
  specialType: number,
  creatorUserId: number,
  uid: number,
): Playlist['kind'] => {
  if (specialType === LIKED_SPECIAL_TYPE) return 'liked';
  return creatorUserId === uid ? 'own' : 'collected';
};

export const canSortPlaylist = (kind: Playlist['kind']): boolean =>
  kind === 'own' || kind === 'liked';

export const reorderSortable = <T extends { id: number }>(
  items: readonly T[],
  ids: readonly number[],
  isSortable: (item: T) => boolean,
): T[] => {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (item && isSortable(item)) ordered.push(item);
  }
  const seen = new Set(ordered.map((item) => item.id));
  for (const item of items) {
    if (isSortable(item) && !seen.has(item.id)) ordered.push(item);
  }
  let next = 0;
  return items.map((item) => (isSortable(item) ? ordered[next++]! : item));
};

export interface PlaylistsResponse {
  playlists: Playlist[];
}

export const PLAYLIST_NAME_WIDTH = 40;
export const PLAYLIST_DESCRIPTION_LENGTH = 1000;
export const PLAYLIST_TAGS_MAX = 3;

export const nameWidth = (name: string): number => {
  let width = 0;
  for (let index = 0; index < name.length; index += 1) {
    width += name.charCodeAt(index) < 0x80 ? 1 : 2;
  }
  return width;
};

export type PlaylistEditProblem =
  | 'nameEmpty'
  | 'nameTooLong'
  | 'descriptionTooLong'
  | 'tooManyTags'
  | 'tooManySongs';

export const nameProblem = (name: string): PlaylistEditProblem | null => {
  if (!name) return 'nameEmpty';
  return nameWidth(name) > PLAYLIST_NAME_WIDTH ? 'nameTooLong' : null;
};

export interface CreatePlaylistRequest {
  name: string;
  private: boolean;
}

export interface CreatePlaylistResponse {
  playlist: Playlist;
}

export interface RenamePlaylistRequest {
  name: string;
}

export interface DescribePlaylistRequest {
  description: string;
}

export interface TagPlaylistRequest {
  tags: string[];
}

export interface PlaylistTagGroup {
  name: string;
  tags: string[];
}

export interface PlaylistTagsResponse {
  groups: PlaylistTagGroup[];
}

export interface TrackIdsResponse {
  trackIds: number[];
}

export type PlaylistUnavailable = 'deleted' | 'missing' | 'private';

export type PlaylistPageResponse =
  | {
      kind: 'shown';
      playlist: PlaylistInfo;
      trackIds: number[];
      tracksUpdatedAt: number | null;
    }
  | { kind: 'unavailable'; reason: PlaylistUnavailable };

export interface Credit {
  id: number | null;
  name: string | null;
}

export const creditLine = (credits: readonly Credit[]): string => {
  const names = credits.flatMap((artist) => artist.name ?? []);
  return names.length > 0 ? names.join(' / ') : '未知歌手';
};

// 只在显示时换，数据里仍是 null：导出不能把它当歌名写进文件
export const songTitle = (song: Pick<Song, 'name'>): string =>
  song.name ?? '未知歌曲';

export const playlistName = (playlist: {
  name: string | null;
  kind?: Playlist['kind'] | null;
}): string =>
  playlist.kind === 'liked' ? '我喜欢的音乐' : (playlist.name ?? '未命名歌单');

// 加 ?param=宽y宽，换成 https；主机统一成 p1：p1–p4 是同一张图，
// 不统一时刷新后换来换去会被当成新图重新淡入（闪一下），缓存也认不出
export const thumbnailUrl = (url: string, pixels: number): string =>
  `${url.replace(/^https?:\/\/p\d+\.music\.126\.net\//, 'https://p1.music.126.net/').replace(/^http:/, 'https:')}?param=${pixels}y${pixels}`;

export interface Song {
  id: number;
  name: string | null;
  artists: Credit[];
  album: {
    id: number | null;
    name: string | null;
    coverUrl: string | null;
  };
  duration: number | null;
  downloadSize: number | null;
  availability: Availability;
  trackNumber: number | null;
  disc: string | null;
  aliases: string[];
  translations: string[];
  publishedAt: number | null;
}

export type Availability = 'full' | 'trial' | 'noCopyright';

export const SONGS_PER_REQUEST = 1000;

export interface SongsRequest {
  ids: number[];
}

export interface SongsResponse {
  songs: Song[];
}

export interface CollectedAlbum {
  id: number;
  name: string | null;
  coverUrl: string | null;
  artists: Credit[];
  songCount: number | null;
}

export interface CollectedAlbumsResponse {
  albums: CollectedAlbum[];
}

export interface CollectedArtist {
  id: number;
  name: string | null;
  avatarUrl: string | null;
}

export interface CollectedArtistsResponse {
  artists: CollectedArtist[];
}

export interface AlbumResponse {
  album: {
    id: number;
    name: string | null;
    coverUrl: string | null;
    artist: Credit;
    publishedAt: number | null;
    description: string | null;
    songCount: number | null;
    company: string | null;
  };
  songs: Song[];
}

export interface ArtistAlbum {
  id: number;
  name: string | null;
  coverUrl: string | null;
  publishedAt: number | null;
}

export const ARTIST_ALBUMS_PER_REQUEST = 100;

export const ARTIST_SONGS_PER_REQUEST = 100;

export const ARTIST_SONG_ORDERS = ['hot', 'time'] as const;
export type ArtistSongOrder = (typeof ARTIST_SONG_ORDERS)[number];

export interface ArtistSongsResponse {
  songs: Song[];
  more: boolean;
  total: number | null;
}

export interface ArtistResponse {
  artist: {
    id: number;
    name: string | null;
    avatarUrl: string | null;
    songCount: number | null;
    albumCount: number | null;
  };
  songs: ArtistSongsResponse;
  albums: ArtistAlbum[];
  moreAlbums: boolean;
}

export interface ArtistAlbumsResponse {
  albums: ArtistAlbum[];
  more: boolean;
}

export interface ArtistIntroSection {
  title: string | null;
  text: string;
}

export interface ArtistIntroResponse {
  brief: string | null;
  sections: ArtistIntroSection[];
}
