import type { Component } from 'svelte';

import type {
  LibraryState,
  PlaylistPage,
  syncNoticeFor,
} from '#lib/app/library.ts';

type HomeNotice = ReturnType<typeof syncNoticeFor>;

export type DesktopHomeComponent = Component<{
  library: LibraryState;
  liked: PlaylistPage;
  notice: HomeNotice;
  stripEl?: HTMLElement;
  onReady?: () => void;
}>;

export type PhoneHomeComponent = Component<{
  library: LibraryState;
  likedId: number;
  notice: HomeNotice;
  query: string;
}>;

let desktop = $state.raw<DesktopHomeComponent>();
let phone = $state.raw<PhoneHomeComponent>();
let loadingDesktop: Promise<void> | null = null;
let loadingPhone: Promise<void> | null = null;

export const homeView = {
  get desktop() {
    return desktop;
  },
  get phone() {
    return phone;
  },
};

export const preloadHomeView = (isDesktop: boolean): Promise<void> => {
  if (isDesktop) {
    if (desktop) return Promise.resolve();
    loadingDesktop ??= import('./DesktopLibraryHome.svelte')
      .then((module) => {
        desktop = module.default;
      })
      .catch((error: unknown) => {
        loadingDesktop = null;
        console.error('加载桌面曲库失败', error);
      });
    return loadingDesktop;
  }
  if (phone) return Promise.resolve();
  loadingPhone ??= import('./PhoneLibraryHome.svelte')
    .then((module) => {
      phone = module.default;
    })
    .catch((error: unknown) => {
      loadingPhone = null;
      console.error('加载手机曲库失败', error);
    });
  return loadingPhone;
};
