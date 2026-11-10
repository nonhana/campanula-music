import type { Account } from '#lib/api/account.js';
import { endpoints } from '#lib/api/endpoints.js';
import type {
  AlbumResponse,
  ArtistAlbum,
  ArtistIntroResponse,
  ArtistResponse,
  ArtistSongOrder,
  ArtistSongsResponse,
  CollectedAlbum,
  CollectedArtist,
  CreatePlaylistRequest,
  Playlist,
  PlaylistCollectRequest,
  PlaylistEditProblem,
  PlaylistInfo,
  PlaylistTagGroup,
  PlaylistUnavailable,
  Song,
} from '#lib/api/library.js';
import {
  canSortPlaylist,
  nameProblem,
  playlistName,
  SONGS_PER_REQUEST,
  TRACKS_PER_CHANGE,
} from '#lib/api/library.js';
import type { WriteResponse } from '#lib/api/write.js';

import type { Api, RequestFailure, Result } from './api-client';
import type { Clock, PageVisibility } from './browser';
import type { Change, ConfirmedChange, ImmediateChange } from './changes';
import {
  changePatch,
  changeProblem,
  heartOf,
  playlistTarget,
  targetOf,
} from './changes';
import type { Deferred, PendingChange } from './deferred';
import { createDeferred } from './deferred';
import type { LibraryPatch, LocalDb, PlaylistTracks, Replica } from './local';
import { emptyPatch, patched } from './local';
import type { Notices } from './notice';
import type { Waiting } from './pacing';
import type {
  BackgroundFailure,
  BackgroundSessionResult,
  SessionFailure,
  SessionResult,
  SessionRound,
} from './session-round';

export type SyncFailure = BackgroundFailure;

type OpenFailure = SessionFailure;

export type ChangeFailure =
  | OpenFailure
  | { kind: 'checkTokenUnavailable' }
  | { kind: 'invalid'; problem: PlaylistEditProblem };

export type CreateOutcome =
  | { ok: true; playlistId: number }
  | { ok: false; failure: ChangeFailure };

export type AddSongsOutcome =
  | { ok: true; added: number }
  | { ok: false; failure: ChangeFailure | { kind: 'missing' } }
  | null;

export type AddTargetBlock =
  | 'currentPlaylist'
  | 'alreadyHearted'
  | 'alreadyInPlaylist';

export interface AddTarget extends Playlist {
  readonly total: number | null;
  readonly blocked: AddTargetBlock | null;
}

export type AddTargetsRequest =
  | {
      readonly mode: 'song';
      readonly song: Song;
      readonly currentPlaylistId: number | null;
    }
  | { readonly mode: 'multi'; readonly currentPlaylistId: number | null };

type SyncStatus =
  | { status: 'syncing' }
  | { status: 'rateLimited'; until: number }
  | { status: 'offline' }
  | { status: 'failed'; failure: SyncFailure }
  | { status: 'synced' };

export interface PlaylistSongs<P = Playlist> {
  playlist: P;
  songs: readonly Song[];
  // 歌曲信息可能还没取到：判断在不在歌单里用 trackIds，别用 songs
  trackIds: readonly number[];
  // 拿到编号前是网易云写的数（偏少）；取全后 songs 仍可能比 total 少
  total: number | null;
  complete: boolean;
}

type PlaylistOpening =
  | { status: 'loading' }
  | { status: 'failed'; failure: OpenFailure };

export type PageState<T> =
  | { status: 'loading' }
  | { status: 'failed'; failure: OpenFailure }
  | { status: 'shown'; content: T };

type More =
  | { status: 'notLoaded' }
  | { status: 'loading' }
  | { status: 'failed'; failure: OpenFailure };

export type ArtistTab = 'songs' | 'albums' | 'intro';

export interface ArtistSongs {
  songs: readonly Song[];
  total: number | null;
  more: More | null;
}

export interface ArtistPage {
  artist: ArtistResponse['artist'];
  order: ArtistSongOrder;
  songs: Record<ArtistSongOrder, PageState<ArtistSongs> | null>;
  albums: readonly ArtistAlbum[];
  moreAlbums: More | null;
  intro: PageState<ArtistIntroResponse> | null;
}

export interface NeteasePlaylistSongs extends PlaylistSongs<PlaylistInfo> {
  more: PlaylistOpening | null;
  trackIds: readonly number[];
  tracksUpdatedAt: number | null;
}

type NeteasePlaylistPage =
  | PageState<NeteasePlaylistSongs>
  | { status: 'unavailable'; reason: PlaylistUnavailable };

type PlaylistPageSongs =
  | { kind: 'loading' }
  | { kind: 'unavailable'; reason: PlaylistUnavailable }
  | { kind: 'empty' }
  | { kind: 'songs'; songs: readonly Song[]; total: number; complete: boolean };

export interface PlaylistPageFailure {
  where: 'list' | 'more';
  failure: RequestFailure;
  // 只决定标题和重试文案；重试动作看 retry
  source: 'sync' | 'open';
  retry: 'sync' | 'open';
}

export interface PlaylistPage {
  // null：列表还没拿到；false：列表里没有它
  inLibrary: boolean | null;
  kind: Playlist['kind'] | null;
  info: PlaylistInfo | null;
  private: boolean;
  content: PlaylistSongs<PlaylistInfo> | null;
  songs: PlaylistPageSongs;
  more: PlaylistOpening | null;
  // 前台打开失败优先于后台同步失败
  failure: PlaylistPageFailure | null;
  count: { loaded: number; total: number } | null;
  can: { edit: boolean; sort: boolean; collect: boolean };
}

export type SyncNoticeState =
  | { kind: 'syncing'; progress: { done: number; total: number } | null }
  | { kind: 'rateLimited' }
  | { kind: 'offline' }
  | { kind: 'failed'; failure: SyncFailure };

export interface LibraryState {
  playlists: readonly Playlist[] | null;
  hearts: ReadonlySet<number> | null;
  liked: PlaylistSongs | null;
  albums: readonly CollectedAlbum[] | null;
  artists: readonly CollectedArtist[] | null;
  songsOf: (playlistId: number) => PlaylistSongs | null;
  songCountOf: (playlistId: number) => number | null;
  opening: ReadonlyMap<number, PlaylistOpening>;
  albumPage: (albumId: number) => PageState<AlbumResponse> | null;
  artistPage: (artistId: number) => PageState<ArtistPage> | null;
  neteasePlaylist: (playlistId: number) => NeteasePlaylistPage | null;
  playlistPage: (playlistId: number) => PlaylistPage;
  playlistTags: PageState<PlaylistTagGroup[]> | null;
  sync: SyncStatus;
  syncNotice: SyncNoticeState | null;
}

export interface PlaylistSearch {
  songs: readonly Song[];
  incomplete: boolean;
}

export interface PlaylistGroups {
  own: readonly Playlist[];
  collected: readonly Playlist[];
}

export interface LibraryContext {
  api: Api;
  session: SessionRound;
  local: LocalDb;
  clock: Clock;
  page: PageVisibility;
  write: (library: LibraryState) => void;
  online: () => boolean;
  checkToken: () => Promise<string>;
  notices: Pick<Notices, 'show' | 'hideWhere'>;
}

export interface Library {
  enter: (account: Account) => Promise<LibraryState | null>;
  sync: () => void;
  retry: () => void;
  open: (playlistId: number) => Promise<void>;
  openAlbum: (albumId: number) => Promise<void>;
  openArtist: (artistId: number) => Promise<void>;
  chooseArtistOrder: (artistId: number, order: ArtistSongOrder) => void;
  openArtistSongs: (artistId: number, order: ArtistSongOrder) => Promise<void>;
  moreArtistSongs: (artistId: number, order: ArtistSongOrder) => Promise<void>;
  moreArtistAlbums: (artistId: number) => Promise<void>;
  openArtistIntro: (artistId: number) => Promise<void>;
  openPlaylistTags: () => Promise<void>;
  change: (change: ImmediateChange) => Promise<ChangeResult>;
  addSongs: (
    playlist: Playlist,
    songs: readonly Song[],
  ) => Promise<AddSongsOutcome>;
  removeSongs: (playlist: Playlist, songIds: readonly number[]) => void;
  undoRemove: (removalId: number) => void;
  dismissRemoval: (removalId: number) => void;
  retryRemove: (
    playlist: Playlist,
    songIds: readonly number[],
  ) => Promise<void>;
  moveSongs: (
    playlistId: number,
    songIds: readonly number[],
    before: number | null,
  ) => boolean;
  retryOrder: (playlist: Playlist, songIds: readonly number[]) => Promise<void>;
  orderPlaylists: (playlistIds: readonly number[]) => boolean;
  retryPlaylistOrder: (playlistIds: readonly number[]) => Promise<void>;
  flush: (playlistId?: number) => Promise<void>;
  publish: () => void;
  addTargets: (request: AddTargetsRequest) => AddTarget[] | null;
  setCover: (playlistId: number, coverUrl: string) => Promise<void>;
  create: (
    draft: CreatePlaylistRequest,
    songs?: readonly Song[],
  ) => Promise<CreateOutcome | null>;
}

// null：这一轮已作废（退出、登录失效），什么都不用做
type Outcome<T, F> = { ok: true; value: T } | { ok: false; failure: F } | null;

type ChangeResult = Outcome<WriteResponse['kind'], ChangeFailure>;

type Pulled = Outcome<void, OpenFailure>;

const chunks = <T>(items: readonly T[], size: number): T[][] =>
  Array.from(
    {
      length: Math.ceil(items.length / size),
    },
    (_, index) => items.slice(index * size, (index + 1) * size),
  );

const artistSongsOf = (
  page: ArtistSongsResponse,
  before: readonly Song[] = [],
): ArtistSongs => ({
  songs: [...before, ...page.songs],
  total: page.total,
  more: page.more ? { status: 'notLoaded' } : null,
});

const tracksCurrent = (
  tracks: PlaylistTracks | undefined,
  playlist: Playlist,
): tracks is PlaylistTracks =>
  tracks !== undefined &&
  (playlist.tracksUpdatedAt === null ||
    tracks.version === playlist.tracksUpdatedAt);

const upToDate = (replica: Replica, playlist: Playlist): boolean => {
  const tracks = replica.tracks.get(playlist.id);
  return tracksCurrent(tracks, playlist) && tracks.complete;
};

const isSyncFailure = (failure: OpenFailure): failure is SyncFailure =>
  failure.kind !== 'offline' && failure.kind !== 'rateLimited';

const skippable = (failure: SyncFailure): boolean => {
  switch (failure.kind) {
    case 'upstreamChanged':
    case 'rejected':
      return true;
    case 'unreachable':
    case 'serverError':
    case 'neteaseUnavailable':
    case 'cookieSecretMissing':
      return false;
    default: {
      const unhandled: never = failure;
      throw new Error(`不认识的同步失败：${JSON.stringify(unhandled)}`);
    }
  }
};

interface Pages {
  albums: ReadonlyMap<number, PageState<AlbumResponse>>;
  artists: ReadonlyMap<number, PageState<ArtistPage>>;
  playlists: ReadonlyMap<number, NeteasePlaylistPage>;
  tags: PageState<PlaylistTagGroup[]> | null;
}

const songsOf = (replica: Replica, playlist: Playlist): PlaylistSongs => {
  const tracks = replica.tracks.get(playlist.id);
  return {
    playlist,
    songs: tracks
      ? tracks.trackIds.flatMap((id) => replica.songs.get(id) ?? [])
      : [],
    trackIds: tracks ? tracks.trackIds : [],
    total: tracks ? tracks.trackIds.length : playlist.trackCount,
    complete: tracks?.complete ?? false,
  };
};

const listedTotal = (playlist: PlaylistSongs<unknown>): number =>
  playlist.complete
    ? playlist.songs.length
    : (playlist.total ?? playlist.trackIds.length);

const songCount = (playlist: PlaylistSongs<unknown>): number | null =>
  playlist.songs.length > 0 || playlist.complete
    ? listedTotal(playlist)
    : playlist.total;

type SongsFailure = Pick<PlaylistPageFailure, 'failure' | 'source' | 'retry'>;

const songsViewOf = (
  playlist: PlaylistSongs<unknown>,
  opening: PlaylistOpening | null,
  failure: SongsFailure | null,
): Pick<PlaylistPage, 'songs' | 'more' | 'failure' | 'count'> => {
  if (playlist.songs.length > 0) {
    const total = listedTotal(playlist);
    const failed =
      opening?.status === 'failed'
        ? {
            where: 'more' as const,
            failure: opening.failure,
            source: 'open' as const,
            retry: 'open' as const,
          }
        : null;
    return {
      songs: {
        kind: 'songs',
        songs: playlist.songs,
        total,
        complete: playlist.complete,
      },
      more: opening,
      failure: failed,
      count: { loaded: playlist.songs.length, total },
    };
  }
  if (playlist.complete) {
    return {
      songs: { kind: 'empty' },
      more: opening,
      failure: null,
      count: { loaded: 0, total: 0 },
    };
  }
  return {
    songs: { kind: 'loading' },
    more: opening,
    failure: failure ? { where: 'list', ...failure } : null,
    count: null,
  };
};

const playlistPageOf = (
  replica: Replica,
  playlistId: number,
  songsOfPlaylist: (id: number) => PlaylistSongs | null,
  neteasePages: ReadonlyMap<number, NeteasePlaylistPage>,
  opening: ReadonlyMap<number, PlaylistOpening>,
  syncFailure: SyncFailure | null,
): PlaylistPage => {
  const nothing = { edit: false, sort: false, collect: false } as const;
  if (replica.playlists === null) {
    return {
      inLibrary: null,
      kind: null,
      info: null,
      private: false,
      content: null,
      songs: { kind: 'loading' },
      more: null,
      failure: syncFailure
        ? {
            where: 'list',
            failure: syncFailure,
            source: 'sync',
            retry: 'sync',
          }
        : null,
      count: null,
      can: nothing,
    };
  }
  const listed = songsOfPlaylist(playlistId);
  if (listed) {
    const current = opening.get(playlistId) ?? null;
    const failure = current
      ? current.status === 'failed'
        ? {
            failure: current.failure,
            source: 'open' as const,
            retry: 'open' as const,
          }
        : null
      : syncFailure
        ? {
            failure: syncFailure,
            source: 'sync' as const,
            retry: 'open' as const,
          }
        : null;
    return {
      inLibrary: true,
      kind: listed.playlist.kind,
      info: listed.playlist,
      private: listed.playlist.private,
      content: listed,
      ...songsViewOf(listed, current, failure),
      can: {
        edit: listed.playlist.kind === 'own',
        sort: canSortPlaylist(listed.playlist.kind),
        collect: listed.playlist.kind === 'collected',
      },
    };
  }
  const page = neteasePages.get(playlistId);
  switch (page?.status) {
    case undefined:
    case 'loading':
      return {
        inLibrary: false,
        kind: null,
        info: null,
        private: false,
        content: null,
        songs: { kind: 'loading' },
        more: null,
        failure: null,
        count: null,
        can: nothing,
      };
    case 'failed':
      return {
        inLibrary: false,
        kind: null,
        info: null,
        private: false,
        content: null,
        songs: { kind: 'loading' },
        more: null,
        failure: {
          where: 'list',
          failure: page.failure,
          source: 'open',
          retry: 'open',
        },
        count: null,
        can: nothing,
      };
    case 'unavailable':
      return {
        inLibrary: false,
        kind: null,
        info: null,
        private: false,
        content: null,
        songs: { kind: 'unavailable', reason: page.reason },
        more: null,
        failure: null,
        count: null,
        can: nothing,
      };
    case 'shown': {
      const content = page.content;
      const more = content.more;
      const failure =
        more?.status === 'failed'
          ? {
              failure: more.failure,
              source: 'open' as const,
              retry: 'open' as const,
            }
          : null;
      return {
        inLibrary: false,
        kind: null,
        info: content.playlist,
        private: false,
        content,
        ...songsViewOf(content, more, failure),
        can: { edit: false, sort: false, collect: true },
      };
    }
    default: {
      const unhandled: never = page;
      throw new Error(`不认识的歌单状态：${JSON.stringify(unhandled)}`);
    }
  }
};

const syncNoticeOf = (
  replica: Replica,
  sync: SyncStatus,
): SyncNoticeState | null => {
  if (sync.status === 'synced' || replica.firstSyncDone) return null;
  const playlists = replica.playlists;
  let firstSync = playlists === null;
  let progress: { done: number; total: number } | null = null;
  if (playlists) {
    let done = 0;
    let total = 0;
    firstSync = false;
    for (const playlist of playlists) {
      const tracks = replica.tracks.get(playlist.id);
      const complete = tracks?.complete ?? false;
      const songs = tracks
        ? tracks.trackIds.reduce(
            (count, id) => (replica.songs.has(id) ? count + 1 : count),
            0,
          )
        : 0;
      if (!complete && (songs === 0 || playlist.kind === 'liked'))
        firstSync = true;
      done += complete ? (tracks?.trackIds.length ?? 0) : songs;
      total += tracks?.trackIds.length ?? playlist.trackCount ?? 0;
    }
    progress = { done, total };
  }
  if (!firstSync) return null;
  switch (sync.status) {
    case 'syncing':
      return { kind: 'syncing', progress };
    case 'rateLimited':
      return { kind: 'rateLimited' };
    case 'offline':
      return { kind: 'offline' };
    case 'failed':
      return { kind: 'failed', failure: sync.failure };
    default: {
      const unhandled: never = sync;
      throw new Error(`不认识的同步状态：${JSON.stringify(unhandled)}`);
    }
  }
};

export const syncNoticeFor = (
  library: Pick<LibraryState, 'syncNotice'>,
  failureShown: boolean,
): SyncNoticeState | null => {
  const notice = library.syncNotice;
  return failureShown && notice?.kind === 'failed' ? null : notice;
};

const stateOf = (
  replica: Replica,
  sync: SyncStatus,
  opening: ReadonlyMap<number, PlaylistOpening>,
  pages: Pages,
): LibraryState => {
  const playlists = new Map(
    replica.playlists?.map((playlist) => [playlist.id, playlist]),
  );
  const computed = new Map<number, PlaylistSongs | null>();
  const songsOfPlaylist = (playlistId: number): PlaylistSongs | null => {
    if (!computed.has(playlistId)) {
      const playlist = playlists.get(playlistId);
      computed.set(playlistId, playlist ? songsOf(replica, playlist) : null);
    }
    return computed.get(playlistId) ?? null;
  };
  const liked = replica.playlists?.find(
    (playlist) => playlist.kind === 'liked',
  );
  const stored = new Map(replica.albumPages);
  const albumPages = new Map(pages.albums);
  const artistPages = new Map(pages.artists);
  const neteasePages = new Map(pages.playlists);
  const syncFailure = sync.status === 'failed' ? sync.failure : null;
  const pageCache = new Map<number, PlaylistPage>();
  const playlistPage = (playlistId: number): PlaylistPage => {
    let page = pageCache.get(playlistId);
    if (!page) {
      page = playlistPageOf(
        replica,
        playlistId,
        songsOfPlaylist,
        neteasePages,
        opening,
        syncFailure,
      );
      pageCache.set(playlistId, page);
    }
    return page;
  };
  return {
    playlists: replica.playlists,
    hearts: replica.hearts && new Set(replica.hearts),
    liked: liked ? songsOfPlaylist(liked.id) : null,
    albums: replica.albums,
    artists: replica.artists,
    songsOf: songsOfPlaylist,
    songCountOf: (playlistId) => {
      const listed = songsOfPlaylist(playlistId);
      return listed ? songCount(listed) : null;
    },
    opening: new Map(opening),
    albumPage: (albumId) => {
      const content = stored.get(albumId);
      return (
        albumPages.get(albumId) ??
        (content ? { status: 'shown', content } : null)
      );
    },
    artistPage: (artistId) => artistPages.get(artistId) ?? null,
    neteasePlaylist: (playlistId) => neteasePages.get(playlistId) ?? null,
    playlistPage,
    playlistTags: pages.tags,
    sync,
    syncNotice: syncNoticeOf(replica, sync),
  };
};

const folded = (text: string): string => text.normalize('NFKC').toLowerCase();

const matcherOf = (query: string): ((text: string | null) => boolean) => {
  const term = folded(query.trim());
  return (text) =>
    term === '' || (text !== null && folded(text).includes(term));
};

export const filterSongs = (songs: readonly Song[], query: string): Song[] => {
  const matches = matcherOf(query);
  return songs.filter(
    (song) =>
      matches(song.name) ||
      matches(song.album.name) ||
      song.artists.some((artist) => matches(artist.name)),
  );
};

export const filterAlbums = (
  albums: readonly CollectedAlbum[],
  query: string,
): CollectedAlbum[] => {
  const matches = matcherOf(query);
  return albums.filter(
    (album) =>
      matches(album.name) ||
      album.artists.some((artist) => matches(artist.name)),
  );
};

export const filterArtists = (
  artists: readonly CollectedArtist[],
  query: string,
): CollectedArtist[] => {
  const matches = matcherOf(query);
  return artists.filter((artist) => matches(artist.name));
};

export const playlistGroups = (
  playlists: readonly Playlist[],
): PlaylistGroups => ({
  own: playlists.filter((playlist) => playlist.kind === 'own'),
  collected: playlists.filter((playlist) => playlist.kind === 'collected'),
});

export const filterPlaylists = (
  playlists: readonly Playlist[],
  query: string,
): PlaylistGroups => {
  const matches = matcherOf(query);
  return playlistGroups(
    playlists.filter(
      (playlist) =>
        playlist.kind !== 'liked' && matches(playlistName(playlist)),
    ),
  );
};

export const searchPlaylist = (
  playlist: PlaylistSongs<unknown>,
  query: string,
): PlaylistSearch => ({
  songs: filterSongs(playlist.songs, query),
  incomplete: !playlist.complete,
});

const waitingStatus = (waiting: Waiting): SyncStatus => {
  switch (waiting.reason) {
    case 'rateLimited':
      return { status: 'rateLimited', until: waiting.until };
    case 'offline':
      return { status: 'offline' };
    default: {
      const unhandled: never = waiting;
      throw new Error(`不认识的等待原因：${JSON.stringify(unhandled)}`);
    }
  }
};

export const createLibrary = (context: LibraryContext): Library => {
  const { api, session, local, clock, notices } = context;
  let replica: Replica | null = null;
  let status: SyncStatus = { status: 'synced' };
  let running: Promise<void> = Promise.resolve();
  // 同一张歌单同时只有一处在拉，后台同步和打开共用
  const pulling = new Map<
    number,
    { version: number | null; force: boolean; job: Promise<Pulled> }
  >();
  const urgent = new Set<number>();
  const waiting = new Map<number, AbortController>();
  let opening = new Map<number, PlaylistOpening>();
  const pages = {
    albums: new Map<number, PageState<AlbumResponse>>(),
    artists: new Map<number, PageState<ArtistPage>>(),
    playlists: new Map<number, NeteasePlaylistPage>(),
    tags: null as PageState<PlaylistTagGroup[]> | null,
  };
  const fetchingAlbums = new Set<number>();
  const fetchingPlaylists = new Set<number>();
  const neteaseSongs = new Map<number, Song>();
  let changes: PendingChange[] = [];
  let tick = 0;
  let saving: Promise<unknown> = Promise.resolve();

  const shown = (current: Replica): Replica =>
    changes
      .filter((entry) => !entry.saved)
      .reduce(
        (view, entry) => patched(view, changePatch(view, entry.change)),
        current,
      );

  const reapplied = (view: Replica, at: number): Replica =>
    changes
      .filter((entry) => entry.confirmedAt !== null && entry.confirmedAt > at)
      .reduce(
        (next, entry) => patched(next, changePatch(next, entry.change)),
        view,
      );

  const start = (): void => {
    const mine = session.current;
    running = running.then(() => run(mine));
  };

  const deferred: Deferred = createDeferred({
    clock,
    page: context.page,
    local,
    session,
    replica: () => replica,
    shown: () => (replica ? shown(replica) : null),
    overlay: {
      add: (entry) => {
        changes.push(entry);
      },
      remove: (match) => {
        changes = changes.filter((entry) => !match(entry.change));
      },
      confirm: async (mine, entry, change) => {
        entry.change = change;
        entry.confirmedAt = ++tick;
        return save(
          mine,
          (now) => changePatch(now, change),
          () => {
            entry.saved = true;
          },
        );
      },
    },
    publish: () => publish(),
    notices,
    sync: start,
    online: context.online,
  });
  const removeSongs = (
    playlist: Playlist,
    songIds: readonly number[],
  ): void => {
    deferred.remove(playlist, songIds);
  };

  const undoRemove = (removalId: number): void => {
    deferred.undoRemove(removalId);
  };

  const dismissRemoval = (removalId: number): void => {
    deferred.dismissRemoval(removalId);
  };

  const retryRemove = (
    playlist: Playlist,
    songIds: readonly number[],
  ): Promise<void> => deferred.retryRemove(playlist, songIds);

  const moveSongs = (
    playlistId: number,
    songIds: readonly number[],
    before: number | null,
  ): boolean => deferred.moveSongs(playlistId, songIds, before);

  const retryOrder = (
    playlist: Playlist,
    songIds: readonly number[],
  ): Promise<void> => deferred.retryOrder(playlist, songIds);

  const orderPlaylists = (playlistIds: readonly number[]): boolean =>
    deferred.orderPlaylists(playlistIds);

  const retryPlaylistOrder = (playlistIds: readonly number[]): Promise<void> =>
    deferred.retryPlaylistOrder(playlistIds);

  const flush = (playlistId?: number): Promise<void> =>
    deferred.flush(playlistId);

  const addTargets = (request: AddTargetsRequest): AddTarget[] | null => {
    const current = replica;
    if (!current) return null;
    const shownReplica = shown(current);
    const playlists = shownReplica.playlists;
    if (!playlists) return null;
    const listed =
      request.mode === 'song'
        ? [
            ...playlists.filter((playlist) => playlist.kind === 'liked'),
            ...playlists.filter((playlist) => playlist.kind === 'own'),
          ]
        : playlists.filter(
            (playlist) =>
              playlist.kind === 'own' &&
              playlist.id !== request.currentPlaylistId,
          );
    const song = request.mode === 'song' ? request.song : null;
    return listed.map((playlist) => {
      const tracks = shownReplica.tracks.get(playlist.id);
      const total = songCount(songsOf(shownReplica, playlist));
      // 界面“已在歌单里”要和 addSongs 去重一致：只看 trackIds
      const alreadyInPlaylist =
        song !== null &&
        tracks?.trackIds.includes(song.id) === true &&
        shownReplica.songs.has(song.id);
      const blocked: AddTargetBlock | null =
        request.currentPlaylistId === playlist.id
          ? 'currentPlaylist'
          : song === null
            ? null
            : playlist.kind === 'liked'
              ? shownReplica.hearts?.includes(song.id)
                ? 'alreadyHearted'
                : null
              : alreadyInPlaylist
                ? 'alreadyInPlaylist'
                : null;
      return { ...playlist, total, blocked };
    });
  };

  const addSongs = async (
    playlist: Playlist,
    songs: readonly Song[],
  ): Promise<AddSongsOutcome> => {
    const current = replica;
    if (!current) return null;
    const seen = new Set<number>();
    const unique = songs.filter((song) => {
      if (seen.has(song.id)) return false;
      seen.add(song.id);
      return true;
    });
    const restored = deferred.restore(
      playlist.id,
      unique.map((song) => song.id),
    );
    const have = new Set(
      shown(current).tracks.get(playlist.id)?.trackIds ?? [],
    );
    const fresh = unique.filter(
      (song) => !restored.has(song.id) && !have.has(song.id),
    );
    if (fresh.length === 0) {
      notices.show({ kind: 'alreadyAdded', playlist });
      return { ok: true, added: 0 };
    }
    if (fresh.length > TRACKS_PER_CHANGE) {
      const failure = { kind: 'invalid', problem: 'tooManySongs' } as const;
      notices.show({
        kind: 'notChanged',
        change: { kind: 'addMany', playlist, songs: fresh },
        failure,
      });
      return { ok: false, failure };
    }
    const result = await applyChange({
      kind: 'addMany',
      playlist,
      songs: fresh,
    });
    if (!result) return null;
    if (result.ok && result.value === 'done')
      return { ok: true, added: fresh.length };
    if (result.ok) {
      return {
        ok: false,
        failure: { kind: 'missing' },
      };
    }
    return { ok: false, failure: result.failure };
  };

  const publish = (next: SyncStatus = status): void => {
    const previous = status;
    status = next;
    if (!replica) return;
    const state = stateOf(shown(replica), status, opening, pages);
    if (
      next.status === 'failed' &&
      previous.status !== 'failed' &&
      !state.syncNotice
    )
      notices.show({ kind: 'syncFailed', failure: next.failure });
    else if (previous.status === 'failed' && next.status !== 'failed')
      notices.hideWhere((notice) => notice.kind === 'syncFailed');
    context.write(state);
  };

  const background = <T>(
    mine: number,
    send: () => Promise<Result<T>>,
    giveUp?: AbortSignal,
  ): Promise<BackgroundSessionResult<T> | 'gaveUp'> =>
    session.background(
      send,
      (waitingFor) => {
        if (session.isCurrent(mine)) {
          publish(
            waitingFor ? waitingStatus(waitingFor) : { status: 'syncing' },
          );
        }
      },
      giveUp,
    );

  const playlistRequest = async <T>(
    mine: number,
    playlistId: number,
    send: () => Promise<Result<T>>,
  ): Promise<Outcome<T, OpenFailure>> => {
    if (!urgent.has(playlistId)) {
      const giveUp = new AbortController();
      waiting.set(playlistId, giveUp);
      const result = await background(mine, send, giveUp.signal).finally(() =>
        waiting.delete(playlistId),
      );
      if (result !== 'gaveUp') return result;
      if (!session.isCurrent(mine)) return null;
    }
    return session.api.request(send);
  };

  const stamped = <T>(
    send: () => Promise<Result<T>>,
  ): { send: () => Promise<Result<T>>; at: () => number } => {
    let at = 0;
    return {
      send: () => {
        at = ++tick;
        return send();
      },
      at: () => at,
    };
  };

  // 一步一步写：两步交错时后写的会拿旧副本盖掉前面的，检查和开事务必须在同一步里
  const save = (
    mine: number,
    patchOf: (current: Replica) => LibraryPatch,
    after?: () => void,
  ): Promise<boolean> => {
    const step = saving.then(async () => {
      const current = replica;
      if (!session.isCurrent(mine) || !current) return false;
      const patch = patchOf(current);
      if (
        !emptyPatch(patch) &&
        (!(await local.saveLibrary(current.owner, patch)) ||
          !session.isCurrent(mine))
      )
        return false;
      Object.assign(current, patched(current, patch));
      after?.();
      publish();
      return true;
    });
    saving = step.catch(() => {});
    return step;
  };

  const saveTracks = (
    mine: number,
    playlistId: number,
    tracks: PlaylistTracks,
    at: number,
  ): Promise<boolean> =>
    save(
      mine,
      (current) => {
        const merged =
          reapplied(
            {
              ...current,
              tracks: new Map([[playlistId, tracks]]),
            },
            at,
          ).tracks.get(playlistId) ?? tracks;
        return {
          tracks: new Map([[playlistId, merged]]),
        };
      },
      () => {
        if (tracks.complete) opening.delete(playlistId);
      },
    );

  const pull = async (
    mine: number,
    current: Replica,
    playlist: Playlist,
    force = false,
  ): Promise<Pulled> => {
    const { id } = playlist;
    const deleted = () =>
      current.playlists !== null &&
      !current.playlists.some((item) => item.id === id);

    let tracks = current.tracks.get(id);
    let at = tick;
    if (force || !tracksCurrent(tracks, playlist)) {
      const request = stamped(() => api.get(endpoints.trackIds, { id }));
      const fetched = await playlistRequest(mine, id, request.send);
      if (!fetched?.ok) return fetched;
      tracks = {
        version: playlist.tracksUpdatedAt,
        trackIds: fetched.value.trackIds,
        complete: false,
      };
      at = request.at();
      if (deleted()) return { ok: true, value: undefined };
      if (!(await saveTracks(mine, id, tracks, at))) return null;
    }
    if (tracks.complete) return { ok: true, value: undefined };
    const missing = (current.tracks.get(id) ?? tracks).trackIds.filter(
      (songId) => !current.songs.has(songId),
    );
    for (const ids of chunks(missing, SONGS_PER_REQUEST)) {
      const page = await playlistRequest(mine, id, () =>
        api.post(endpoints.songs, { ids }),
      );
      if (!page?.ok) return page;
      if (!(await save(mine, () => ({ songs: page.value.songs })))) return null;
    }
    if (deleted()) return { ok: true, value: undefined };
    return (await saveTracks(mine, id, { ...tracks, complete: true }, at))
      ? { ok: true, value: undefined }
      : null;
  };

  const load = (
    mine: number,
    current: Replica,
    playlist: Playlist,
    force = false,
  ): Promise<Pulled> => {
    const { id, tracksUpdatedAt: version } = playlist;
    const existing = pulling.get(id);
    if (existing?.version === version && (existing.force || !force))
      return existing.job;
    const before = existing?.job.catch(() => null) ?? Promise.resolve(null);
    const job: Promise<Pulled> = before
      .then(() => pull(mine, current, playlist, force))
      .finally(() => {
        if (pulling.get(id)?.job === job) {
          pulling.delete(id);
          urgent.delete(id);
        }
      });
    pulling.set(id, { version, force, job });
    return job;
  };

  const syncPlaylist = async (
    mine: number,
    current: Replica,
    playlist: Playlist,
  ): Promise<Outcome<void, SyncFailure>> => {
    for (;;) {
      const result = await load(mine, current, playlist);
      if (!result || result.ok) return result;
      if (isSyncFailure(result.failure))
        return { ok: false, failure: result.failure };
    }
  };

  const syncCollected = async <T>(
    mine: number,
    send: () => Promise<Result<T>>,
    patchOf: (value: T, current: Replica, at: number) => LibraryPatch,
  ): Promise<'synced' | SyncFailure | null> => {
    const request = stamped(send);
    const fetched = await background(mine, request.send);
    if (!fetched || fetched === 'gaveUp') return null;
    if (fetched.ok) {
      return (await save(mine, (current) =>
        patchOf(fetched.value, current, request.at()),
      ))
        ? 'synced'
        : null;
    }
    if (skippable(fetched.failure)) return fetched.failure;
    publish({ status: 'failed', failure: fetched.failure });
    return null;
  };

  const run = async (mine: number): Promise<void> => {
    const current = replica;
    if (!session.isCurrent(mine) || !current) return;
    const startedAt = ++tick;
    publish({ status: 'syncing' });
    const heartsRequest = stamped(() =>
      api.get(endpoints.hearts, { uid: current.owner }),
    );
    const hearts = await background(mine, heartsRequest.send);
    if (!hearts || hearts === 'gaveUp') return;
    if (!hearts.ok)
      return publish({ status: 'failed', failure: hearts.failure });
    if (
      !(await save(mine, (now) => ({
        hearts: reapplied(
          { ...now, hearts: hearts.value.songIds },
          heartsRequest.at(),
        ).hearts!,
      })))
    )
      return;
    const listRequest = stamped(() =>
      api.get(endpoints.playlists, { uid: current.owner }),
    );
    const list = await background(mine, listRequest.send);
    if (!list || list === 'gaveUp') return;
    if (!list.ok) return publish({ status: 'failed', failure: list.failure });
    const removeDeleted = () => {
      const kept = new Set(current.playlists?.map((playlist) => playlist.id));
      for (const id of opening.keys()) {
        if (!kept.has(id)) opening.delete(id);
      }
    };
    if (
      !(await save(
        mine,
        (now) => ({
          playlists: reapplied(
            { ...now, playlists: list.value.playlists },
            listRequest.at(),
          ).playlists!,
        }),
        removeDeleted,
      ))
    )
      return;
    await deferred.recover(mine, async (playlistId) => {
      const playlist = current.playlists?.find(
        (item) => item.id === playlistId,
      );
      if (!playlist) return 'missing';
      const result = await load(mine, current, playlist, true);
      if (!result) return 'stopped';
      return result.ok ? 'recovered' : 'failed';
    });
    if (!session.isCurrent(mine)) return;

    const albums = await syncCollected(
      mine,
      () => api.get(endpoints.albums),
      (value, now, at) => ({
        albums: reapplied({ ...now, albums: value.albums }, at).albums!,
      }),
    );
    if (!albums) return;
    const artists = await syncCollected(
      mine,
      () => api.get(endpoints.artists),
      (value, now, at) => ({
        artists: reapplied({ ...now, artists: value.artists }, at).artists!,
      }),
    );
    if (!artists) return;

    let skipped =
      [albums, artists].find(
        (result): result is SyncFailure => result !== 'synced',
      ) ?? null;
    for (const playlist of current.playlists ?? []) {
      const result = await syncPlaylist(mine, current, playlist);
      if (!result) return;
      if (result.ok) continue;
      if (!skippable(result.failure))
        return publish({ status: 'failed', failure: result.failure });
      skipped ??= result.failure;
    }
    changes = changes.filter(
      (entry) => entry.confirmedAt === null || entry.confirmedAt > startedAt,
    );
    if (
      !current.firstSyncDone &&
      !(await save(mine, () => ({ firstSyncDone: true })))
    )
      return;
    publish(
      skipped ? { status: 'failed', failure: skipped } : { status: 'synced' },
    );
  };

  const openNetease = async (playlistId: number): Promise<void> => {
    if (fetchingPlaylists.has(playlistId)) return;
    fetchingPlaylists.add(playlistId);
    const show = (page: NeteasePlaylistPage) => {
      pages.playlists.set(playlistId, page);
      publish();
    };
    const before = pages.playlists.get(playlistId);
    const shown = before?.status === 'shown' ? before.content : null;
    if (!shown) {
      show({ status: 'loading' });
    } else if (shown.more) {
      show({
        status: 'shown',
        content: {
          ...shown,
          more: { status: 'loading' },
        },
      });
    }

    const fetched = await session.api.get(endpoints.playlist, {
      id: playlistId,
    });
    if (!fetched) return;
    if (!fetched.ok) {
      fetchingPlaylists.delete(playlistId);
      if (!shown) {
        show({ status: 'failed', failure: fetched.failure });
      } else if (!shown.complete) {
        show({
          status: 'shown',
          content: {
            ...shown,
            more: { status: 'failed', failure: fetched.failure },
          },
        });
      }
      return;
    }
    const page = fetched.value;
    if (page.kind === 'unavailable') {
      fetchingPlaylists.delete(playlistId);
      return show({ status: 'unavailable', reason: page.reason });
    }
    const { playlist, trackIds, tracksUpdatedAt } = page;
    const contentOf = (more: PlaylistOpening | null): NeteasePlaylistSongs => ({
      playlist,
      songs: trackIds.flatMap((id) => neteaseSongs.get(id) ?? []),
      total: trackIds.length,
      complete: more === null,
      more,
      trackIds,
      tracksUpdatedAt,
    });
    for (const ids of chunks(
      trackIds.filter((id) => !neteaseSongs.has(id)),
      SONGS_PER_REQUEST,
    )) {
      show({
        status: 'shown',
        content: contentOf({ status: 'loading' }),
      });
      const songs = await session.api.post(endpoints.songs, { ids });
      if (!songs) return;
      if (!songs.ok) {
        fetchingPlaylists.delete(playlistId);
        return show({
          status: 'shown',
          content: contentOf({ status: 'failed', failure: songs.failure }),
        });
      }
      for (const song of songs.value.songs) neteaseSongs.set(song.id, song);
    }
    fetchingPlaylists.delete(playlistId);
    show({
      status: 'shown',
      content: contentOf(null),
    });
  };

  type Submitted = NonNullable<ChangeResult>;

  const submitted = (
    result: SessionResult<WriteResponse>,
  ): Submitted | null => {
    if (!result) return null;
    return result.ok ? { ok: true, value: result.value.kind } : result;
  };

  const submit = async (
    mine: number,
    change: ImmediateChange,
  ): Promise<Submitted | null> => {
    const send = <T>(
      call: () => Promise<Result<T>>,
    ): Promise<SessionResult<T>> | null =>
      session.isCurrent(mine) ? session.api.request(call) : null;
    const heart = heartOf(change);
    if (heart) {
      const result = await send(() =>
        api.post(endpoints.heart, {
          songId: heart.song.id,
          hearted: heart.hearted,
        }),
      );
      return result && submitted(result);
    }
    switch (change.kind) {
      case 'heart':
        throw new Error('红心在上面已经提交了');
      case 'add': {
        const result = await send(() =>
          api.post(
            endpoints.addTracks,
            { id: change.playlist.id },
            {
              songIds: [change.song.id],
            },
          ),
        );
        return result && submitted(result);
      }
      case 'addMany': {
        const result = await send(() =>
          api.post(
            endpoints.addTracks,
            { id: change.playlist.id },
            {
              songIds: change.songs.map((song) => song.id),
            },
          ),
        );
        return result && submitted(result);
      }
      case 'collectAlbum': {
        const result = await send(() =>
          api.post(
            endpoints.collectAlbum,
            { id: change.album.id },
            { collected: change.collected },
          ),
        );
        return result && submitted(result);
      }
      case 'collectArtist': {
        const result = await send(() =>
          api.post(
            endpoints.collectArtist,
            { id: change.artist.id },
            { collected: change.collected },
          ),
        );
        return result && submitted(result);
      }
      case 'collectPlaylist': {
        let body: PlaylistCollectRequest = { collected: false };
        if (change.collected) {
          const checkToken = await context.checkToken().catch(() => null);
          if (!checkToken) {
            return {
              ok: false,
              failure: { kind: 'checkTokenUnavailable' },
            };
          }
          body = { collected: true, checkToken };
        }
        const result = await send(() =>
          api.post(endpoints.collectPlaylist, { id: change.playlist.id }, body),
        );
        return result && submitted(result);
      }
      case 'rename': {
        const result = await send(() =>
          api.post(
            endpoints.renamePlaylist,
            { id: change.playlist.id },
            { name: change.name },
          ),
        );
        return result && submitted(result);
      }
      case 'describe': {
        const result = await send(() =>
          api.post(
            endpoints.describePlaylist,
            { id: change.playlist.id },
            { description: change.description ?? '' },
          ),
        );
        return result && submitted(result);
      }
      case 'tag': {
        const result = await send(() =>
          api.post(
            endpoints.tagPlaylist,
            { id: change.playlist.id },
            { tags: change.tags },
          ),
        );
        return result && submitted(result);
      }
      case 'publish': {
        const result = await send(() =>
          api.post(
            endpoints.publishPlaylist,
            { id: change.playlist.id },
            undefined,
          ),
        );
        return result && submitted(result);
      }
      case 'delete': {
        const result = await send(() =>
          api.post(
            endpoints.deletePlaylist,
            { id: change.playlist.id },
            undefined,
          ),
        );
        return result && submitted(result);
      }
      default: {
        const unhandled: never = change;
        throw new Error(`不认识的修改：${JSON.stringify(unhandled)}`);
      }
    }
  };

  const keepPage = (current: Replica, change: Change): void => {
    if (
      change.kind === 'collectAlbum' &&
      !change.collected &&
      pages.albums.get(change.album.id)?.status !== 'shown'
    ) {
      const stored = current.albumPages.get(change.album.id);
      if (stored)
        pages.albums.set(change.album.id, { status: 'shown', content: stored });
    }
    if (
      change.kind === 'collectPlaylist' &&
      !change.collected &&
      pages.playlists.get(change.playlist.id)?.status !== 'shown'
    ) {
      const tracks = current.tracks.get(change.playlist.id);
      if (!tracks) return;
      const { songs, total, complete } = songsOf(current, change.playlist);
      for (const song of songs) neteaseSongs.set(song.id, song);
      pages.playlists.set(change.playlist.id, {
        status: 'shown',
        content: {
          playlist: change.playlist,
          songs,
          total,
          complete,
          more: null,
          trackIds: tracks.trackIds,
          tracksUpdatedAt: tracks.version,
        },
      });
    }
  };

  const confirm = async (
    mine: number,
    change: ConfirmedChange,
  ): Promise<boolean> => {
    const entry: PendingChange = { change, confirmedAt: ++tick, saved: false };
    changes.push(entry);
    publish();
    return save(
      mine,
      (now) => changePatch(now, entry.change),
      () => {
        entry.saved = true;
      },
    );
  };

  const confirmedPatch = (current: Replica, change: Change): LibraryPatch => {
    const patch = changePatch(current, change);
    if (change.kind !== 'collectAlbum' || !change.collected) return patch;
    const page = pages.albums.get(change.album.id);
    return page?.status === 'shown'
      ? {
          ...patch,
          albumPages: new Map([[change.album.id, page.content]]),
        }
      : patch;
  };

  const settleChange = async (
    mine: number,
    entry: PendingChange,
    change: Change,
    result: Submitted,
  ): Promise<void> => {
    if (result.ok && result.value === 'done') {
      entry.confirmedAt = ++tick;
      await save(
        mine,
        (now) => confirmedPatch(now, change),
        () => {
          entry.saved = true;
          if (change.kind === 'add' || change.kind === 'addMany')
            notices.show({ kind: 'added', change });
        },
      );
      return;
    }
    changes = changes.filter((each) => each !== entry);
    if (result.ok) {
      if (
        change.kind === 'add' ||
        change.kind === 'addMany' ||
        change.kind === 'collectPlaylist'
      )
        notices.show({ kind: 'playlistMissing', change });
      publish();
      return start();
    }
    notices.show({ kind: 'notChanged', change, failure: result.failure });
  };

  const forget = (): void => {
    pulling.clear();
    urgent.clear();
    waiting.clear();
    opening = new Map();
    pages.albums.clear();
    pages.artists.clear();
    pages.playlists.clear();
    pages.tags = null;
    fetchingAlbums.clear();
    fetchingPlaylists.clear();
    neteaseSongs.clear();
    deferred.forget();
    changes = [];
  };

  const applyChange = async (
    change: ImmediateChange,
  ): Promise<Submitted | null> => {
    const current = replica;
    if (!current) return null;
    const mine = session.current;
    // 撤销窗口里加回来：它仍在网易云上，不用再发加入；这个判断要放在断网判断前面
    if (
      change.kind === 'add' &&
      change.playlist.kind === 'own' &&
      deferred.restore(change.playlist.id, [change.song.id]).has(change.song.id)
    )
      return null;
    const problem = changeProblem(change);
    const failure: ChangeFailure | null = problem
      ? { kind: 'invalid', problem }
      : context.online()
        ? null
        : { kind: 'offline' };
    if (failure) {
      notices.show({ kind: 'notChanged', change, failure });
      return { ok: false, failure };
    }
    keepPage(current, change);
    const entry: PendingChange = { change, confirmedAt: null, saved: false };
    changes.push(entry);
    publish();
    const target = targetOf(change);
    let submitted: Submitted | null = null;
    await deferred.serialize(target, async () => {
      const result = await submit(mine, change);
      if (result && session.isCurrent(mine)) {
        submitted = result;
        await settleChange(mine, entry, change, result);
      }
    });
    return submitted;
  };

  const leave = (): void => {
    forget();
    replica = null;
  };

  context.session.onChange((change) => {
    if (change.kind !== 'signedIn') leave();
  });

  const changeArtist = (
    artistId: number,
    change: (page: ArtistPage) => ArtistPage,
  ): void => {
    const shown = pages.artists.get(artistId);
    if (shown?.status !== 'shown') return;
    pages.artists.set(artistId, {
      status: 'shown',
      content: change(shown.content),
    });
    publish();
  };

  const withSongs =
    (order: ArtistSongOrder, songs: PageState<ArtistSongs>) =>
    (page: ArtistPage): ArtistPage => ({
      ...page,
      songs: { ...page.songs, [order]: songs },
    });

  const changeArtistSongs = (
    artistId: number,
    order: ArtistSongOrder,
    change: (songs: ArtistSongs) => ArtistSongs,
  ): void =>
    changeArtist(artistId, (page) => {
      const songs = page.songs[order];
      return songs?.status === 'shown'
        ? withSongs(order, {
            status: 'shown',
            content: change(songs.content),
          })(page)
        : page;
    });

  return {
    async enter(account) {
      const mine = session.current;
      if (!session.isCurrent(mine)) return null;
      forget();
      const [stored, pending] = await Promise.all([
        local.readLibrary(),
        local.pendingChanges(account.id),
      ]);
      const shown: Replica =
        stored?.owner === account.id
          ? stored
          : {
              owner: account.id,
              hearts: null,
              playlists: null,
              tracks: new Map(),
              songs: new Map(),
              albums: null,
              artists: null,
              albumPages: new Map(),
              firstSyncDone: false,
            };
      if (shown !== stored && session.isCurrent(mine))
        await local.resetLibrary(account.id);
      if (!session.isCurrent(mine)) return null;
      replica = shown;
      deferred.resume(stored?.owner === account.id ? pending : []);
      status = { status: 'syncing' };
      return stateOf(shown, status, opening, pages);
    },
    sync: start,
    retry() {
      if (status.status !== 'failed') return;
      publish({ status: 'syncing' });
      start();
    },
    async open(playlistId) {
      await deferred.settled(playlistTarget(playlistId));
      const current = replica;
      if (!current?.playlists) return;
      const playlist = current.playlists.find((item) => item.id === playlistId);
      if (!playlist) return openNetease(playlistId);
      if (upToDate(current, playlist)) return;
      const mine = session.current;
      urgent.add(playlistId);
      waiting.get(playlistId)?.abort();
      opening.set(playlistId, { status: 'loading' });
      publish();
      const result = await load(mine, current, playlist);
      if (!result || !session.isCurrent(mine)) return;
      if (result.ok) opening.delete(playlistId);
      else
        opening.set(playlistId, { status: 'failed', failure: result.failure });
      publish();
    },
    async openAlbum(albumId) {
      const current = replica;
      if (
        !current ||
        fetchingAlbums.has(albumId) ||
        pages.albums.get(albumId)?.status === 'shown'
      )
        return;
      const mine = session.current;
      const stored = current.albumPages.get(albumId);
      if (
        stored &&
        stored.album.songCount ===
          current.albums?.find((album) => album.id === albumId)?.songCount
      )
        return;
      fetchingAlbums.add(albumId);
      if (!stored) {
        pages.albums.set(albumId, { status: 'loading' });
        publish();
      }
      const result = await session.api.get(endpoints.album, { id: albumId });
      if (!result) return;
      fetchingAlbums.delete(albumId);
      if (!result.ok) {
        if (!stored) {
          pages.albums.set(albumId, {
            status: 'failed',
            failure: result.failure,
          });
          publish();
        }
        return;
      }
      const page = result.value;
      pages.albums.set(albumId, { status: 'shown', content: page });
      publish();
      if (current.albums?.some((album) => album.id === albumId)) {
        await save(mine, () => ({
          albumPages: new Map([[albumId, page]]),
        }));
      }
    },
    async openArtist(artistId) {
      const shown = pages.artists.get(artistId);
      if (!replica || shown?.status === 'loading' || shown?.status === 'shown')
        return;
      pages.artists.set(artistId, { status: 'loading' });
      publish();
      const result = await session.api.get(endpoints.artist, { id: artistId });
      if (!result) return;
      if (result.ok) {
        const { artist, songs, albums, moreAlbums } = result.value;
        pages.artists.set(artistId, {
          status: 'shown',
          content: {
            artist,
            order: 'hot',
            songs: {
              hot: {
                status: 'shown',
                content: artistSongsOf(songs),
              },
              time: null,
            },
            albums,
            moreAlbums: moreAlbums ? { status: 'notLoaded' } : null,
            intro: null,
          },
        });
      } else {
        pages.artists.set(artistId, {
          status: 'failed',
          failure: result.failure,
        });
      }
      publish();
    },
    chooseArtistOrder(artistId, order) {
      const shown = pages.artists.get(artistId);
      if (shown?.status === 'shown' && shown.content.order !== order)
        changeArtist(artistId, (page) => ({ ...page, order }));
    },
    async openArtistSongs(artistId, order) {
      const shown = pages.artists.get(artistId);
      if (shown?.status !== 'shown') return;
      const songs = shown.content.songs[order];
      if (songs?.status === 'loading' || songs?.status === 'shown') return;
      changeArtist(artistId, withSongs(order, { status: 'loading' }));
      const result = await session.api.get(endpoints.artistSongs, {
        id: artistId,
        order,
        offset: 0,
      });
      if (!result) return;
      changeArtist(
        artistId,
        withSongs(
          order,
          result.ok
            ? {
                status: 'shown',
                content: artistSongsOf(result.value),
              }
            : { status: 'failed', failure: result.failure },
        ),
      );
    },
    async moreArtistSongs(artistId, order) {
      const shown = pages.artists.get(artistId);
      const songs =
        shown?.status === 'shown' ? shown.content.songs[order] : null;
      if (
        songs?.status !== 'shown' ||
        !songs.content.more ||
        songs.content.more.status === 'loading'
      )
        return;
      changeArtistSongs(artistId, order, (before) => ({
        ...before,
        more: { status: 'loading' },
      }));
      const result = await session.api.get(endpoints.artistSongs, {
        id: artistId,
        order,
        offset: songs.content.songs.length,
      });
      if (!result) return;
      changeArtistSongs(artistId, order, (before) =>
        result.ok
          ? artistSongsOf(result.value, before.songs)
          : {
              ...before,
              more: { status: 'failed', failure: result.failure },
            },
      );
    },
    async moreArtistAlbums(artistId) {
      const shown = pages.artists.get(artistId);
      if (
        shown?.status !== 'shown' ||
        !shown.content.moreAlbums ||
        shown.content.moreAlbums.status === 'loading'
      )
        return;
      changeArtist(artistId, (page) => ({
        ...page,
        moreAlbums: { status: 'loading' },
      }));
      const result = await session.api.get(endpoints.artistAlbums, {
        id: artistId,
        offset: shown.content.albums.length,
      });
      if (!result) return;
      changeArtist(artistId, (page) =>
        result.ok
          ? {
              ...page,
              albums: [...page.albums, ...result.value.albums],
              moreAlbums: result.value.more ? { status: 'notLoaded' } : null,
            }
          : {
              ...page,
              moreAlbums: { status: 'failed', failure: result.failure },
            },
      );
    },
    async openArtistIntro(artistId) {
      const shown = pages.artists.get(artistId);
      if (shown?.status !== 'shown') return;
      const { intro } = shown.content;
      if (intro?.status === 'loading' || intro?.status === 'shown') return;
      changeArtist(artistId, (page) => ({
        ...page,
        intro: { status: 'loading' },
      }));
      const result = await session.api.get(endpoints.artistIntro, {
        id: artistId,
      });
      if (!result) return;
      changeArtist(artistId, (page) => ({
        ...page,
        intro: result.ok
          ? { status: 'shown', content: result.value }
          : { status: 'failed', failure: result.failure },
      }));
    },
    async openPlaylistTags() {
      const shown = pages.tags;
      if (!replica || shown?.status === 'loading' || shown?.status === 'shown')
        return;
      pages.tags = { status: 'loading' };
      publish();
      const result = await session.api.get(endpoints.playlistTags);
      if (!result) return;
      pages.tags = result.ok
        ? { status: 'shown', content: result.value.groups }
        : { status: 'failed', failure: result.failure };
      publish();
    },
    async change(change) {
      return applyChange(change);
    },
    addSongs,
    removeSongs,
    undoRemove,
    dismissRemoval,
    retryRemove,
    moveSongs,
    retryOrder,
    orderPlaylists,
    retryPlaylistOrder,
    flush,
    publish,
    addTargets,
    async setCover(playlistId, coverUrl) {
      if (!replica) return;
      await confirm(session.current, { kind: 'cover', playlistId, coverUrl });
    },
    async create(draft, songs = []) {
      const name = draft.name.trim();
      const problem = nameProblem(name);
      if (problem) {
        return {
          ok: false,
          failure: { kind: 'invalid', problem },
        };
      }
      if (!replica) return null;
      if (!context.online()) {
        return {
          ok: false,
          failure: { kind: 'offline' },
        };
      }
      const mine = session.current;
      const result = await session.api.post(endpoints.createPlaylist, {
        name,
        private: draft.private,
      });
      if (!result) return null;
      if (!result.ok) return result;
      const { playlist } = result.value;
      if (!(await confirm(mine, { kind: 'create', playlist }))) return null;
      if (songs.length > 0) void addSongs(playlist, songs);
      return { ok: true, playlistId: playlist.id };
    },
  };
};
