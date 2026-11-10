import type {
  CollectedAlbum,
  CollectedArtist,
  Playlist,
  PlaylistEditProblem,
  Song,
} from '#lib/api/library.js';
import {
  canSortPlaylist,
  nameProblem,
  PLAYLIST_DESCRIPTION_LENGTH,
  PLAYLIST_TAGS_MAX,
  reorderSortable,
} from '#lib/api/library.js';

import type { LibraryPatch, PlaylistTracks, Replica } from './local';

export interface PlaylistSeed {
  tracks: PlaylistTracks;
  songs: readonly Song[];
}

export type Change =
  | { kind: 'heart'; song: Song; hearted: boolean }
  | { kind: 'add'; playlist: Playlist; song: Song }
  | { kind: 'addMany'; playlist: Playlist; songs: readonly Song[] }
  | { kind: 'remove'; playlist: Playlist; songIds: number[] }
  | { kind: 'order'; playlist: Playlist; songIds: number[] }
  | { kind: 'playlistOrder'; playlistIds: number[] }
  | { kind: 'collectAlbum'; album: CollectedAlbum; collected: boolean }
  | { kind: 'collectArtist'; artist: CollectedArtist; collected: boolean }
  | {
      kind: 'collectPlaylist';
      playlist: Playlist;
      collected: boolean;
      seed: PlaylistSeed | null;
    }
  | { kind: 'rename'; playlist: Playlist; name: string }
  | { kind: 'describe'; playlist: Playlist; description: string | null }
  | { kind: 'tag'; playlist: Playlist; tags: string[] }
  | { kind: 'publish'; playlist: Playlist }
  | { kind: 'delete'; playlist: Playlist };

export type DeferredChange = Extract<
  Change,
  { kind: 'remove' | 'order' | 'playlistOrder' }
>;
export type ImmediateChange = Exclude<Change, DeferredChange>;

export type ConfirmedChange =
  | Change
  | { kind: 'create'; playlist: Playlist }
  | { kind: 'cover'; playlistId: number; coverUrl: string };

export interface PlaylistEdit {
  name?: string;
  description?: string;
  tags?: readonly string[];
}

export const playlistEdits = (
  playlist: Playlist,
  edit: PlaylistEdit,
): ImmediateChange[] => {
  const changes: ImmediateChange[] = [];
  const name = edit.name?.trim();
  if (name !== undefined && name !== playlist.name)
    changes.push({ kind: 'rename', playlist, name });
  const description =
    edit.description === undefined
      ? undefined
      : edit.description.trim() || null;
  if (
    description !== undefined &&
    description !== (playlist.description?.trim() || null)
  )
    changes.push({ kind: 'describe', playlist, description });
  const { tags } = edit;
  if (
    tags &&
    (tags.length !== playlist.tags.length ||
      tags.some((tag, index) => tag !== playlist.tags[index]))
  ) {
    changes.push({
      kind: 'tag',
      playlist,
      tags: [...tags],
    });
  }
  return changes;
};

export const changeProblem = (change: Change): PlaylistEditProblem | null => {
  switch (change.kind) {
    case 'rename':
      return nameProblem(change.name);
    case 'describe':
      return (change.description?.length ?? 0) > PLAYLIST_DESCRIPTION_LENGTH
        ? 'descriptionTooLong'
        : null;
    case 'tag':
      return change.tags.length > PLAYLIST_TAGS_MAX ? 'tooManyTags' : null;
    case 'heart':
    case 'add':
    case 'addMany':
    case 'remove':
    case 'order':
    case 'playlistOrder':
    case 'collectAlbum':
    case 'collectArtist':
    case 'collectPlaylist':
    case 'publish':
    case 'delete':
      return null;
    default: {
      const unhandled: never = change;
      throw new Error(`不认识的修改：${JSON.stringify(unhandled)}`);
    }
  }
};

export const heartOf = (
  change: ConfirmedChange,
): { song: Song; hearted: boolean } | null => {
  if (change.kind === 'heart') return change;
  if (change.kind === 'add' && change.playlist.kind === 'liked')
    return { song: change.song, hearted: true };
  return null;
};

// 打开歌单前等它排完（deferred.settled）也用同一个键
export const playlistTarget = (playlistId: number): string =>
  `playlist:${playlistId}`;

export const targetOf = (change: Change): string => {
  const heart = heartOf(change);
  if (heart) return `heart:${heart.song.id}`;
  switch (change.kind) {
    case 'add':
      return `add:${change.playlist.id}:${change.song.id}`;
    case 'addMany':
    case 'remove':
    case 'order':
      return `tracks:${change.playlist.id}`;
    case 'playlistOrder':
      return 'playlists';
    case 'collectAlbum':
      return `album:${change.album.id}`;
    case 'collectArtist':
      return `artist:${change.artist.id}`;
    case 'collectPlaylist':
    case 'delete':
      return playlistTarget(change.playlist.id);
    case 'rename':
      return `name:${change.playlist.id}`;
    case 'describe':
      return `description:${change.playlist.id}`;
    case 'tag':
      return `tags:${change.playlist.id}`;
    case 'publish':
      return `privacy:${change.playlist.id}`;
    default:
      throw new Error(`不认识的修改：${JSON.stringify(change)}`);
  }
};

const prepended = (ids: number[], id: number): number[] =>
  ids.includes(id) ? ids : [id, ...ids];

const tracksWith = (
  replica: Replica,
  playlistId: number,
  songId: number,
): PlaylistTracks | null => {
  const tracks = replica.tracks.get(playlistId);
  return tracks && !tracks.trackIds.includes(songId)
    ? {
        ...tracks,
        trackIds: [songId, ...tracks.trackIds],
      }
    : null;
};

const tracksWithMany = (
  replica: Replica,
  playlistId: number,
  songs: readonly Song[],
): PlaylistTracks | null => {
  const tracks = replica.tracks.get(playlistId);
  if (!tracks) return null;
  const fresh = songs
    .filter((song) => !tracks.trackIds.includes(song.id))
    .map((song) => song.id);
  return fresh.length > 0
    ? {
        ...tracks,
        trackIds: [...fresh, ...tracks.trackIds],
      }
    : null;
};

const tracksWithout = (
  replica: Replica,
  playlistId: number,
  songIds: readonly number[],
): PlaylistTracks | null => {
  const tracks = replica.tracks.get(playlistId);
  if (!tracks) return null;
  const removed = new Set(songIds);
  const kept = tracks.trackIds.filter((id) => !removed.has(id));
  return kept.length !== tracks.trackIds.length
    ? { ...tracks, trackIds: kept }
    : null;
};

const missingSongs = (
  replica: Replica,
  songs: readonly Song[],
): Song[] | undefined => {
  const missing = songs.filter((song) => !replica.songs.has(song.id));
  return missing.length > 0 ? missing : undefined;
};

const orderedTracks = (
  replica: Replica,
  playlistId: number,
  songIds: readonly number[],
): PlaylistTracks | null => {
  const tracks = replica.tracks.get(playlistId);
  if (!tracks) return null;
  const present = new Set(tracks.trackIds);
  const ordered = songIds.filter((songId) => present.has(songId));
  const seen = new Set(ordered);
  const kept = tracks.trackIds.filter((songId) => !seen.has(songId));
  return {
    ...tracks,
    trackIds: [...ordered, ...kept],
  };
};

const heartPatch = (
  replica: Replica,
  song: Song,
  hearted: boolean,
): LibraryPatch => {
  const { hearts } = replica;
  const liked = replica.playlists?.find(
    (playlist) => playlist.kind === 'liked',
  );
  const likedTracks = liked && replica.tracks.get(liked.id);
  let tracks: ReadonlyMap<number, PlaylistTracks> | undefined;
  if (liked && likedTracks) {
    const trackIds = hearted
      ? prepended(likedTracks.trackIds, song.id)
      : likedTracks.trackIds.filter((id) => id !== song.id);
    if (trackIds.length !== likedTracks.trackIds.length) {
      tracks = new Map([[liked.id, { ...likedTracks, trackIds }]]);
    }
  }
  return {
    hearts: hearts
      ? hearted
        ? prepended(hearts, song.id)
        : hearts.filter((id) => id !== song.id)
      : undefined,
    tracks,
    songs: hearted ? missingSongs(replica, [song]) : undefined,
  };
};

const withCollected = (
  playlists: Playlist[],
  playlist: Playlist,
): Playlist[] => {
  if (playlists.some((item) => item.id === playlist.id)) return playlists;
  const at = playlists.findIndex((item) => item.kind === 'collected');
  return at < 0
    ? [...playlists, playlist]
    : [...playlists.slice(0, at), playlist, ...playlists.slice(at)];
};

const withCreated = (playlists: Playlist[], playlist: Playlist): Playlist[] => {
  if (playlists.some((item) => item.id === playlist.id)) return playlists;
  const at = playlists.findIndex((item) => item.kind === 'liked') + 1;
  return [...playlists.slice(0, at), playlist, ...playlists.slice(at)];
};

const editedPatch = (
  replica: Replica,
  playlistId: number,
  edit: (playlist: Playlist) => Playlist,
): LibraryPatch => {
  const { playlists } = replica;
  return playlists?.some((item) => item.id === playlistId)
    ? {
        playlists: playlists.map((item) =>
          item.id === playlistId ? edit(item) : item,
        ),
      }
    : {};
};

const toggled = <T extends { id: number }>(
  items: T[] | null,
  item: T,
  collected: boolean,
): T[] | undefined => {
  if (!items) return undefined;
  if (collected) {
    return items.some((each) => each.id === item.id) ? items : [item, ...items];
  }
  return items.filter((each) => each.id !== item.id);
};

export const changePatch = (
  replica: Replica,
  change: ConfirmedChange,
): LibraryPatch => {
  const heart = heartOf(change);
  if (heart) return heartPatch(replica, heart.song, heart.hearted);
  switch (change.kind) {
    case 'add': {
      const tracks = tracksWith(replica, change.playlist.id, change.song.id);
      return {
        tracks: tracks ? new Map([[change.playlist.id, tracks]]) : undefined,
        songs: missingSongs(replica, [change.song]),
      };
    }
    case 'addMany': {
      const tracks = tracksWithMany(replica, change.playlist.id, change.songs);
      return {
        tracks: tracks ? new Map([[change.playlist.id, tracks]]) : undefined,
        songs: missingSongs(replica, change.songs),
      };
    }
    case 'remove': {
      const tracks = tracksWithout(replica, change.playlist.id, change.songIds);
      return {
        tracks: tracks ? new Map([[change.playlist.id, tracks]]) : undefined,
      };
    }
    case 'order': {
      const tracks = orderedTracks(replica, change.playlist.id, change.songIds);
      return {
        tracks: tracks ? new Map([[change.playlist.id, tracks]]) : undefined,
      };
    }
    case 'playlistOrder':
      return {
        playlists: replica.playlists
          ? reorderSortable(replica.playlists, change.playlistIds, (playlist) =>
              canSortPlaylist(playlist.kind),
            )
          : undefined,
      };
    case 'collectAlbum':
      return {
        albums: toggled(replica.albums, change.album, change.collected),
      };
    case 'collectArtist':
      return {
        artists: toggled(replica.artists, change.artist, change.collected),
      };
    case 'collectPlaylist': {
      const { playlist, collected, seed } = change;
      const playlists =
        replica.playlists &&
        (collected
          ? withCollected(replica.playlists, playlist)
          : replica.playlists.filter((item) => item.id !== playlist.id));
      const seeded = collected && seed && !replica.tracks.has(playlist.id);
      return {
        playlists: playlists ?? undefined,
        tracks: seeded ? new Map([[playlist.id, seed.tracks]]) : undefined,
        songs: seeded ? missingSongs(replica, seed.songs) : undefined,
      };
    }
    case 'create': {
      const { playlist } = change;
      const seeded = !replica.tracks.has(playlist.id);
      return {
        playlists: replica.playlists
          ? withCreated(replica.playlists, playlist)
          : undefined,
        tracks: seeded
          ? new Map([
              [
                playlist.id,
                {
                  version: playlist.tracksUpdatedAt,
                  trackIds: [],
                  complete: true,
                },
              ],
            ])
          : undefined,
      };
    }
    case 'rename':
      return editedPatch(replica, change.playlist.id, (playlist) => ({
        ...playlist,
        name: change.name,
      }));
    case 'describe':
      return editedPatch(replica, change.playlist.id, (playlist) => ({
        ...playlist,
        description: change.description,
      }));
    case 'tag':
      return editedPatch(replica, change.playlist.id, (playlist) => ({
        ...playlist,
        tags: [...change.tags],
      }));
    case 'publish':
      return editedPatch(replica, change.playlist.id, (playlist) => ({
        ...playlist,
        private: false,
      }));
    case 'delete':
      return {
        playlists: replica.playlists?.filter(
          (item) => item.id !== change.playlist.id,
        ),
      };
    case 'cover':
      return editedPatch(replica, change.playlistId, (playlist) => ({
        ...playlist,
        coverUrl: change.coverUrl,
      }));
    default:
      throw new Error(`不认识的修改：${JSON.stringify(change)}`);
  }
};
