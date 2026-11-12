import type { ArtistAlbumBody, ModuleCallConfig } from 'hana-music-api';
import {
  albumSub,
  albumSublist,
  artistAlbum,
  artistDesc,
  artistSongs,
  artistSub,
  artistSublist,
  like,
  likelist,
  album as neteaseAlbum,
  recommendSongs,
  songDetail,
} from 'hana-music-api';

import type { DailyResponse } from '#lib/api/discover.js';
import type {
  AlbumResponse,
  ArtistAlbum,
  ArtistAlbumsResponse,
  ArtistIntroResponse,
  ArtistResponse,
  ArtistSongOrder,
  ArtistSongsResponse,
  CollectedAlbum,
  CollectedArtist,
  Song,
} from '#lib/api/library.js';
import {
  ARTIST_ALBUMS_PER_REQUEST,
  ARTIST_SONGS_PER_REQUEST,
} from '#lib/api/library.js';
import type { WriteResponse } from '#lib/api/write.js';

import { rejection } from './failure';
import { creditOf, songOf, songWithPrivilegeOf } from './songs';

export const fetchHearts = async (
  uid: number,
  config: ModuleCallConfig,
): Promise<number[]> => {
  const { body } = await likelist({ uid }, config);
  return [...body.ids];
};

export const fetchSongs = async (
  ids: readonly number[],
  config: ModuleCallConfig,
): Promise<Song[]> => {
  const { body } = await songDetail(
    {
      ids,
    },
    config,
  );
  const byId = new Map(body.songs.map((song) => [song.id, song]));
  const privileges = new Map(
    body.privileges.map((privilege) => [privilege.id, privilege]),
  );
  return ids.flatMap((id) => {
    const song = byId.get(id);
    return song ? [songOf(song, privileges.get(id))] : [];
  });
};

const COLLECTED_PER_CALL = 1000;

const everyPage = async <T>(
  page: (offset: number) => Promise<{
    items: T[];
    hasMore: boolean | null | undefined;
  }>,
): Promise<T[]> => {
  const items: T[] = [];
  for (let offset = 0; ; offset += COLLECTED_PER_CALL) {
    const next = await page(offset);
    items.push(...next.items);
    if (!next.hasMore) return items;
  }
};

export const fetchCollectedAlbums = (
  config: ModuleCallConfig,
): Promise<CollectedAlbum[]> =>
  everyPage(async (offset) => {
    const { body } = await albumSublist(
      { limit: COLLECTED_PER_CALL, offset },
      config,
    );
    return {
      items: body.data.map((album) => ({
        id: album.id,
        name: album.name ?? null,
        coverUrl: album.picUrl ?? null,
        artists: (album.artists ?? []).map(creditOf),
        songCount: album.size ?? null,
      })),
      hasMore: body.hasMore,
    };
  });

export const fetchCollectedArtists = (
  config: ModuleCallConfig,
): Promise<CollectedArtist[]> =>
  everyPage(async (offset) => {
    const { body } = await artistSublist(
      { limit: COLLECTED_PER_CALL, offset },
      config,
    );
    return {
      items: body.data.map((artist) => ({
        id: artist.id,
        name: artist.name ?? null,
        avatarUrl: artist.picUrl ?? null,
      })),
      hasMore: body.hasMore,
    };
  });

export const fetchAlbum = async (
  albumId: number,
  config: ModuleCallConfig,
): Promise<AlbumResponse> => {
  const {
    body: { album, songs },
  } = await neteaseAlbum({ id: albumId }, config);
  return {
    album: {
      id: album.id,
      name: album.name ?? null,
      coverUrl: album.picUrl ?? null,
      artist: creditOf(album.artist),
      publishedAt: album.publishTime ?? null,
      description: album.description ?? null,
      songCount: album.size ?? null,
      company: album.company ?? null,
    },
    songs: songs.map(songWithPrivilegeOf),
  };
};

const artistAlbums = (
  artistId: number,
  offset: number,
  config: ModuleCallConfig,
) =>
  artistAlbum(
    { id: artistId, limit: ARTIST_ALBUMS_PER_REQUEST, offset },
    config,
  );

const artistAlbumOf = (
  album: ArtistAlbumBody['hotAlbums'][number],
): ArtistAlbum => ({
  id: album.id,
  name: album.name ?? null,
  coverUrl: album.picUrl ?? null,
  publishedAt: album.publishTime ?? null,
});

export const fetchArtistSongs = async (
  artistId: number,
  order: ArtistSongOrder,
  offset: number,
  config: ModuleCallConfig,
): Promise<ArtistSongsResponse> => {
  const { body } = await artistSongs(
    {
      id: artistId,
      order,
      limit: ARTIST_SONGS_PER_REQUEST,
      offset,
    },
    config,
  );
  return {
    songs: body.songs.map(songWithPrivilegeOf),
    more: body.more ?? false,
    total: body.total ?? null,
  };
};

export const fetchArtist = async (
  artistId: number,
  config: ModuleCallConfig,
): Promise<ArtistResponse> => {
  const [songs, albums] = await Promise.all([
    fetchArtistSongs(artistId, 'hot', 0, config),
    artistAlbums(artistId, 0, config),
  ]);
  const { artist } = albums.body;
  return {
    artist: {
      id: artistId,
      name: artist?.name ?? null,
      avatarUrl: artist?.img1v1Url ?? null,
      songCount: artist?.musicSize ?? null,
      albumCount: artist?.albumSize ?? null,
    },
    songs,
    albums: albums.body.hotAlbums.map(artistAlbumOf),
    moreAlbums: albums.body.more ?? false,
  };
};

export const fetchArtistAlbums = async (
  artistId: number,
  offset: number,
  config: ModuleCallConfig,
): Promise<ArtistAlbumsResponse> => {
  const { body } = await artistAlbums(artistId, offset, config);
  return {
    albums: body.hotAlbums.map(artistAlbumOf),
    more: body.more ?? false,
  };
};

export const fetchArtistIntro = async (
  artistId: number,
  config: ModuleCallConfig,
): Promise<ArtistIntroResponse> => {
  const { body } = await artistDesc({ id: artistId }, config);
  return {
    brief: body.briefDesc?.trim() || null,
    sections: body.introduction.flatMap((section) => {
      const text = section.txt?.trim();
      return text ? [{ title: section.ti?.trim() || null, text }] : [];
    }),
  };
};

export const fetchDaily = async (
  config: ModuleCallConfig,
): Promise<DailyResponse> => {
  const { body } = await recommendSongs({}, config);
  return {
    songs: body.data.dailySongs.map(songWithPrivilegeOf),
  };
};

export const heart = async (
  songId: number,
  hearted: boolean,
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  await like({ id: songId, like: hearted }, config);
  return { kind: 'done' };
};

const ALBUM_NOT_COLLECTED = 404;

export const collectAlbum = async (
  albumId: number,
  collected: boolean,
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  await albumSub(
    {
      id: albumId,
      t: collected ? 1 : 0,
    },
    config,
  ).catch((error: unknown) => {
    if (collected || rejection(error)?.code !== ALBUM_NOT_COLLECTED)
      throw error;
  });
  return { kind: 'done' };
};

export const collectArtist = async (
  artistId: number,
  collected: boolean,
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  await artistSub(
    {
      id: artistId,
      t: collected ? 1 : 0,
    },
    config,
  );
  return { kind: 'done' };
};
