import type {
  LyricLine,
  LyricsResponse,
  LyricWord,
} from '#lib/api/playback.js';

interface LyricText {
  readonly lyric?: string | null;
}

export interface NeteaseLyrics {
  readonly lrc: { readonly lyric: string };
  readonly tlyric?: LyricText | null;
  readonly romalrc?: LyricText | null;
  readonly yrc?: LyricText | null;
  readonly ytlrc?: LyricText | null;
  readonly yromalrc?: LyricText | null;
  readonly pureMusic?: boolean | null;
}

// start 是毫秒（配翻译时比较用）；words 的 start/end 已换成秒
interface Timed {
  start: number;
  text: string;
  words: LyricWord[] | null;
  credit: boolean;
}

const MATCH_TOLERANCE_MS = 1000;

const LRC_LINE = /^((?:\[\d+:\d+(?:[.:]\d+)?\])+)(.*)$/;
const LRC_TAG = /\[(\d+):(\d+)(?:[.:](\d+))?\]/g;
const YRC_LINE = /^\[(\d+),\d+\](.*)$/;
const YRC_WORD = /\((\d+),(\d+),-?\d+\)/g;

const seconds = (ms: number) => ms / 1000;

const creditOf = (raw: string): Timed | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('t' in parsed) ||
    !('c' in parsed)
  )
    return null;
  const { t, c } = parsed;
  if (typeof t !== 'number' || !Array.isArray(c)) return null;
  const text = c
    .map((part: unknown) =>
      typeof part === 'object' &&
      part !== null &&
      'tx' in part &&
      typeof part.tx === 'string'
        ? part.tx
        : '',
    )
    .join('')
    .trim();
  return text
    ? {
        start: t,
        text,
        words: null,
        credit: true,
      }
    : null;
};

const lrcLinesOf = (raw: string): Timed[] => {
  const match = LRC_LINE.exec(raw);
  if (!match) return [];
  const text = match[2].trim();
  return [...match[1].matchAll(LRC_TAG)].map(
    ([, minutes, secs, fraction = '0']) => ({
      start:
        Number(minutes) * 60_000 +
        Number(secs) * 1000 +
        Number(fraction.padEnd(3, '0').slice(0, 3)),
      text,
      words: null,
      credit: false,
    }),
  );
};

const yrcLineOf = (raw: string): Timed | null => {
  const match = YRC_LINE.exec(raw);
  if (!match) return null;
  const body = match[2];
  const marks = [...body.matchAll(YRC_WORD)];
  const words = marks.flatMap((mark, i): LyricWord[] => {
    const text = body.slice(
      mark.index + mark[0].length,
      marks[i + 1]?.index ?? body.length,
    );
    const start = Number(mark[1]);
    return text
      ? [
          {
            start: seconds(start),
            end: seconds(start + Number(mark[2])),
            text,
          },
        ]
      : [];
  });
  const text = words
    .map((word) => word.text)
    .join('')
    .trim();
  return text
    ? {
        start: Number(match[1]),
        text,
        words,
        credit: false,
      }
    : null;
};

const linesOf = (
  lyric: string | null | undefined,
  format: 'lrc' | 'yrc',
): Timed[] => {
  const lines = (lyric ?? '').split(/\r?\n/).flatMap((raw): Timed[] => {
    const line = raw.trim();
    if (line.startsWith('{') || format === 'yrc') {
      const single = line.startsWith('{') ? creditOf(line) : yrcLineOf(line);
      return single ? [single] : [];
    }
    return lrcLinesOf(line).filter((timed) => timed.text !== '');
  });
  return lines.sort((a, b) => a.start - b.start);
};

const hasLyrics = (lines: readonly Timed[]): boolean =>
  lines.some((line) => !line.credit);

const matched = (
  lines: readonly Timed[],
  extra: readonly Timed[],
): (string | null)[] => {
  const out: (string | null)[] = lines.map(() => null);
  for (const item of extra) {
    if (item.credit) continue;
    let best = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (
        !lines[i].credit &&
        (best === -1 ||
          Math.abs(lines[i].start - item.start) <
            Math.abs(lines[best].start - item.start))
      )
        best = i;
    }
    if (
      best !== -1 &&
      out[best] === null &&
      Math.abs(lines[best].start - item.start) <= MATCH_TOLERANCE_MS
    )
      out[best] = item.text;
  }
  return out;
};

export const lyricsOf = (body: NeteaseLyrics): LyricsResponse => {
  if (body.pureMusic === true) return { kind: 'pureMusic' };
  const byWord = linesOf(body.yrc?.lyric, 'yrc');
  const word = hasLyrics(byWord);
  const lines = word ? byWord : linesOf(body.lrc.lyric, 'lrc');
  if (!hasLyrics(lines)) return { kind: 'none' };
  const pick = (
    byWordSource: LyricText | null | undefined,
    byLineSource: LyricText | null | undefined,
  ) => {
    const own = word ? linesOf(byWordSource?.lyric, 'lrc') : [];
    return own.length > 0 ? own : linesOf(byLineSource?.lyric, 'lrc');
  };
  const translations = matched(lines, pick(body.ytlrc, body.tlyric));
  const romanizations = matched(lines, pick(body.yromalrc, body.romalrc));
  return {
    kind: word ? 'word' : 'line',
    lines: lines.map((line, i): LyricLine => ({
      start: seconds(line.start),
      text: line.text,
      words: line.words,
      translation: translations[i],
      romanization: romanizations[i],
    })),
    translated: translations.some((text) => text !== null),
    romanized: romanizations.some((text) => text !== null),
    yrc: body.yrc?.lyric?.trim() ? body.yrc.lyric : null,
    romalrc: body.romalrc?.lyric?.trim() ? body.romalrc.lyric : null,
  };
};
