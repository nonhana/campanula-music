// PROTOTYPE（变体 C）：本机曲库的即时搜索。逐字符折叠，保证折叠前后下标一一对应，方便“即时点亮”。
// 折叠规则：大小写、全角拉丁/数字 → 半角、片假名 → 平假名（ミク 与 みく 互相匹配）。汉字原样比较。
import type { Album, Artist, Playlist, Song } from '$lib/prototype/data'

function foldChar(c: string): string {
  const code = c.charCodeAt(0)
  // 全角 ASCII（！ 到 ～）
  if (code >= 0xFF01 && code <= 0xFF5E)
    return String.fromCharCode(code - 0xFEE0).toLowerCase()
  // 片假名 ァ–ヶ → 平假名
  if (code >= 0x30A1 && code <= 0x30F6)
    return String.fromCharCode(code - 0x60)
  // 全角空格
  if (code === 0x3000)
    return ' '
  const lower = c.toLowerCase()
  return lower.length === 1 ? lower : c
}

/** 与原文等长的折叠结果 */
export function fold(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++)
    out += foldChar(s[i])
  return out
}

/** 把搜索词拆成若干个折叠后的词，空白分隔，全部命中才算匹配 */
export function terms(query: string): string[] {
  return fold(query.trim()).split(/\s+/).filter(Boolean)
}

export interface Segment {
  text: string
  hit: boolean
}

/** 把一段文字切成“命中 / 未命中”的片段 */
export function segments(text: string, query: string): Segment[] {
  const ts = terms(query)
  if (ts.length === 0 || !text)
    return [{ text, hit: false }]
  const f = fold(text)
  const marks = new Uint8Array(text.length)
  let any = false
  for (const t of ts) {
    let from = 0
    while (from <= f.length - t.length) {
      const at = f.indexOf(t, from)
      if (at < 0)
        break
      marks.fill(1, at, at + t.length)
      any = true
      from = at + t.length
    }
  }
  if (!any)
    return [{ text, hit: false }]
  const out: Segment[] = []
  let start = 0
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marks[i] !== marks[start]) {
      out.push({ text: text.slice(start, i), hit: marks[start] === 1 })
      start = i
    }
  }
  return out
}

export function hasHit(text: string, query: string): boolean {
  const ts = terms(query)
  if (ts.length === 0)
    return false
  const f = fold(text)
  return ts.some(t => f.includes(t))
}

const songIndex = new WeakMap<Song, string>()

function songHaystack(s: Song): string {
  let h = songIndex.get(s)
  if (h === undefined) {
    h = fold(`${s.title}\n${s.artists.join('\n')}\n${s.album}`)
    songIndex.set(s, h)
  }
  return h
}

/** 歌名、歌手、专辑里包含全部搜索词的歌曲 */
export function filterSongs(list: Song[], query: string): Song[] {
  const ts = terms(query)
  if (ts.length === 0)
    return list
  const out: Song[] = []
  for (const s of list) {
    const h = songHaystack(s)
    if (ts.every(t => h.includes(t)))
      out.push(s)
  }
  return out
}

/** 带原下标的过滤结果（播放队列需要原下标） */
export function filterIndexed(list: Song[], query: string): { song: Song, index: number }[] {
  const ts = terms(query)
  const out: { song: Song, index: number }[] = []
  for (let i = 0; i < list.length; i++) {
    const s = list[i]
    if (ts.length === 0 || ts.every(t => songHaystack(s).includes(t)))
      out.push({ song: s, index: i })
  }
  return out
}

function matchesAll(text: string, ts: string[]): boolean {
  const f = fold(text)
  return ts.every(t => f.includes(t))
}

export function filterPlaylists(list: Playlist[], query: string): Playlist[] {
  const ts = terms(query)
  if (ts.length === 0)
    return []
  return list.filter(p => matchesAll(p.name, ts) || matchesAll(p.description, ts))
}

export function filterArtists(list: Artist[], query: string): Artist[] {
  const ts = terms(query)
  if (ts.length === 0)
    return []
  return list.filter(a => matchesAll(a.name, ts))
}

export function filterAlbums(list: Album[], query: string): Album[] {
  const ts = terms(query)
  if (ts.length === 0)
    return []
  return list.filter(a => matchesAll(`${a.name}\n${a.artist}`, ts))
}
