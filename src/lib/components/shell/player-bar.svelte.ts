import type { Component } from 'svelte';

let desktop = $state.raw<Component>();
let phone = $state.raw<Component>();
let loadingDesktop: Promise<void> | null = null;
let loadingPhone: Promise<void> | null = null;

export const playerBar = {
  get desktop() {
    return desktop;
  },
  get phone() {
    return phone;
  },
};

export const preloadPlayerBar = (isDesktop: boolean): Promise<void> => {
  if (isDesktop) {
    if (desktop) return Promise.resolve();
    loadingDesktop ??= import('../player/DesktopPlayerBar.svelte')
      .then((module) => {
        desktop = module.default;
      })
      .catch((error: unknown) => {
        loadingDesktop = null;
        console.error('加载桌面播放条失败', error);
      });
    return loadingDesktop;
  }
  if (phone) return Promise.resolve();
  loadingPhone ??= import('../player/PhoneMiniPlayer.svelte')
    .then((module) => {
      phone = module.default;
    })
    .catch((error: unknown) => {
      loadingPhone = null;
      console.error('加载手机播放条失败', error);
    });
  return loadingPhone;
};

// 空队列时在首屏稳定后空闲预热对应端播放条，确保首次播歌时封面飞行和底栏滑入不掉帧
export const warmPlayerBar = (isDesktop: () => boolean): (() => void) => {
  const run = () => {
    void preloadPlayerBar(isDesktop());
  };
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(run, { timeout: 2000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(run, 1000);
  return () => clearTimeout(id);
};
