import type { Song } from '#lib/api/library.js';
import { creditLine } from '#lib/api/library.js';

const KANA = /[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9F]/;
const TRADITIONAL =
  /[們個說這樣對時會從來發現與機關點經國長開門問間聽見東車為讓過還進遠運達選隨實寫學愛戲遊類歲鄧紫倫傑煉幸倔強偷頭風雲夢裡麼妳嗎號鐘覺緣戀憶漸靈雙聲歡]/;

export const langOf = (
  ...texts: (string | null)[]
): 'ja' | 'zh-TW' | undefined => {
  const all = texts.filter((text) => text !== null).join(' ');
  if (KANA.test(all)) return 'ja';
  if (TRADITIONAL.test(all)) return 'zh-TW';
  return undefined;
};

export const artistLine = (song: Song): string => creditLine(song.artists);

export const yearOf = (publishedAt: number | null): number | null =>
  publishedAt !== null && publishedAt > 0
    ? new Date(publishedAt).getFullYear()
    : null;

export const formatCount = (count: number): string =>
  count.toLocaleString('en-US');

export const formatSongCount = (count: number | null): string | null =>
  count === null ? null : `${formatCount(count)} 首`;

export const formatPlays = (count: number): string => {
  if (count < 10_000) return formatCount(count);
  const [unit, label] =
    count < 100_000_000 ? [10_000, '万'] : [100_000_000, '亿'];
  const value = count / unit;
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${label}`;
};

export const formatDuration = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export const formatStorageSize = (bytes: number): string => {
  if (bytes === 0) return '0 MB';
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
};

export const formatMegabytes = (bytes: number): string =>
  (bytes / 1024 / 1024).toFixed(1);
