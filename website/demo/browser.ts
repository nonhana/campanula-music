import type { BrowserCapabilities } from '#lib/app/browser.ts';

import { sampleFetch } from './sample.ts';

export const demoBrowser = (namespace: string): BrowserCapabilities => {
  const audios = new Set<HTMLAudioElement>();
  const unavailable = async (): Promise<never> => {
    throw new Error('示例只开放播放、歌词和队列');
  };
  const request: BrowserCapabilities['locks']['request'] = <T>(
    name: string,
    options: LockOptions | LockGrantedCallback<T>,
    callback?: LockGrantedCallback<T>,
  ) =>
    typeof options === 'function'
      ? navigator.locks.request(`${namespace}:${name}`, options)
      : navigator.locks.request(`${namespace}:${name}`, options, callback!);
  return {
    fetch: sampleFetch,
    indexedDB,
    clock: {
      now: () => Date.now(),
      after: (ms, callback) => {
        const id = setTimeout(callback, ms);
        return () => clearTimeout(id);
      },
    },
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
    MediaMetadata,
    locks: { request },
    broadcastChannel: (name) => new BroadcastChannel(`${namespace}:${name}`),
    audio: () => {
      const audio = new Audio();
      audios.add(audio);
      audio.addEventListener('error', () => {
        if (parent === window) for (const current of audios) current.pause();
        parent.postMessage(
          { type: 'campanula-demo-media-error' },
          location.origin,
        );
      });
      window.addEventListener('pagehide', () => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      });
      return audio;
    },
    checkToken: unavailable,
    images: { decode: unavailable, release: () => {}, exportJpeg: unavailable },
    uploadCoverImage: unavailable,
    download: unavailable,
    storage: {
      estimate: async () => ({ usage: null, quota: null }),
      persist: async () => false,
    },
    objectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    pickFolder: null,
  };
};
