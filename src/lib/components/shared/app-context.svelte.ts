import { createContext } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';

import type { App, AppState } from '#lib/app/app.ts';
import type { PlayerState } from '#lib/app/player.ts';

export interface AppView {
  readonly app: App;
  readonly state: AppState;
  readonly demo?: boolean;
}

export const viewOf = (app: App): AppView => {
  let active = 0;
  let stop: (() => void) | null = null;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 只保存订阅回调集合，本身不驱动界面更新
  const syncers = new Set<() => void>();
  const syncAll = () => {
    for (const sync of syncers) sync();
  };
  const connect = () => {
    if (active === 0) stop = app.subscribe(syncAll);
    active += 1;
    return () => {
      active -= 1;
      if (active === 0) {
        stop?.();
        stop = null;
      }
    };
  };
  const slice = <T>(
    read: (state: AppState) => T,
    equal: (a: T, b: T) => boolean = Object.is,
  ): (() => T) => {
    let last = read(app.state);
    const subscribe = createSubscriber((update) => {
      last = read(app.state);
      const check = () => {
        const next = read(app.state);
        if (!equal(next, last)) {
          last = next;
          update();
        }
      };
      syncers.add(check);
      const disconnect = connect();
      return () => {
        syncers.delete(check);
        disconnect();
      };
    });
    return () => {
      subscribe();
      return read(app.state);
    };
  };

  // 按字段拆分订阅，避免播放时高频 timeupdate（player.position）唤醒列表行和封面重算
  const readSession = slice((state) => state.session);
  const readLogin = slice((state) => state.login);
  const readLibrary = slice((state) => state.library);
  const readNotices = slice((state) => state.notices);
  const readLyrics = slice((state) => state.lyrics);
  const readDaily = slice((state) => state.daily);
  const readSearch = slice((state) => state.search);
  const readDownloads = slice((state) => state.downloads);
  const readExporting = slice((state) => state.exporting);
  const readCover = slice((state) => state.cover);
  const readOnline = slice((state) => state.online);

  const readQueue = slice((state) => state.player.queue);
  const readCurrent = slice((state) => state.player.current);
  const readStatus = slice((state) => state.player.status);
  const readPosition = slice((state) => state.player.position);
  const readDuration = slice((state) => state.player.duration);
  const readTrial = slice((state) => state.player.trial);
  const readVolume = slice((state) => state.player.volume);
  const readNotice = slice((state) => state.player.notice);
  const readChange = slice((state) => state.player.change);
  const readMode = slice((state) => state.player.mode);
  const readNeighbors = slice(
    (state) => state.player.neighbors,
    (a, b) => a.previous === b.previous && a.next === b.next,
  );
  const readQuality = slice((state) => state.player.quality);

  const player: PlayerState = {
    get queue() {
      return readQueue();
    },
    get current() {
      return readCurrent();
    },
    get status() {
      return readStatus();
    },
    get position() {
      return readPosition();
    },
    get duration() {
      return readDuration();
    },
    get trial() {
      return readTrial();
    },
    get volume() {
      return readVolume();
    },
    get notice() {
      return readNotice();
    },
    get change() {
      return readChange();
    },
    get mode() {
      return readMode();
    },
    get neighbors() {
      return readNeighbors();
    },
    get quality() {
      return readQuality();
    },
  };

  const state: AppState = {
    get session() {
      return readSession();
    },
    get login() {
      return readLogin();
    },
    get library() {
      return readLibrary();
    },
    get notices() {
      return readNotices();
    },
    get player() {
      return player;
    },
    get lyrics() {
      return readLyrics();
    },
    get daily() {
      return readDaily();
    },
    get search() {
      return readSearch();
    },
    get downloads() {
      return readDownloads();
    },
    get exportable() {
      return app.state.exportable;
    },
    get touchPrimary() {
      return app.state.touchPrimary;
    },
    get exporting() {
      return readExporting();
    },
    get cover() {
      return readCover();
    },
    get online() {
      return readOnline();
    },
    get playable() {
      readDownloads();
      readOnline();
      readSession();
      return app.state.playable;
    },
    get downloadBlock() {
      readDownloads();
      readOnline();
      readSession();
      return app.state.downloadBlock;
    },
  };

  return {
    app,
    state,
  };
};

export const [getAppView, setAppView] = createContext<AppView>();
