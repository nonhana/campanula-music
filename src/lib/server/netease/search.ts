import type { ModuleCallConfig } from 'hana-music-api';
import {
  cloudsearch as neteaseCloudsearch,
  searchSuggest,
} from 'hana-music-api';

import type {
  SearchKind,
  SearchPageResponse,
  SuggestionsResponse,
} from '#lib/api/search.js';
import { SEARCH_RESULTS_PER_REQUEST } from '#lib/api/search.js';

import { creditOf, songWithPrivilegeOf } from './songs';

const lookalike = (name: string): string =>
  name.normalize('NFKC').replace(/[\u301C\u223C]/g, '~');

export const fetchSuggestions = async (
  keywords: string,
  config: ModuleCallConfig,
): Promise<SuggestionsResponse> => {
  const { body } = await searchSuggest({ keywords }, config);
  const { songs, artists, albums, playlists } = body.result;
  const named = <
    T extends {
      id: number;
      name?: string | null;
    },
  >(
    items: readonly T[] | null | undefined,
  ) =>
    (items ?? []).flatMap(({ id, name }) =>
      name == null ? [] : [{ id, name }],
    );
  const songNames = named(songs).map((song) => song.name);
  const looks = songNames.map(lookalike);
  return {
    suggestions: [
      ...songNames
        .filter((_, index) => looks.indexOf(looks[index]) === index)
        .map((name) => ({ kind: 'song' as const, name })),
      ...named(artists).map((artist) => ({
        kind: 'artist' as const,
        ...artist,
      })),
      ...named(albums).map((album) => ({ kind: 'album' as const, ...album })),
      ...named(playlists).map((playlist) => ({
        kind: 'playlist' as const,
        ...playlist,
      })),
    ],
  };
};

const CLOUDSEARCH_TYPES: Record<SearchKind, 1 | 10 | 100 | 1000> = {
  songs: 1,
  playlists: 1000,
  artists: 100,
  albums: 10,
};

const cloudsearch = async (
  kind: SearchKind,
  keywords: string,
  offset: number,
  config: ModuleCallConfig,
) => {
  const { body } = await neteaseCloudsearch(
    {
      keywords,
      type: CLOUDSEARCH_TYPES[kind],
      limit: SEARCH_RESULTS_PER_REQUEST,
      offset,
    },
    config,
  );
  return body.result;
};

export const searches: {
  [K in SearchKind]: (
    keywords: string,
    offset: number,
    config: ModuleCallConfig,
  ) => Promise<SearchPageResponse<K>>;
} = {
  async songs(keywords, offset, config) {
    const { songs, songCount } = await cloudsearch(
      'songs',
      keywords,
      offset,
      config,
    );
    return {
      items: (songs ?? []).map(songWithPrivilegeOf),
      total: songCount ?? null,
    };
  },
  async playlists(keywords, offset, config) {
    const { playlists, playlistCount } = await cloudsearch(
      'playlists',
      keywords,
      offset,
      config,
    );
    return {
      items: (playlists ?? []).map((playlist) => ({
        id: playlist.id,
        name: playlist.name ?? null,
        coverUrl: playlist.coverImgUrl ?? null,
        creator: playlist.creator?.nickname ?? null,
        trackCount: playlist.trackCount ?? null,
        playCount: playlist.playCount ?? null,
      })),
      total: playlistCount ?? null,
    };
  },
  async artists(keywords, offset, config) {
    const { artists, artistCount } = await cloudsearch(
      'artists',
      keywords,
      offset,
      config,
    );
    return {
      items: (artists ?? []).map((artist) => ({
        id: artist.id,
        name: artist.name ?? null,
        avatarUrl: artist.picUrl ?? null,
        songCount: artist.musicSize ?? null,
      })),
      total: artistCount ?? null,
    };
  },
  async albums(keywords, offset, config) {
    const { albums, albumCount } = await cloudsearch(
      'albums',
      keywords,
      offset,
      config,
    );
    return {
      items: (albums ?? []).map((album) => ({
        id: album.id,
        name: album.name ?? null,
        coverUrl: album.picUrl ?? null,
        artists: (album.artists ?? []).map(creditOf),
        publishedAt: album.publishTime ?? null,
      })),
      total: albumCount ?? null,
    };
  },
};
