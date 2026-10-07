// 交互原型的假数据（PROTOTYPE，一次性）。只在 /prototype 下使用，不调用任何接口。
// 曲名、歌手、封面沿用视觉原型（prototype/visual 分支的 src/lib/prototype/data.ts）；
// 「ACG 大合集」是为了试拖拽排序虚构的 4,815 首自建歌单——简报规定不在我喜欢的音乐上试排序。

export type DownloadState = 'done' | 'downloading' | 'queued' | 'failed'
export type SongLang = 'ja' | 'zh-TW' | undefined

export interface Song {
  id: string
  title: string
  artists: string[]
  album: string
  cover: string
  /** 秒 */
  duration: number
  lang: SongLang
  /** 会员歌曲，非会员只能试听，不能下载 */
  trial?: boolean
  /** 无版权，置灰、不能播、不能下载 */
  unavailable?: boolean
  /** 打开原型时这台设备上的下载状态 */
  download?: DownloadState
}

export type PlaylistKind = 'liked' | 'own' | 'collected'

export interface Playlist {
  id: string
  name: string
  cover: string
  kind: PlaylistKind
  creator: string
  description: string
  tags: string[]
  isPrivate?: boolean
  playCount?: number
}

/** 封面图片地址（static/prototype/covers/） */
export function coverSrc(key: string): string {
  return key.startsWith('blob:') || key.startsWith('data:') ? key : `/prototype/covers/${key}.jpg`
}

const KANA = /[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9F]/
// 常见的繁体专用字，用来粗略判断繁体中文曲名
const TRADITIONAL = /[們個說這樣對時會從來發現與機關點經國長開門問間聽見東車為讓過還進遠運達選隨實寫學愛戲遊類歲鄧紫倫傑煉幸運倔強偷頭風雲夢裡麼妳嗎號鐘覺緣戀憶漸靈雙聲歡]/

export function langOf(...texts: string[]): SongLang {
  const all = texts.join(' ')
  if (KANA.test(all))
    return 'ja'
  if (TRADITIONAL.test(all))
    return 'zh-TW'
  return undefined
}

interface BaseSong {
  title: string
  artists: string[]
  album: string
  cover: string
  duration: number
}

const VBS_ALBUM = 'Vivid BAD SQUAD SEKAI ALBUM vol.2'
const VBS_FEAT = ' (feat. 小豆沢こはね & 白石杏 & 東雲彰人 & 青柳冬弥)'

const base: BaseSong[] = [
  { title: '夜明けのベルフラワー', artists: ['風見ユウ', '初音ミク'], album: 'ベルフラワー', cover: 'shy-girl', duration: 252 },
  { title: 'Dye the sky.', artists: ['シャイニーカラーズ'], album: 'THE IDOLM@STER SHINY COLORS GR@DATE WING 01', cover: 'dye-the-sky', duration: 266 },
  { title: '二人の絆 (U.N.オーエンは彼女なのか?)', artists: ['LOST BLESS'], album: '東方紅魔郷 Arrange', cover: 'futari-no-kizuna', duration: 287 },
  { title: '风居住的街道（Piano ver）(翻自 磯村由紀子)', artists: ['饭碗的彼岸'], album: '风居住的街道', cover: 'kaze-machi', duration: 344 },
  { title: 'とびだせ！わんだぴょい (feat. 天馬司&鳳えむ&草薙寧々&神代類&鏡音リン)', artists: ['ワンダーランズ×ショウタイム'], album: '征け / とびだせ！わんだぴょい', cover: 'wonderhoy', duration: 204 },
  { title: '正 在 退 出 人 類 遊 戲 ▁ ▂ ▃', artists: ['Seto'], album: '正 在 退 出 人 類 遊 戲', cover: 'seto', duration: 145 },
  { title: '歌に形はないけれど', artists: ['doriko', '初音ミク'], album: 'Nostalgia', cover: 'uta-katachi', duration: 301 },
  { title: 'Flower Color（花色）', artists: ['Xwirok'], album: 'Flower Color', cover: 'flower-color', duration: 213 },
  { title: 'ロウワー (Cover)', artists: ['millsage'], album: 'ロウワー (Cover)', cover: 'lower', duration: 228 },
  { title: '黄昏ホログラム', artists: ['初音ミク', '神様うさぎ'], album: '黄昏ホログラム', cover: 'tasogare', duration: 194 },
  { title: 'farwell.', artists: ['THT'], album: 'farwell.', cover: 'farwell-tht', duration: 182 },
  { title: '短发少女', artists: ['早西'], album: '短发少女', cover: 'tanpatsu', duration: 239 },
  { title: 'The Garden of Escapism (AK Remix)', artists: ['AK', 'Miro'], album: 'The Garden of Escapism (Remixes)', cover: 'garden-escapism', duration: 268 },
  { title: 'Every Time We Touch', artists: ['Dream Tunes'], album: 'Every Time We Touch', cover: 'every-time', duration: 196 },
  { title: '夢我夢中', artists: ['夢限大みゅーたいぷ', 'ケンモチヒデフミ'], album: '夢我夢中', cover: 'mugamuchu', duration: 204 },
  { title: `CH4NGE${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-change', duration: 210 },
  { title: 'Farewell', artists: ['Varlan'], album: 'Farewell', cover: 'farewell', duration: 196 },
  { title: 'コピー·ミー（复制我）', artists: ['enzo underworld', '知声'], album: 'コピー·ミー', cover: 'copy-me', duration: 201 },
  { title: 'え？あぁ、そう。', artists: ['白石杏', '暁山瑞希', '日野森志歩'], album: 'え？あぁ、そう。', cover: 'ee-aa-sou', duration: 185 },
  { title: `WAVE${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-wave', duration: 232 },
  { title: '解脱', artists: ['浦栗子SpuChestnut'], album: '解脱', cover: 'kaidatsu', duration: 248 },
  { title: 'Drive Your Heart (TV Size)', artists: ['Poppin\'Party'], album: 'Drive Your Heart', cover: 'drive-your-heart', duration: 89 },
  { title: '徳川カップヌードル禁止令', artists: ['KAITO', '鏡音レン', '草薙寧々', '神代類'], album: 'ワンダーランズ×ショウタイム SEKAI ALBUM vol.1', cover: 'tokugawa', duration: 236 },
  { title: `ルーマー${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-rumor', duration: 219 },
  { title: 'サンセットバスストップ', artists: ['GUMI', 'トーマ'], album: 'サンセットバスストップ', cover: 'sunset-bus-stop', duration: 244 },
  { title: '征け (feat. 天馬司&鳳えむ&草薙寧々&神代類)', artists: ['ワンダーランズ×ショウタイム'], album: '征け / とびだせ！わんだぴょい', cover: 'yuke', duration: 233 },
  { title: 'Pretender (Cover)', artists: ['millsage'], album: 'Pretender (Cover)', cover: 'pretender', duration: 325 },
  { title: 'ピースフル・ピーシーズ！', artists: ['一家Dumb Rock!'], album: 'ピースフル・ピーシーズ！', cover: 'peaceful', duration: 243 },
  { title: 'Hush', artists: ['Kairos Covers'], album: 'Goblin OST Piano Collection', cover: 'hush', duration: 271 },
  { title: 'Stellar Stellar (Cover)', artists: ['millsage'], album: 'Stellar Stellar (Cover)', cover: 'stellar', duration: 302 },
  { title: 'Keep on Riddim', artists: ['一家Dumb Rock!'], album: 'ピースフル・ピーシーズ！', cover: 'riddim', duration: 207 },
  { title: '微笑みの爆弾 (Cover)', artists: ['一家Dumb Rock!'], album: '微笑みの爆弾 (Cover)', cover: 'bakudan', duration: 252 },
  { title: 'Abracadabra (Cover)', artists: ['Ave Mujica'], album: 'Abracadabra', cover: 'abracadabra', duration: 238 },
  { title: 'オリオンをなぞる (Cover)', artists: ['夢限大みゅーたいぷ'], album: 'オリオンをなぞる', cover: 'orion', duration: 262 },
  { title: 'このまんまでいこう (feat. 初音ミク)', artists: ['Leo/need'], album: 'Leo/need SEKAI ALBUM vol.3', cover: 'konomanma', duration: 227 },
  { title: '夢と葉桜', artists: ['初音ミク', '青木月光'], album: '夢と葉桜', cover: 'yume-hazakura', duration: 254 },
  { title: 'ReAct', artists: ['初音ミク', '鏡音リン', '黒うさP', '鏡音レン'], album: 'ReAct', cover: 'react', duration: 287 },
  { title: 'White Prism', artists: ['初音ミク', '一之瀬ユウ'], album: 'White Prism', cover: 'white-prism', duration: 210 },
  { title: 'きみのためのうた', artists: ['内緒のピアス'], album: 'きみのためのうた', cover: 'kimi-no-tame', duration: 214 },
  { title: '水無月の通り雨', artists: ['ゐろは苹果'], album: '水無月の通り雨', cover: 'minazuki', duration: 252 },
  { title: 'Eternal garden', artists: ['流派未階堂'], album: 'Eternal garden', cover: 'eternal-garden', duration: 233 },
  { title: 'Shy Girl', artists: ['Kedam'], album: 'Shy Girl', cover: 'shy-girl', duration: 224 },
  { title: 'Flower of Life', artists: ['陽花'], album: 'Flower of Life', cover: 'flower-of-life', duration: 276 },
  { title: `マーシャル・マキシマイザー${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-change', duration: 156 },
  { title: `花溺れ${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-wave', duration: 241 },
  { title: `酔いどれ知らず${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-rumor', duration: 222 },
  { title: '金木犀', artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-change', duration: 218 },
  { title: `コールボーイ${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-wave', duration: 199 },
  { title: '春嵐', artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-rumor', duration: 236 },
  { title: '夏の終わりのラジオ', artists: ['夕凪ミナト'], album: '夏の終わりのラジオ', cover: 'pl-umi', duration: 231 },
]

/** 用来铺满大歌单的版本后缀 */
const SUFFIXES = [' (off vocal)', ' (TV Size)', ' -Piano Arrange-', ' (Live)', ' (Acoustic Ver.)', ' (2025 Remaster)', ' (Extended Mix)', ' (Sped Up)']

/** 确定性的伪随机数，保证每次打开的假数据一致 */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeSong(b: BaseSong, id: string, suffix: string, extra: Partial<Song>): Song {
  const title = b.title + suffix
  return {
    id,
    title,
    artists: b.artists,
    album: b.album,
    cover: b.cover,
    duration: b.duration,
    lang: langOf(title, b.album, ...b.artists),
    ...extra,
  }
}

/** 前 16 首手工安排各种状态，保证首屏就能看到试听、无版权、下载中这些情况 */
const firstScreenStates: Partial<Song>[] = [
  { download: 'done' },
  {},
  { download: 'done' },
  { trial: true },
  { download: 'done' },
  { unavailable: true },
  { download: 'downloading' },
  {},
  { download: 'done' },
  { download: 'queued' },
  { download: 'failed' },
  {},
  { download: 'done' },
  { trial: true },
  {},
  { download: 'done' },
]

export const BIG_TOTAL = 4815

/** 曲库里出现过的全部歌曲：4,815 首，编号 s0–s4814 互不重复 */
export const allSongs: Song[] = (() => {
  const rand = mulberry32(20261007)
  const out: Song[] = []
  base.forEach((b, i) => out.push(makeSong(b, `s${i}`, '', firstScreenStates[i] ?? (i % 4 === 1 ? { download: 'done' } : {}))))
  let i = out.length
  while (out.length < BIG_TOTAL) {
    const b = base[Math.floor(rand() * base.length)]
    const suffix = rand() < 0.45 ? '' : SUFFIXES[Math.floor(rand() * SUFFIXES.length)]
    const extra: Partial<Song> = {}
    if (i % 37 === 11)
      extra.unavailable = true
    else if (i % 23 === 4)
      extra.trial = true
    else if (i % 4 === 0)
      extra.download = 'done'
    out.push(makeSong(b, `s${i}`, suffix, extra))
    i++
  }
  return out
})()

export const songById = new Map(allSongs.map(s => [s.id, s]))

export const me = { nickname: '花火', avatar: 'pl-rhythm' }

export const BIG_ID = 'pl-big'

export const playlists: Playlist[] = [
  { id: 'liked', name: '我喜欢的音乐', cover: 'shy-girl', kind: 'liked', creator: me.nickname, description: '', tags: [] },
  { id: BIG_ID, name: 'ACG 大合集', cover: 'pl-memories', kind: 'own', creator: me.nickname, description: '从我喜欢的音乐里挑出来的，慢慢整理。', tags: ['ACG', '日语'] },
  { id: 'pl-rhythm', name: 'rhythm', cover: 'pl-rhythm', kind: 'own', creator: me.nickname, description: '跟着鼓点走路的歌。', tags: ['日语', '电子', '运动'] },
  { id: 'pl-miku', name: '术力口', cover: 'pl-miku', kind: 'own', creator: me.nickname, description: 'VOCALOID 合集，以初音ミク为主，持续更新。', tags: ['ACG', '日语', '电子'] },
  { id: 'pl-kawaii', name: '可爱滴捏', cover: 'pl-kawaii', kind: 'own', creator: me.nickname, description: '', tags: ['ACG', '治愈'] },
  { id: 'pl-darkness', name: 'listen the darkness.', cover: 'pl-darkness', kind: 'own', creator: me.nickname, description: '', tags: ['夜晚'], isPrivate: true },
  { id: 'pl-umi', name: '一起看海', cover: 'pl-umi', kind: 'own', creator: me.nickname, description: '夏天快结束的时候。', tags: ['旅行'] },
  { id: 'c-sekai', name: 'プロセカ 全曲集 2025', cover: 'wonderhoy', kind: 'collected', creator: 'セカイ観測所', description: 'Project SEKAI 收录曲，按实装时间排序。', tags: ['ACG', '日语', '游戏'], playCount: 1_204_000 },
  { id: 'c-piano', name: '钢琴 · 深夜自习室', cover: 'kaze-machi', kind: 'collected', creator: '饭碗的彼岸', description: '写作业、看书的时候放。', tags: ['钢琴', '学习', '安静'], playCount: 386_000 },
  { id: 'c-vocaloid', name: 'VOCALOID 殿堂入り 100', cover: 'react', kind: 'collected', creator: 'ミク廃', description: '', tags: ['ACG', '日语'], playCount: 2_071_000 },
  { id: 'c-citypop', name: '城市流行 · 黄昏线', cover: 'sunset-bus-stop', kind: 'collected', creator: 'トーマ', description: '', tags: ['日语', '怀旧'], playCount: 92_000 },
]

const SIZES: Record<string, number> = { 'liked': 1260, 'pl-rhythm': 35, 'pl-miku': 81, 'pl-kawaii': 126, 'pl-darkness': 14, 'pl-umi': 7, 'c-sekai': 612, 'c-piano': 88, 'c-vocaloid': 100, 'c-citypop': 64 }

/** 每张歌单打开原型时的曲目（网易云的歌单里同一首歌只出现一次，所以这里去重） */
export function initialTracks(playlistId: string): Song[] {
  if (playlistId === BIG_ID) {
    // 前 16 首保持原样，后面确定性地打乱
    const rest = allSongs.slice(16)
    const rand = mulberry32(4815)
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]]
    }
    return [...allSongs.slice(0, 16), ...rest]
  }
  const size = SIZES[playlistId] ?? 20
  const rand = mulberry32(playlistId.length * 7919 + size)
  const seen = new Set<string>()
  const out: Song[] = []
  while (out.length < size) {
    const s = allSongs[Math.floor(rand() * 1600)]
    if (!seen.has(s.id)) {
      seen.add(s.id)
      out.push(s)
    }
  }
  return out
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

export function formatPlays(n: number): string {
  if (n >= 10_000)
    return `${(n / 10_000).toFixed(n >= 1_000_000 ? 0 : 1)} 万`
  return String(n)
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024)
    return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024)
    return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

export function artistLine(song: Song): string {
  return song.artists.join(' / ')
}
