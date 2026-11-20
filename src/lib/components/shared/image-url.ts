import { displayImageUrl, isNeteaseImageUrl } from '#lib/api/library.ts';

let preconnected = false;

export const ensureNeteaseImagePreconnect = (url: string): void => {
  if (
    preconnected ||
    typeof document === 'undefined' ||
    !isNeteaseImageUrl(url)
  )
    return;
  preconnected = true;
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = 'https://p1.music.126.net';
  document.head.append(link);
};

export const displayPixels = (size: number): number => {
  const dpr =
    typeof window === 'undefined'
      ? 2
      : Math.min(2, Math.max(1, Math.ceil(window.devicePixelRatio || 1)));
  return Math.round(size * dpr);
};

export const displayCoverSource = (url: string, size: number): string => {
  ensureNeteaseImagePreconnect(url);
  return displayImageUrl(url, displayPixels(size));
};
