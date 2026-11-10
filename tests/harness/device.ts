import { IDBDatabase, IDBFactory } from 'fake-indexeddb';
import type { Cookie } from 'tough-cookie';
import { CookieJar } from 'tough-cookie';

import type { App } from '#lib/app/app.js';
import { createApp } from '#lib/app/app.js';
import type {
  BrowserCapabilities,
  ChannelCapability,
  Clock,
  NetworkStatus,
} from '#lib/app/browser.js';

import {
  FakeAudio,
  FakeBroadcast,
  FakeFiles,
  FakeFolders,
  FakeImages,
  FakeLocks,
  FakeMediaMetadata,
  FakeMediaSession,
  FakeNetwork,
  FakeObjectUrls,
  FakePage,
  FakeStorage,
  FakeWatchman,
  MediaTasks,
} from './browser';

export interface SentRequest {
  method: string;
  path: string;
  body?: unknown;
  keepalive?: true;
}

interface ReceivedResponse {
  method: string;
  path: string;
  status: number;
}

export interface Tab {
  app: App;
  hide: () => void;
  show: () => void;
  freeze: () => void;
  resume: () => void;
  close: () => void;
  mediaSession: FakeMediaSession;
  watchman: FakeWatchman;
  audio: readonly FakeAudio[];
  sounding: () => FakeAudio | undefined;
}

export interface Device {
  open: () => Promise<Tab>;
  readonly requests: readonly SentRequest[];
  readonly pending: readonly SentRequest[];
  readonly responseBodies: readonly string[];
  readonly responses: readonly ReceivedResponse[];
  cookies: () => Promise<Cookie[]>;
  setCookie: (setCookie: string) => Promise<void>;
  stored: () => Promise<Record<string, [IDBValidKey, unknown][]>>;
  preload: (
    version: number,
    prepare: (database: IDBDatabase) => void,
  ) => Promise<void>;
  setOnline: (online: boolean) => void;
  images: FakeImages;
  files: FakeFiles;
  storage: FakeStorage;
  objectUrls: FakeObjectUrls;
  folders: FakeFolders;
  idle: () => Promise<void>;
  busy: () => boolean;
}

const LOCAL_DB = 'campanula';

let activeTransactions = 0;
const transaction = IDBDatabase.prototype.transaction;
IDBDatabase.prototype.transaction = function (
  this: IDBDatabase,
  ...args: Parameters<IDBDatabase['transaction']>
) {
  const started = transaction.apply(this, args);
  activeTransactions += 1;
  const finished = () => {
    activeTransactions -= 1;
  };
  started.addEventListener('complete', finished);
  started.addEventListener('abort', finished);
  return started;
};

const bodyOf = (init: RequestInit | undefined): Pick<SentRequest, 'body'> =>
  typeof init?.body === 'string'
    ? {
        body: JSON.parse(init.body) as unknown,
      }
    : {};

export const SENT_HEADER = 'x-test-sent';

export interface DeviceTraits {
  touchPrimary?: boolean;
}

export const createDevice = (
  origin: string,
  clock: Clock,
  stamp: () => number,
  traits: DeviceTraits = {},
): Device => {
  const jar = new CookieJar();
  const requests: SentRequest[] = [];
  const pending: SentRequest[] = [];
  const responseBodies: string[] = [];
  const responses: ReceivedResponse[] = [];
  const indexedDB = new IDBFactory();
  const network = new FakeNetwork();
  const locks = new FakeLocks();
  const broadcast = new FakeBroadcast();
  const mediaTasks = new MediaTasks();
  const images = new FakeImages();
  const inFlight = new Set<Promise<unknown>>();
  const files = new FakeFiles(network);
  const objectUrls = new FakeObjectUrls();
  const folders = new FakeFolders();
  const storage = new FakeStorage();

  const track = (work: Promise<unknown>): void => {
    inFlight.add(work);
    void work.catch(() => {}).finally(() => inFlight.delete(work));
  };

  const deviceIndexedDB = Object.create(indexedDB) as IDBFactory;
  deviceIndexedDB.open = (name, version) => {
    const request = indexedDB.open(name, version);
    track(
      new Promise((resolve) => {
        request.addEventListener('success', resolve);
        request.addEventListener('error', resolve);
      }),
    );
    return request;
  };

  const send = async (path: string, init?: RequestInit): Promise<Response> => {
    const sentAt = stamp();
    if (!network.onLine) throw new TypeError('Failed to fetch');
    const request = new Request(new URL(path, origin), init);
    request.headers.set(SENT_HEADER, String(sentAt));
    const url = new URL(request.url);
    const sent: SentRequest = {
      method: request.method,
      path: url.pathname + url.search,
      ...bodyOf(init),
      ...(request.keepalive ? { keepalive: true as const } : {}),
    };
    requests.push(sent);
    pending.push(sent);
    try {
      const cookie = await jar.getCookieString(request.url);
      if (cookie) request.headers.set('cookie', cookie);
      const response = await fetch(request);
      responses.push({
        method: request.method,
        path: sent.path,
        status: response.status,
      });
      for (const setCookie of response.headers.getSetCookie())
        await jar.setCookie(setCookie, response.url);
      responseBodies.push(await response.clone().text());
      return response;
    } finally {
      pending.splice(pending.indexOf(sent), 1);
    }
  };

  const busy = () =>
    activeTransactions > 0 ||
    locks.pending > 0 ||
    broadcast.pending > 0 ||
    mediaTasks.pending > 0;

  const deviceFetch: BrowserCapabilities['fetch'] = (path, init) => {
    const sending = send(path, init);
    track(sending);
    return sending;
  };

  return {
    requests,
    pending,
    responseBodies,
    responses,
    async open() {
      const page = new FakePage();
      const lockScope = {};
      const mediaSession = new FakeMediaSession();
      const audio: FakeAudio[] = [];
      const watchman = new FakeWatchman();
      let closed = false;
      const alive = (callback: () => void) => () => {
        if (!closed) callback();
      };
      const channels: ChannelCapability[] = [];
      const networkListeners = {
        online: new Map<() => void, () => void>(),
        offline: new Map<() => void, () => void>(),
      };
      const tabNetwork: NetworkStatus = {
        get onLine() {
          return network.onLine;
        },
        addEventListener(type, listener) {
          const gated = networkListeners[type].get(listener) ?? alive(listener);
          networkListeners[type].set(listener, gated);
          network.addEventListener(type, gated);
        },
        removeEventListener(type, listener) {
          const gated = networkListeners[type].get(listener);
          if (gated) network.removeEventListener(type, gated);
          networkListeners[type].delete(listener);
        },
      };
      const app = createApp({
        fetch: deviceFetch,
        clock: {
          now: clock.now,
          after: (ms, callback) => clock.after(ms, alive(callback)),
        },
        indexedDB: deviceIndexedDB,
        network: tabNetwork,
        page,
        touchPrimary: traits.touchPrimary ?? false,
        mediaSession,
        MediaMetadata: FakeMediaMetadata,
        locks: locks.scoped(lockScope),
        broadcastChannel: (name) => {
          const channel = broadcast.channel(name);
          channels.push(channel);
          return channel;
        },
        audio: () => {
          const player = new FakeAudio(mediaTasks);
          audio.push(player);
          return player;
        },
        checkToken: () => watchman.checkToken(),
        images,
        uploadCoverImage(url, jpeg, token, signal) {
          const work = images.uploadCoverImage(url, jpeg, token, signal);
          track(work);
          return work;
        },
        download(url, onChunk, options) {
          const work = files.download(url, onChunk, options);
          track(work);
          return work;
        },
        storage,
        objectUrl: (blob) => objectUrls.create(blob),
        revokeObjectUrl: (url) => objectUrls.revoke(url),
        pickFolder: folders.supported ? () => folders.pick() : null,
      });
      await app.open();
      return {
        app,
        hide: () => page.set('hidden'),
        show: () => page.set('visible'),
        freeze: () => page.freeze(),
        resume: () => page.resume(),
        close: () => {
          page.set('hidden');
          closed = true;
          locks.release(lockScope);
          for (const player of audio) player.close();
          for (const channel of channels) channel.close();
        },
        mediaSession,
        watchman,
        audio,
        sounding: () => audio.find((player) => player.sounding),
      };
    },
    cookies: () => jar.getCookies(origin),
    setCookie: async (setCookie) => {
      await jar.setCookie(setCookie, origin);
    },
    async preload(version, prepare) {
      if ((await indexedDB.databases()).some((info) => info.name === LOCAL_DB))
        throw new Error('预存旧版数据库要在这台设备第一次打开 App 之前');
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(LOCAL_DB, version);
        request.onupgradeneeded = () => {
          try {
            prepare(request.result);
          } catch (error) {
            request.transaction!.abort();
            reject(error);
          }
        };
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    },
    async stored() {
      if (!(await indexedDB.databases()).some((info) => info.name === LOCAL_DB))
        return {};
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(LOCAL_DB);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const names = [...database.objectStoreNames];
      const transaction = database.transaction(names);
      const read = <T>(request: IDBRequest<T>) =>
        new Promise<T>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      const contents = await Promise.all(
        names.map(async (name) => {
          const store = transaction.objectStore(name);
          const [keys, values] = await Promise.all([
            read(store.getAllKeys()),
            read(store.getAll()),
          ]);
          return [
            name,
            keys.map(
              (key, index) => [key, values[index]] as [IDBValidKey, unknown],
            ),
          ] as const;
        }),
      );
      database.close();
      return Object.fromEntries(contents);
    },
    setOnline: (online) => network.set(online),
    files,
    storage,
    objectUrls,
    folders,
    images,
    async idle() {
      do {
        await Promise.allSettled(inFlight);
        await new Promise((resolve) => setImmediate(resolve));
      } while (inFlight.size > 0 || busy());
    },
    busy,
  };
};
