import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';

import { unseen } from './motion.ts';

type ImageStatus = 'loading' | 'cached' | 'loaded' | 'broken';

// 只看 img.complete 不够：屏幕外的懒加载图缓存里有也要等它进到附近才标成加载好
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- 只在挂上 img 的那一刻查，不驱动界面更新，不用做成响应式
const loaded = new Set<string>();

// eslint-disable-next-line svelte/prefer-svelte-reactivity -- 只是留着引用，不驱动界面更新
const preloading = new Map<
  string,
  { img: HTMLImageElement; done: Promise<void> }
>();

// 只等 load 不够，没解码的图第一次画可能先空一帧
export const preloadImage = (src: string): Promise<void> => {
  if (loaded.has(src)) return Promise.resolve();
  let pending = preloading.get(src);
  if (!pending) {
    const img = new Image();
    img.src = src;
    const done = img
      .decode()
      .then(
        () => void loaded.add(src),
        () => {},
      )
      .finally(() => preloading.delete(src));
    pending = { img, done };
    preloading.set(src, pending);
  }
  return pending.done;
};

export const imageLoaded = (src: string): boolean => loaded.has(src);

export interface ImageReveal {
  readonly status: ImageStatus;
  image: Attachment<HTMLImageElement>;
}

// source 要在组件初始化时调用。
export const createImageReveal = (
  source: () => string,
  { instant = false }: { instant?: boolean } = {},
): ImageReveal => {
  let seen = $state<{
    source: string;
    status: Exclude<ImageStatus, 'loading'>;
  } | null>(null);
  const status = $derived.by((): ImageStatus => {
    const src = source();
    if (!src) return 'loading';
    if (loaded.has(src)) return 'cached';
    return seen?.source === src ? seen.status : 'loading';
  });

  return {
    get status() {
      return status;
    },
    image(img) {
      const initial = untrack(source);
      if (
        initial &&
        img.getAttribute('src') === initial &&
        img.complete &&
        img.naturalWidth > 0
      ) {
        loaded.add(initial);
        seen = { source: initial, status: 'cached' };
      }
      const onload = () => {
        const src = untrack(source);
        if (
          !src ||
          img.getAttribute('src') !== src ||
          !img.complete ||
          img.naturalWidth === 0
        )
          return;
        loaded.add(src);
        if (seen?.source !== src) {
          seen = {
            source: src,
            status: instant || unseen() ? 'cached' : 'loaded',
          };
        }
      };
      const onerror = () => {
        const src = untrack(source);
        if (!src || img.getAttribute('src') !== src) return;
        seen = { source: src, status: 'broken' };
      };
      img.addEventListener('load', onload);
      img.addEventListener('error', onerror);
      return () => {
        img.removeEventListener('load', onload);
        img.removeEventListener('error', onerror);
      };
    },
  };
};
