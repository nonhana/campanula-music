import { endpoints } from '#lib/api/endpoints.js';
import type { AlbumResponse, Song } from '#lib/api/library.js';
import { thumbnailUrl } from '#lib/api/library.js';
import type { LyricsResponse, Quality } from '#lib/api/playback.js';
import { DOWNLOAD_QUALITY } from '#lib/api/playback.js';

import type { Api, Result } from './api-client';
import type { BrowserCapabilities, Clock } from './browser';
import type {
  DownloadSource,
  LocalDb,
  QueuedDownload,
  StoredDownload,
  StoredPart,
} from './local';
import { mergeDownloadSources, sameDownloadSource } from './local';
import type { Notices } from './notice';
import { plainSong } from './plain';
import type {
  BackgroundFailure,
  BackgroundSessionResult,
  SessionRound,
} from './session-round';

export type { DownloadSource };

const DOWNLOAD_COVER_SIZE = 512;

const recordBytes = (record: StoredDownload): number =>
  record.audio.size + (record.cover?.size ?? 0);

export type DownloadFailure =
  | { kind: 'request'; failure: BackgroundFailure }
  | { kind: 'unavailable' }
  | { kind: 'interrupted' }
  | { kind: 'saveFailed' }
  | { kind: 'appError' };

export type DownloadTask =
  | {
      status: 'queued';
      song: Song;
      sources: readonly DownloadSource[];
      received: number;
      total: number | null;
    }
  | {
      status: 'downloading';
      song: Song;
      sources: readonly DownloadSource[];
      received: number;
      total: number | null;
    }
  | {
      status: 'failed';
      song: Song;
      sources: readonly DownloadSource[];
      received: number;
      total: number | null;
      failure: DownloadFailure;
    };

export type DownloadNotice =
  | {
      kind: 'downloadFailed';
      song: Song;
      failure: DownloadFailure;
      count?: number;
    }
  | {
      kind: 'downloadsSkipped';
      downloaded: number;
      trial: number;
      noCopyright: number;
    }
  | { kind: 'downloadsPaused' }
  | { kind: 'downloadsRemoved'; removed: number; kept: number };

export interface DownloadsState {
  songs: readonly Song[] | null;
  tasks: ReadonlyMap<number, DownloadTask>;
  paused: 'storageFull' | null;
  quality: Quality;
  bytes: number;
  has: (songId: number) => boolean;
  coverOf: (coverUrl: string) => string | null;
  sourcesOf: (songId: number) => readonly DownloadSource[];
  sizeOf: (songId: number) => number;
}

export type DownloadBlock =
  | 'downloaded'
  | 'queued'
  | 'downloading'
  | 'trial'
  | 'noCopyright'
  | 'signedOut'
  | 'offline';

export type DownloadStartBlock = Extract<
  DownloadBlock,
  'signedOut' | 'offline'
>;

export interface DownloadRemoval {
  removed: number;
  kept: number;
  freed: number;
}

export interface DownloadBatchOutcome {
  queued: number;
  downloaded: number;
  trial: number;
  noCopyright: number;
}

export const downloadBlock = (
  song: Song,
  downloads: DownloadsState,
  { signedIn, online }: { signedIn: boolean; online: boolean },
): DownloadBlock | null => {
  if (downloads.has(song.id)) return 'downloaded';
  const task = downloads.tasks.get(song.id);
  if (task?.status === 'downloading') return 'downloading';
  if (task?.status === 'queued') return 'queued';
  if (song.availability !== 'full') return song.availability;
  if (!signedIn) return 'signedOut';
  return online ? null : 'offline';
};

export const INITIAL_DOWNLOADS: DownloadsState = {
  songs: null,
  tasks: new Map(),
  paused: null,
  quality: DOWNLOAD_QUALITY,
  bytes: 0,
  has: () => false,
  coverOf: () => null,
  sourcesOf: () => [],
  sizeOf: () => 0,
};

export interface DownloadsContext {
  api: Api;
  session: SessionRound;
  local: LocalDb;
  clock: Clock;
  browser: Pick<
    BrowserCapabilities,
    'download' | 'objectUrl' | 'revokeObjectUrl' | 'locks' | 'page'
  >;
  storage: Pick<BrowserCapabilities['storage'], 'estimate' | 'persist'>;
  albumPage: (albumId: number) => AlbumResponse | null;
  online: () => boolean;
  signedIn: () => boolean;
  write: (downloads: DownloadsState) => void;
  notices: Pick<Notices, 'show' | 'hideWhere'>;
  changed: () => void;
}

export interface Downloads {
  load: () => Promise<void>;
  download: (song: Song) => DownloadBlock | null;
  add: (
    songs: readonly Song[],
    source: DownloadSource,
    options?: { quiet?: boolean },
  ) => Promise<DownloadBatchOutcome | DownloadStartBlock>;
  retry: (songId: number) => boolean;
  cancel: (songId: number) => boolean;
  cancelAll: () => void;
  wake: () => void;
  resume: () => void;
  remove: (songIds: readonly number[]) => Promise<DownloadRemoval>;
  removePlaylist: (playlistId: number) => Promise<DownloadRemoval>;
  clear: () => Promise<DownloadRemoval>;
  setQuality: (quality: Quality) => void;
  stored: (songId: number) => StoredDownload;
  audioUrl: (songId: number) => string;
  lyricsOf: (songId: number) => LyricsResponse | null;
}

const storageFull = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'QuotaExceededError';

const UNKNOWN_PROGRESS_BYTES = 64 * 1024;
const UNKNOWN_PROGRESS_MS = 500;

const PART_BYTES = 1024 * 1024;

const DOWNLOAD_QUEUE_LOCK = 'campanula-download-queue';

interface Prepared {
  url: string;
  lyrics: LyricsResponse;
  album: AlbumResponse['album'] | null;
  size: number | null;
}

type PreparedResult =
  | { kind: 'ready'; value: Prepared }
  | { kind: 'wait' }
  | { kind: 'failed'; failure: DownloadFailure };

type StepResult = 'next' | 'wait';

export const createDownloads = (context: DownloadsContext): Downloads => {
  const { api, session, local, clock, browser } = context;
  let records: Map<number, StoredDownload> | null = null;
  let songs: readonly Song[] | null = null;
  let covers = new Map<string, Blob>();
  const tasks = new Map<number, DownloadTask>();
  let paused: 'storageFull' | null = null;
  let quality: Quality = DOWNLOAD_QUALITY;
  let bytes = 0;
  let persistAsked = false;
  const attempts = new Map<number, number>();
  const aborts = new Map<number, AbortController>();
  const parts = new Map<number, BlobPart[]>();
  const partBytes = new Map<number, number>();
  const audioDone = new Set<number>();
  const audioTypes = new Map<number, string>();
  const ready = new Map<number, StoredDownload>();
  const orders = new Map<number, number>();
  let nextOrder = 1;
  let leader = false;
  let queueLock: Promise<boolean> | undefined;
  const unsaved = new Map<number, Uint8Array<ArrayBuffer>[]>();
  const unsavedBytes = new Map<number, number>();
  const storedIndex = new Map<number, number>();
  // 分段写入按每首串成链，一首同时只写一段：删除排在其后，否则删完又被写回来
  const partChains = new Map<number, Promise<void>>();
  const partWrites = new Set<number>();
  const brokenParts = new Set<number>();
  // 换文件从头下、丢掉断点时加一：之前排着的写入发现对不上就不写了
  const partEpochs = new Map<number, number>();
  // 传输期间页面藏起来过：这一趟断开不算失败
  const hiddenWhileDownloading = new Set<number>();
  let pageHidden = browser.page.visibilityState === 'hidden';
  const owned = new Set<number>();
  let running = false;
  let again = false;
  let loading: Promise<void> | undefined;
  const audioUrls = new Map<number, string>();
  const coverUrls = new Map<string, string>();
  const albums = new Map<number, Promise<AlbumResponse['album'] | null>>();

  const recordOf = (songId: number): StoredDownload => {
    const record = records?.get(songId);
    if (!record) throw new Error(`这台设备上没有下载 ${songId}`);
    return record;
  };

  const setRecords = (next: Map<number, StoredDownload>): void => {
    records = next;
    const stored = [...next.values()];
    songs = stored
      .sort((a, b) => b.downloadedAt - a.downloadedAt)
      .map((record) => record.song);
    bytes = stored.reduce((sum, record) => sum + recordBytes(record), 0);
    covers = new Map(
      [...next.values()].flatMap(({ song, cover }) =>
        song.album.coverUrl !== null && cover !== null
          ? [[song.album.coverUrl, cover] as const]
          : [],
      ),
    );
  };

  const coverOf = (coverUrl: string): string | null => {
    const cover = covers.get(coverUrl);
    if (!cover) return null;
    let url = coverUrls.get(coverUrl);
    if (!url) {
      url = browser.objectUrl(cover);
      coverUrls.set(coverUrl, url);
    }
    return url;
  };

  const current = (): DownloadsState => {
    const shown = records;
    return {
      songs,
      tasks,
      paused,
      quality,
      bytes,
      has: (songId) => shown?.has(songId) ?? false,
      coverOf,
      sourcesOf: (songId) => shown?.get(songId)?.sources ?? [],
      sizeOf: (songId) => recordBytes(recordOf(songId)),
    };
  };

  const publish = (): void => {
    context.write(current());
  };

  const setTask = (songId: number, task: DownloadTask): void => {
    tasks.set(songId, task);
    publish();
  };

  const chainPartWrite = (
    songId: number,
    work: () => Promise<void>,
  ): Promise<void> => {
    const previous = partChains.get(songId) ?? Promise.resolve();
    const next = previous.then(work).catch((error: unknown) => {
      console.error('下载的断点没能写进这台设备', error);
    });
    partChains.set(songId, next);
    return next;
  };

  const forgetParts = (songId: number): void => {
    parts.delete(songId);
    partBytes.delete(songId);
    audioTypes.delete(songId);
    audioDone.delete(songId);
    unsaved.delete(songId);
    unsavedBytes.delete(songId);
    storedIndex.delete(songId);
    brokenParts.delete(songId);
    partEpochs.set(songId, (partEpochs.get(songId) ?? 0) + 1);
  };

  const clearParts = (songId: number): void => {
    forgetParts(songId);
    if (owns(songId))
      chainPartWrite(songId, () => local.deleteDownloadParts([songId]));
  };

  const chunksOf = (songId: number): BlobPart[] => {
    let chunks = parts.get(songId);
    if (!chunks) {
      chunks = [];
      parts.set(songId, chunks);
    }
    return chunks;
  };

  const receivedOf = (songId: number): number => partBytes.get(songId) ?? 0;

  const owns = (songId: number): boolean => leader || owned.has(songId);

  const flushParts = (songId: number): void => {
    if (
      !owns(songId) ||
      paused ||
      brokenParts.has(songId) ||
      partWrites.has(songId)
    )
      return;
    const chunks = unsaved.get(songId);
    if (!chunks || chunks.length === 0) return;
    unsaved.delete(songId);
    unsavedBytes.delete(songId);
    const blob = new Blob(chunks);
    const index = storedIndex.get(songId) ?? 0;
    const epoch = partEpochs.get(songId) ?? 0;
    const keep = (): void => {
      const rest = unsaved.get(songId) ?? [];
      unsaved.set(songId, [...chunks, ...rest]);
      unsavedBytes.set(songId, (unsavedBytes.get(songId) ?? 0) + blob.size);
    };
    partWrites.add(songId);
    void chainPartWrite(songId, async () => {
      if (epoch !== (partEpochs.get(songId) ?? 0)) return;
      if (!(await enoughSpace(blob.size))) {
        keep();
        pause();
        return;
      }
      try {
        await local.appendDownloadPart(songId, index, blob);
      } catch (error) {
        if (storageFull(error)) {
          keep();
          pause();
          return;
        }
        console.error('下载的断点没能写进这台设备', error);
        brokenParts.add(songId);
        unsaved.delete(songId);
        unsavedBytes.delete(songId);
        partEpochs.set(songId, (partEpochs.get(songId) ?? 0) + 1);
        storedIndex.delete(songId);
        chainPartWrite(songId, () => local.deleteDownloadParts([songId]));
        return;
      }
      if (epoch !== (partEpochs.get(songId) ?? 0)) return;
      storedIndex.set(songId, index + 1);
    }).finally(() => {
      partWrites.delete(songId);
      flushParts(songId);
    });
  };

  const flushAllParts = (): void => {
    for (const songId of [...unsaved.keys()]) flushParts(songId);
  };

  const append = (songId: number, chunk: Uint8Array<ArrayBuffer>): void => {
    if (!tasks.has(songId)) return;
    chunksOf(songId).push(chunk);
    partBytes.set(songId, receivedOf(songId) + chunk.byteLength);
    if (!owns(songId) || brokenParts.has(songId)) return;
    const buffered = unsaved.get(songId) ?? [];
    buffered.push(chunk);
    unsaved.set(songId, buffered);
    const size = (unsavedBytes.get(songId) ?? 0) + chunk.byteLength;
    unsavedBytes.set(songId, size);
    if (size >= PART_BYTES) flushParts(songId);
  };

  const liveSources = (
    songId: number,
    fallback: readonly DownloadSource[],
  ): readonly DownloadSource[] => tasks.get(songId)?.sources ?? fallback;

  const queuedTask = (
    song: Song,
    sources: readonly DownloadSource[],
    received = 0,
    total: number | null = null,
  ): DownloadTask => ({
    status: 'queued',
    song,
    sources,
    received,
    total,
  });
  const downloadingTask = (
    song: Song,
    sources: readonly DownloadSource[],
    received: number,
    total: number | null,
  ): DownloadTask => ({
    status: 'downloading',
    song,
    sources,
    received,
    total,
  });
  const failedTask = (
    song: Song,
    sources: readonly DownloadSource[],
    received: number,
    total: number | null,
    failure: DownloadFailure,
  ): DownloadTask => ({
    status: 'failed',
    song,
    sources,
    received,
    total,
    failure,
  });

  const saveQueued = (songIds: readonly number[]): void => {
    const entries: QueuedDownload[] = [];
    for (const songId of songIds) {
      const task = tasks.get(songId);
      if (!task || task.status === 'failed') continue;
      owned.add(songId);
      let order = orders.get(songId);
      if (order === undefined) {
        order = nextOrder;
        nextOrder += 1;
        orders.set(songId, order);
      }
      entries.push({
        song: task.song,
        sources: [...task.sources],
        order,
        total: task.total,
        audioComplete: audioDone.has(songId),
        audioType: audioTypes.get(songId) ?? null,
      });
    }
    if (entries.length === 0) return;
    void local
      .saveQueuedDownloads(entries)
      .catch((error: unknown) =>
        console.error('排队中的下载没能写进这台设备', error),
      );
  };

  const queuedIdsOf = (songIds: readonly number[]): number[] =>
    leader ? [...songIds] : songIds.filter((songId) => owned.has(songId));

  const deleteQueued = (songIds: readonly number[]): void => {
    const ids = queuedIdsOf(songIds);
    if (ids.length === 0) return;
    void local
      .deleteQueuedDownloads(ids)
      .catch((error: unknown) =>
        console.error('排队中的下载没能从这台设备删掉', error),
      );
  };

  const fail = (
    song: Song,
    sources: readonly DownloadSource[],
    failure: DownloadFailure,
    { keepParts = false } = {},
  ): StepResult => {
    const received = keepParts ? receivedOf(song.id) : 0;
    if (!keepParts) clearParts(song.id);
    const task = failedTask(
      song,
      tasks.get(song.id)?.sources ?? sources,
      received,
      tasks.get(song.id)?.total ?? null,
      failure,
    );
    tasks.set(song.id, task);
    orders.delete(song.id);
    deleteQueued([song.id]);
    publish();
    context.notices.show({
      kind: 'downloadFailed',
      song,
      failure,
    });
    return 'next';
  };

  const pause = (): void => {
    if (paused) return;
    paused = 'storageFull';
    publish();
    context.notices.show({ kind: 'downloadsPaused' });
  };

  const askPersist = (): void => {
    if (persistAsked) return;
    persistAsked = true;
    void context.storage.persist().catch(() => {});
  };

  const attemptOf = (songId: number): number => attempts.get(songId) ?? 0;

  const forgetAttempt = (songId: number): void => {
    attempts.set(songId, attemptOf(songId) + 1);
  };

  const dropTasks = (songIds: readonly number[]): void => {
    for (const songId of songIds) {
      forgetAttempt(songId);
      aborts.get(songId)?.abort();
      aborts.delete(songId);
      tasks.delete(songId);
      ready.delete(songId);
      orders.delete(songId);
      forgetParts(songId);
    }
    const storedIds = queuedIdsOf(songIds);
    deleteQueued(storedIds);
    for (const songId of storedIds) owned.delete(songId);
    if (storedIds.length === 0) return;
    const waiting = storedIds
      .map((songId) => partChains.get(songId))
      .filter((chain): chain is Promise<void> => chain !== undefined);
    const remove = () =>
      local
        .deleteDownloadParts(storedIds)
        .catch((error: unknown) =>
          console.error('下载的断点没能从这台设备删掉', error),
        );
    if (waiting.length === 0) void remove();
    else void Promise.allSettled(waiting).then(remove);
  };

  const hideSongNotices = (songId: number): void => {
    context.notices.hideWhere(
      (notice) =>
        notice.kind === 'downloadFailed' &&
        notice.song.id === songId &&
        (notice.count ?? 1) === 1,
    );
  };

  const background = <T>(
    send: () => Promise<Result<T>>,
  ): Promise<BackgroundSessionResult<T> | 'gaveUp'> =>
    session.background(send, () => {});

  const albumOf = (song: Song): Promise<AlbumResponse['album'] | null> => {
    const id = song.album.id;
    if (!id) return Promise.resolve(null);
    const page = context.albumPage(id);
    if (page) return Promise.resolve(page.album);
    let album = albums.get(id);
    if (!album) {
      album = background(() => api.get(endpoints.album, { id })).then(
        (result) =>
          result && result !== 'gaveUp' && result.ok
            ? result.value.album
            : null,
      );
      albums.set(id, album);
      void album.then((got) => {
        if (!got) albums.delete(id);
      });
    }
    return album;
  };

  const prepare = async (song: Song): Promise<PreparedResult> => {
    const [url, lyrics, album] = await Promise.all([
      background(() =>
        api.get(endpoints.downloadUrl, { id: song.id, quality }),
      ),
      background(() => api.get(endpoints.lyrics, { id: song.id })),
      albumOf(song),
    ]);
    if (!url || !lyrics || url === 'gaveUp' || lyrics === 'gaveUp')
      return { kind: 'wait' };
    if (!url.ok) {
      return {
        kind: 'failed',
        failure: { kind: 'request', failure: url.failure },
      };
    }
    if (!lyrics.ok) {
      return {
        kind: 'failed',
        failure: { kind: 'request', failure: lyrics.failure },
      };
    }
    if (!url.value.downloadable) {
      return {
        kind: 'failed',
        failure: { kind: 'unavailable' },
      };
    }
    return {
      kind: 'ready',
      value: {
        url: url.value.url,
        lyrics: lyrics.value,
        album,
        size: url.value.size,
      },
    };
  };

  const enoughSpace = async (bytes: number): Promise<boolean> => {
    let estimate;
    try {
      estimate = await context.storage.estimate();
    } catch {
      return true;
    }
    if (estimate.usage === null || estimate.quota === null) return true;
    return estimate.quota - estimate.usage >= bytes;
  };

  const save = async (
    songId: number,
    record: StoredDownload,
    token: number,
  ): Promise<StepResult> => {
    clearParts(songId);
    await partChains.get(songId);
    const space = await enoughSpace(recordBytes(record));
    if (attemptOf(songId) !== token || !tasks.has(songId)) return 'next';
    if (!space) {
      ready.set(songId, record);
      const task = tasks.get(songId);
      if (task)
        setTask(
          songId,
          queuedTask(
            task.song,
            task.sources,
            record.audio.size,
            record.audio.size,
          ),
        );
      saveQueued([songId]);
      pause();
      return 'wait';
    }
    try {
      await local.saveDownload(record);
    } catch (error) {
      if (attemptOf(songId) !== token || !tasks.has(songId)) return 'next';
      if (storageFull(error)) {
        ready.set(songId, record);
        const task = tasks.get(songId);
        if (task) {
          setTask(
            songId,
            queuedTask(
              task.song,
              task.sources,
              record.audio.size,
              record.audio.size,
            ),
          );
          saveQueued([songId]);
        }
        pause();
        return 'wait';
      }
      console.error('下载没能存进这台设备', error);
      ready.set(songId, record);
      return fail(record.song, record.sources, { kind: 'saveFailed' });
    }
    if (attemptOf(songId) !== token || !tasks.has(songId)) {
      await local.deleteDownloads([songId]).catch(() => {});
      return 'next';
    }
    const sources = liveSources(songId, record.sources);
    const saved = {
      ...record,
      sources: [...sources],
    };
    setRecords(new Map(records).set(songId, saved));
    tasks.delete(songId);
    ready.delete(songId);
    clearParts(songId);
    orders.delete(songId);
    deleteQueued([songId]);
    owned.delete(songId);
    publish();
    context.changed();
    return 'next';
  };

  const step = async (songId: number): Promise<StepResult> => {
    const task = tasks.get(songId);
    if (!task || task.status !== 'queued') return 'next';
    const { song } = task;
    const sources = task.sources;
    const token = attemptOf(songId);
    const waiting = ready.get(songId);
    if (waiting) {
      if (attemptOf(songId) !== token) return 'next';
      return await save(songId, waiting, token);
    }
    if (!context.signedIn() || !context.online()) return 'wait';
    const anySpace = await enoughSpace(1);
    if (attemptOf(songId) !== token || !tasks.has(songId)) {
      clearParts(songId);
      return 'next';
    }
    if (!anySpace) {
      pause();
      return 'wait';
    }

    const prepared = await prepare(song);
    if (attemptOf(songId) !== token || !tasks.has(songId)) {
      clearParts(songId);
      return 'next';
    }
    if (prepared.kind === 'wait') return 'wait';
    if (prepared.kind === 'failed')
      return fail(song, sources, prepared.failure, {
        keepParts: prepared.failure.kind === 'request',
      });
    const { url, lyrics, album, size } = prepared.value;

    let audioComplete = audioDone.has(songId);
    let received = receivedOf(songId);
    const total = size ?? task.total;
    if (
      size !== null &&
      ((task.total !== null && task.total !== size) ||
        (!audioComplete && received >= size))
    ) {
      clearParts(songId);
      audioComplete = false;
      received = 0;
    }
    tasks.set(
      songId,
      queuedTask(song, liveSources(songId, sources), received, total),
    );
    saveQueued([songId]);
    publish();

    let remaining = 0;
    if (total !== null) remaining = Math.max(total - received, 0);
    const roomForAll = total === null || (await enoughSpace(remaining));
    if (attemptOf(songId) !== token || !tasks.has(songId)) {
      clearParts(songId);
      return 'next';
    }
    if (!roomForAll) {
      pause();
      return 'wait';
    }

    const coverUrl = song.album.coverUrl;
    const coverChunks: Uint8Array<ArrayBuffer>[] = [];
    let shown = received;
    let shownAt = clock.now();
    let downloadedType = audioTypes.get(songId) ?? '';

    const show = (next: number): void => {
      const live = tasks.get(songId);
      if (!live) return;
      if (total === null) {
        if (
          next - shown < UNKNOWN_PROGRESS_BYTES &&
          clock.now() - shownAt < UNKNOWN_PROGRESS_MS
        )
          return;
        shown = next;
        shownAt = clock.now();
        setTask(songId, downloadingTask(song, live.sources, next, null));
        return;
      }
      const percent = Math.floor((next * 100) / total);
      if (percent === Math.floor((shown * 100) / total) && next !== total)
        return;
      shown = next;
      setTask(songId, downloadingTask(song, live.sources, next, total));
    };

    const live = tasks.get(songId);
    setTask(
      songId,
      downloadingTask(song, live?.sources ?? sources, received, total),
    );
    hiddenWhileDownloading.delete(songId);
    if (pageHidden) hiddenWhileDownloading.add(songId);

    const abort = new AbortController();
    aborts.set(songId, abort);
    const transferAudio = audioComplete
      ? Promise.resolve()
      : browser
          .download(
            url,
            (chunk) => {
              append(songId, chunk);
              show(receivedOf(songId));
            },
            {
              from: received,
              signal: abort.signal,
              restart: () => {
                clearParts(songId);
                shown = 0;
                shownAt = clock.now();
                const restarted = tasks.get(songId);
                if (restarted)
                  setTask(
                    songId,
                    downloadingTask(song, restarted.sources, 0, total),
                  );
                saveQueued([songId]);
              },
            },
          )
          .then(({ type }) => {
            downloadedType = type;
            audioTypes.set(songId, type);
            audioDone.add(songId);
            saveQueued([songId]);
          });
    const transferCover =
      coverUrl === null
        ? Promise.resolve({ type: '' })
        : browser.download(
            thumbnailUrl(coverUrl, DOWNLOAD_COVER_SIZE),
            (chunk) => coverChunks.push(chunk),
            { signal: abort.signal },
          );

    const requeue = (): StepResult => {
      setTask(
        songId,
        queuedTask(
          song,
          liveSources(songId, sources),
          receivedOf(songId),
          tasks.get(songId)?.total ?? total,
        ),
      );
      return 'wait';
    };

    const [audioResult, coverResult] = await Promise.allSettled([
      transferAudio,
      transferCover,
    ]).finally(() => {
      if (aborts.get(songId) === abort) aborts.delete(songId);
    });

    if (attemptOf(songId) !== token || !tasks.has(songId)) {
      clearParts(songId);
      return 'next';
    }
    if (audioResult.status === 'rejected') {
      if (!context.online()) return requeue();
      if (hiddenWhileDownloading.delete(songId)) return requeue();
      return fail(song, sources, { kind: 'interrupted' }, { keepParts: true });
    }
    if (coverResult.status === 'rejected') {
      if (hiddenWhileDownloading.delete(songId)) return requeue();
      return fail(song, sources, { kind: 'interrupted' }, { keepParts: true });
    }
    hiddenWhileDownloading.delete(songId);

    const audio = new Blob(chunksOf(songId), {
      type: downloadedType,
    });
    if (total !== null && audio.size !== total) {
      clearParts(songId);
      return fail(song, sources, { kind: 'interrupted' });
    }
    const cover =
      coverUrl === null
        ? null
        : new Blob(coverChunks, {
            type: coverResult.value.type,
          });
    const record: StoredDownload = {
      song,
      audio,
      cover,
      lyrics,
      album,
      sources: [...sources],
      downloadedAt: clock.now(),
    };
    return await save(songId, record, token);
  };

  const pump = (): void => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    void (async () => {
      try {
        for (;;) {
          again = false;
          if (paused || !context.signedIn() || !context.online()) break;
          let next: [number, DownloadTask] | undefined;
          for (const entry of tasks) {
            if (entry[1].status === 'queued') {
              next = entry;
              break;
            }
          }
          if (!next) break;
          const [songId] = next;
          let result: StepResult;
          try {
            result = await step(songId);
          } catch (error) {
            console.error('下载出错', error);
            const task = tasks.get(songId);
            result = task
              ? fail(task.song, task.sources, { kind: 'appError' })
              : 'next';
          }
          if (result === 'wait') break;
        }
      } finally {
        running = false;
        if (again) {
          again = false;
          pump();
        }
      }
    })();
  };

  browser.page.addEventListener('visibilitychange', () => {
    const hidden = browser.page.visibilityState === 'hidden';
    if (hidden === pageHidden) return;
    pageHidden = hidden;
    if (!hidden) {
      pump();
      return;
    }
    for (const [songId, task] of tasks) {
      if (task.status === 'downloading') hiddenWhileDownloading.add(songId);
    }
    flushAllParts();
  });
  browser.page.addEventListener('resume', pump);

  // 几个标签页同时开着时只有一个接着下本机存着的队列：拿到锁就拿着不放，标签页关掉浏览器才放开
  const queueOwnership = (): Promise<boolean> => {
    if (!queueLock) {
      const { promise, resolve } = Promise.withResolvers<boolean>();
      queueLock = promise;
      void browser.locks
        .request(DOWNLOAD_QUEUE_LOCK, { ifAvailable: true }, (lock) => {
          resolve(lock !== null);
          return lock === null ? undefined : new Promise<void>(() => {});
        })
        .catch(() => resolve(false));
    }
    return queueLock;
  };

  const restoreQueue = (
    queued: readonly QueuedDownload[],
    storedParts: readonly StoredPart[],
  ): void => {
    const bySong = new Map<number, StoredPart[]>();
    for (const part of storedParts) {
      const list = bySong.get(part.songId) ?? [];
      list.push(part);
      bySong.set(part.songId, list);
    }
    const droppedQueue: number[] = [];
    const droppedParts = new Set(bySong.keys());
    let maxOrder = 0;
    for (const entry of queued) {
      const songId = entry.song.id;
      if (records?.has(songId)) {
        droppedQueue.push(songId);
        continue;
      }
      const chunks = (bySong.get(songId) ?? []).sort(
        (a, b) => a.index - b.index,
      );
      const received = chunks.reduce((sum, part) => sum + part.blob.size, 0);
      const contiguous = chunks.every(
        (part, position) => part.index === position,
      );
      const complete =
        entry.audioComplete &&
        entry.total !== null &&
        entry.audioType !== null &&
        received === entry.total;
      const withinTotal = entry.total === null || received <= entry.total;
      const usable = contiguous && withinTotal;
      if (usable) {
        parts.set(
          songId,
          chunks.map((part) => part.blob),
        );
        partBytes.set(songId, received);
        storedIndex.set(songId, chunks.length);
        if (entry.audioType !== null) audioTypes.set(songId, entry.audioType);
        if (complete) audioDone.add(songId);
        droppedParts.delete(songId);
      }
      const queuedBytes = usable ? received : 0;
      tasks.set(
        songId,
        queuedTask(entry.song, entry.sources, queuedBytes, entry.total),
      );
      orders.set(songId, entry.order);
      maxOrder = Math.max(maxOrder, entry.order);
    }
    nextOrder = maxOrder + 1;
    deleteQueued(droppedQueue);
    if (droppedParts.size > 0) {
      void local
        .deleteDownloadParts([...droppedParts])
        .catch((error: unknown) =>
          console.error('下载的断点没能从这台设备删掉', error),
        );
    }
  };

  const loadRecords = (): Promise<void> => {
    loading ??= (async () => {
      leader = await queueOwnership();
      const [stored, saved, queued, storedParts] = await Promise.all([
        local.readDownloads(),
        local.downloadQuality(),
        leader ? local.readQueuedDownloads() : [],
        leader ? local.readDownloadParts() : [],
      ]);
      quality = saved ?? DOWNLOAD_QUALITY;
      setRecords(new Map(stored.map((record) => [record.song.id, record])));
      if (leader) restoreQueue(queued, storedParts);
      publish();
    })().catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
    return loading;
  };

  const revokeDownloads = (dropped: readonly StoredDownload[]): void => {
    for (const { song } of dropped) {
      const audio = audioUrls.get(song.id);
      if (audio) browser.revokeObjectUrl(audio);
      audioUrls.delete(song.id);
      const { coverUrl } = song.album;
      const cover = coverUrl === null ? undefined : coverUrls.get(coverUrl);
      if (coverUrl !== null && cover && !covers.has(coverUrl)) {
        browser.revokeObjectUrl(cover);
        coverUrls.delete(coverUrl);
      }
    }
  };

  const cancel = (songId: number): boolean => {
    if (!tasks.has(songId)) return false;
    dropTasks([songId]);
    hideSongNotices(songId);
    if (paused && tasks.size === 0) {
      paused = null;
      context.notices.hideWhere((notice) => notice.kind === 'downloadsPaused');
    }
    publish();
    return true;
  };

  const cancelAll = (): void => {
    if (tasks.size === 0 && paused === null) return;
    const wasPaused = paused !== null;
    dropTasks([...tasks.keys()]);
    tasks.clear();
    paused = null;
    context.notices.hideWhere((notice) => notice.kind === 'downloadFailed');
    if (wasPaused)
      context.notices.hideWhere((notice) => notice.kind === 'downloadsPaused');
    publish();
  };

  return {
    load: loadRecords,
    download(song) {
      const plain = plainSong(song);
      const blocked = downloadBlock(plain, current(), {
        signedIn: context.signedIn(),
        online: context.online(),
      });
      if (blocked) return blocked;
      askPersist();
      const existing = tasks.get(plain.id);
      if (existing) {
        tasks.delete(plain.id);
        tasks.set(
          plain.id,
          queuedTask(
            plain,
            mergeDownloadSources(existing.sources, [{ kind: 'single' }]),
            receivedOf(plain.id),
            existing.total,
          ),
        );
      } else {
        tasks.set(plain.id, queuedTask(plain, [{ kind: 'single' }]));
      }
      saveQueued([plain.id]);
      publish();
      hideSongNotices(plain.id);
      pump();
      return null;
    },
    async add(batch, source, { quiet = false } = {}) {
      if (!context.signedIn()) return 'signedOut';
      if (!context.online()) return 'offline';
      const outcome: DownloadBatchOutcome = {
        queued: 0,
        downloaded: 0,
        trial: 0,
        noCopyright: 0,
      };
      const downloadedIds: number[] = [];
      const queuedIds: number[] = [];
      for (const song of new Map(
        batch.map((each) => [each.id, plainSong(each)]),
      ).values()) {
        if (records?.has(song.id)) {
          outcome.downloaded += 1;
          downloadedIds.push(song.id);
          continue;
        }
        const task = tasks.get(song.id);
        if (task) {
          const sources = mergeDownloadSources(task.sources, [source]);
          if (task.status === 'failed') {
            tasks.delete(song.id);
            tasks.set(
              song.id,
              queuedTask(song, sources, receivedOf(song.id), task.total),
            );
            hideSongNotices(song.id);
          } else {
            tasks.set(song.id, {
              ...task,
              sources,
            });
          }
          queuedIds.push(song.id);
          outcome.queued += 1;
          continue;
        }
        switch (song.availability) {
          case 'trial':
            outcome.trial += 1;
            continue;
          case 'noCopyright':
            outcome.noCopyright += 1;
            continue;
          case 'full':
            break;
          default: {
            const unhandled: never = song.availability;
            throw new Error(`不认识的歌曲状态：${JSON.stringify(unhandled)}`);
          }
        }
        tasks.set(song.id, queuedTask(song, [source]));
        queuedIds.push(song.id);
        outcome.queued += 1;
      }
      saveQueued(queuedIds);
      if (downloadedIds.length > 0) {
        try {
          const updated = await local.addDownloadSources(downloadedIds, [
            source,
          ]);
          const next = new Map(records);
          let changed = false;
          for (const [songId, sources] of updated) {
            const record = next.get(songId);
            if (record) {
              next.set(songId, {
                ...record,
                sources,
              });
              changed = true;
            }
          }
          if (changed) records = next;
        } catch (error) {
          console.error('没能记下这些下载是从哪儿来的', error);
        }
      }
      const processed =
        outcome.queued > 0 ||
        outcome.downloaded > 0 ||
        outcome.trial > 0 ||
        outcome.noCopyright > 0;
      if (processed) publish();
      if (
        !quiet &&
        outcome.downloaded + outcome.trial + outcome.noCopyright > 0
      ) {
        context.notices.show({
          kind: 'downloadsSkipped',
          downloaded: outcome.downloaded,
          trial: outcome.trial,
          noCopyright: outcome.noCopyright,
        });
      }
      if (outcome.queued > 0) askPersist();
      pump();
      return outcome;
    },
    retry(songId) {
      const task = tasks.get(songId);
      if (!task || task.status !== 'failed') return false;
      tasks.delete(songId);
      tasks.set(
        songId,
        queuedTask(task.song, task.sources, receivedOf(songId), task.total),
      );
      saveQueued([songId]);
      context.notices.hideWhere(
        (notice) =>
          notice.kind === 'downloadFailed' && notice.song.id === songId,
      );
      publish();
      pump();
      return true;
    },
    wake() {
      pump();
    },
    resume() {
      paused = null;
      publish();
      flushAllParts();
      pump();
    },
    cancel,
    cancelAll,
    async remove(songIds) {
      const removed = songIds.map(recordOf);
      const freed = removed.reduce(
        (sum, record) => sum + recordBytes(record),
        0,
      );
      await local.deleteDownloads(songIds);
      const next = new Map(records);
      for (const songId of songIds) next.delete(songId);
      setRecords(next);
      revokeDownloads(removed);
      publish();
      context.changed();
      const removal: DownloadRemoval = {
        removed: removed.length,
        kept: 0,
        freed,
      };
      if (removal.removed > 0 || removal.kept > 0)
        context.notices.show({
          kind: 'downloadsRemoved',
          removed: removal.removed,
          kept: removal.kept,
        });
      return removal;
    },
    async removePlaylist(playlistId) {
      const source: DownloadSource = {
        kind: 'playlist',
        id: playlistId,
        name: '',
      };
      await loadRecords();
      const droppedTasks: number[] = [];
      const changedTasks: number[] = [];
      for (const [songId, task] of [...tasks]) {
        if (!task.sources.some((each) => sameDownloadSource(each, source)))
          continue;
        const rest = task.sources.filter(
          (each) => !sameDownloadSource(each, source),
        );
        if (rest.length > 0) {
          tasks.set(songId, {
            ...task,
            sources: rest,
          });
          changedTasks.push(songId);
        } else {
          droppedTasks.push(songId);
          hideSongNotices(songId);
        }
      }
      dropTasks(droppedTasks);
      saveQueued(changedTasks);
      const tasksChanged = droppedTasks.length > 0 || changedTasks.length > 0;
      if (tasksChanged && paused && tasks.size === 0) {
        paused = null;
        context.notices.hideWhere(
          (notice) => notice.kind === 'downloadsPaused',
        );
      }

      const keptIds: number[] = [];
      const removedIds: number[] = [];
      let kept = 0;
      for (const [songId, record] of records ?? []) {
        if (!record.sources.some((each) => sameDownloadSource(each, source)))
          continue;
        if (record.sources.some((each) => !sameDownloadSource(each, source))) {
          keptIds.push(songId);
          kept += 1;
        } else {
          removedIds.push(songId);
        }
      }
      const dropped = removedIds.map(recordOf);
      const freed = dropped.reduce(
        (sum, record) => sum + recordBytes(record),
        0,
      );
      if (removedIds.length > 0) await local.deleteDownloads(removedIds);
      const persisted =
        keptIds.length > 0
          ? await local.removeDownloadSource(keptIds, source)
          : new Map<number, DownloadSource[]>();
      if (keptIds.length > 0 || removedIds.length > 0) {
        const next = new Map(records);
        for (const [songId, sources] of persisted) {
          const record = next.get(songId);
          if (record) {
            next.set(songId, {
              ...record,
              sources,
            });
          }
        }
        for (const songId of removedIds) next.delete(songId);
        setRecords(next);
      }
      if (removedIds.length > 0 || tasksChanged) {
        revokeDownloads(dropped);
        publish();
        context.changed();
      } else if (keptIds.length > 0) {
        publish();
      }
      const removal: DownloadRemoval = {
        removed: dropped.length,
        kept,
        freed,
      };
      if (removedIds.length > 0 || keptIds.length > 0)
        context.notices.show({
          kind: 'downloadsRemoved',
          removed: removal.removed,
          kept: removal.kept,
        });
      return removal;
    },
    async clear() {
      await loadRecords();
      const dropped = [...(records?.values() ?? [])];
      const freed = dropped.reduce(
        (sum, record) => sum + recordBytes(record),
        0,
      );
      const taskIds = [...tasks.keys()];
      const wasPaused = paused !== null;
      dropTasks(taskIds);
      tasks.clear();
      paused = null;
      context.notices.hideWhere((notice) => notice.kind === 'downloadFailed');
      if (wasPaused)
        context.notices.hideWhere(
          (notice) => notice.kind === 'downloadsPaused',
        );
      if (dropped.length > 0)
        await local.deleteDownloads(dropped.map((record) => record.song.id));
      setRecords(new Map());
      revokeDownloads(dropped);
      publish();
      context.changed();
      if (dropped.length > 0 || taskIds.length > 0) {
        context.notices.show({
          kind: 'downloadsRemoved',
          removed: dropped.length,
          kept: 0,
        });
      }
      return {
        removed: dropped.length,
        kept: 0,
        freed,
      };
    },
    setQuality(next) {
      if (next === quality) return;
      quality = next;
      publish();
      void local.saveDownloadQuality(next);
    },
    stored: recordOf,
    audioUrl(songId) {
      let url = audioUrls.get(songId);
      if (!url) {
        url = browser.objectUrl(recordOf(songId).audio);
        audioUrls.set(songId, url);
      }
      return url;
    },
    lyricsOf: (songId) => records?.get(songId)?.lyrics ?? null,
  };
};
