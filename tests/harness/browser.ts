import type { Clock as FakeTimers } from '@sinonjs/fake-timers';

import type { CoverCrop } from '#lib/api/cover.js';
import { COVER_WORK_MAX_SIDE } from '#lib/api/cover.js';
import type {
  AudioCapability,
  ChannelCapability,
  Clock,
  DecodedImage,
  DownloadOptions,
  FileCapability,
  FolderCapability,
  LocksCapability,
  MediaSessionCapability,
  NetworkStatus,
  PageVisibility,
  StorageEstimate,
  WritableCapability,
} from '#lib/app/browser.js';

export const clockOn = (timers: FakeTimers): Clock => ({
  now: () => timers.now,
  after(ms, callback) {
    const id = timers.setTimeout(callback, ms);
    return () => timers.clearTimeout(id);
  },
});

export class FakeNetwork extends EventTarget implements NetworkStatus {
  #onLine = true;

  get onLine(): boolean {
    return this.#onLine;
  }

  set(online: boolean): void {
    if (online === this.#onLine) return;
    this.#onLine = online;
    this.dispatchEvent(new Event(online ? 'online' : 'offline'));
  }
}

export class FakeStorage {
  usage = 0;
  quota = Number.MAX_SAFE_INTEGER;
  persistCalls = 0;
  persistResult = true;

  async estimate(): Promise<StorageEstimate> {
    return {
      usage: this.usage,
      quota: this.quota,
    };
  }

  async persist(): Promise<boolean> {
    this.persistCalls += 1;
    return this.persistResult;
  }
}

export class FakePage extends EventTarget implements PageVisibility {
  #state: DocumentVisibilityState = 'visible';

  get visibilityState(): DocumentVisibilityState {
    return this.#state;
  }

  set(state: DocumentVisibilityState): void {
    if (state === this.#state) return;
    this.#state = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }

  freeze(): void {
    this.dispatchEvent(new Event('freeze'));
  }

  resume(): void {
    this.dispatchEvent(new Event('resume'));
  }
}

export class FakeWatchman {
  available = true;
  readonly issued: string[] = [];

  async checkToken(): Promise<string> {
    if (!this.available) throw new Error('Watchman 的脚本没加载出来');
    const token = `${this.issued.length + 1}`.padStart(170, 'W');
    this.issued.push(token);
    return token;
  }
}

export interface FakeImageFile {
  name?: string;
  type?: string;
  bytes?: number;
  width?: number;
  height?: number;
  decodable?: boolean;
}

export interface FakeCoverUpload {
  url: string;
  jpeg: Blob;
  token: string;
  signal: AbortSignal;
  aborted: boolean;
}

interface WaitingUpload {
  resolve: () => void;
  reject: (error: Error) => void;
}

export class FakeImages {
  uploadError: Error | null = null;
  holdUploads = false;
  exportBytes = 300_000;
  exportError: Error | null = null;
  readonly uploads: FakeCoverUpload[] = [];
  readonly exports: { image: DecodedImage; crop: CoverCrop }[] = [];
  readonly released: string[] = [];
  #files = new WeakMap<File, FakeImageFile>();
  #images = new Map<DecodedImage, { released: boolean }>();
  #waiting: WaitingUpload[] = [];
  #count = 0;

  file(spec: FakeImageFile = {}): File {
    const { name = 'photo.jpg', type = 'image/jpeg', bytes = 1_000_000 } = spec;
    const file = { name, type, size: bytes } as File;
    this.#files.set(file, spec);
    return file;
  }

  async decode(file: File): Promise<DecodedImage> {
    const spec = this.#files.get(file);
    if (!spec || spec.decodable === false)
      throw new DOMException('不能解码', 'InvalidStateError');
    const origWidth = spec.width ?? 800;
    const origHeight = spec.height ?? 800;
    const scale = Math.min(
      1,
      COVER_WORK_MAX_SIDE / Math.max(origWidth, origHeight),
    );
    const image: DecodedImage = {
      url: `blob:fake-cover-${++this.#count}`,
      width: Math.round(origWidth * scale),
      height: Math.round(origHeight * scale),
      origWidth,
      origHeight,
    };
    this.#images.set(image, { released: false });
    return image;
  }

  release(image: DecodedImage): void {
    const entry = this.#images.get(image);
    if (!entry || entry.released) return;
    entry.released = true;
    this.released.push(image.url);
  }

  async exportJpeg(image: DecodedImage, crop: CoverCrop): Promise<Blob> {
    if (this.exportError) throw this.exportError;
    this.exports.push({ image, crop });
    return new Blob([new Uint8Array(this.exportBytes)], { type: 'image/jpeg' });
  }

  uploadCoverImage(
    url: string,
    jpeg: Blob,
    token: string,
    signal: AbortSignal,
  ): Promise<void> {
    const upload: FakeCoverUpload = {
      url,
      jpeg,
      token,
      signal,
      aborted: false,
    };
    this.uploads.push(upload);
    if (this.uploadError) return Promise.reject(this.uploadError);
    return new Promise<void>((resolve, reject) => {
      const abort = () => {
        upload.aborted = true;
        reject(new DOMException('直传被取消', 'AbortError'));
      };
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, { once: true });
      if (!this.holdUploads) resolve();
      else this.#waiting.push({ resolve, reject });
    });
  }

  releaseUpload(): void {
    this.#waiting.shift()?.resolve();
  }

  failUpload(error: Error): void {
    this.#waiting.shift()?.reject(error);
  }
}

export interface FakeFile {
  bytes: number;
  type: string;
  ranges?: boolean;
}

export interface FakeTransfer {
  until?: Promise<void>;
  cut?: boolean;
}

const aborted = (signal?: AbortSignal): Promise<never> => {
  const { promise, reject } = Promise.withResolvers<never>();
  signal?.addEventListener(
    'abort',
    () => reject(new DOMException('Aborted', 'AbortError')),
    { once: true },
  );
  return promise;
};

export class FakeFiles {
  readonly #files = new Map<string, FakeFile>();
  readonly #next = new Map<string, FakeTransfer>();
  readonly requests: string[] = [];
  readonly starts: number[] = [];

  constructor(private readonly network: NetworkStatus) {}

  put(url: string, file: FakeFile): void {
    this.#files.set(url, file);
  }

  next(url: string, transfer: FakeTransfer): void {
    this.#next.set(url, transfer);
  }

  async download(
    url: string,
    onChunk: (chunk: Uint8Array<ArrayBuffer>) => void,
    { from = 0, restart, signal }: DownloadOptions = {},
  ): Promise<{ type: string }> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!this.network.onLine) throw new TypeError('Failed to fetch');
    this.requests.push(url);
    this.starts.push(from);
    const file = this.#files.get(url);
    if (!file) throw new Error('文件服务器回了 404');
    if (from > 0 && file.ranges === false) {
      restart?.();
      from = 0;
    }
    const transfer = this.#next.get(url) ?? {};
    this.#next.delete(url);
    const half = from + Math.floor((file.bytes - from) / 2);
    if (transfer.until || transfer.cut) {
      onChunk(new Uint8Array(half - from));
      if (transfer.until) {
        await Promise.race([transfer.until, aborted(signal)]);
      }
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (transfer.cut || !this.network.onLine)
        throw new TypeError('network error');
      onChunk(new Uint8Array(file.bytes - half));
    } else {
      onChunk(new Uint8Array(file.bytes - from));
    }
    return { type: file.type };
  }
}

export class FakeObjectUrls {
  readonly #blobs = new Map<string, Blob>();
  #count = 0;

  create(blob: Blob): string {
    const url = `blob:campanula/${++this.#count}`;
    this.#blobs.set(url, blob);
    return url;
  }

  revoke(url: string): void {
    this.#blobs.delete(url);
  }

  blobOf(url: string): Blob | undefined {
    return this.#blobs.get(url);
  }
}

export interface FakeWrite {
  until?: Promise<void>;
  error?: DOMException;
}

export class FakeFolder implements FolderCapability {
  readonly files = new Map<string, Blob>();
  readonly #next = new Map<string, FakeWrite>();
  readonly #started = new Map<string, () => void>();

  constructor(
    readonly name: string,
    existing: readonly string[] = [],
  ) {
    for (const file of existing) this.files.set(file, new Blob());
  }

  nextWrite(file: string, write: FakeWrite): void {
    this.#next.set(file, write);
  }

  writing(file: string): Promise<void> {
    return new Promise((resolve) => this.#started.set(file, resolve));
  }

  async getFileHandle(
    name: string,
    { create = false } = {},
  ): Promise<FileCapability> {
    if (!name || name === '.' || name === '..' || /[/\\]/.test(name))
      throw new TypeError(`Name is not allowed: ${name}`);
    if (!this.files.has(name)) {
      if (!create)
        throw new DOMException(
          `A requested file or directory could not be found: ${name}`,
          'NotFoundError',
        );
      this.files.set(name, new Blob());
    }
    return {
      createWritable: async () => this.#writable(name),
    };
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name))
      throw new DOMException(
        `A requested file or directory could not be found: ${name}`,
        'NotFoundError',
      );
  }

  #writable(name: string): WritableCapability {
    const chunks: Blob[] = [];
    let state: 'writable' | 'erroring' | 'errored' | 'closed' = 'writable';
    let inFlight: Promise<unknown> | null = null;
    return {
      write: async (data) => {
        if (state !== 'writable')
          throw new TypeError('The stream is not writable');
        const planned = this.#next.get(name) ?? {};
        this.#next.delete(name);
        this.#started.get(name)?.();
        this.#started.delete(name);
        const writing = (async () => {
          await planned.until;
          if (planned.error) {
            state = 'errored';
            throw planned.error;
          }
          chunks.push(data);
        })();
        inFlight = writing;
        try {
          await writing;
        } finally {
          inFlight = null;
        }
      },
      close: async () => {
        if (state !== 'writable')
          throw new TypeError('The stream is not writable');
        state = 'closed';
        this.files.set(name, new Blob(chunks));
      },
      abort: async () => {
        if (state === 'errored' || state === 'closed') return;
        state = 'erroring';
        await inFlight?.catch(() => {});
        state = 'errored';
        chunks.length = 0;
      },
    };
  }
}

export type FolderChoice = FakeFolder | 'cancel';

export class FakeFolders {
  supported = true;
  opened = 0;
  readonly #choices: FolderChoice[] = [];

  next(choice: FolderChoice): void {
    this.#choices.push(choice);
  }

  async pick(): Promise<FakeFolder> {
    this.opened += 1;
    const choice = this.#choices.shift();
    if (choice === undefined)
      throw new Error('测试没有排好听众在文件夹选择器里怎么做');
    if (choice === 'cancel')
      throw new DOMException('The user aborted a request.', 'AbortError');
    return choice;
  }
}

class FakeLock implements Lock {
  constructor(
    readonly name: string,
    readonly mode: LockMode,
  ) {}
}

interface LockRequest {
  name: string;
  mode: LockMode;
  callback: LockGrantedCallback<unknown>;
  signal: AbortSignal | undefined;
  invoked: boolean;
  scope: object | undefined;
  settle: {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  };
}

const invoke = (
  callback: LockGrantedCallback<unknown>,
  lock: Lock | null,
): Promise<unknown> => new Promise((resolve) => resolve(callback(lock)));

export class FakeLocks implements LocksCapability {
  readonly #held: FakeLock[] = [];
  readonly #queues = new Map<string, LockRequest[]>();
  readonly #owners = new Map<FakeLock, object>();
  readonly #closed = new WeakSet<object>();
  pending = 0;

  #task(step: () => void): void {
    this.pending += 1;
    setImmediate(() => {
      this.pending -= 1;
      step();
    });
  }

  request<T>(
    name: string,
    callback: LockGrantedCallback<T>,
  ): Promise<Awaited<T>>;
  request<T>(
    name: string,
    options: LockOptions,
    callback: LockGrantedCallback<T>,
  ): Promise<Awaited<T>>;
  request<T>(
    name: string,
    ...args: [LockGrantedCallback<T>] | [LockOptions, LockGrantedCallback<T>]
  ): Promise<Awaited<T>> {
    return this.#request(undefined, name, ...args);
  }

  scoped(scope: object): LocksCapability {
    return {
      request: <T>(
        name: string,
        ...args:
          | [LockGrantedCallback<T>]
          | [LockOptions, LockGrantedCallback<T>]
      ) => this.#request(scope, name, ...args),
    };
  }

  release(scope: object): void {
    this.#closed.add(scope);
    const names = new Set<string>();
    for (let at = this.#held.length - 1; at >= 0; at -= 1) {
      const lock = this.#held[at]!;
      if (this.#owners.get(lock) !== scope) continue;
      this.#owners.delete(lock);
      this.#held.splice(at, 1);
      names.add(lock.name);
    }
    for (const [name, queue] of this.#queues) {
      const kept = queue.filter((request) => request.scope !== scope);
      if (kept.length === queue.length) continue;
      this.#queues.set(name, kept);
      names.add(name);
    }
    for (const name of names) this.#process(name);
  }

  #request<T>(
    scope: object | undefined,
    name: string,
    ...args: [LockGrantedCallback<T>] | [LockOptions, LockGrantedCallback<T>]
  ): Promise<Awaited<T>> {
    const [options, callback] = args.length === 1 ? [{}, args[0]] : args;
    const {
      mode = 'exclusive',
      ifAvailable = false,
      steal = false,
      signal,
    } = options;
    const notSupported = (message: string) =>
      Promise.reject(new DOMException(message, 'NotSupportedError'));
    if (name.startsWith('-')) return notSupported('以 - 开头的锁名是保留的');
    if (steal && ifAvailable)
      return notSupported('steal 和 ifAvailable 不能同时用');
    if (steal && mode !== 'exclusive')
      return notSupported('steal 只能用于 exclusive');
    if (signal && (steal || ifAvailable))
      return notSupported('signal 不能和 steal、ifAvailable 同时用');
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (steal) throw new Error('Web Locks 替身没有做 steal');

    return new Promise((resolve, reject) => {
      const request: LockRequest = {
        name,
        mode,
        callback: callback as LockGrantedCallback<unknown>,
        signal,
        invoked: false,
        scope,
        settle: { resolve: resolve as (value: unknown) => void, reject },
      };
      const queue = this.#queue(name);
      if (ifAvailable && !this.#grantable(request)) {
        this.#task(() => {
          if (scope && this.#closed.has(scope)) return;
          resolve(invoke(request.callback, null) as Promise<Awaited<T>>);
        });
        return;
      }
      signal?.addEventListener(
        'abort',
        () => {
          if (request.invoked) return;
          reject(signal.reason);
          const at = queue.indexOf(request);
          if (at !== -1) {
            queue.splice(at, 1);
            this.#process(name);
          }
        },
        { once: true },
      );
      queue.push(request);
      this.#process(name);
    });
  }

  #queue(name: string): LockRequest[] {
    let queue = this.#queues.get(name);
    if (!queue) this.#queues.set(name, (queue = []));
    return queue;
  }

  #grantable(request: LockRequest): boolean {
    const queue = this.#queue(request.name);
    if (queue.length > 0 && queue[0] !== request) return false;
    const sameName = this.#held.filter((lock) => lock.name === request.name);
    return request.mode === 'exclusive'
      ? sameName.length === 0
      : sameName.every((lock) => lock.mode !== 'exclusive');
  }

  #process(name: string): void {
    const queue = this.#queue(name);
    while (queue.length > 0 && this.#grantable(queue[0])) {
      const request = queue.shift()!;
      const lock = new FakeLock(request.name, request.mode);
      this.#held.push(lock);
      if (request.scope) this.#owners.set(lock, request.scope);
      const release = () => {
        const at = this.#held.indexOf(lock);
        if (at !== -1) this.#held.splice(at, 1);
        this.#owners.delete(lock);
        this.#process(name);
      };
      this.#task(() => {
        if (
          request.signal?.aborted ||
          (request.scope && this.#closed.has(request.scope))
        )
          return release();
        request.invoked = true;
        const waiting = invoke(request.callback, lock);
        void waiting
          .catch(() => {})
          .then(() => {
            release();
            request.settle.resolve(waiting);
          });
      });
    }
  }
}

export class FakeBroadcast {
  readonly #open = new Set<FakeChannel>();
  pending = 0;

  channel = (name: string): ChannelCapability => {
    const channel = new FakeChannel(name, this);
    this.#open.add(channel);
    return channel;
  };

  deliver(source: FakeChannel, data: unknown): void {
    for (const destination of this.#open) {
      if (destination === source || destination.name !== source.name) continue;
      this.pending += 1;
      setImmediate(() => {
        this.pending -= 1;
        if (!destination.closed) {
          destination.dispatchEvent(
            new MessageEvent('message', {
              data: structuredClone(data),
            }),
          );
        }
      });
    }
  }

  forget(channel: FakeChannel): void {
    this.#open.delete(channel);
  }
}

class FakeChannel extends EventTarget implements ChannelCapability {
  closed = false;

  constructor(
    readonly name: string,
    private readonly broadcast: FakeBroadcast,
  ) {
    super();
  }

  postMessage(message: unknown): void {
    if (this.closed)
      throw new DOMException('频道已经关闭', 'InvalidStateError');
    this.broadcast.deliver(this, structuredClone(message));
  }

  close(): void {
    this.closed = true;
    this.broadcast.forget(this);
  }
}

export class FakeMediaMetadata implements MediaMetadata {
  title: string;
  artist: string;
  album: string;
  artwork: readonly MediaImage[];

  constructor(init: MediaMetadataInit = {}) {
    this.title = init.title ?? '';
    this.artist = init.artist ?? '';
    this.album = init.album ?? '';
    this.artwork = (init.artwork ?? []).map((image) => ({ ...image }));
  }
}

export class FakeMediaSession implements MediaSessionCapability {
  metadata: MediaMetadata | null = null;
  playbackState: MediaSessionPlaybackState = 'none';
  position: Required<MediaPositionState> | null = null;
  readonly #handlers = new Map<MediaSessionAction, MediaSessionActionHandler>();

  get actions(): MediaSessionAction[] {
    return [...this.#handlers.keys()];
  }

  setActionHandler(
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null,
  ): void {
    if (handler) this.#handlers.set(action, handler);
    else this.#handlers.delete(action);
  }

  setPositionState(state?: MediaPositionState): void {
    if (!state || Object.keys(state).length === 0) {
      this.position = null;
      return;
    }
    const { duration, position = 0, playbackRate = 1 } = state;
    if (duration === undefined || Number.isNaN(duration) || duration < 0)
      throw new TypeError(`setPositionState：时长不合法（${duration}）`);
    if (position < 0 || position > duration)
      throw new TypeError(
        `setPositionState：进度 ${position} 不在 0 到 ${duration} 之间`,
      );
    if (playbackRate === 0)
      throw new TypeError('setPositionState：速度不能是 0');
    this.position = { duration, position, playbackRate };
  }

  press(
    action: MediaSessionAction,
    details: Omit<MediaSessionActionDetails, 'action'> = {},
  ): void {
    const handler = this.#handlers.get(action);
    if (!handler) throw new Error(`锁屏上没有 ${action} 按钮`);
    handler({ action, ...details });
  }
}

export class MediaTasks {
  pending = 0;

  queue(step: () => void): void {
    this.pending += 1;
    setImmediate(() => {
      this.pending -= 1;
      step();
    });
  }
}

export const MEDIA_ERR_NETWORK = 2;
export const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

interface PendingPlay {
  resolve: () => void;
  reject: (reason: DOMException) => void;
}

export class FakeAudio extends EventTarget implements AudioCapability {
  #src = '';
  #currentTime = 0;
  duration = Number.NaN;
  paused = true;
  ended = false;
  volume = 1;
  preload: AudioCapability['preload'] = 'auto';
  error: { code: number } | null = null;
  sounding = false;
  #ready = false;
  #pending: PendingPlay[] = [];
  #closed = false;

  constructor(private readonly tasks: MediaTasks) {
    super();
  }

  close(): void {
    this.#closed = true;
    this.paused = true;
    this.sounding = false;
    this.#pending = [];
  }

  get src(): string {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    this.#ready = false;
    this.paused = true;
    this.sounding = false;
    this.ended = false;
    this.#currentTime = 0;
    this.duration = Number.NaN;
    this.error = null;
    this.#reject(this.#take(), 'AbortError');
  }

  get currentTime(): number {
    return this.#currentTime;
  }

  set currentTime(value: number) {
    this.#currentTime = value;
    this.ended = false;
  }

  play(): Promise<void> {
    if (this.error?.code === MEDIA_ERR_SRC_NOT_SUPPORTED)
      return Promise.reject(
        new DOMException('地址放不了', 'NotSupportedError'),
      );
    const promise = new Promise<void>((resolve, reject) =>
      this.#pending.push({ resolve, reject }),
    );
    if (this.ended) this.currentTime = 0;
    if (this.paused) {
      this.paused = false;
      this.tasks.queue(() => this.#fire('play'));
      if (!this.#ready) this.tasks.queue(() => this.#fire('waiting'));
    }
    if (this.#ready) {
      this.tasks.queue(() => {
        if (this.paused || !this.#ready) return;
        this.#sound();
      });
    }
    return promise;
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.sounding = false;
    const pending = this.#take();
    this.tasks.queue(() => {
      this.#fire('timeupdate');
      this.#fire('pause');
      this.#reject(pending, 'AbortError');
    });
  }

  ready(duration = 240): void {
    if (!this.#src) throw new Error('播放器还没有地址');
    const known = !Number.isNaN(this.duration);
    this.#ready = true;
    this.duration = duration;
    if (!known) this.#fire('durationchange');
    this.#fire('canplaythrough');
    if (!this.paused) this.#sound();
  }

  progress(seconds: number): void {
    if (!this.sounding) throw new Error('播放器没在出声');
    this.#currentTime = seconds;
    this.#fire('timeupdate');
  }

  end(): void {
    if (!this.sounding) throw new Error('播放器没在出声');
    this.#currentTime = this.duration;
    this.paused = true;
    this.sounding = false;
    this.ended = true;
    this.#fire('timeupdate');
    this.#fire('pause');
    this.#fire('ended');
  }

  stall(): void {
    if (!this.sounding) throw new Error('播放器没在出声');
    this.#ready = false;
    this.sounding = false;
    this.#fire('waiting');
  }

  fail(
    code:
      | typeof MEDIA_ERR_NETWORK
      | typeof MEDIA_ERR_SRC_NOT_SUPPORTED = MEDIA_ERR_NETWORK,
  ): void {
    this.error = { code };
    this.#ready = false;
    this.sounding = false;
    this.#fire('error');
    if (code === MEDIA_ERR_SRC_NOT_SUPPORTED)
      this.#reject(this.#take(), 'NotSupportedError');
  }

  #sound(): void {
    if (!this.sounding) {
      this.sounding = true;
      this.#fire('playing');
    }
    for (const pending of this.#take()) pending.resolve();
  }

  #take(): PendingPlay[] {
    const pending = this.#pending;
    this.#pending = [];
    return pending;
  }

  #reject(
    pending: PendingPlay[],
    name: 'AbortError' | 'NotSupportedError',
  ): void {
    for (const play of pending) {
      play.reject(
        new DOMException(
          name === 'AbortError' ? '播放被打断' : '地址放不了',
          name,
        ),
      );
    }
  }

  #fire(type: string): void {
    if (!this.#closed) this.dispatchEvent(new Event(type));
  }
}
