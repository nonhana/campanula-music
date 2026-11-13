import { initializeWatchman } from 'hana-music-api/watchman';

import type { CoverCrop } from '#lib/api/cover.js';
import {
  COVER_OUTPUT_MAX_BYTES,
  COVER_OUTPUT_MIN_QUALITY,
  COVER_OUTPUT_QUALITY,
  COVER_OUTPUT_SIZE,
  COVER_WORK_MAX_SIDE,
} from '#lib/api/cover.js';
import { mock } from '#lib/mock-flag.js';

export interface BrowserCapabilities {
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  clock: Clock;
  indexedDB: IDBFactory;
  network: NetworkStatus;
  page: PageVisibility;
  touchPrimary: boolean;
  mediaSession: MediaSessionCapability;
  MediaMetadata: typeof MediaMetadata;
  locks: LocksCapability;
  broadcastChannel: (name: string) => ChannelCapability;
  audio: () => AudioCapability;
  checkToken: () => Promise<string>;
  images: ImageCapability;
  uploadCoverImage: (
    url: string,
    jpeg: Blob,
    token: string,
    signal: AbortSignal,
  ) => Promise<void>;
  download: (
    url: string,
    onChunk: (chunk: Uint8Array<ArrayBuffer>) => void,
    options?: DownloadOptions,
  ) => Promise<{ type: string }>;
  storage: {
    estimate: () => Promise<StorageEstimate>;
    persist: () => Promise<boolean>;
  };
  objectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  pickFolder: (() => Promise<FolderCapability>) | null;
}

export interface FolderCapability {
  readonly name: string;
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileCapability>;
  removeEntry: (name: string) => Promise<void>;
}

export interface DownloadOptions {
  from?: number;
  restart?: () => void;
  signal?: AbortSignal;
}

export interface StorageEstimate {
  usage: number | null;
  quota: number | null;
}

export interface FileCapability {
  createWritable: () => Promise<WritableCapability>;
}

export interface WritableCapability {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
}

export interface DecodedImage {
  readonly url: string;
  // 长边已缩到 COVER_WORK_MAX_SIDE 以内，裁剪坐标按它算
  readonly width: number;
  readonly height: number;
  readonly origWidth: number;
  readonly origHeight: number;
}

export interface ImageCapability {
  decode: (file: File) => Promise<DecodedImage>;
  release: (image: DecodedImage) => void;
  exportJpeg: (image: DecodedImage, crop: CoverCrop) => Promise<Blob>;
}

type AudioEvent =
  | 'playing'
  | 'waiting'
  | 'pause'
  | 'timeupdate'
  | 'durationchange'
  | 'canplaythrough'
  | 'ended'
  | 'error';

export interface AudioCapability {
  src: string;
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  volume: number;
  preload: '' | 'none' | 'metadata' | 'auto';
  readonly error: { readonly code: number } | null;
  play: () => Promise<void>;
  pause: () => void;
  addEventListener: (type: AudioEvent, listener: () => void) => void;
}

export type LocksCapability = Pick<LockManager, 'request'>;

export type ChannelCapability = Pick<
  BroadcastChannel,
  'postMessage' | 'addEventListener' | 'close'
>;

export type MediaSessionCapability = Pick<
  MediaSession,
  'metadata' | 'playbackState' | 'setActionHandler' | 'setPositionState'
>;

export interface Clock {
  now: () => number;
  after: (ms: number, callback: () => void) => () => void;
}

export interface NetworkStatus {
  readonly onLine: boolean;
  addEventListener: (type: 'online' | 'offline', listener: () => void) => void;
  removeEventListener: (
    type: 'online' | 'offline',
    listener: () => void,
  ) => void;
}

// Android 上切到后台约 1 分钟后页面被冻结、回来时解冻
export interface PageVisibility {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener: (
    type: 'visibilitychange' | 'freeze' | 'resume',
    listener: () => void,
  ) => void;
  removeEventListener: (
    type: 'visibilitychange' | 'freeze' | 'resume',
    listener: () => void,
  ) => void;
}

const watchmanToken = async (): Promise<string> => {
  if (mock) return 'mock-watchman-token';
  const watchman = await initializeWatchman({
    businessKey: 'afb1a8e61222dcc4b7a733ca69f089cb',
  });
  return watchman.getToken();
};

const COVER_PREVIEW_MAX = 1600;
const WHITE = '#fff';

interface Decoded {
  bitmap: ImageBitmap;
  url: string;
}

const decoded = new WeakMap<DecodedImage, Decoded>();

const drawWhite = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器不给 canvas 的绘图上下文');
  context.fillStyle = WHITE;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = 'high';
  return context;
};

const toJpeg = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('浏览器没能导出 JPEG')),
      'image/jpeg',
      quality,
    ),
  );

const decodeImage = async (file: File): Promise<DecodedImage> => {
  let bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  const origWidth = bitmap.width;
  const origHeight = bitmap.height;
  const longest = Math.max(origWidth, origHeight);
  if (longest > COVER_WORK_MAX_SIDE) {
    const scale = COVER_WORK_MAX_SIDE / longest;
    const smaller = await createImageBitmap(bitmap, {
      resizeWidth: Math.round(origWidth * scale),
      resizeHeight: Math.round(origHeight * scale),
      resizeQuality: 'high',
    });
    bitmap.close();
    bitmap = smaller;
  }
  const previewScale = Math.min(
    1,
    COVER_PREVIEW_MAX / Math.max(bitmap.width, bitmap.height),
  );
  const preview = document.createElement('canvas');
  preview.width = Math.round(bitmap.width * previewScale);
  preview.height = Math.round(bitmap.height * previewScale);
  drawWhite(preview).drawImage(bitmap, 0, 0, preview.width, preview.height);
  const blob = await toJpeg(preview, 0.85);
  const image: DecodedImage = {
    url: URL.createObjectURL(blob),
    width: bitmap.width,
    height: bitmap.height,
    origWidth,
    origHeight,
  };
  decoded.set(image, { bitmap, url: image.url });
  return image;
};

const releaseImage = (image: DecodedImage): void => {
  const entry = decoded.get(image);
  if (!entry) return;
  decoded.delete(image);
  entry.bitmap.close();
  URL.revokeObjectURL(entry.url);
};

const exportCoverJpeg = async (
  image: DecodedImage,
  crop: CoverCrop,
): Promise<Blob> => {
  const entry = decoded.get(image);
  if (!entry) throw new Error('这张图已经释放了，不能再裁');
  const canvas = document.createElement('canvas');
  canvas.width = COVER_OUTPUT_SIZE;
  canvas.height = COVER_OUTPUT_SIZE;
  drawWhite(canvas).drawImage(
    entry.bitmap,
    crop.x,
    crop.y,
    crop.size,
    crop.size,
    0,
    0,
    COVER_OUTPUT_SIZE,
    COVER_OUTPUT_SIZE,
  );
  let quality = COVER_OUTPUT_QUALITY;
  let blob = await toJpeg(canvas, quality);
  while (
    blob.size > COVER_OUTPUT_MAX_BYTES &&
    quality > COVER_OUTPUT_MIN_QUALITY
  ) {
    quality = Math.max(
      COVER_OUTPUT_MIN_QUALITY,
      Math.round((quality - 0.08) * 100) / 100,
    );
    blob = await toJpeg(canvas, quality);
  }
  return blob;
};

const uploadCoverImage = async (
  url: string,
  jpeg: Blob,
  token: string,
  signal: AbortSignal,
): Promise<void> => {
  const response = await window.fetch(url, {
    method: 'POST',
    headers: { 'x-nos-token': token, 'content-type': 'image/jpeg' },
    body: jpeg,
    signal,
  });
  if (!response.ok) throw new Error(`图片存储回了 ${response.status}`);
};

const download = async (
  url: string,
  onChunk: (chunk: Uint8Array<ArrayBuffer>) => void,
  { from = 0, restart, signal }: DownloadOptions = {},
): Promise<{ type: string }> => {
  const response = await window.fetch(url, {
    ...(from > 0
      ? {
          headers: { Range: `bytes=${from}-` },
        }
      : {}),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok || !response.body)
    throw new Error(`文件服务器回了 ${response.status}`);
  if (from > 0) {
    if (response.status === 206) {
      const range = response.headers.get('content-range');
      if (range !== null) {
        const start = Number(/^bytes (\d+)-/.exec(range)?.[1]);
        if (start !== from) {
          restart?.();
          throw new Error(
            `文件服务器回的第 ${
              Number.isNaN(start) ? '未知' : start
            } 段，要的是 ${from}`,
          );
        }
      }
    } else {
      restart?.();
    }
  }
  const type = response.headers.get('content-type') ?? '';
  const reader = response.body.getReader();
  for (
    let chunk = await reader.read();
    !chunk.done;
    chunk = await reader.read()
  )
    onChunk(chunk.value);
  return { type };
};

type DirectoryPicker = (options: {
  mode: 'readwrite';
  startIn: 'music';
}) => Promise<FileSystemDirectoryHandle>;

export const realBrowserCapabilities = (): BrowserCapabilities => {
  const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker })
    .showDirectoryPicker;
  return {
    fetch: (path, init) => window.fetch(path, init),
    clock: {
      now: () => Date.now(),
      after(ms, callback) {
        const id = window.setTimeout(callback, ms);
        return () => window.clearTimeout(id);
      },
    },
    indexedDB: window.indexedDB,
    network: {
      get onLine() {
        return navigator.onLine;
      },
      addEventListener: (type, listener) =>
        window.addEventListener(type, listener),
      removeEventListener: (type, listener) =>
        window.removeEventListener(type, listener),
    },
    page: document,
    touchPrimary: matchMedia('(pointer: coarse)').matches,
    mediaSession: navigator.mediaSession,
    MediaMetadata: window.MediaMetadata,
    locks: navigator.locks,
    broadcastChannel: (name) => new BroadcastChannel(name),
    audio: () => new Audio(),
    checkToken: watchmanToken,
    images: {
      decode: decodeImage,
      release: releaseImage,
      exportJpeg: exportCoverJpeg,
    },
    uploadCoverImage,
    download,
    storage: {
      async estimate() {
        const { usage = null, quota = null } =
          await navigator.storage.estimate();
        return { usage, quota };
      },
      persist: () => navigator.storage.persist(),
    },
    objectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    pickFolder: picker
      ? () => picker.call(window, { mode: 'readwrite', startIn: 'music' })
      : null,
  };
};
