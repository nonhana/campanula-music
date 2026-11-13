import type { Account } from '#lib/api/account.js';
import type { CoverCrop } from '#lib/api/cover.js';
import { endpoints } from '#lib/api/endpoints.js';
import type {
  ArtistSongOrder,
  CollectedAlbum,
  CollectedArtist,
  CreatePlaylistRequest,
  Playlist,
  Song,
} from '#lib/api/library.js';
import { playlistName } from '#lib/api/library.js';
import { LOGIN_COOKIE_LOCK } from '#lib/api/login.js';
import type { PlaySource, Quality } from '#lib/api/playback.js';
import type { SearchedItems, SearchKind } from '#lib/api/search.js';

import type { RequestFailure, Result } from './api-client';
import { createApi } from './api-client';
import type { BrowserCapabilities } from './browser';
import type { PlaylistEdit, PlaylistSeed } from './changes';
import { changeProblem, playlistEdits } from './changes';
import type { CheckIns } from './check-ins';
import { createCheckIns } from './check-ins';
import type { CoverOutcome, CoverState } from './cover';
import { createCover } from './cover';
import type { DailyState } from './daily';
import { createDaily } from './daily';
import type {
  DownloadBatchOutcome,
  DownloadBlock,
  DownloadRemoval,
  DownloadSource,
  DownloadsState,
  DownloadStartBlock,
} from './downloads';
import {
  createDownloads,
  downloadBlock as downloadBlockFor,
  INITIAL_DOWNLOADS,
} from './downloads';
import type { ExportState } from './export';
import { createExports } from './export';
import type {
  AddSongsOutcome,
  AddTarget,
  AddTargetsRequest,
  ArtistTab,
  CreateOutcome,
  LibraryState,
  PlaylistGroups,
  PlaylistSearch,
} from './library';
import {
  createLibrary,
  filterAlbums,
  filterArtists,
  filterPlaylists,
  filterSongs,
  searchPlaylist,
} from './library';
import { createLocalDatabase, createLocalDb } from './local';
import type { LoginState } from './login';
import { createLogin, INITIAL_LOGIN } from './login';
import type { LyricsState } from './lyrics';
import { createLyrics } from './lyrics';
import { connectMediaSession } from './media-session';
import type {
  NoticeAction,
  NoticeEntry,
  NoticeTone,
  ShowNoticeOptions,
} from './notice';
import { createNotices } from './notice';
import { createBackgroundLane } from './pacing';
import { plainSong, plainSource } from './plain';
import type { Player, PlayerState, PlayMode } from './player';
import { createPlayer, DEFAULT_VOLUME, INITIAL_PLAYER } from './player';
import { createSavedQueue } from './saved-queue';
import type { SearchState } from './search';
import { createSearch, INITIAL_SEARCH } from './search';
import type { Session } from './session-round';
import { createSessionRound } from './session-round';

const SESSION_CHANNEL = 'campanula:session';

interface SessionMessage {
  type: 'signedOut';
}

type ListSource = Exclude<PlaySource, { kind: 'search' }>;

export interface CollectTarget {
  kind: 'playlist' | 'album' | 'artist';
  id: number;
}

type ViewedPage =
  | { kind: 'playlist'; id: number }
  | { kind: 'album'; id: number }
  | { kind: 'artist'; id: number; tab: ArtistTab; order: ArtistSongOrder }
  | { kind: 'daily' }
  | { kind: 'search'; keyword: string };

export interface AppState {
  session: Session;
  login: LoginState;
  library: LibraryState | null;
  notices: readonly NoticeEntry[];
  player: PlayerState;
  lyrics: LyricsState | null;
  daily: DailyState | null;
  search: SearchState;
  downloads: DownloadsState;
  readonly exportable: boolean;
  readonly touchPrimary: boolean;
  exporting: ExportState | null;
  cover: CoverState | null;
  online: boolean;
  readonly playable: (song: Song) => boolean;
  readonly downloadBlock: (song: Song) => DownloadBlock | null;
}

export interface App {
  readonly state: AppState;
  subscribe: (listener: () => void) => () => void;
  open: () => Promise<void>;
  startQrLogin: () => Promise<void>;
  stopQrLogin: () => void;
  continueQrLogin: () => Promise<void>;
  sendCaptcha: (phone: string) => Promise<void>;
  loginWithCaptcha: (phone: string, captcha: string) => Promise<void>;
  logout: () => Promise<void>;
  retrySync: () => void;
  viewing: (page: ViewedPage) => () => void;
  openPlaylist: (playlistId: number) => Promise<void>;
  searchPlaylist: (playlistId: number, query: string) => PlaylistSearch | null;
  openAlbum: (albumId: number) => Promise<void>;
  openArtist: (artistId: number) => Promise<void>;
  openArtistSongs: (artistId: number, order: ArtistSongOrder) => Promise<void>;
  moreArtistSongs: (artistId: number, order: ArtistSongOrder) => Promise<void>;
  moreArtistAlbums: (artistId: number) => Promise<void>;
  openArtistIntro: (artistId: number) => Promise<void>;
  openDaily: () => Promise<void>;
  suggest: (keyword: string) => void;
  search: (keyword: string) => Promise<void>;
  openSearch: (keyword: string) => Promise<void>;
  moreSearchResults: (keyword: string, kind: SearchKind) => Promise<void>;
  clearSearchHistory: () => Promise<void>;
  play: (source: PlaySource, songId: number) => void;
  playAll: (source: PlaySource) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  playFromQueue: (index: number) => void;
  playNext: (source: PlaySource, song: Song) => void;
  addToQueue: (source: PlaySource, song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setPlayMode: (mode: PlayMode) => void;
  seek: (position: number) => void;
  playFrom: (position: number) => void;
  setVolume: (volume: number) => void;
  setPlayQuality: (quality: Quality) => void;
  dismissPlayerNotice: () => void;
  openLyrics: (songId: number) => Promise<void>;
  heart: (
    song: Song,
    hearted: boolean,
    options?: { notify?: boolean },
  ) => Promise<void>;
  addToPlaylist: (playlistId: number, song: Song) => Promise<void>;
  addSongsToPlaylist: (
    playlistId: number,
    songs: readonly Song[],
  ) => Promise<AddSongsOutcome>;
  addTargets: (request: AddTargetsRequest) => AddTarget[] | null;
  removeFromPlaylist: (playlistId: number, songIds: readonly number[]) => void;
  moveSongs: (
    playlistId: number,
    songIds: readonly number[],
    before: number | null,
  ) => boolean;
  orderPlaylists: (playlistIds: readonly number[]) => boolean;
  flushPlaylist: (playlistId: number) => Promise<void>;
  searchSongs: (keyword: string) => Promise<Result<readonly Song[]>>;
  collect: (target: CollectTarget, collected: boolean) => Promise<void>;
  createPlaylist: (
    draft: CreatePlaylistRequest,
    songs?: readonly Song[],
  ) => Promise<CreateOutcome | null>;
  editPlaylist: (playlistId: number, edit: PlaylistEdit) => Promise<void>;
  publishPlaylist: (playlistId: number) => Promise<void>;
  deletePlaylist: (playlistId: number) => Promise<void>;
  openPlaylistTags: () => Promise<void>;
  prepareCover: (playlistId: number, file: File) => Promise<void>;
  uploadCover: (crop: CoverCrop) => Promise<CoverOutcome | null>;
  cancelCover: () => void;
  retryCover: () => Promise<CoverOutcome | null>;
  closeCover: () => void;
  noticeAction: (id: number, action: NoticeAction) => Promise<void>;
  toast: (
    tone: NoticeTone,
    text: string,
    options?: ShowNoticeOptions,
  ) => number;
  download: (song: Song) => DownloadBlock | null;
  downloadSongs: (
    songs: readonly Song[],
    source: DownloadSource,
  ) => Promise<DownloadBatchOutcome | DownloadStartBlock>;
  downloadPlaylist: (
    playlistId: number,
    songs?: readonly Song[],
    options?: { fill?: boolean },
  ) => Promise<DownloadBatchOutcome | DownloadStartBlock>;
  downloadAlbum: (
    albumId: number,
    songs?: readonly Song[],
  ) => Promise<DownloadBatchOutcome | DownloadStartBlock>;
  retryDownload: (songId: number) => void;
  cancelDownload: (songId: number) => void;
  cancelAllDownloads: () => void;
  resumeDownloads: () => void;
  deleteDownloads: (songIds: readonly number[]) => Promise<DownloadRemoval>;
  deletePlaylistDownloads: (playlistId: number) => Promise<DownloadRemoval>;
  clearDownloads: () => Promise<DownloadRemoval>;
  setDownloadQuality: (quality: Quality) => void;
  exportDownloads: (songIds: readonly number[]) => Promise<void>;
  cancelExport: () => void;
  closeExport: () => void;
  searchDownloads: (query: string) => readonly Song[];
  searchPlaylists: (query: string) => PlaylistGroups | null;
  searchAlbums: (query: string) => readonly CollectedAlbum[] | null;
  searchArtists: (query: string) => readonly CollectedArtist[] | null;
}

export const createApp = (browser: BrowserCapabilities): App => {
  const api = createApi(browser, () => round.current);
  const db = createLocalDatabase(browser.indexedDB);
  const local = createLocalDb(db);
  const streamable = (): boolean =>
    state.online && state.session.status === 'signedIn';

  const playable = (song: Song): boolean =>
    state.downloads.has(song.id) ||
    (song.availability !== 'noCopyright' && streamable());

  const downloadBlockForApp = (song: Song): DownloadBlock | null =>
    downloadBlockFor(song, state.downloads, {
      signedIn: state.session.status === 'signedIn',
      online: state.online,
    });

  const defaultVolume = browser.touchPrimary ? 1 : DEFAULT_VOLUME;

  let state: AppState = {
    session: { status: 'checking' },
    login: INITIAL_LOGIN,
    library: null,
    notices: [],
    player: { ...INITIAL_PLAYER, volume: defaultVolume },
    lyrics: null,
    daily: null,
    search: INITIAL_SEARCH,
    cover: null,
    downloads: INITIAL_DOWNLOADS,
    exportable: browser.pickFolder !== null,
    touchPrimary: browser.touchPrimary,
    exporting: null,
    online: browser.network.onLine,
    playable,
    downloadBlock: downloadBlockForApp,
  };
  const listeners = new Set<() => void>();
  let viewing: { page: ViewedPage; token: number; applied: string } | null =
    null;
  let viewingToken = 0;
  let viewingQueued = false;

  const update = (next: Partial<AppState>) => {
    state = {
      ...state,
      ...next,
    };
    for (const listener of listeners) listener();
    if (next.library !== undefined || next.session !== undefined)
      applyViewing();
    if (next.library !== undefined) fillPendingPlaylists();
  };

  const viewingKey = (page: ViewedPage): string => {
    const signedIn = state.session.status === 'signedIn';
    const shown = state.library;
    switch (page.kind) {
      case 'playlist': {
        const ready = shown?.playlists != null;
        const outside =
          shown != null &&
          shown.playlists != null &&
          shown.songsOf(page.id) === null;
        return `playlist:${page.id}:${ready}:${outside}`;
      }
      case 'album':
        return `album:${page.id}:${shown !== null}:${(shown?.albumPage(page.id) ?? null) === null}`;
      case 'artist': {
        const opened = shown?.artistPage(page.id) ?? null;
        const content = opened?.status === 'shown' ? opened.content : null;
        return `artist:${page.id}:${page.tab}:${page.order}:${shown !== null}:${opened?.status ?? 'none'}:${content?.songs[page.order] === null}:${content?.intro === null}`;
      }
      case 'daily':
        return `daily:${signedIn}`;
      case 'search':
        return `search:${page.keyword}:${signedIn}`;
      default: {
        const unhandled: never = page;
        throw new Error(`不认识的页面：${JSON.stringify(unhandled)}`);
      }
    }
  };

  const loginExpired = (): void => {
    void local.setCachedAccount(null).catch(() => {});
    void round.change({ kind: 'loginExpired' });
    update({
      session: { status: 'loginExpired' },
      library: null,
    });
    player.availabilityChanged();
  };

  const lane = createBackgroundLane(browser);
  const round = createSessionRound({ api, lane, expired: loginExpired });
  const notices = createNotices({
    clock: browser.clock,
    changed: () => {
      update({
        notices: notices.list(),
      });
      library.publish();
    },
  });
  const pendingPlaylists = new Map<
    number,
    { source: DownloadSource; seen: Set<number> }
  >();
  round.onChange(() => {
    pendingPlaylists.clear();
    notices.clear();
  });
  let player: Player;
  let checkIns: CheckIns;

  const savedQueue = createSavedQueue({
    db,
    session: round,
    player: () => player,
    read: () => state.player,
    send: () => checkIns.send(),
    sendBeforeLogout: (owner) => checkIns.sendBeforeLogout(owner),
  });

  checkIns = createCheckIns({
    api,
    session: round,
    store: savedQueue.pending,
    locks: browser.locks,
    account: () =>
      state.session.status === 'signedIn' ? state.session.account.id : null,
  });

  let finishingLogout: Promise<RequestFailure | null> | undefined;
  const finishPendingLogout = async (): Promise<RequestFailure | null> => {
    if (!(await local.pendingLogout())) return null;
    await savedQueue.pending.clear();
    const result = await api.post(endpoints.logout);
    if (!result.ok) return result.failure;
    await local.setPendingLogout(false);
    return null;
  };
  const finishLogout = (): Promise<RequestFailure | null> => {
    finishingLogout ??= browser.locks
      .request(LOGIN_COOKIE_LOCK, finishPendingLogout)
      .finally(() => {
        finishingLogout = undefined;
      });
    return finishingLogout;
  };
  browser.network.addEventListener('online', () => void finishLogout());

  const downloadsChanged = (): void => {
    player.availabilityChanged();
  };

  const downloads = createDownloads({
    api,
    session: round,
    local,
    clock: browser.clock,
    browser,
    storage: browser.storage,
    albumPage: (albumId) => {
      const page = state.library?.albumPage(albumId);
      return page?.status === 'shown' ? page.content : null;
    },
    online: () => browser.network.onLine,
    signedIn: () => state.session.status === 'signedIn',
    write: (next) => update({ downloads: next }),
    notices,
    changed: downloadsChanged,
  });

  let fillingPlaylists = false;
  let fillAgain = false;
  const fillPendingPlaylists = (): void => {
    if (fillingPlaylists) {
      fillAgain = true;
      return;
    }
    if (pendingPlaylists.size === 0) return;
    if (!state.library) {
      pendingPlaylists.clear();
      return;
    }
    fillingPlaylists = true;
    void (async () => {
      for (const [playlistId, pending] of pendingPlaylists) {
        const content = state.library?.playlistPage(playlistId).content;
        if (!content) continue;
        const songs = content.songs.filter(
          (song) => !pending.seen.has(song.id),
        );
        if (songs.length > 0) {
          const added = await downloads.add(songs, pending.source, {
            quiet: true,
          });
          if (added === 'signedOut' || added === 'offline') continue;
          for (const song of songs) pending.seen.add(song.id);
        }
        if (content.complete) pendingPlaylists.delete(playlistId);
      }
    })()
      .catch((error: unknown) => {
        console.error('补整张歌单的下载时出错', error);
      })
      .finally(() => {
        fillingPlaylists = false;
        if (fillAgain) {
          fillAgain = false;
          fillPendingPlaylists();
        }
      });
  };

  const { pickFolder } = browser;
  const exports = createExports({
    pickFolder: () => {
      if (!pickFolder) throw new Error('这个浏览器不能选文件夹，不该导出');
      return pickFolder();
    },
    stored: downloads.stored,
    sizeOf: (songId) => state.downloads.sizeOf(songId),
    write: (next) => update({ exporting: next }),
  });

  player = createPlayer({
    api: round.api,
    clock: browser.clock,
    audio: browser.audio,
    defaultVolume,
    write: (next) => {
      update({ player: next });
      showOnLockScreen(next);
    },
    save: savedQueue.save,
    forget: savedQueue.forget,
    downloaded: (songId) => state.downloads.has(songId),
    localFile: (songId) => downloads.audioUrl(songId),
    playable,
  });
  const lockScreen = connectMediaSession({
    session: browser.mediaSession,
    MediaMetadata: browser.MediaMetadata,
    clock: browser.clock,
    player,
    read: () => state.player,
    localCover: (coverUrl) => state.downloads.coverOf(coverUrl),
  });
  const showOnLockScreen = (next: PlayerState): void => {
    lockScreen(next);
  };

  for (const type of ['online', 'offline'] as const) {
    browser.network.addEventListener(type, () => {
      update({ online: browser.network.onLine });
      player.availabilityChanged();
      downloads.wake();
      fillPendingPlaylists();
    });
  }

  const library = createLibrary({
    api,
    session: round,
    local,
    clock: browser.clock,
    page: browser.page,
    write: (next) => {
      update({ library: next });
      player.libraryChanged(
        (playlistId) => next.playlistPage(playlistId).content,
      );
    },
    online: () => browser.network.onLine,
    notices,
  });

  const cover = createCover({
    api: round.api,
    session: round,
    images: browser.images,
    upload: browser.uploadCoverImage,
    write: (next) => update({ cover: next }),
    changed: (playlistId, coverUrl) => library.setCover(playlistId, coverUrl),
  });

  const lyrics = createLyrics({
    api: round.api,
    session: round,
    read: () => state.lyrics,
    write: (next) => update({ lyrics: next }),
    stored: (songId) => downloads.lyricsOf(songId),
  });

  const daily = createDaily({
    api: round.api,
    session: round,
    clock: browser.clock,
    read: () => state.daily,
    write: (next) => update({ daily: next }),
  });

  const search = createSearch({
    api: round.api,
    session: round,
    clock: browser.clock,
    local,
    read: () => state.search,
    write: (next) => update({ search: next }),
  });

  // 等这一次状态发布会话走完再动手：open 要等收藏、取消收藏的排队
  const applyViewing = (): void => {
    const current = viewing;
    if (!current) return;
    const key = viewingKey(current.page);
    if (key === current.applied) return;
    current.applied = key;
    if (viewingQueued) return;
    viewingQueued = true;
    queueMicrotask(() => {
      viewingQueued = false;
      openViewingPage();
    });
  };

  const openViewingPage = (): void => {
    const current = viewing;
    if (!current) return;
    const { page } = current;
    const shown = state.library;
    switch (page.kind) {
      case 'playlist':
        if (shown?.playlists) void library.open(page.id);
        return;
      case 'album':
        if (shown) void library.openAlbum(page.id);
        return;
      case 'artist': {
        if (!shown) return;
        const opened = shown.artistPage(page.id);
        if (opened === null) {
          void library.openArtist(page.id);
          return;
        }
        if (opened.status !== 'shown') return;
        library.chooseArtistOrder(page.id, page.order);
        if (opened.content.songs[page.order] === null)
          void library.openArtistSongs(page.id, page.order);
        if (page.tab === 'intro' && opened.content.intro === null)
          void library.openArtistIntro(page.id);
        return;
      }
      case 'daily':
        if (state.session.status === 'signedIn') void daily.open();
        return;
      case 'search':
        if (state.session.status === 'signedIn' && page.keyword.trim())
          void search.open(page.keyword);
        return;
      default: {
        const unhandled: never = page;
        throw new Error(`不认识的页面：${JSON.stringify(unhandled)}`);
      }
    }
  };

  const view = (page: ViewedPage): (() => void) => {
    const token = ++viewingToken;
    viewing = { page, token, applied: '' };
    applyViewing();
    let left = false;
    return () => {
      if (left) return;
      left = true;
      if (page.kind === 'playlist') void library.flush(page.id);
      if (viewing?.token === token) viewing = null;
    };
  };

  const signedIn = async (account: Account): Promise<void> => {
    const entered = round.change({ kind: 'signedIn', account });
    const mine = round.current;
    const [shown, quality, history] = await Promise.all([
      library.enter(account),
      local.playQuality(),
      local.searchHistory(),
    ]);
    await entered;
    if (!round.isCurrent(mine) || !shown) return;
    await local.setCachedAccount(account).catch(() => {});
    if (!round.isCurrent(mine)) return;
    if (quality) player.setQuality(quality);
    update({
      session: { status: 'signedIn', account },
      login: INITIAL_LOGIN,
      library: shown,
      search: { ...state.search, history },
    });
    downloads.wake();
    player.availabilityChanged();
    library.sync();
    checkIns.send();
  };

  const login = createLogin({
    api,
    session: round,
    clock: browser.clock,
    page: browser.page,
    withLoginCookie: (send) => browser.locks.request(LOGIN_COOKIE_LOCK, send),
    beforeLogin: finishPendingLogout,
    discardLogin: async () => {
      await local.setPendingLogout(true);
      await finishPendingLogout();
    },
    read: () => state.login,
    write: (next) => update({ login: next }),
    signedIn: (account) => {
      update({ session: { status: 'checking' } });
      return signedIn(account);
    },
  });

  const signedOut = (by: 'this-tab' | 'other-tab'): Promise<void> => {
    const changed = Promise.all([
      round.change({ kind: 'signedOut', by }),
      local.setCachedAccount(null).catch(() => {}),
    ]);
    update({
      session: { status: 'signedOut' },
      login: INITIAL_LOGIN,
      library: null,
    });
    player.availabilityChanged();
    return changed.then(() => {});
  };

  const listOf = (
    source: ListSource,
  ): { songs: readonly Song[]; complete: boolean } | null => {
    if (source.kind === 'downloads')
      return (
        state.downloads.songs && {
          songs: state.downloads.songs,
          complete: true,
        }
      );
    const shown = state.library;
    if (!shown) return null;
    switch (source.kind) {
      case 'playlist': {
        const page = shown.playlistPage(source.id);
        return (
          page.content && {
            songs: page.content.songs,
            complete: page.content.complete,
          }
        );
      }
      case 'album': {
        const page = shown.albumPage(source.id);
        return page?.status === 'shown'
          ? { songs: page.content.songs, complete: true }
          : null;
      }
      case 'artist': {
        const page = shown.artistPage(source.id);
        const songs =
          page?.status === 'shown'
            ? page.content.songs[page.content.order]
            : null;
        return songs?.status === 'shown'
          ? { songs: songs.content.songs, complete: true }
          : null;
      }
      case 'daily':
        return state.daily?.status === 'shown'
          ? { songs: state.daily.songs, complete: true }
          : null;
      default: {
        const unhandled: never = source;
        throw new Error(`不认识的播放来源：${JSON.stringify(unhandled)}`);
      }
    }
  };

  const searchedSong = (keyword: string, songId: number): Song | undefined => {
    const results = state.search.results;
    const songs = results?.keyword === keyword ? results.songs : null;
    return songs?.status === 'shown'
      ? songs.items.find((song) => song.id === songId)
      : undefined;
  };

  const searchedItem = <K extends Exclude<SearchKind, 'songs'>>(
    kind: K,
    id: number,
  ): SearchedItems[K] | undefined => {
    const list = state.search.results?.[kind];
    return list?.status === 'shown'
      ? (list.items as SearchedItems[K][]).find((item) => item.id === id)
      : undefined;
  };

  const playlistToCollect = (
    shown: LibraryState,
    id: number,
  ): { playlist: Playlist; seed: PlaylistSeed | null } | null => {
    const listed = shown.playlists?.find((playlist) => playlist.id === id);
    if (listed) return { playlist: listed, seed: null };
    const page = shown.neteasePlaylist(id);
    if (page?.status === 'shown') {
      const { playlist, trackIds, tracksUpdatedAt, songs, complete } =
        page.content;
      return {
        playlist: {
          ...playlist,
          kind: 'collected',
          private: false,
          trackCount: trackIds.length,
          tracksUpdatedAt,
        },
        seed: {
          tracks: {
            version: tracksUpdatedAt,
            trackIds: [...trackIds],
            complete,
          },
          songs,
        },
      };
    }
    const searched = searchedItem('playlists', id);
    return searched
      ? {
          playlist: {
            ...searched,
            creatorAvatarUrl: null,
            description: null,
            tags: [],
            kind: 'collected',
            private: false,
            tracksUpdatedAt: 0,
          },
          seed: null,
        }
      : null;
  };

  const albumToCollect = (
    shown: LibraryState,
    id: number,
  ): CollectedAlbum | null => {
    const listed = shown.albums?.find((album) => album.id === id);
    if (listed) return listed;
    const page = shown.albumPage(id);
    if (page?.status === 'shown') {
      const { name, coverUrl, artist, songCount } = page.content.album;
      return {
        id,
        name,
        coverUrl,
        artists: [artist],
        songCount,
      };
    }
    const searched = searchedItem('albums', id);
    return searched
      ? {
          id,
          name: searched.name,
          coverUrl: searched.coverUrl,
          artists: searched.artists,
          songCount: 0,
        }
      : null;
  };

  const artistToCollect = (
    shown: LibraryState,
    id: number,
  ): CollectedArtist | null => {
    const listed = shown.artists?.find((artist) => artist.id === id);
    if (listed) return listed;
    const page = shown.artistPage(id);
    if (page?.status === 'shown')
      return {
        id,
        name: page.content.artist.name,
        avatarUrl: page.content.artist.avatarUrl,
      };
    const searched = searchedItem('artists', id);
    return searched
      ? { id, name: searched.name, avatarUrl: searched.avatarUrl }
      : null;
  };

  const ownPlaylist = (playlistId: number): Playlist => {
    const playlist = state.library?.playlists?.find(
      (item) => item.id === playlistId,
    );
    if (playlist?.kind !== 'own')
      throw new Error(`只有自建歌单能改、能删：${playlistId}`);
    return playlist;
  };

  const sessionChannel = browser.broadcastChannel(SESSION_CHANNEL);
  sessionChannel.addEventListener('message', (event) => {
    const message = event.data as SessionMessage;
    switch (message.type) {
      case 'signedOut':
        void signedOut('other-tab');
        return;
      default: {
        const unhandled: never = message.type;
        throw new Error(`不认识的广播消息：${JSON.stringify(unhandled)}`);
      }
    }
  });

  const actOnNotice = async (
    entry: NoticeEntry,
    action: NoticeAction,
  ): Promise<void> => {
    const notice = entry.notice;
    switch (action) {
      case 'undo':
        if (notice.kind === 'removed') library.undoRemove(notice.removalId);
        return;
      case 'dismiss':
        if (notice.kind === 'removed') library.dismissRemoval(notice.removalId);
        notices.hide(entry.id);
        return;
      case 'retry':
        switch (notice.kind) {
          case 'removeFailed':
            return library.retryRemove(notice.playlist, notice.songIds);
          case 'orderFailed':
            return library.retryOrder(notice.playlist, notice.songIds);
          case 'playlistOrderFailed':
            return library.retryPlaylistOrder(notice.playlistIds);
          case 'syncFailed':
            return library.retry();
          case 'downloadFailed':
            if (downloads.retry(notice.song.id)) notices.hide(entry.id);
            return;
          default:
            return;
        }
      case 'resume':
        if (notice.kind === 'downloadsPaused') {
          downloads.resume();
          notices.hide(entry.id);
        }
        return;
      default: {
        const unhandled: never = action;
        throw new Error(`不认识的提示条动作：${JSON.stringify(unhandled)}`);
      }
    }
  };

  return {
    get state() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async open() {
      update({
        session: { status: 'checking' },
      });
      const loaded = Promise.all([
        downloads.load(),
        local.volume().then((volume) => {
          if (volume !== null && !browser.touchPrimary)
            player.setVolume(volume);
        }),
      ]);
      const asked = round.current;
      if (await local.pendingLogout()) {
        await Promise.all([finishLogout(), loaded]);
        if (!round.isCurrent(asked)) return;
        await round.change({ kind: 'anonymous' });
        update({
          session: { status: 'signedOut' },
        });
        return;
      }
      const [session] = await Promise.all([
        browser.locks.request(LOGIN_COOKIE_LOCK, async () => {
          if (await local.pendingLogout()) {
            await finishPendingLogout();
            return { status: 'signedOut' } as const;
          }
          return round.checkAccount();
        }),
        loaded,
      ]);
      if (!round.isCurrent(asked) || !session) return;
      if (session.status === 'signedIn') return signedIn(session.account);
      if (
        session.status === 'checkFailed' &&
        session.failure.kind === 'offline'
      ) {
        const account = await local.cachedAccount();
        if (!round.isCurrent(asked)) return;
        if (account) return signedIn(account);
        await round.change({ kind: 'anonymous' });
        update({
          session: { status: 'signedOut' },
        });
        return;
      }
      if (session.status === 'signedOut') {
        await local.setCachedAccount(null).catch(() => {});
        await round.change({ kind: 'anonymous' });
      } else if (session.status === 'loginExpired') {
        void local.setCachedAccount(null).catch(() => {});
        void round.change({ kind: 'loginExpired' });
      }
      update({ session });
    },
    startQrLogin: login.startQr,
    stopQrLogin: login.stopQr,
    continueQrLogin: login.continueQr,
    sendCaptcha: login.sendCaptcha,
    loginWithCaptcha: login.loginWithCaptcha,
    async logout() {
      await local.setPendingLogout(true);
      // 先让其他标签页收到退出、停掉后台通道，再等本标签页的最后打卡和清理；
      // 反过来会等跨标签页的打卡锁，而对方正等这条广播（断网、限流时卡住）
      const changed = signedOut('this-tab');
      sessionChannel.postMessage({
        type: 'signedOut',
      } satisfies SessionMessage);
      await changed;
      await local.deleteLibrary();
      await finishLogout();
    },
    retrySync: library.retry,
    viewing: view,
    openPlaylist: library.open,
    searchPlaylist(playlistId, query) {
      const playlist = state.library?.playlistPage(playlistId).content;
      return playlist ? searchPlaylist(playlist, query) : null;
    },
    openAlbum: library.openAlbum,
    openArtist: library.openArtist,
    openArtistSongs: library.openArtistSongs,
    moreArtistSongs: library.moreArtistSongs,
    moreArtistAlbums: library.moreArtistAlbums,
    openArtistIntro: library.openArtistIntro,
    openPlaylistTags: library.openPlaylistTags,
    prepareCover: cover.prepare,
    uploadCover: cover.upload,
    cancelCover: cover.cancel,
    retryCover: cover.retry,
    closeCover: cover.close,
    editPlaylist: async (playlistId, edit) => {
      const changes = playlistEdits(ownPlaylist(playlistId), edit);
      const refused =
        changes.find((change) => changeProblem(change)) ??
        (browser.network.onLine ? undefined : changes[0]);
      if (refused) {
        await library.change(refused);
        return;
      }
      await Promise.all(changes.map((change) => library.change(change)));
    },
    async createPlaylist(draft, songs) {
      const outcome = await library.create(draft, songs?.map(plainSong));
      if (outcome?.ok && (songs?.length ?? 0) === 0) {
        notices.show({
          kind: 'playlistCreated',
          name: draft.name.trim(),
        });
      }
      return outcome;
    },
    async publishPlaylist(playlistId) {
      const playlist = ownPlaylist(playlistId);
      if (!playlist.private) return;
      const result = await library.change({ kind: 'publish', playlist });
      if (result?.ok && result.value === 'done') {
        notices.show({
          kind: 'playlistPublished',
          name: playlistName(playlist),
        });
      }
    },
    async deletePlaylist(playlistId) {
      const playlist = ownPlaylist(playlistId);
      const result = await library.change({ kind: 'delete', playlist });
      if (result?.ok && result.value === 'done') {
        notices.show({
          kind: 'playlistDeleted',
          name: playlistName(playlist),
        });
      }
    },
    openDaily: daily.open,
    suggest: search.suggest,
    search: search.search,
    openSearch: search.open,
    moreSearchResults: search.more,
    clearSearchHistory: search.clearHistory,
    play(source, songId) {
      source = plainSource(source);
      if (source.kind === 'search') {
        const song = searchedSong(source.keyword, songId);
        if (song) player.interject(source, song);
        return;
      }
      const list = listOf(source);
      if (list) player.play(source, list.songs, songId, list.complete);
    },
    playAll(source) {
      source = plainSource(source);
      if (source.kind === 'search')
        throw new Error('搜索结果没有播放全部：在搜索里点歌是插播');
      const list = listOf(source);
      const first = list?.songs.find((song) => state.playable(song));
      if (list && first)
        player.play(source, list.songs, first.id, list.complete);
    },
    togglePlay: player.toggle,
    next: player.next,
    previous: player.previous,
    playFromQueue: player.jump,
    playNext(source, song) {
      const outcome = player.playNext(plainSource(source), plainSong(song));
      if (outcome !== 'ignored') {
        notices.show({
          kind: 'queuedNext',
          count: 1,
          started: outcome === 'started',
        });
      }
    },
    addToQueue(source, song) {
      const outcome = player.addToQueue(plainSource(source), plainSong(song));
      if (outcome !== 'ignored') {
        notices.show({
          kind: 'queuedEnd',
          count: 1,
          started: outcome === 'started',
        });
      }
    },
    removeFromQueue: player.removeFromQueue,
    clearQueue: player.clearQueue,
    setPlayMode: player.setMode,
    seek: player.seek,
    playFrom: player.playFrom,
    setVolume(volume) {
      if (browser.touchPrimary) return;
      player.setVolume(volume);
      void local.saveVolume(volume);
    },
    setPlayQuality(quality) {
      player.setQuality(quality);
      void local.savePlayQuality(quality);
    },
    dismissPlayerNotice: player.dismissNotice,
    openLyrics: lyrics.open,
    async heart(song, hearted, options) {
      const plain = plainSong(song);
      const result = await library.change({
        kind: 'heart',
        song: plain,
        hearted,
      });
      if (options?.notify && result?.ok && result.value === 'done')
        notices.show({ kind: 'hearted', song: plain, hearted });
    },
    async addToPlaylist(playlistId, song) {
      const playlist = state.library?.playlists?.find(
        (item) => item.id === playlistId,
      );
      if (!playlist || playlist.kind === 'collected')
        throw new Error(`只能加入自建歌单和我喜欢的音乐：${playlistId}`);
      await library.change({
        kind: 'add',
        playlist,
        song: plainSong(song),
      });
    },
    addSongsToPlaylist: async (playlistId, songs) =>
      library.addSongs(ownPlaylist(playlistId), songs.map(plainSong)),
    addTargets: library.addTargets,
    removeFromPlaylist(playlistId, songIds) {
      library.removeSongs(ownPlaylist(playlistId), songIds);
    },
    moveSongs: library.moveSongs,
    orderPlaylists: library.orderPlaylists,
    flushPlaylist: (playlistId) => library.flush(playlistId),
    async searchSongs(keyword) {
      const result = await search.searchSongs(keyword);
      return (
        result ?? {
          ok: false,
          failure: { kind: 'needsLogin' },
        }
      );
    },
    async collect(target, collected) {
      const shown = state.library;
      if (!shown) return;
      switch (target.kind) {
        case 'playlist': {
          const found = playlistToCollect(shown, target.id);
          if (found?.playlist.kind === 'collected') {
            await library.change({
              kind: 'collectPlaylist',
              playlist: found.playlist,
              collected,
              seed: found.seed,
            });
            return;
          }
          break;
        }
        case 'album': {
          const album = albumToCollect(shown, target.id);
          if (album) {
            await library.change({ kind: 'collectAlbum', album, collected });
            return;
          }
          break;
        }
        case 'artist': {
          const artist = artistToCollect(shown, target.id);
          if (artist) {
            await library.change({ kind: 'collectArtist', artist, collected });
            return;
          }
          break;
        }
        default: {
          const unhandled: never = target.kind;
          throw new Error(`不认识要收藏的东西：${JSON.stringify(unhandled)}`);
        }
      }
      throw new Error(
        `界面上没有这样东西，收藏不了：${JSON.stringify(target)}`,
      );
    },
    noticeAction: (id: number, action: NoticeAction): Promise<void> => {
      const entry = notices.list().find((each) => each.id === id);
      return entry && entry.actions.includes(action)
        ? actOnNotice(entry, action)
        : Promise.resolve();
    },
    toast: (tone, text, options) =>
      notices.show(
        {
          kind: 'plain',
          tone,
          text,
        },
        options,
      ),
    download: downloads.download,
    downloadSongs: (songs, source) => downloads.add(songs, source),
    async downloadPlaylist(playlistId, songs, options) {
      const shown = state.library;
      if (!shown) return 'signedOut';
      const page = shown.playlistPage(playlistId);
      const source: DownloadSource = {
        kind: 'playlist',
        id: playlistId,
        name: playlistName({
          name: page.info?.name ?? null,
          kind: page.kind,
        }),
      };
      const content = page.content;
      const selected = songs ?? content?.songs ?? [];
      const selectedIds = new Set(selected.map((song) => song.id));
      const allLoaded =
        content !== null &&
        selected.length === content.songs.length &&
        content.songs.every((song) => selectedIds.has(song.id));
      const filling =
        content !== null && !content.complete && (options?.fill ?? allLoaded);
      const outcome = await downloads.add(selected, source);
      if (outcome === 'signedOut' || outcome === 'offline') return outcome;
      if (filling) {
        pendingPlaylists.set(playlistId, {
          source,
          seen: new Set(content.songs.map((song) => song.id)),
        });
        fillPendingPlaylists();
      } else {
        pendingPlaylists.delete(playlistId);
      }
      return outcome;
    },
    async downloadAlbum(albumId, songs) {
      const page = state.library?.albumPage(albumId);
      if (page?.status !== 'shown') {
        return {
          queued: 0,
          downloaded: 0,
          trial: 0,
          noCopyright: 0,
        };
      }
      return downloads.add(songs ?? page.content.songs, {
        kind: 'album',
        id: albumId,
        name: page.content.album.name ?? '未知专辑',
      });
    },
    retryDownload(songId) {
      downloads.retry(songId);
    },
    cancelDownload(songId) {
      downloads.cancel(songId);
    },
    cancelAllDownloads() {
      pendingPlaylists.clear();
      downloads.cancelAll();
    },
    resumeDownloads() {
      downloads.resume();
      notices.hideWhere((notice) => notice.kind === 'downloadsPaused');
    },
    deleteDownloads: downloads.remove,
    deletePlaylistDownloads(playlistId) {
      pendingPlaylists.delete(playlistId);
      return downloads.removePlaylist(playlistId);
    },
    clearDownloads() {
      pendingPlaylists.clear();
      return downloads.clear();
    },
    setDownloadQuality: downloads.setQuality,
    exportDownloads: exports.start,
    cancelExport: exports.cancel,
    closeExport: exports.close,
    searchDownloads: (query) => filterSongs(state.downloads.songs ?? [], query),
    searchPlaylists: (query) => {
      const playlists = state.library?.playlists;
      return playlists ? filterPlaylists(playlists, query) : null;
    },
    searchAlbums: (query) => {
      const albums = state.library?.albums;
      return albums ? filterAlbums(albums, query) : null;
    },
    searchArtists: (query) => {
      const artists = state.library?.artists;
      return artists ? filterArtists(artists, query) : null;
    },
  };
};
