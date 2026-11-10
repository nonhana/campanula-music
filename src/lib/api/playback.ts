export const QUALITIES = [
  'standard',
  'higher',
  'exhigh',
  'lossless',
  'hires',
] as const;

export type Quality = (typeof QUALITIES)[number];

export const NUMBERED_SOURCE_KINDS = ['playlist', 'album', 'artist'] as const;

export type PlaySource =
  | { kind: (typeof NUMBERED_SOURCE_KINDS)[number]; id: number }
  | { kind: 'daily' }
  | { kind: 'downloads' }
  | { kind: 'search'; keyword: string };

export interface CheckInRequest {
  source: PlaySource;
  seconds: number;
}

export type PlayUrlResponse =
  | {
      playable: true;
      url: string;
      trial: boolean;
      expiresIn: number;
    }
  | { playable: false };

export const DOWNLOAD_QUALITY: Quality = 'exhigh';

export type DownloadUrlResponse =
  | {
      downloadable: true;
      url: string;
      size: number | null;
    }
  | { downloadable: false };

// 一个字，或带后面空格的一个单词（不要 trim）
export interface LyricWord {
  // start/end 都是秒
  start: number;
  end: number;
  text: string;
}

export interface LyricLine {
  start: number;
  text: string;
  words: LyricWord[] | null;
  translation: string | null;
  romanization: string | null;
}

export type LyricsResponse =
  | { kind: 'pureMusic' }
  | { kind: 'none' }
  | {
      kind: 'word' | 'line';
      lines: LyricLine[];
      translated: boolean;
      romanized: boolean;
      yrc: string | null;
      romalrc: string | null;
    };
