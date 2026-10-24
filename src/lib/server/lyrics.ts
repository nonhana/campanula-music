import type { LyricLine, LyricsResponse, LyricWord } from '#lib/api/playback.js'

// 把网易云 lyric_new 的歌词整理成一行一行的（格式照录制，tests/fixtures/netease/playback/lyric_new.*.json）：
// - lrc、tlyric、romalrc、ytlrc、yromalrc 是 LRC：每行前面一个或几个 [分:秒.小数] 时间标签；
// - yrc 是逐字歌词：[行开始毫秒,行时长](词开始毫秒,词时长,0)词(…)词…；
// - 两种里都夹着 JSON 写的署名行：{"t":毫秒,"c":[{"tx":"作词: "},{"tx":"米津玄師"}]}。
// 翻译、音译按时刻配到原文的行上：yrc 配 ytlrc、yromalrc，lrc 配 tlyric、romalrc，录制里时刻都正好一样

interface LyricText {
  readonly lyric: string
}

/** lyric_new 的返回里用到的部分（SDK 2.8.0 都声明了；旧的 lyric 模块没有收窄，不用） */
export interface NeteaseLyrics {
  readonly lrc: LyricText
  readonly tlyric?: LyricText
  readonly romalrc?: LyricText
  readonly yrc?: LyricText
  readonly ytlrc?: LyricText
  readonly yromalrc?: LyricText
  readonly pureMusic?: boolean
}

/** 原文、翻译或音译里的一行：start 是毫秒（配翻译时比较用），words 已经换成秒，直接交给界面 */
interface Timed {
  start: number
  text: string
  words: LyricWord[] | null
  /** 作词、作曲这类署名行 */
  credit: boolean
}

/** 翻译、音译的行和原文的行时刻相差不超过这么多才算配上（毫秒）：yrc 只有 tlyric 时两边的时刻差几百毫秒 */
const MATCH_TOLERANCE_MS = 1000

const LRC_LINE = /^((?:\[\d+:\d+(?:[.:]\d+)?\])+)(.*)$/
const LRC_TAG = /\[(\d+):(\d+)(?:[.:](\d+))?\]/g
const YRC_LINE = /^\[(\d+),\d+\](.*)$/
const YRC_WORD = /\((\d+),(\d+),-?\d+\)/g

const seconds = (ms: number) => ms / 1000

/** 署名行：{"t":毫秒,"c":[{"tx":…}]}，文字是各段 tx 连起来；认不出就是 null */
function creditOf(raw: string): Timed | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || !('t' in parsed) || !('c' in parsed))
    return null
  const { t, c } = parsed
  if (typeof t !== 'number' || !Array.isArray(c))
    return null
  const text = c.map((part: unknown) => typeof part === 'object' && part !== null && 'tx' in part && typeof part.tx === 'string'
    ? part.tx
    : '').join('').trim()
  return text
    ? {
        start: t,
        text,
        words: null,
        credit: true,
      }
    : null
}

/** LRC 的一行：几个时间标签就是几行（同一句在几个时刻唱）；没有时间标签的（[ti:…] 这类）不要 */
function lrcLinesOf(raw: string): Timed[] {
  const match = LRC_LINE.exec(raw)
  if (!match)
    return []
  const text = match[2].trim()
  return [
    ...match[1].matchAll(LRC_TAG),
  ].map(([, minutes, secs, fraction = '0']) => ({
    // 小数一位是十分之一秒，两位是百分之一秒，三位是毫秒
    start: Number(minutes) * 60_000 + Number(secs) * 1000 + Number(fraction.padEnd(3, '0').slice(0, 3)),
    text,
    words: null,
    credit: false,
  }))
}

/** yrc 的一行：词之间按 (开始,时长,0) 分开，两个标记中间的就是这个词 */
function yrcLineOf(raw: string): Timed | null {
  const match = YRC_LINE.exec(raw)
  if (!match)
    return null
  const body = match[2]
  const marks = [
    ...body.matchAll(YRC_WORD),
  ]
  const words = marks.flatMap((mark, i): LyricWord[] => {
    const text = body.slice(mark.index + mark[0].length, marks[i + 1]?.index ?? body.length)
    const start = Number(mark[1])
    return text
      ? [
          {
            start: seconds(start),
            end: seconds(start + Number(mark[2])),
            text,
          },
        ]
      : []
  })
  const text = words.map(word => word.text).join('').trim()
  return text
    ? {
        start: Number(match[1]),
        text,
        words,
        credit: false,
      }
    : null
}

/** 一整段歌词拆成行，按开始的时刻排（同一时刻的保持原来的先后）；空行不要 */
function linesOf(lyric: string | undefined, format: 'lrc' | 'yrc'): Timed[] {
  const lines = (lyric ?? '').split(/\r?\n/).flatMap((raw): Timed[] => {
    const line = raw.trim()
    if (line.startsWith('{') || format === 'yrc') {
      const single = line.startsWith('{')
        ? creditOf(line)
        : yrcLineOf(line)
      return single
        ? [single]
        : []
    }
    return lrcLinesOf(line).filter(timed => timed.text !== '')
  })
  return lines.sort((a, b) => a.start - b.start)
}

/** 有真正的歌词（不只是署名） */
function hasLyrics(lines: readonly Timed[]): boolean {
  return lines.some(line => !line.credit)
}

/** 把翻译或音译的每一行配到时刻最近的原文行上；一行原文只配一行 */
function matched(lines: readonly Timed[], extra: readonly Timed[]): (string | null)[] {
  const out: (string | null)[] = lines.map(() => null)
  for (const item of extra) {
    if (item.credit)
      continue
    let best = -1
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].credit && (best === -1 || Math.abs(lines[i].start - item.start) < Math.abs(lines[best].start - item.start)))
        best = i
    }
    if (best !== -1 && out[best] === null && Math.abs(lines[best].start - item.start) <= MATCH_TOLERANCE_MS)
      out[best] = item.text
  }
  return out
}

export function lyricsOf(body: NeteaseLyrics): LyricsResponse {
  if (body.pureMusic === true)
    return { kind: 'pureMusic' }
  const byWord = linesOf(body.yrc?.lyric, 'yrc')
  const word = hasLyrics(byWord)
  const lines = word
    ? byWord
    : linesOf(body.lrc.lyric, 'lrc')
  if (!hasLyrics(lines))
    return { kind: 'none' }
  // 逐字的优先配逐字的翻译、音译（ytlrc、yromalrc），没有再用逐行的
  const pick = (byWordSource: { lyric: string } | undefined, byLineSource: { lyric: string } | undefined) => {
    const own = word
      ? linesOf(byWordSource?.lyric, 'lrc')
      : []
    return own.length > 0
      ? own
      : linesOf(byLineSource?.lyric, 'lrc')
  }
  const translations = matched(lines, pick(body.ytlrc, body.tlyric))
  const romanizations = matched(lines, pick(body.yromalrc, body.romalrc))
  return {
    kind: word ? 'word' : 'line',
    lines: lines.map((line, i): LyricLine => ({
      start: seconds(line.start),
      text: line.text,
      words: line.words,
      translation: translations[i],
      romanization: romanizations[i],
    })),
    translated: translations.some(text => text !== null),
    romanized: romanizations.some(text => text !== null),
  }
}
