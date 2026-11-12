import { endpoints } from '#lib/api/endpoints.js';
import type { Song } from '#lib/api/library.js';
import type { PlaySource, Quality } from '#lib/api/playback.js';

import type { AudioCapability, Clock } from './browser';
import type { PlaylistSongs } from './library';
import type { SessionApi, SessionFailure } from './session-round';

const HANDOVER_LEAD = 1;
const UNBUFFERED_HANDOVER_LEAD = 5;
const URL_EXPIRY_MARGIN_MS = 60_000;
const PREPARE_AGAIN_LEAD = 20;
const PREPARE_AGAIN_INTERVAL_MS = 5_000;

export interface QueueEntry {
  song: Song;
  source: PlaySource;
}

type PlaybackStatus = 'loading' | 'buffering' | 'playing' | 'paused';

export type PlayerNotice =
  | { kind: 'urlFailed'; failure: SessionFailure }
  | { kind: 'streamFailed' }
  | { kind: 'skipped'; song: Song }
  | { kind: 'nothingPlayable' };

export type SongChange = 'next' | 'previous' | 'pick' | 'continue' | 'skip';

export type PlayMode = 'loop' | 'one' | 'shuffle';

export interface PlayerState {
  queue: readonly QueueEntry[];
  current: number | null;
  status: PlaybackStatus;
  position: number;
  duration: number | null;
  trial: boolean;
  volume: number;
  notice: PlayerNotice | null;
  change: SongChange | null;
  mode: PlayMode;
  neighbors: { previous: number | null; next: number | null };
  quality: Quality;
}

const NO_NEIGHBORS: PlayerState['neighbors'] = { previous: null, next: null };

export const DEFAULT_VOLUME = 0.3;

export const INITIAL_PLAYER: PlayerState = {
  queue: [],
  current: null,
  status: 'paused',
  position: 0,
  duration: null,
  trial: false,
  volume: DEFAULT_VOLUME,
  notice: null,
  change: null,
  mode: 'loop',
  neighbors: NO_NEIGHBORS,
  quality: 'exhigh',
};

export interface SavedQueue {
  entries: readonly QueueEntry[];
  mode: PlayMode;
  order: readonly number[] | null;
  upNext: readonly number[];
  filling: { playlistId: number; have: readonly number[] } | null;
}

export interface SavedProgress {
  songId: number;
  position: number;
  duration: number | null;
  trial: boolean;
  listened: number;
}

export interface SavedPlayer {
  queue: SavedQueue;
  progress: SavedProgress;
}

export interface CheckIn {
  songId: number;
  source: PlaySource;
  seconds: number;
}

export interface PlayerContext {
  api: SessionApi;
  clock: Clock;
  audio: () => AudioCapability;
  defaultVolume: number;
  write: (player: PlayerState) => void;
  // 进度、队列、打卡必须在同一个事务里存，否则重开对不上、打卡会重记或漏记
  save: (
    progress: SavedProgress,
    queue: SavedQueue | undefined,
    checkIns: readonly CheckIn[],
  ) => void;
  forget: (checkIns: readonly CheckIn[]) => void;
  downloaded: (songId: number) => boolean;
  localFile: (songId: number) => string;
  playable: (song: Song) => boolean;
}

export interface Player {
  play: (
    source: PlaySource,
    songs: readonly Song[],
    songId: number,
    complete: boolean,
  ) => void;
  libraryChanged: (
    songsOf: (playlistId: number) => PlaylistSongs<{ id: number }> | null,
  ) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  jump: (index: number) => void;
  playNext: (
    source: PlaySource,
    song: Song,
  ) => 'started' | 'queued' | 'ignored';
  addToQueue: (
    source: PlaySource,
    song: Song,
  ) => 'started' | 'queued' | 'ignored';
  interject: (source: PlaySource, song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  seek: (position: number) => void;
  playFrom: (position: number) => void;
  setVolume: (volume: number) => void;
  setMode: (mode: PlayMode) => void;
  setQuality: (quality: Quality) => void;
  dismissNotice: () => void;
  stop: () => void;
  restore: (saved: SavedPlayer) => void;
  availabilityChanged: () => void;
  adopt: () => void;
}

interface PlayUrl {
  url: string;
  trial: boolean;
  expiresAt: number;
  local: boolean;
}

type Fetched =
  | { ok: true; url: PlayUrl | null }
  | { ok: false; failure: SessionFailure }
  | null;

interface Deck {
  audio: AudioCapability;
  song: Song | null;
  url: PlayUrl | null;
  buffered: boolean;
}

interface Incoming {
  deck: Deck;
  handover: boolean;
}

interface Filling {
  playlistId: number;
  have: ReadonlySet<number>;
}

type QueueParts = Omit<SavedQueue, 'filling'> & { filling: Filling | null };

const durationOf = (deck: Deck): number | null =>
  Number.isFinite(deck.audio.duration) ? deck.audio.duration : null;

const shuffled = (ids: readonly number[]): number[] => {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const progressKey = (
  songId: number,
  state: Pick<PlayerState, 'position' | 'duration' | 'trial' | 'status'>,
): string =>
  [
    songId,
    Math.floor(state.position),
    state.duration,
    state.trial,
    state.status,
  ].join();

const fillIn = (
  queue: readonly QueueEntry[],
  playlist: PlaylistSongs<{ id: number }>,
  have: ReadonlySet<number>,
  upNext: readonly number[],
): readonly QueueEntry[] => {
  const inQueue = new Set(queue.map((entry) => entry.song.id));
  const source: PlaySource = { kind: 'playlist', id: playlist.playlist.id };
  const before = new Map<number, QueueEntry[]>();
  let waiting: QueueEntry[] = [];
  let last: number | null = null;
  let missing = 0;
  for (const song of playlist.songs) {
    if (inQueue.has(song.id)) {
      if (upNext.includes(song.id)) continue;
      if (waiting.length > 0) before.set(song.id, waiting);
      waiting = [];
      last = song.id;
    } else if (!have.has(song.id)) {
      waiting.push({ song, source });
      missing += 1;
    }
  }
  if (missing === 0) return queue;
  const filled: QueueEntry[] = [];
  let tail = last === null;
  for (const entry of queue) {
    if (tail && !upNext.includes(entry.song.id)) {
      filled.push(...waiting);
      tail = false;
    }
    filled.push(...(before.get(entry.song.id) ?? []), entry);
    if (entry.song.id === last) tail = true;
  }
  if (tail) filled.push(...waiting);
  return filled;
};

export const createPlayer = (context: PlayerContext): Player => {
  const { api, clock } = context;
  let state: PlayerState = { ...INITIAL_PLAYER, volume: context.defaultVolume };
  let incoming: Incoming | null = null;
  let handoverFailed = false;
  let attempt = 0;
  let startAt = 0;
  let preparing = 0;
  let prepared = false;
  let filling: Filling | null = null;
  let upNext: readonly number[] = [];
  let order: readonly number[] | null = null;
  let positions: { queue: readonly QueueEntry[]; index: Map<number, number> } =
    {
      queue: [],
      index: new Map(),
    };
  const unavailable = new Set<number>();
  const urls = new Map<number, PlayUrl>();
  const fetching = new Map<number, Promise<Fetched>>();
  let epoch = 0;
  let lastPrepare = Number.NEGATIVE_INFINITY;
  let active: Deck;
  let spare: Deck;
  let savedQueue: QueueParts | null = null;
  let savedProgressKey = '';
  let heard = 0;
  let soundingSince: number | null = null;
  let finished: CheckIn[] = [];

  // queue 和 current 必须一起发布，否则 state.current 会指错
  const publish = (next: Partial<PlayerState>): void => {
    state = {
      ...state,
      ...next,
    };
    const id = currentId();
    if (next.current !== undefined && id !== null && upNext.includes(id))
      upNext = upNext.filter((each) => each !== id);
    state.neighbors = neighbors();
    if (state.status === 'playing' && soundingSince === null) {
      soundingSince = clock.now();
    } else if (state.status !== 'playing' && soundingSince !== null) {
      heard = listened();
      soundingSince = null;
    }
    context.write(state);
    persist();
  };

  const listened = (): number =>
    heard + (soundingSince === null ? 0 : (clock.now() - soundingSince) / 1000);

  const endListen = (): void => {
    const seconds = Math.round(listened());
    if (seconds > 0 && state.current !== null) {
      const { song, source } = state.queue[state.current];
      finished.push({ songId: song.id, source, seconds });
    }
    heard = 0;
    soundingSince = null;
  };

  const persist = (): void => {
    const checkIns = finished;
    finished = [];
    if (state.current === null) {
      if (savedQueue || checkIns.length > 0) {
        savedQueue = null;
        savedProgressKey = '';
        context.forget(checkIns);
      }
      return;
    }
    const queueChanged =
      savedQueue === null ||
      savedQueue.entries !== state.queue ||
      savedQueue.mode !== state.mode ||
      savedQueue.order !== order ||
      savedQueue.upNext !== upNext ||
      savedQueue.filling !== filling;
    const { song } = state.queue[state.current];
    const key = progressKey(song.id, state);
    if (!queueChanged && key === savedProgressKey && checkIns.length === 0)
      return;
    savedProgressKey = key;
    savedQueue = {
      entries: state.queue,
      mode: state.mode,
      order,
      upNext,
      filling,
    };
    context.save(
      {
        songId: song.id,
        position: state.position,
        duration: state.duration,
        trial: state.trial,
        listened: listened(),
      },
      queueChanged
        ? {
            ...savedQueue,
            filling: filling && {
              playlistId: filling.playlistId,
              have: [...filling.have],
            },
          }
        : undefined,
      checkIns,
    );
  };

  const fresh = (url: PlayUrl | null): url is PlayUrl =>
    url !== null && clock.now() < url.expiresAt - URL_EXPIRY_MARGIN_MS;

  const holds = (deck: Deck, song: Song): boolean =>
    deck.song?.id === song.id && fresh(deck.url) && !deck.audio.error;

  const primed = (deck: Deck, song: Song): boolean =>
    holds(deck, song) && deck.url!.local === context.downloaded(song.id);

  const localUrl = (song: Song): PlayUrl | null =>
    context.downloaded(song.id)
      ? {
          url: context.localFile(song.id),
          trial: false,
          expiresAt: Number.POSITIVE_INFINITY,
          local: true,
        }
      : null;

  const isCurrent = (deck: Deck): boolean => {
    if (state.status === 'loading') return false;
    const shown = incoming && !incoming.handover ? incoming.deck : active;
    return (
      deck === shown &&
      state.current !== null &&
      deck.song?.id === state.queue[state.current].song.id
    );
  };

  const playUrl = (song: Song): Promise<Fetched> => {
    const cached = localUrl(song) ?? urls.get(song.id) ?? null;
    if (fresh(cached)) return Promise.resolve({ ok: true, url: cached });
    let request = fetching.get(song.id);
    if (!request) {
      const requestedAt = clock.now();
      const mine = epoch;
      request = api
        .get(endpoints.playUrl, { id: song.id, quality: state.quality })
        .then((result): Fetched => {
          if (!result) return null;
          if (!result.ok) return result;
          if (!result.value.playable) return { ok: true, url: null };
          const url = {
            url: result.value.url,
            trial: result.value.trial,
            expiresAt: requestedAt + result.value.expiresIn * 1000,
            local: false,
          };
          if (mine === epoch) urls.set(song.id, url);
          return { ok: true, url };
        })
        .finally(() => {
          if (mine === epoch) fetching.delete(song.id);
        });
      fetching.set(song.id, request);
    }
    return request;
  };

  const canPlay = (song: Song): boolean => context.playable(song);

  const playable = (entry: QueueEntry): boolean =>
    canPlay(entry.song) &&
    (context.downloaded(entry.song.id) || !unavailable.has(entry.song.id));

  const playableFrom = (from: number, step: 1 | -1): number | null => {
    const { queue } = state;
    const at = order ? order.indexOf(queue[from].song.id) : from;
    for (let offset = 1; offset <= queue.length; offset += 1) {
      const k =
        (((at + step * offset) % queue.length) + queue.length) % queue.length;
      const index = order ? indexOfSong(order[k]) : k;
      if (playable(queue[index])) return index;
    }
    return null;
  };

  const following = (): number | null => {
    if (state.current === null) return null;
    if (state.mode === 'one' && playable(state.queue[state.current]))
      return state.current;
    return playableFrom(state.current, 1);
  };

  const neighbors = (): PlayerState['neighbors'] => {
    const { current } = state;
    if (current === null) return NO_NEIGHBORS;
    const other = (index: number | null) => (index === current ? null : index);
    return {
      previous: other(playableFrom(current, -1)),
      next: other(playableFrom(current, 1)),
    };
  };

  const indexOfSong = (id: number): number => {
    if (positions.queue !== state.queue) {
      positions = {
        queue: state.queue,
        index: new Map(
          state.queue.map((entry, index) => [entry.song.id, index]),
        ),
      };
    }
    return positions.index.get(id) ?? -1;
  };

  const load = (deck: Deck, song: Song, url: PlayUrl): void => {
    deck.song = song;
    deck.url = url;
    deck.buffered = false;
    deck.audio.preload = 'auto';
    deck.audio.src = url.url;
  };

  const play = (deck: Deck): void => {
    const mine = attempt;
    const waiting = incoming;
    const handover = incoming?.handover ?? false;
    void deck.audio.play().catch(() => {
      if (mine !== attempt || waiting !== incoming) return;
      if (incoming?.deck === deck && incoming.handover) {
        incoming = null;
        handoverFailed = true;
        deck.audio.pause();
        return;
      }
      if (state.status !== 'buffering') return;
      pauseAll();
      publish({
        status: 'paused',
        notice: handover ? { kind: 'streamFailed' } : state.notice,
      });
    });
  };

  const pauseAll = (): void => {
    incoming = null;
    active.audio.pause();
    spare.audio.pause();
  };

  const start = async (
    index: number,
    position: number,
    change: SongChange | null,
    notice: PlayerNotice | null = null,
  ): Promise<void> => {
    const mine = ++attempt;
    preparing += 1;
    prepared = false;
    handoverFailed = false;
    const { song } = state.queue[index];
    if (incoming && !primed(incoming.deck, song)) incoming.deck.audio.pause();
    incoming = null;
    startAt = position;
    if (change !== null) endListen();
    publish({
      current: index,
      position,
      duration: null,
      trial: false,
      notice,
      change: change ?? state.change,
    });
    if (!primed(spare, song)) {
      let url = localUrl(song) ?? urls.get(song.id) ?? null;
      if (!fresh(url)) {
        publish({ status: 'loading' });
        const fetched = await playUrl(song);
        if (mine !== attempt) return;
        if (fetched === null) {
          pauseAll();
          publish({ status: 'paused' });
          return;
        }
        if (!fetched.ok) return urlFailed(fetched.failure);
        if (!fetched.url) return skip(song);
        url = fetched.url;
      }
      load(spare, song, url);
    }
    // 用 startAt 不用 state.position：旧播放器放同一首时还在报进度
    spare.audio.currentTime = startAt;
    incoming = { deck: spare, handover: false };
    publish({
      status: 'buffering',
      duration: durationOf(spare),
      trial: spare.url!.trial,
    });
    play(spare);
  };

  const urlFailed = (failure: SessionFailure): void => {
    pauseAll();
    publish({
      status: 'paused',
      notice: { kind: 'urlFailed', failure },
    });
  };

  const skip = (song: Song): void => {
    unavailable.add(song.id);
    const next = playableFrom(state.current!, 1);
    if (next === null) {
      pauseAll();
      publish({
        status: 'paused',
        notice: { kind: 'nothingPlayable' },
      });
      return;
    }
    void start(next, 0, 'skip', { kind: 'skipped', song });
  };

  const prepareNext = async (): Promise<void> => {
    if (prepared || state.current === null) return;
    prepared = true;
    lastPrepare = clock.now();
    const mine = ++preparing;
    const index = following();
    if (index === null) return;
    const { song } = state.queue[index];
    if (primed(spare, song)) return;
    const fetched = await playUrl(song);
    if (mine !== preparing) return;
    if (!fetched) return;
    if (!fetched.ok) {
      return;
    }
    if (!fetched.url) {
      unavailable.add(song.id);
      publish({
        notice: { kind: 'skipped', song },
      });
      prepared = false;
      return prepareNext();
    }
    load(spare, song, fetched.url);
  };

  const handOver = (): void => {
    if (
      incoming ||
      handoverFailed ||
      state.status !== 'playing' ||
      state.current === null
    )
      return;
    const next = following();
    if (next === null) return;
    const remaining = active.audio.duration - active.audio.currentTime;
    if (!primed(spare, state.queue[next].song)) {
      if (
        remaining <= PREPARE_AGAIN_LEAD &&
        clock.now() - lastPrepare >= PREPARE_AGAIN_INTERVAL_MS
      ) {
        prepared = false;
        void prepareNext();
      }
      return;
    }
    if (remaining > (spare.buffered ? HANDOVER_LEAD : UNBUFFERED_HANDOVER_LEAD))
      return;
    incoming = { deck: spare, handover: true };
    play(spare);
  };

  const arrived = ({ deck, handover }: Incoming): void => {
    incoming = null;
    if (deck !== active) {
      const old = active;
      active = deck;
      spare = old;
      old.audio.pause();
    }
    prepared = false;
    unavailable.clear();
    if (handover) endListen();
    publish({
      current: indexOfSong(deck.song!.id),
      status: 'playing',
      position: deck.audio.currentTime,
      duration: durationOf(deck),
      trial: deck.url!.trial,
      change: handover ? 'continue' : state.change,
    });
    void prepareNext();
  };

  const ended = (): void => {
    if (state.current === null) return;
    if (incoming?.handover) {
      incoming.handover = false;
      endListen();
      publish({
        current: indexOfSong(incoming.deck.song!.id),
        status: 'buffering',
        position: 0,
        duration: durationOf(incoming.deck),
        trial: incoming.deck.url!.trial,
        change: 'continue',
      });
      return;
    }
    if (incoming) return;
    const next = following();
    endListen();
    if (handoverFailed) {
      handoverFailed = false;
      publish({
        current: next ?? state.current,
        status: 'paused',
        position: 0,
        duration: null,
        notice: { kind: 'streamFailed' },
        change: next === null ? state.change : 'continue',
      });
      return;
    }
    if (next === null) {
      publish({ status: 'paused', position: 0 });
      return;
    }
    void start(next, 0, 'continue');
  };

  const streamFailed = (deck: Deck): void => {
    if (!fresh(deck.url) && state.current !== null) {
      void start(state.current, state.position, null, state.notice);
      return;
    }
    pauseAll();
    publish({
      status: 'paused',
      notice: { kind: 'streamFailed' },
    });
  };

  const listen = (deck: Deck): void => {
    const { audio } = deck;
    audio.addEventListener('playing', () => {
      if (incoming?.deck === deck) return arrived(incoming);
      if (incoming || !isCurrent(deck)) return;
      publish({ status: 'playing' });
      void prepareNext();
    });
    audio.addEventListener('waiting', () => {
      if (!isCurrent(deck) || audio.paused) return;
      if (state.status === 'playing') publish({ status: 'buffering' });
    });
    audio.addEventListener('pause', () => {
      if (
        !incoming &&
        isCurrent(deck) &&
        audio.paused &&
        !audio.ended &&
        (state.status === 'playing' || state.status === 'buffering')
      )
        publish({ status: 'paused' });
    });
    audio.addEventListener('timeupdate', () => {
      if (!isCurrent(deck)) return;
      publish({ position: audio.currentTime });
      handOver();
    });
    audio.addEventListener('durationchange', () => {
      if (isCurrent(deck)) {
        publish({
          duration: durationOf(deck),
        });
      }
    });
    audio.addEventListener('canplaythrough', () => {
      deck.buffered = true;
    });
    audio.addEventListener('ended', () => {
      if (isCurrent(deck)) ended();
    });
    audio.addEventListener('error', () => {
      if (incoming?.deck === deck && incoming.handover) {
        incoming = null;
        handoverFailed = true;
        audio.pause();
        return;
      }
      if (isCurrent(deck)) return streamFailed(deck);
      if (deck.song) urls.delete(deck.song.id);
      deck.song = null;
      deck.url = null;
    });
  };

  const deck = (): Deck => {
    const created: Deck = {
      audio: context.audio(),
      song: null,
      url: null,
      buffered: false,
    };
    created.audio.volume = state.volume;
    listen(created);
    return created;
  };

  active = deck();
  spare = deck();

  const resume = (): void => {
    const index = state.current!;
    const { song } = state.queue[index];
    if (!canPlay(song)) {
      const next = playableFrom(index, 1);
      if (next === null || next === index) {
        return publish({
          notice: { kind: 'nothingPlayable' },
        });
      }
      return void start(next, 0, 'skip');
    }
    if (holds(active, song) && !active.audio.ended) {
      prepared = false;
      publish({ status: 'buffering', notice: null });
      play(active);
      return;
    }
    void start(index, state.position, null);
  };

  const seek = (position: number): void => {
    if (state.current === null) return;
    const { song } = state.queue[state.current];
    const duration =
      state.duration ??
      (song.duration === null
        ? Number.POSITIVE_INFINITY
        : song.duration / 1000);
    const at = Math.min(Math.max(0, position), duration);
    if (incoming?.handover) {
      incoming.deck.audio.pause();
      incoming.deck.audio.currentTime = 0;
      incoming = null;
    }
    const deck = incoming?.deck ?? (holds(active, song) ? active : null);
    if (deck) deck.audio.currentTime = at;
    startAt = at;
    publish({ position: at });
  };

  const currentId = (): number | null =>
    state.current === null ? null : state.queue[state.current].song.id;

  const publishQueue = (queue: readonly QueueEntry[]): void => {
    const id = currentId();
    const current = queue.findIndex((entry) => entry.song.id === id);
    if (current === -1)
      throw new Error(`播放队列变了，当前这首（${id}）不在新的播放队列里`);
    publish({ queue, current });
  };

  const add = (
    source: PlaySource,
    song: Song,
    how: 'next' | 'end' | 'now',
  ): 'started' | 'queued' | 'ignored' => {
    if (!canPlay(song)) return 'ignored';
    const id = currentId();
    if (id === null) {
      if (order) order = [song.id];
      publish({
        queue: [{ song, source }],
      });
      void start(0, 0, 'pick');
      return 'started';
    }
    if (song.id === id) {
      if (how === 'now' && state.status === 'paused') resume();
      return 'ignored';
    }
    const rest = state.queue.filter((entry) => entry.song.id !== song.id);
    const at =
      how === 'end'
        ? rest.length
        : rest.findIndex((entry) => entry.song.id === id) + 1;
    upNext =
      how === 'next'
        ? [song.id, ...upNext.filter((each) => each !== song.id)]
        : upNext.filter((each) => each !== song.id);
    if (order) {
      const others = order.filter((each) => each !== song.id);
      const after = how === 'end' ? others.length : others.indexOf(id) + 1;
      order = [...others.slice(0, after), song.id, ...others.slice(after)];
    }
    publishQueue([...rest.slice(0, at), { song, source }, ...rest.slice(at)]);
    if (how === 'now') {
      void start(at, 0, 'pick');
      return 'started';
    }
    queueChanged();
    return 'queued';
  };

  const queueChanged = (): void => {
    if (incoming?.handover) {
      const next = following();
      if (next !== null && state.queue[next].song.id === incoming.deck.song!.id)
        return;
      incoming.deck.audio.pause();
      incoming.deck.audio.currentTime = 0;
      incoming = null;
    }
    handoverFailed = false;
    prepared = false;
    if (!incoming && state.status === 'playing') void prepareNext();
  };

  const clear = (): void => {
    attempt += 1;
    preparing += 1;
    handoverFailed = false;
    upNext = [];
    if (order) order = [];
    filling = null;
    pauseAll();
    unavailable.clear();
    endListen();
    publish({
      ...INITIAL_PLAYER,
      volume: state.volume,
      mode: state.mode,
      quality: state.quality,
    });
  };

  return {
    play(source, songs, songId, complete) {
      const index = songs.findIndex((song) => song.id === songId);
      if (index === -1 || !canPlay(songs[index])) return;
      unavailable.clear();
      upNext = [];
      order =
        state.mode === 'shuffle'
          ? [
              songId,
              ...shuffled(
                songs.flatMap((song) => (song.id === songId ? [] : [song.id])),
              ),
            ]
          : null;
      filling = null;
      if (!complete) {
        if (source.kind !== 'playlist')
          throw new Error(
            `只有歌单会没同步全，${source.kind} 的列表要一次拿全`,
          );
        filling = {
          playlistId: source.id,
          have: new Set(songs.map((song) => song.id)),
        };
      }
      endListen();
      publish({
        queue: songs.map((song) => ({ song, source })),
        current: index,
      });
      void start(index, 0, 'pick');
    },
    libraryChanged(songsOf) {
      if (filling === null) return;
      const playlist = songsOf(filling.playlistId);
      if (playlist && !playlist.complete) return;
      const { have } = filling;
      filling = null;
      if (!playlist || state.current === null) return;
      const queue = fillIn(state.queue, playlist, have, upNext);
      if (queue === state.queue) return;
      if (order) {
        const known = new Set(order);
        order = [
          ...order,
          ...shuffled(
            queue.flatMap((entry) =>
              known.has(entry.song.id) ? [] : [entry.song.id],
            ),
          ),
        ];
      }
      publishQueue(queue);
      queueChanged();
    },
    toggle() {
      if (state.current === null) return;
      if (state.status === 'paused') return resume();
      attempt += 1;
      pauseAll();
      publish({ status: 'paused' });
    },
    next() {
      const index =
        state.current === null ? null : playableFrom(state.current, 1);
      if (index !== null) void start(index, 0, 'next');
    },
    previous() {
      const index =
        state.current === null ? null : playableFrom(state.current, -1);
      if (index === null) return;
      if (upNext.length > 0) upNext = [];
      void start(index, 0, 'previous');
    },
    jump(index) {
      const entry = state.queue[index];
      if (!entry || index === state.current || !playable(entry)) return;
      if (upNext.length > 0) upNext = [];
      void start(index, 0, 'pick');
    },
    playNext: (source, song) => add(source, song, 'next'),
    addToQueue: (source, song) => add(source, song, 'end'),
    interject: (source, song) => add(source, song, 'now'),
    removeFromQueue(index) {
      if (index === state.current || !state.queue[index]) return;
      const { id } = state.queue[index].song;
      upNext = upNext.filter((each) => each !== id);
      if (order) order = order.filter((each) => each !== id);
      publishQueue(state.queue.filter((_, i) => i !== index));
      queueChanged();
    },
    clearQueue: clear,
    seek,
    playFrom(position) {
      if (state.current === null) return;
      seek(position);
      if (state.status === 'paused') resume();
    },
    setVolume(volume) {
      active.audio.volume = volume;
      spare.audio.volume = volume;
      publish({ volume });
    },
    setMode(mode) {
      if (mode === state.mode) return;
      const id = currentId();
      if (mode === 'shuffle') {
        const first = id === null ? [] : [id, ...upNext];
        order = [
          ...first,
          ...shuffled(
            state.queue.flatMap((entry) =>
              first.includes(entry.song.id) ? [] : [entry.song.id],
            ),
          ),
        ];
      } else {
        order = null;
      }
      publish({ mode });
      queueChanged();
    },
    setQuality(quality) {
      if (quality === state.quality) return;
      epoch += 1;
      preparing += 1;
      urls.clear();
      fetching.clear();
      if (incoming?.deck !== spare) {
        spare.song = null;
        spare.url = null;
      }
      publish({ quality });
      queueChanged();
    },
    dismissNotice() {
      publish({ notice: null });
    },
    adopt() {
      heard = 0;
      soundingSince = state.status === 'playing' ? clock.now() : null;
      savedQueue = null;
      persist();
    },
    availabilityChanged() {
      if (state.current === null) return;
      publish({});
      queueChanged();
    },
    stop() {
      epoch += 1;
      for (const each of [active, spare]) {
        each.song = null;
        each.url = null;
      }
      urls.clear();
      fetching.clear();
      clear();
    },
    restore({ queue, progress }) {
      const current = queue.entries.findIndex(
        (entry) => entry.song.id === progress.songId,
      );
      if (current === -1)
        throw new Error(
          `存着的当前这首（${progress.songId}）不在存着的播放队列里`,
        );
      order = queue.order;
      upNext = queue.upNext;
      filling = queue.filling && {
        playlistId: queue.filling.playlistId,
        have: new Set(queue.filling.have),
      };
      heard = progress.listened;
      soundingSince = null;
      const restored = {
        position: progress.position,
        duration: progress.duration,
        trial: progress.trial,
        status: 'paused',
      } as const;
      savedQueue = {
        entries: queue.entries,
        mode: queue.mode,
        order,
        upNext,
        filling,
      };
      savedProgressKey = progressKey(progress.songId, restored);
      publish({
        queue: queue.entries,
        current,
        mode: queue.mode,
        ...restored,
        change: null,
        notice: null,
      });
    },
  };
};
