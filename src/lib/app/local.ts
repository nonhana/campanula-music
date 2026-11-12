import type { Account } from '#lib/api/account.js';
import type {
  AlbumResponse,
  CollectedAlbum,
  CollectedArtist,
  Playlist,
  Song,
} from '#lib/api/library.js';
import type { LyricsResponse, Quality } from '#lib/api/playback.js';

const NAME = 'campanula';
const VERSION = 15;
const SESSION = 'session';
const LIBRARY = 'library';
const TRACKS = 'tracks';
const SONGS = 'songs';
const ALBUM_PAGES = 'albumPages';
const LIBRARY_STORES = [LIBRARY, TRACKS, SONGS, ALBUM_PAGES];
export const PLAYER = 'player';
const SETTINGS = 'settings';
export const CHECK_INS = 'checkIns';
const DOWNLOADS = 'downloads';
const DOWNLOAD_QUEUE = 'downloadQueue';
const DOWNLOAD_PARTS = 'downloadParts';

export type DownloadSource =
  | { kind: 'single' }
  | { kind: 'playlist'; id: number; name: string }
  | { kind: 'album'; id: number; name: string };

export const sameDownloadSource = (
  a: DownloadSource,
  b: DownloadSource,
): boolean =>
  a.kind === b.kind &&
  (a.kind === 'single' || (b.kind !== 'single' && a.id === b.id));

export const mergeDownloadSources = (
  sources: readonly DownloadSource[],
  added: readonly DownloadSource[],
): DownloadSource[] => {
  const merged = [...sources];
  for (const source of added) {
    const index = merged.findIndex((existing) =>
      sameDownloadSource(existing, source),
    );
    if (index === -1) merged.push(source);
    else merged[index] = source;
  }
  return merged;
};

export interface StoredDownload {
  song: Song;
  audio: Blob;
  cover: Blob | null;
  lyrics: LyricsResponse;
  album: AlbumResponse['album'] | null;
  sources: DownloadSource[];
  downloadedAt: number;
}

export interface QueuedDownload {
  song: Song;
  sources: DownloadSource[];
  order: number;
  total: number | null;
  audioComplete: boolean;
  audioType: string | null;
}

export interface StoredPart {
  songId: number;
  index: number;
  blob: Blob;
}

export interface PlaylistTracks {
  version: number | null;
  trackIds: number[];
  complete: boolean;
}

export interface Replica {
  owner: number;
  hearts: number[] | null;
  playlists: Playlist[] | null;
  tracks: Map<number, PlaylistTracks>;
  songs: Map<number, Song>;
  albums: CollectedAlbum[] | null;
  artists: CollectedArtist[] | null;
  albumPages: Map<number, AlbumResponse>;
  firstSyncDone: boolean;
}

export interface LibraryPatch {
  hearts?: number[];
  playlists?: Playlist[];
  tracks?: ReadonlyMap<number, PlaylistTracks>;
  songs?: readonly Song[];
  albums?: CollectedAlbum[];
  artists?: CollectedArtist[];
  albumPages?: ReadonlyMap<number, AlbumResponse>;
  firstSyncDone?: true;
}

export const emptyPatch = (patch: LibraryPatch): boolean =>
  Object.values(patch).every((part) => part === undefined);

export const patched = (replica: Replica, patch: LibraryPatch): Replica => {
  let { tracks, songs, albumPages } = replica;
  if (patch.tracks || patch.playlists) {
    tracks = new Map(tracks);
    for (const [id, playlistTracks] of patch.tracks ?? [])
      tracks.set(id, playlistTracks);
    if (patch.playlists) {
      const kept = new Set(patch.playlists.map((playlist) => playlist.id));
      for (const id of tracks.keys()) {
        if (!kept.has(id)) tracks.delete(id);
      }
    }
  }
  if (patch.songs?.length) {
    songs = new Map(songs);
    for (const song of patch.songs) songs.set(song.id, song);
  }
  if (patch.albums || patch.albumPages) {
    const collected = new Set(
      (patch.albums ?? replica.albums ?? []).map((album) => album.id),
    );
    albumPages = new Map(
      [...albumPages, ...(patch.albumPages ?? [])].filter(([id]) =>
        collected.has(id),
      ),
    );
  }
  return {
    ...replica,
    hearts: patch.hearts ?? replica.hearts,
    playlists: patch.playlists ?? replica.playlists,
    tracks,
    songs,
    albums: patch.albums ?? replica.albums,
    artists: patch.artists ?? replica.artists,
    albumPages,
    firstSyncDone: patch.firstSyncDone ?? replica.firstSyncDone,
  };
};

export interface LocalDb {
  pendingLogout: () => Promise<boolean>;
  setPendingLogout: (pending: boolean) => Promise<void>;
  cachedAccount: () => Promise<Account | null>;
  setCachedAccount: (account: Account | null) => Promise<void>;
  readLibrary: () => Promise<Replica | null>;
  resetLibrary: (owner: number) => Promise<void>;
  deleteLibrary: () => Promise<void>;
  pendingChanges: (owner: number) => Promise<number[]>;
  addPendingChange: (owner: number, playlistId: number) => Promise<boolean>;
  removePendingChange: (owner: number, playlistId: number) => Promise<boolean>;
  saveLibrary: (owner: number, patch: LibraryPatch) => Promise<boolean>;
  playQuality: () => Promise<Quality | null>;
  savePlayQuality: (quality: Quality) => Promise<void>;
  downloadQuality: () => Promise<Quality | null>;
  saveDownloadQuality: (quality: Quality) => Promise<void>;
  // 0–1
  volume: () => Promise<number | null>;
  saveVolume: (volume: number) => Promise<void>;
  searchHistory: () => Promise<string[]>;
  changeSearchHistory: (
    change: (history: string[]) => string[],
  ) => Promise<string[]>;
  readDownloads: () => Promise<StoredDownload[]>;
  saveDownload: (download: StoredDownload) => Promise<void>;
  addDownloadSources: (
    songIds: readonly number[],
    sources: readonly DownloadSource[],
  ) => Promise<ReadonlyMap<number, DownloadSource[]>>;
  removeDownloadSource: (
    songIds: readonly number[],
    source: DownloadSource,
  ) => Promise<ReadonlyMap<number, DownloadSource[]>>;
  deleteDownloads: (songIds: readonly number[]) => Promise<void>;
  readQueuedDownloads: () => Promise<QueuedDownload[]>;
  saveQueuedDownloads: (entries: readonly QueuedDownload[]) => Promise<void>;
  deleteQueuedDownloads: (songIds: readonly number[]) => Promise<void>;
  readDownloadParts: () => Promise<StoredPart[]>;
  appendDownloadPart: (
    songId: number,
    index: number,
    blob: Blob,
  ) => Promise<void>;
  deleteDownloadParts: (songIds: readonly number[]) => Promise<void>;
}

export interface LocalDatabase {
  open: () => Promise<IDBDatabase>;
  write: (
    stores: string[],
    change: (transaction: IDBTransaction) => void,
  ) => Promise<void>;
}

export const settled = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const committed = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

const storesFor = (patch: LibraryPatch): string[] => [
  ...(patch.tracks || patch.playlists ? [TRACKS] : []),
  ...(patch.songs ? [SONGS] : []),
  ...(patch.albums || patch.albumPages ? [ALBUM_PAGES] : []),
];

const dropAllBut = (
  store: IDBObjectStore,
  kept: readonly { id: number }[],
): void => {
  const ids = new Set(kept.map((item) => item.id));
  const keys = store.getAllKeys();
  keys.onsuccess = () => {
    for (const key of keys.result as number[]) {
      if (!ids.has(key)) store.delete(key);
    }
  };
};

type StoredLater =
  | 'creator'
  | 'private'
  | 'playCount'
  | 'description'
  | 'tags'
  | 'creatorAvatarUrl';

type SongAddedLater =
  | 'trackNumber'
  | 'disc'
  | 'aliases'
  | 'translations'
  | 'publishedAt'
  | 'downloadSize';
type StoredSong = Omit<Song, SongAddedLater> &
  Partial<Pick<Song, SongAddedLater>>;

const songAddedLater = (song: StoredSong): Song => ({
  trackNumber: null,
  disc: null,
  aliases: [],
  translations: [],
  publishedAt: null,
  downloadSize: null,
  ...song,
});

type Lines = Extract<LyricsResponse, { lines: unknown }>;

type StoredDownloadBefore11 = Omit<
  StoredDownload,
  'song' | 'lyrics' | 'album' | 'sources'
> & {
  song: StoredSong;
  lyrics:
    | Exclude<LyricsResponse, Lines>
    | (Omit<Lines, 'yrc' | 'romalrc'> &
        Partial<Pick<Lines, 'yrc' | 'romalrc'>>);
  album?: StoredDownload['album'];
  sources?: DownloadSource[];
};

const downloadAddedIn11 = (
  download: StoredDownloadBefore11,
): StoredDownload => ({
  ...download,
  song: songAddedLater(download.song),
  lyrics:
    'lines' in download.lyrics
      ? { yrc: null, romalrc: null, ...download.lyrics }
      : download.lyrics,
  album: download.album ?? null,
  sources: download.sources ?? [{ kind: 'single' }],
});

const upgrade = (
  database: IDBDatabase,
  transaction: IDBTransaction,
  from: number,
): void => {
  if (from < 1) database.createObjectStore(SESSION);
  if (from < 2) {
    database.createObjectStore(LIBRARY);
    database.createObjectStore(TRACKS);
    database.createObjectStore(SONGS, { keyPath: 'id' });
  }
  if (from >= 2 && from < 12) {
    const library = transaction.objectStore(LIBRARY);
    const stored = library.get('playlists');
    stored.onsuccess = () => {
      const playlists = stored.result as
        | (Omit<Playlist, StoredLater> & Partial<Pick<Playlist, StoredLater>>)[]
        | undefined;
      if (playlists) {
        library.put(
          playlists.map(
            (playlist) =>
              ({
                creator: '',
                creatorAvatarUrl: null,
                private: false,
                playCount: 0,
                description: null,
                tags: [],
                ...playlist,
              }) satisfies Playlist,
          ),
          'playlists',
        );
      }
    };
  }
  if (from < 4) database.createObjectStore(ALBUM_PAGES);
  if (from >= 2 && from < 10) {
    transaction.objectStore(SONGS).clear();
    transaction.objectStore(ALBUM_PAGES).clear();
    const tracks = transaction.objectStore(TRACKS).openCursor();
    tracks.onsuccess = () => {
      const cursor = tracks.result;
      if (!cursor) return;
      cursor.update({
        ...(cursor.value as PlaylistTracks),
        complete: false,
      } satisfies PlaylistTracks);
      cursor.continue();
    };
  }
  if (from < 6) {
    database.createObjectStore(PLAYER);
    database.createObjectStore(SETTINGS);
  }
  if (from < 7) database.createObjectStore(CHECK_INS, { autoIncrement: true });
  if (from < 9) database.createObjectStore(DOWNLOADS);
  if (from >= 6 && from < 10) {
    const player = transaction.objectStore(PLAYER);
    const stored = player.get('queue');
    stored.onsuccess = () => {
      const queue = stored.result as
        | { entries: { song: StoredSong }[] }
        | undefined;
      if (queue) {
        player.put(
          {
            ...queue,
            entries: queue.entries.map((entry) => ({
              ...entry,
              song: songAddedLater(entry.song),
            })),
          },
          'queue',
        );
      }
    };
  }
  // 13 是已回滚的那一轮，只有当时打开过的设备停在 13
  if (from === 13) {
    database.deleteObjectStore('downloadQueue');
    database.deleteObjectStore('backgroundDownloads');
  }
  if (from < 15) {
    database.createObjectStore(DOWNLOAD_QUEUE);
    database.createObjectStore(DOWNLOAD_PARTS);
  }
};

export const createLocalDatabase = (indexedDB: IDBFactory): LocalDatabase => {
  let open: IDBDatabase | undefined;
  let opening: Promise<IDBDatabase> | undefined;
  const database = (): Promise<IDBDatabase> => {
    opening ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(NAME, VERSION);
      request.onupgradeneeded = (event) =>
        upgrade(request.result, request.transaction!, event.oldVersion);
      request.onsuccess = () => {
        open = request.result;
        // 别的标签页要升级时让开，否则会卡住；之后读写会失败，刷新就好
        open.onversionchange = () => open?.close();
        resolve(open);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        opening = undefined;
        reject(
          new Error(
            '另一个标签页还开着旧版本的 Campanula，本机数据库没法升级：关掉或刷新那个标签页再试',
          ),
        );
      };
    });
    return opening;
  };

  return {
    open: database,
    async write(stores, change) {
      const transaction = (await database()).transaction(stores, 'readwrite');
      change(transaction);
      await committed(transaction);
    },
  };
};

export const createLocalDb = (db: LocalDatabase): LocalDb => {
  const write = (
    stores: string[],
    change: (transaction: IDBTransaction) => void,
  ): Promise<void> => db.write(stores, change);

  const writeLibrary = async (
    owner: number,
    stores: string[],
    change: (transaction: IDBTransaction) => void,
  ): Promise<boolean> => {
    const transaction = (await db.open()).transaction(
      [LIBRARY, ...stores],
      'readwrite',
    );
    const current = transaction.objectStore(LIBRARY).get('owner');
    let mine = false;
    current.onsuccess = () => {
      mine = current.result === owner;
      if (mine) change(transaction);
    };
    await committed(transaction);
    return mine;
  };

  const clearLibrary = (transaction: IDBTransaction) => {
    for (const store of LIBRARY_STORES) transaction.objectStore(store).clear();
  };

  const changeDownloadSources = async (
    songIds: readonly number[],
    change: (sources: readonly DownloadSource[]) => DownloadSource[],
  ): Promise<ReadonlyMap<number, DownloadSource[]>> => {
    const changed = new Map<number, DownloadSource[]>();
    await write([DOWNLOADS], (transaction) => {
      const store = transaction.objectStore(DOWNLOADS);
      for (const songId of songIds) {
        const stored = store.get(songId);
        stored.onsuccess = () => {
          if (!stored.result) return;
          const download = downloadAddedIn11(
            stored.result as StoredDownloadBefore11,
          );
          const next = change(download.sources);
          changed.set(songId, next);
          store.put(
            {
              ...download,
              sources: next,
            },
            songId,
          );
        };
      }
    });
    return changed;
  };

  return {
    async pendingLogout() {
      const store = (await db.open()).transaction(SESSION).objectStore(SESSION);
      return (await settled(store.get('pendingLogout'))) === true;
    },
    setPendingLogout: (pending) =>
      write([SESSION], (transaction) => {
        const store = transaction.objectStore(SESSION);
        if (pending) store.put(true, 'pendingLogout');
        else store.delete('pendingLogout');
      }),
    async cachedAccount() {
      const store = (await db.open()).transaction(SESSION).objectStore(SESSION);
      return (
        ((await settled(store.get('account'))) as Account | undefined) ?? null
      );
    },
    setCachedAccount: (account) =>
      write([SESSION], (transaction) => {
        const store = transaction.objectStore(SESSION);
        if (account) store.put(account, 'account');
        else store.delete('account');
      }),
    async readLibrary() {
      const transaction = (await db.open()).transaction(LIBRARY_STORES);
      const library = transaction.objectStore(LIBRARY);
      const [
        owner,
        hearts,
        playlists,
        collectedAlbums,
        collectedArtists,
        firstSyncDone,
        trackKeys,
        trackValues,
        songs,
        albumKeys,
        albumValues,
      ] = await Promise.all([
        settled(library.get('owner')) as Promise<number | undefined>,
        settled(library.get('hearts')) as Promise<number[] | undefined>,
        settled(library.get('playlists')) as Promise<Playlist[] | undefined>,
        settled(library.get('collectedAlbums')) as Promise<
          CollectedAlbum[] | undefined
        >,
        settled(library.get('collectedArtists')) as Promise<
          CollectedArtist[] | undefined
        >,
        settled(library.get('firstSyncDone')) as Promise<true | undefined>,
        settled(transaction.objectStore(TRACKS).getAllKeys()) as Promise<
          number[]
        >,
        settled(transaction.objectStore(TRACKS).getAll()) as Promise<
          PlaylistTracks[]
        >,
        settled(transaction.objectStore(SONGS).getAll()) as Promise<Song[]>,
        settled(transaction.objectStore(ALBUM_PAGES).getAllKeys()) as Promise<
          number[]
        >,
        settled(transaction.objectStore(ALBUM_PAGES).getAll()) as Promise<
          AlbumResponse[]
        >,
      ]);
      if (owner === undefined) return null;
      return {
        owner,
        hearts: hearts ?? null,
        playlists: playlists ?? null,
        tracks: new Map(
          trackKeys.map((key, index) => [key, trackValues[index]]),
        ),
        songs: new Map(songs.map((song) => [song.id, song])),
        albums: collectedAlbums ?? null,
        artists: collectedArtists ?? null,
        albumPages: new Map(
          albumKeys.map((key, index) => [key, albumValues[index]]),
        ),
        firstSyncDone: firstSyncDone === true,
      };
    },
    resetLibrary: (owner) =>
      write(LIBRARY_STORES, (transaction) => {
        clearLibrary(transaction);
        transaction.objectStore(LIBRARY).put(owner, 'owner');
      }),
    deleteLibrary: () => write(LIBRARY_STORES, clearLibrary),
    async pendingChanges(owner) {
      const store = (await db.open()).transaction(LIBRARY).objectStore(LIBRARY);
      const [storedOwner, pending] = await Promise.all([
        settled(store.get('owner')) as Promise<number | undefined>,
        settled(store.get('pendingChanges')) as Promise<number[] | undefined>,
      ]);
      return storedOwner === owner ? (pending ?? []) : [];
    },
    addPendingChange: (owner, playlistId) =>
      writeLibrary(owner, [], (transaction) => {
        const store = transaction.objectStore(LIBRARY);
        const stored = store.get('pendingChanges');
        stored.onsuccess = () => {
          const ids = (stored.result as number[] | undefined) ?? [];
          if (!ids.includes(playlistId))
            store.put([...ids, playlistId], 'pendingChanges');
        };
      }),
    removePendingChange: (owner, playlistId) =>
      writeLibrary(owner, [], (transaction) => {
        const store = transaction.objectStore(LIBRARY);
        const stored = store.get('pendingChanges');
        stored.onsuccess = () => {
          const ids = (stored.result as number[] | undefined) ?? [];
          const kept = ids.filter((id) => id !== playlistId);
          if (kept.length > 0) store.put(kept, 'pendingChanges');
          else store.delete('pendingChanges');
        };
      }),
    saveLibrary: (owner, patch) =>
      writeLibrary(owner, storesFor(patch), (transaction) => {
        const library = transaction.objectStore(LIBRARY);
        if (patch.hearts) library.put(patch.hearts, 'hearts');
        if (patch.artists) library.put(patch.artists, 'collectedArtists');
        if (patch.firstSyncDone) library.put(true, 'firstSyncDone');
        if (patch.songs) {
          const songs = transaction.objectStore(SONGS);
          for (const song of patch.songs) songs.put(song);
        }
        if (patch.tracks || patch.playlists) {
          const tracks = transaction.objectStore(TRACKS);
          for (const [id, playlistTracks] of patch.tracks ?? [])
            tracks.put(playlistTracks, id);
          if (patch.playlists) {
            library.put(patch.playlists, 'playlists');
            dropAllBut(tracks, patch.playlists);
          }
        }
        if (patch.albums || patch.albumPages) {
          const pages = transaction.objectStore(ALBUM_PAGES);
          if (patch.albums) library.put(patch.albums, 'collectedAlbums');
          const collected = library.get('collectedAlbums');
          collected.onsuccess = () => {
            const albums =
              (collected.result as CollectedAlbum[] | undefined) ?? [];
            for (const [id, page] of patch.albumPages ?? []) {
              if (albums.some((album) => album.id === id)) pages.put(page, id);
            }
            dropAllBut(pages, albums);
          };
        }
      }),
    async playQuality() {
      const store = (await db.open())
        .transaction(SETTINGS)
        .objectStore(SETTINGS);
      const quality = (await settled(store.get('playQuality'))) as
        | Quality
        | undefined;
      return quality ?? null;
    },
    savePlayQuality: (quality) =>
      write([SETTINGS], (transaction) =>
        transaction.objectStore(SETTINGS).put(quality, 'playQuality'),
      ),
    async downloadQuality() {
      const store = (await db.open())
        .transaction(SETTINGS)
        .objectStore(SETTINGS);
      const quality = (await settled(store.get('downloadQuality'))) as
        | Quality
        | undefined;
      return quality ?? null;
    },
    saveDownloadQuality: (quality) =>
      write([SETTINGS], (transaction) =>
        transaction.objectStore(SETTINGS).put(quality, 'downloadQuality'),
      ),
    async volume() {
      const store = (await db.open())
        .transaction(SETTINGS)
        .objectStore(SETTINGS);
      const volume = (await settled(store.get('volume'))) as number | undefined;
      return volume ?? null;
    },
    saveVolume: (volume) =>
      write([SETTINGS], (transaction) =>
        transaction.objectStore(SETTINGS).put(volume, 'volume'),
      ),
    async searchHistory() {
      const store = (await db.open())
        .transaction(SETTINGS)
        .objectStore(SETTINGS);
      const history = (await settled(store.get('searchHistory'))) as
        | string[]
        | undefined;
      return history ?? [];
    },
    async changeSearchHistory(change) {
      let changed: string[] = [];
      await write([SETTINGS], (transaction) => {
        const store = transaction.objectStore(SETTINGS);
        const stored = store.get('searchHistory');
        stored.onsuccess = () => {
          changed = change((stored.result as string[] | undefined) ?? []);
          store.put(changed, 'searchHistory');
        };
      });
      return changed;
    },
    async readDownloads() {
      const store = (await db.open())
        .transaction(DOWNLOADS)
        .objectStore(DOWNLOADS);
      return ((await settled(store.getAll())) as StoredDownloadBefore11[]).map(
        downloadAddedIn11,
      );
    },
    saveDownload: (download) =>
      write([DOWNLOADS, DOWNLOAD_QUEUE, DOWNLOAD_PARTS], (transaction) => {
        const songId = download.song.id;
        transaction.objectStore(DOWNLOADS).put(download, songId);
        transaction.objectStore(DOWNLOAD_QUEUE).delete(songId);
        const parts = transaction.objectStore(DOWNLOAD_PARTS);
        const cursor = parts.openCursor();
        cursor.onsuccess = () => {
          const current = cursor.result;
          if (!current) return;
          if ((current.key as [number, number])[0] === songId) current.delete();
          current.continue();
        };
      }),
    addDownloadSources: (songIds, sources) =>
      changeDownloadSources(songIds, (existing) =>
        mergeDownloadSources(existing, sources),
      ),
    removeDownloadSource: (songIds, source) =>
      changeDownloadSources(songIds, (existing) =>
        existing.filter((each) => !sameDownloadSource(each, source)),
      ),
    deleteDownloads: (songIds) =>
      write([DOWNLOADS], (transaction) => {
        for (const songId of songIds)
          transaction.objectStore(DOWNLOADS).delete(songId);
      }),
    async readQueuedDownloads() {
      const store = (await db.open())
        .transaction(DOWNLOAD_QUEUE)
        .objectStore(DOWNLOAD_QUEUE);
      const queued = (await settled(store.getAll())) as QueuedDownload[];
      return queued.sort((a, b) => a.order - b.order);
    },
    saveQueuedDownloads: (entries) =>
      write([DOWNLOAD_QUEUE], (transaction) => {
        const store = transaction.objectStore(DOWNLOAD_QUEUE);
        for (const queued of entries) store.put(queued, queued.song.id);
      }),
    deleteQueuedDownloads: (songIds) =>
      write([DOWNLOAD_QUEUE], (transaction) => {
        for (const songId of songIds)
          transaction.objectStore(DOWNLOAD_QUEUE).delete(songId);
      }),
    async readDownloadParts() {
      const store = (await db.open())
        .transaction(DOWNLOAD_PARTS)
        .objectStore(DOWNLOAD_PARTS);
      const [keys, blobs] = await Promise.all([
        settled(store.getAllKeys()) as Promise<[number, number][]>,
        settled(store.getAll()) as Promise<Blob[]>,
      ]);
      return keys.map(([songId, index], position) => ({
        songId,
        index,
        blob: blobs[position]!,
      }));
    },
    appendDownloadPart: (songId, index, blob) =>
      write([DOWNLOAD_PARTS], (transaction) => {
        transaction.objectStore(DOWNLOAD_PARTS).put(blob, [songId, index]);
      }),
    deleteDownloadParts: (songIds) =>
      write([DOWNLOAD_PARTS], (transaction) => {
        const store = transaction.objectStore(DOWNLOAD_PARTS);
        const ids = new Set(songIds);
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const current = cursor.result;
          if (!current) return;
          const [songId] = current.key as [number, number];
          if (ids.has(songId)) current.delete();
          current.continue();
        };
      }),
  };
};
