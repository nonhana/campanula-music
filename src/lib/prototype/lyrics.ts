// 原型用的歌词（PROTOTYPE）。“夜明けのベルフラワー”“夏の終わりのラジオ”都是虚构曲目，歌词、翻译、音译均为原型自拟。
// 结构模仿网易云：逐字歌词（yrc）每行、每个词都有起止时间；逐行歌词（lrc）只有每行的开始时间。

/** yrc = 逐字，lrc = 只有逐行 */
export type LyricKind = 'yrc' | 'lrc'

export interface LyricSet {
  kind: LyricKind
  lines: LyricLine[]
  hasTranslation: boolean
  hasRomaji: boolean
}

export interface LyricWord {
  text: string
  start: number
  end: number
}

export interface LyricLine {
  start: number
  end: number
  words: LyricWord[]
  text: string
  translation: string
  romaji: string
}

// [开始秒数, 用 | 分词的原文, 翻译, 音译]
const RAW: [number, string, string, string][] = [
  [16.0, '窓を|開けたら|　|まだ|青い|朝', '推开窗，还是蓝色的清晨', 'mado o aketara mada aoi asa'],
  [21.8, '風が|鳴らした|　|小さな|ベル', '风摇响了一只小小的铃', 'kaze ga narashita chiisana beru'],
  [27.5, '昨日の|歌を|　|ポケットに|入れて', '把昨天的歌放进口袋', 'kinō no uta o poketto ni irete'],
  [33.2, '君の|街まで|　|歩いて|ゆく', '一路走到你住的那条街', 'kimi no machi made aruite yuku'],
  [39.0, 'ねえ|　|聞こえる？', '喂，你听得见吗？', 'nē, kikoeru?'],
  [42.6, '光の|粒が|　|胸で|揺れる', '光的颗粒在胸口摇晃', 'hikari no tsubu ga mune de yureru'],
  [48.3, '名前の|ない|　|この|気持ちを', '这份还没有名字的心情', 'namae no nai kono kimochi o'],
  [54.0, '夜明けの|色で|　|描いて|みたい', '想用黎明的颜色把它画下来', 'yoake no iro de egaite mitai'],
  [60.2, 'ベルフラワー|　|揺れて|　|揺れて', '风铃草，摇啊摇', 'beru furawā yurete yurete'],
  [65.9, '届かない|声も|　|歌に|なる', '传不到的声音，也会变成歌', 'todokanai koe mo uta ni naru'],
  [71.6, 'ベルフラワー|　|鳴らして', '风铃草，让它响起来', 'beru furawā narashite'],
  [76.0, '今日の|はじまりを|　|君に', '把今天的开始，送给你', 'kyō no hajimari o kimi ni'],
  [96.0, '坂道の|途中で|　|振り向いたら', '在坡道半路回过头', 'sakamichi no tochū de furimuitara'],
  [101.7, '遠い|海が|　|少し|光った', '远处的海微微亮了一下', 'tōi umi ga sukoshi hikatta'],
  [107.4, '言えなかった|ことも|　|今なら', '那些没说出口的话，现在的话', 'ienakatta koto mo ima nara'],
  [113.1, '風に|乗せて|　|届けられる', '可以乘着风送过去了', 'kaze ni nosete todokerareru'],
]

function tokens(line: string, start: number, end: number): LyricWord[] {
  const parts = line.split('|')
  const weights = parts.map(p => (p.trim() === '' ? 0.6 : [...p].length))
  const total = weights.reduce((a, b) => a + b, 0)
  const span = end - start
  let t = start
  return parts.map((text, i) => {
    const d = span * weights[i] / total
    const w = { text, start: t, end: t + d }
    t += d
    return w
  })
}

export const bellflowerLyrics: LyricLine[] = RAW.map(([start, text, translation, romaji], i) => {
  const next = RAW[i + 1]?.[0] ?? start + 6
  const end = Math.min(next - 0.4, start + 5.6)
  return { start, end, text: text.replaceAll('|', ''), words: tokens(text, start, end), translation, romaji }
})

// 逐行歌词（没有逐字时间，也没有音译）：[开始秒数, 原文, 翻译]
const RADIO_RAW: [number, string, string][] = [
  [12.0, '窓辺のラジオが　夏の終わりを告げる', '窗边的收音机，报出夏天结束的消息'],
  [18.4, '波の音だけ　少し遠くなった', '只有海浪声，退远了一点'],
  [24.9, '日に焼けた地図を　小さくたたんで', '把晒褪了色的地图，折得小小的'],
  [31.2, '君と歩いた道を　ポケットにしまう', '把和你走过的路，收进口袋'],
  [38.0, 'さよならの代わりに　周波数を合わせた', '没有说再见，只是把频率调准'],
  [44.6, '聞こえないふりで　ボリュームを上げた', '装作听不见，把音量调高'],
  [51.0, '夏の終わりのラジオ　雑音まじりの歌', '夏末的收音机，夹着杂音的歌'],
  [57.5, '君の声に　少しだけ似ていた', '有一点点像你的声音'],
  [64.0, '夏の終わりのラジオ　明日の天気は晴れ', '夏末的收音机，说明天是晴天'],
  [70.6, 'それだけで　まだ歩いていける', '只凭这一句，我还能继续走下去'],
  [92.0, '駅までの坂道　自転車を押して', '推着自行车，走上去车站的坡'],
  [98.5, '同じ曲が　どこかの窓から', '同一首歌，从不知哪扇窗里传出来'],
]

const radioLyrics: LyricLine[] = RADIO_RAW.map(([start, text, translation], i) => {
  const end = (RADIO_RAW[i + 1]?.[0] ?? start + 6) - 0.4
  return { start, end, text, words: [{ text, start, end }], translation, romaji: '' }
})

/** 原型里带歌词数据的歌：s0 = 夜明けのベルフラワー（逐字），s49 = 夏の終わりのラジオ（逐行） */
const LYRIC_SETS: Record<string, LyricSet> = {
  s0: { kind: 'yrc', lines: bellflowerLyrics, hasTranslation: true, hasRomaji: true },
  s49: { kind: 'lrc', lines: radioLyrics, hasTranslation: true, hasRomaji: false },
}

export function lyricsOf(songId: string): LyricSet | null {
  return LYRIC_SETS[songId] ?? null
}

/** 当前应高亮的行：最后一个已经开始的行；间奏时返回上一行 */
export function lineIndexAt(lines: LyricLine[], t: number): number {
  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].start <= t)
      idx = i
    else break
  }
  return idx
}

/** 一个词已唱出的比例，0–1 */
export function wordProgress(word: LyricWord, t: number): number {
  if (t <= word.start)
    return 0
  if (t >= word.end)
    return 1
  return (t - word.start) / (word.end - word.start)
}
