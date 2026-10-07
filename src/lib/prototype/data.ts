// 视觉原型的假数据（PROTOTYPE，一次性）。只在 /prototype 下使用，不调用任何接口。
// 曲名、歌手、封面取自旧站与 Auxio 的参考截图（真实曲库）；
// “夜明けのベルフラワー”“夏の終わりのラジオ”及其歌词、收藏歌单的名字为原型虚构内容。

export type DownloadState = 'done' | 'downloading' | 'queued' | 'failed'
export type LyricKind = 'yrc' | 'lrc' | 'instrumental' | 'none'
export type SongLang = 'ja' | 'zh-TW' | undefined

export interface CoverInfo {
  /** 封面整体平均色 */
  avg: string
  /** 封面里最鲜明的颜色，用于“封面染色” */
  vivid: string
}

export interface Song {
  id: string
  title: string
  artists: string[]
  album: string
  albumId: string
  cover: string
  /** 秒 */
  duration: number
  /** 根据曲名、歌手、专辑里的文字判断，给 lang 属性用 */
  lang: SongLang
  liked: boolean
  /** 会员歌曲，非会员只能试听 */
  trial?: boolean
  /** 无版权，置灰、不能播 */
  unavailable?: boolean
  download?: DownloadState
  /** 0–1，下载中时有值 */
  downloadProgress?: number
  lyric: LyricKind
  /** YYYY-MM-DD，加入我喜欢的音乐/歌单的日期 */
  addedAt: string
}

export interface Playlist {
  id: string
  name: string
  cover: string
  count: number
  kind: 'liked' | 'own' | 'collected'
  creator: string
  description: string
  tags: string[]
  updatedAt: string
  downloaded: number
  isPrivate?: boolean
  playCount?: number
}

export interface Album {
  id: string
  name: string
  artist: string
  cover: string
  year: number
  count: number
  description: string
}

export interface Artist {
  id: string
  name: string
  avatar: string
  songCount: number
  albumCount: number
}

export const covers: Record<string, CoverInfo> = {
  'copy-me': { avg: '#2F2A21', vivid: '#DFC277' },
  'ee-aa-sou': { avg: '#D0CFD2', vivid: '#ADD1E4' },
  'vbs-change': { avg: '#8D7A65', vivid: '#AF825C' },
  'vbs-wave': { avg: '#8D7A65', vivid: '#AF825C' },
  'kaidatsu': { avg: '#1D699B', vivid: '#09B3F7' },
  'drive-your-heart': { avg: '#6E6FA9', vivid: '#3B6FBD' },
  'tokugawa': { avg: '#B6B0A4', vivid: '#CE6AA1' },
  'vbs-rumor': { avg: '#8D7A65', vivid: '#AF825C' },
  'pl-rhythm': { avg: '#CCA095', vivid: '#DA7666' },
  'pl-miku': { avg: '#7C98A8', vivid: '#386A86' },
  'pl-kawaii': { avg: '#DCC5C4', vivid: '#EDBDB8' },
  'pl-memories': { avg: '#B36149', vivid: '#CB6A40' },
  'pl-darkness': { avg: '#324F56', vivid: '#4A8A97' },
  'pl-umi': { avg: '#C7D4E3', vivid: '#4CC4FB' },
  'sunset-bus-stop': { avg: '#301E1A', vivid: '#6B3A2E' },
  'wonderhoy': { avg: '#806970', vivid: '#772734' },
  'lower': { avg: '#A297A0', vivid: '#8B6FA0' },
  'peaceful': { avg: '#AC8879', vivid: '#E69772' },
  'yuke': { avg: '#806970', vivid: '#772734' },
  'pretender': { avg: '#180F30', vivid: '#291144' },
  'hush': { avg: '#8E9FA7', vivid: '#5BB1D6' },
  'stellar': { avg: '#1E1849', vivid: '#1B1867' },
  'mugamuchu': { avg: '#CE5872', vivid: '#EE5575' },
  'riddim': { avg: '#AC8879', vivid: '#EC9C78' },
  'seto': { avg: '#474747', vivid: '#212121' },
  'bakudan': { avg: '#E8A935', vivid: '#FDAD32' },
  'abracadabra': { avg: '#917D7C', vivid: '#9E1515' },
  'orion': { avg: '#535B6F', vivid: '#1E2F57' },
  'konomanma': { avg: '#B4A79D', vivid: '#C4A798' },
  'yume-hazakura': { avg: '#CDC4BB', vivid: '#E2AE8D' },
  'tasogare': { avg: '#A69EA6', vivid: '#795967' },
  'react': { avg: '#8C9885', vivid: '#508162' },
  'white-prism': { avg: '#B59770', vivid: '#DA9455' },
  'kimi-no-tame': { avg: '#75737A', vivid: '#57616B' },
  'minazuki': { avg: '#B2AEAE', vivid: '#A3989B' },
  'farewell': { avg: '#2F5173', vivid: '#206BC2' },
  'tanpatsu': { avg: '#B3B4AB', vivid: '#CAC6B9' },
  'dye-the-sky': { avg: '#D0C0D0', vivid: '#AB9BD8' },
  'futari-no-kizuna': { avg: '#87565B', vivid: '#BD616A' },
  'eternal-garden': { avg: '#ADA2AD', vivid: '#7AB39B' },
  'every-time': { avg: '#B8BDBD', vivid: '#9CBBD1' },
  'kaze-machi': { avg: '#8E7B71', vivid: '#93624D' },
  'flower-color': { avg: '#70626D', vivid: '#4C6A86' },
  'flower-of-life': { avg: '#BA9D77', vivid: '#9C6441' },
  'garden-escapism': { avg: '#221F5C', vivid: '#161B6E' },
  'uta-katachi': { avg: '#B4AFAE', vivid: '#CFC5B4' },
  'farwell-tht': { avg: '#E5D9D8', vivid: '#E58892' },
  'shy-girl': { avg: '#70A7A7', vivid: '#6CBDAE' },
}

/** 封面图片地址（static/prototype/covers/） */
export function coverSrc(key: string): string {
  return `/prototype/covers/${key}.jpg`
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
  lyric: LyricKind
}

const VBS_ALBUM = 'Vivid BAD SQUAD SEKAI ALBUM vol.2'
const VBS_FEAT = ' (feat. 小豆沢こはね & 白石杏 & 東雲彰人 & 青柳冬弥)'

const base: BaseSong[] = [
  { title: '夜明けのベルフラワー', artists: ['風見ユウ', '初音ミク'], album: 'ベルフラワー', cover: 'shy-girl', duration: 252, lyric: 'yrc' },
  { title: 'Dye the sky.', artists: ['シャイニーカラーズ'], album: 'THE IDOLM@STER SHINY COLORS GR@DATE WING 01', cover: 'dye-the-sky', duration: 266, lyric: 'yrc' },
  { title: '二人の絆 (U.N.オーエンは彼女なのか?)', artists: ['LOST BLESS'], album: '東方紅魔郷 Arrange', cover: 'futari-no-kizuna', duration: 287, lyric: 'lrc' },
  { title: '风居住的街道（Piano ver）(翻自 磯村由紀子)', artists: ['饭碗的彼岸'], album: '风居住的街道', cover: 'kaze-machi', duration: 344, lyric: 'instrumental' },
  { title: 'とびだせ！わんだぴょい (feat. 天馬司&鳳えむ&草薙寧々&神代類&鏡音リン)', artists: ['ワンダーランズ×ショウタイム'], album: '征け / とびだせ！わんだぴょい', cover: 'wonderhoy', duration: 204, lyric: 'yrc' },
  { title: '正 在 退 出 人 類 遊 戲 ▁ ▂ ▃', artists: ['Seto'], album: '正 在 退 出 人 類 遊 戲', cover: 'seto', duration: 145, lyric: 'lrc' },
  { title: '歌に形はないけれど', artists: ['doriko', '初音ミク'], album: 'Nostalgia', cover: 'uta-katachi', duration: 301, lyric: 'yrc' },
  { title: 'Flower Color（花色）', artists: ['Xwirok'], album: 'Flower Color', cover: 'flower-color', duration: 213, lyric: 'instrumental' },
  { title: 'ロウワー (Cover)', artists: ['millsage'], album: 'ロウワー (Cover)', cover: 'lower', duration: 228, lyric: 'yrc' },
  { title: '黄昏ホログラム', artists: ['初音ミク', '神様うさぎ'], album: '黄昏ホログラム', cover: 'tasogare', duration: 194, lyric: 'yrc' },
  { title: 'farwell.', artists: ['THT'], album: 'farwell.', cover: 'farwell-tht', duration: 182, lyric: 'lrc' },
  { title: '短发少女', artists: ['早西'], album: '短发少女', cover: 'tanpatsu', duration: 239, lyric: 'lrc' },
  { title: 'The Garden of Escapism (AK Remix)', artists: ['AK', 'Miro'], album: 'The Garden of Escapism (Remixes)', cover: 'garden-escapism', duration: 268, lyric: 'none' },
  { title: 'Every Time We Touch', artists: ['Dream Tunes'], album: 'Every Time We Touch', cover: 'every-time', duration: 196, lyric: 'lrc' },
  { title: '夢我夢中', artists: ['夢限大みゅーたいぷ', 'ケンモチヒデフミ'], album: '夢我夢中', cover: 'mugamuchu', duration: 204, lyric: 'yrc' },
  { title: `CH4NGE${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-change', duration: 210, lyric: 'yrc' },
  { title: 'Farewell', artists: ['Varlan'], album: 'Farewell', cover: 'farewell', duration: 196, lyric: 'instrumental' },
  { title: 'コピー·ミー（复制我）', artists: ['enzo underworld', '知声'], album: 'コピー·ミー', cover: 'copy-me', duration: 201, lyric: 'yrc' },
  { title: 'え？あぁ、そう。', artists: ['白石杏', '暁山瑞希', '日野森志歩'], album: 'え？あぁ、そう。', cover: 'ee-aa-sou', duration: 185, lyric: 'yrc' },
  { title: `WAVE${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-wave', duration: 232, lyric: 'yrc' },
  { title: '解脱', artists: ['浦栗子SpuChestnut'], album: '解脱', cover: 'kaidatsu', duration: 248, lyric: 'lrc' },
  { title: 'Drive Your Heart (TV Size)', artists: ["Poppin'Party"], album: 'Drive Your Heart', cover: 'drive-your-heart', duration: 89, lyric: 'yrc' },
  { title: '徳川カップヌードル禁止令', artists: ['KAITO', '鏡音レン', '草薙寧々', '神代類'], album: 'ワンダーランズ×ショウタイム SEKAI ALBUM vol.1', cover: 'tokugawa', duration: 236, lyric: 'yrc' },
  { title: `ルーマー${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-rumor', duration: 219, lyric: 'yrc' },
  { title: 'サンセットバスストップ', artists: ['GUMI', 'トーマ'], album: 'サンセットバスストップ', cover: 'sunset-bus-stop', duration: 244, lyric: 'yrc' },
  { title: '征け (feat. 天馬司&鳳えむ&草薙寧々&神代類)', artists: ['ワンダーランズ×ショウタイム'], album: '征け / とびだせ！わんだぴょい', cover: 'yuke', duration: 233, lyric: 'yrc' },
  { title: 'Pretender (Cover)', artists: ['millsage'], album: 'Pretender (Cover)', cover: 'pretender', duration: 325, lyric: 'yrc' },
  { title: 'ピースフル・ピーシーズ！', artists: ['一家Dumb Rock!'], album: 'ピースフル・ピーシーズ！', cover: 'peaceful', duration: 243, lyric: 'yrc' },
  { title: 'Hush', artists: ['Kairos Covers'], album: 'Goblin OST Piano Collection', cover: 'hush', duration: 271, lyric: 'instrumental' },
  { title: 'Stellar Stellar (Cover)', artists: ['millsage'], album: 'Stellar Stellar (Cover)', cover: 'stellar', duration: 302, lyric: 'yrc' },
  { title: 'Keep on Riddim', artists: ['一家Dumb Rock!'], album: 'ピースフル・ピーシーズ！', cover: 'riddim', duration: 207, lyric: 'yrc' },
  { title: '微笑みの爆弾 (Cover)', artists: ['一家Dumb Rock!'], album: '微笑みの爆弾 (Cover)', cover: 'bakudan', duration: 252, lyric: 'yrc' },
  { title: 'Abracadabra (Cover)', artists: ['Ave Mujica'], album: 'Abracadabra', cover: 'abracadabra', duration: 238, lyric: 'yrc' },
  { title: 'オリオンをなぞる (Cover)', artists: ['夢限大みゅーたいぷ'], album: 'オリオンをなぞる', cover: 'orion', duration: 262, lyric: 'yrc' },
  { title: 'このまんまでいこう (feat. 初音ミク)', artists: ['Leo/need'], album: 'Leo/need SEKAI ALBUM vol.3', cover: 'konomanma', duration: 227, lyric: 'yrc' },
  { title: '夢と葉桜', artists: ['初音ミク', '青木月光'], album: '夢と葉桜', cover: 'yume-hazakura', duration: 254, lyric: 'yrc' },
  { title: 'ReAct', artists: ['初音ミク', '鏡音リン', '黒うさP', '鏡音レン'], album: 'ReAct', cover: 'react', duration: 287, lyric: 'yrc' },
  { title: 'White Prism', artists: ['初音ミク', '一之瀬ユウ'], album: 'White Prism', cover: 'white-prism', duration: 210, lyric: 'yrc' },
  { title: 'きみのためのうた', artists: ['内緒のピアス'], album: 'きみのためのうた', cover: 'kimi-no-tame', duration: 214, lyric: 'yrc' },
  { title: '水無月の通り雨', artists: ['ゐろは苹果'], album: '水無月の通り雨', cover: 'minazuki', duration: 252, lyric: 'yrc' },
  { title: 'Eternal garden', artists: ['流派未階堂'], album: 'Eternal garden', cover: 'eternal-garden', duration: 233, lyric: 'lrc' },
  { title: 'Shy Girl', artists: ['Kedam'], album: 'Shy Girl', cover: 'shy-girl', duration: 224, lyric: 'lrc' },
  { title: 'Flower of Life', artists: ['陽花'], album: 'Flower of Life', cover: 'flower-of-life', duration: 276, lyric: 'yrc' },
  { title: `マーシャル・マキシマイザー${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-change', duration: 156, lyric: 'yrc' },
  { title: `花溺れ${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-wave', duration: 241, lyric: 'yrc' },
  { title: `酔いどれ知らず${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-rumor', duration: 222, lyric: 'yrc' },
  { title: '金木犀', artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-change', duration: 218, lyric: 'yrc' },
  { title: `コールボーイ${VBS_FEAT}`, artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-wave', duration: 199, lyric: 'yrc' },
  { title: '春嵐', artists: ['Vivid BAD SQUAD'], album: VBS_ALBUM, cover: 'vbs-rumor', duration: 236, lyric: 'yrc' },
  // s49：虚构曲目，用来演示“只有逐行歌词”
  { title: '夏の終わりのラジオ', artists: ['夕凪ミナト'], album: '夏の終わりのラジオ', cover: 'pl-umi', duration: 231, lyric: 'lrc' },
]

/** 用来铺满大歌单的版本后缀；纯音乐只用乐器版的后缀 */
const VOCAL_SUFFIXES = [' (off vocal)', ' (TV Size)', ' -Piano Arrange-', ' (Live)', ' (Acoustic Ver.)', ' (2025 Remaster)']
const INST_SUFFIXES = [' (Extended Mix)', ' (Piano Ver.)', ' (Sped Up)']

function slug(s: string): string {
  return s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40)
}

/** 确定性的伪随机数，保证每次渲染的假数据一致 */
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

function dateBack(daysAgo: number): string {
  const d = new Date(Date.UTC(2026, 9, 6))
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function makeSong(b: BaseSong, id: string, suffix: string, extra: Partial<Song>): Song {
  const title = b.title + suffix
  const lyric: LyricKind = suffix.includes('off vocal') || suffix.includes('Piano') ? 'instrumental' : b.lyric
  return {
    id,
    title,
    artists: b.artists,
    album: b.album,
    albumId: `al-${slug(b.album)}`,
    cover: b.cover,
    duration: b.duration,
    lang: langOf(title, b.album, ...b.artists),
    liked: true,
    lyric,
    addedAt: dateBack(0),
    ...extra,
  }
}

/** 我喜欢的音乐的前 16 首：手工安排各种状态，保证首屏就能看到 */
const firstScreenStates: Partial<Song>[] = [
  { download: 'done' }, // 0 夜明けのベルフラワー（正在播放）
  {}, // 1
  { download: 'done' }, // 2
  { trial: true }, // 3
  { download: 'done' }, // 4
  { unavailable: true }, // 5
  { download: 'downloading', downloadProgress: 0.62 }, // 6
  {}, // 7
  { download: 'done' }, // 8
  { download: 'queued' }, // 9
  { download: 'failed' }, // 10
  {}, // 11
  { download: 'done' }, // 12
  { trial: true }, // 13
  {}, // 14
  { download: 'done' }, // 15
]

function buildLiked(total: number): Song[] {
  const rand = mulberry32(20261007)
  const out: Song[] = []
  base.forEach((b, i) => {
    const state = firstScreenStates[i] ?? (i % 4 === 1 ? { download: 'done' as const } : {})
    out.push(makeSong(b, `s${i}`, '', { ...state, addedAt: dateBack(Math.floor(i * 1.7)) }))
  })
  let i = out.length
  while (out.length < total) {
    const b = base[Math.floor(rand() * base.length)]
    const pool = b.lyric === 'instrumental' ? INST_SUFFIXES : VOCAL_SUFFIXES
    const suffix = rand() < 0.45 ? '' : pool[Math.floor(rand() * pool.length)]
    const extra: Partial<Song> = { addedAt: dateBack(Math.floor(i * 0.62) + 80) }
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
}

export const LIKED_TOTAL = 4815

/** 我喜欢的音乐：4815 首，最新红心的在最前面 */
export const likedSongs: Song[] = buildLiked(LIKED_TOTAL)

export const likedDownloaded = likedSongs.filter(s => s.download === 'done').length

export const me = {
  nickname: '花火',
  avatar: 'pl-rhythm',
  vip: false,
}

export const playlists: Playlist[] = [
  { id: 'liked', name: '我喜欢的音乐', cover: likedSongs[0].cover, count: LIKED_TOTAL, kind: 'liked', creator: me.nickname, description: '', tags: [], updatedAt: '2026-10-06', downloaded: likedDownloaded },
  { id: 'pl-rhythm', name: 'rhythm', cover: 'pl-rhythm', count: 35, kind: 'own', creator: me.nickname, description: '跟着鼓点走路的歌。', tags: ['日语', '电子', '运动'], updatedAt: '2026-09-30', downloaded: 35 },
  { id: 'pl-miku', name: '术力口', cover: 'pl-miku', count: 81, kind: 'own', creator: me.nickname, description: 'VOCALOID 合集，以初音ミク为主，持续更新。', tags: ['ACG', '日语', '电子'], updatedAt: '2026-10-05', downloaded: 40 },
  { id: 'pl-kawaii', name: '可爱滴捏', cover: 'pl-kawaii', count: 126, kind: 'own', creator: me.nickname, description: '', tags: ['ACG', '治愈'], updatedAt: '2026-09-12', downloaded: 0 },
  { id: 'pl-memories', name: 'memories are still echoing.', cover: 'pl-memories', count: 323, kind: 'own', creator: me.nickname, description: '傍晚六点的回声。', tags: ['日语', '夜晚', '安静'], updatedAt: '2026-08-21', downloaded: 120 },
  { id: 'pl-darkness', name: 'listen the darkness.', cover: 'pl-darkness', count: 14, kind: 'own', creator: me.nickname, description: '', tags: ['夜晚'], updatedAt: '2026-07-02', downloaded: 14, isPrivate: true },
  { id: 'pl-umi', name: '一起看海', cover: 'pl-umi', count: 7, kind: 'own', creator: me.nickname, description: '夏天快结束的时候。', tags: ['旅行'], updatedAt: '2026-06-18', downloaded: 7 },
  { id: 'c-sekai', name: 'プロセカ 全曲集 2025', cover: 'wonderhoy', count: 612, kind: 'collected', creator: 'セカイ観測所', description: 'Project SEKAI 收录曲，按实装时间排序。', tags: ['ACG', '日语', '游戏'], updatedAt: '2026-10-01', downloaded: 0, playCount: 1_204_000 },
  { id: 'c-piano', name: '钢琴 · 深夜自习室', cover: 'kaze-machi', count: 88, kind: 'collected', creator: '饭碗的彼岸', description: '写作业、看书的时候放。', tags: ['钢琴', '学习', '安静'], updatedAt: '2026-09-27', downloaded: 12, playCount: 386_000 },
  { id: 'c-vocaloid', name: 'VOCALOID 殿堂入り 100', cover: 'react', count: 100, kind: 'collected', creator: 'ミク廃', description: '', tags: ['ACG', '日语'], updatedAt: '2026-05-09', downloaded: 0, playCount: 2_071_000 },
  { id: 'c-citypop', name: '城市流行 · 黄昏线', cover: 'sunset-bus-stop', count: 64, kind: 'collected', creator: 'トーマ', description: '', tags: ['日语', '怀旧'], updatedAt: '2026-04-30', downloaded: 0, playCount: 92_000 },
]

/** 不在曲库里、只会出现在搜索结果里的网易云歌单（原型虚构） */
export const onlinePlaylists: Playlist[] = [
  { id: 'o-miku', name: '初音ミク 十五周年精选', cover: 'react', count: 150, kind: 'collected', creator: 'ボカロ図書館', description: '从 2007 年到现在，每年挑十首。', tags: ['ACG', '日语'], updatedAt: '2026-08-31', downloaded: 0, playCount: 3_120_000 },
  { id: 'o-night', name: '深夜的 VOCALOID 电台', cover: 'tasogare', count: 64, kind: 'collected', creator: '夜猫子', description: '', tags: ['夜晚', '安静'], updatedAt: '2026-09-02', downloaded: 0, playCount: 820_000 },
  { id: 'o-vbs', name: 'Vivid BAD SQUAD 全曲', cover: 'vbs-wave', count: 96, kind: 'collected', creator: 'セカイ観測所', description: '', tags: ['ACG', '游戏'], updatedAt: '2026-09-20', downloaded: 0, playCount: 410_000 },
  { id: 'o-piano', name: '钢琴改编 · 动画歌曲', cover: 'kaze-machi', count: 120, kind: 'collected', creator: '饭碗的彼岸', description: '', tags: ['钢琴', 'ACG'], updatedAt: '2026-07-11', downloaded: 0, playCount: 1_560_000 },
]

/** 曲库里的歌单，或搜索结果里的网易云歌单 */
export function playlistById(id: string): Playlist | undefined {
  return playlists.find(p => p.id === id) ?? onlinePlaylists.find(p => p.id === id)
}

/** 歌单在不在听众的曲库里（自建或已收藏） */
export function inLibrary(pl: Playlist): boolean {
  return playlists.some(p => p.id === pl.id)
}

export const albums: Album[] = [
  { id: 'al-vbs2', name: VBS_ALBUM, artist: 'Vivid BAD SQUAD', cover: 'vbs-change', year: 2025, count: 9, description: '《プロジェクトセカイ》中 Vivid BAD SQUAD 的第二张专辑，收录《CH4NGE》《WAVE》《ルーマー》等 9 首。街头音乐的鼓点、合声和四个人轮流接唱，是这张专辑的骨架。' },
  { id: 'al-shy-girl', name: 'Shy Girl', artist: 'Kedam', cover: 'shy-girl', year: 2019, count: 1, description: '' },
  { id: 'al-goblin', name: 'Goblin OST Piano Collection', artist: 'Kairos Covers', cover: 'hush', year: 2021, count: 1, description: '《孤单又灿烂的神：鬼怪》原声钢琴改编。' },
  { id: 'al-gradate', name: 'THE IDOLM@STER SHINY COLORS GR@DATE WING 01', artist: 'シャイニーカラーズ', cover: 'dye-the-sky', year: 2018, count: 1, description: '' },
  { id: 'al-flower', name: 'Flower of Life', artist: '陽花', cover: 'flower-of-life', year: 2023, count: 1, description: '' },
  { id: 'al-wonder', name: '征け / とびだせ！わんだぴょい', artist: 'ワンダーランズ×ショウタイム', cover: 'wonderhoy', year: 2024, count: 2, description: '' },
  { id: 'al-every', name: 'Every Time We Touch', artist: 'Dream Tunes', cover: 'every-time', year: 2020, count: 1, description: '' },
  { id: 'al-farewell', name: 'Farewell', artist: 'Varlan', cover: 'farewell', year: 2022, count: 1, description: '' },
]

export const artists: Artist[] = [
  { id: 'ar-miku', name: '初音ミク', avatar: 'pl-miku', songCount: 3480, albumCount: 912 },
  { id: 'ar-vbs', name: 'Vivid BAD SQUAD', avatar: 'vbs-change', songCount: 96, albumCount: 14 },
  { id: 'ar-wonder', name: 'ワンダーランズ×ショウタイム', avatar: 'wonderhoy', songCount: 88, albumCount: 13 },
  { id: 'ar-millsage', name: 'millsage', avatar: 'lower', songCount: 41, albumCount: 39 },
  { id: 'ar-dumb', name: '一家Dumb Rock!', avatar: 'peaceful', songCount: 23, albumCount: 6 },
  { id: 'ar-kedam', name: 'Kedam', avatar: 'shy-girl', songCount: 17, albumCount: 11 },
  { id: 'ar-shiny', name: 'シャイニーカラーズ', avatar: 'dye-the-sky', songCount: 210, albumCount: 58 },
  { id: 'ar-kairos', name: 'Kairos Covers', avatar: 'hush', songCount: 64, albumCount: 9 },
  { id: 'ar-mujica', name: 'Ave Mujica', avatar: 'abracadabra', songCount: 27, albumCount: 5 },
  { id: 'ar-varlan', name: 'Varlan', avatar: 'farewell', songCount: 12, albumCount: 8 },
]

/** 某张歌单的曲目（我喜欢的音乐之外都是从曲库里确定性抽取的） */
export function songsOf(playlistId: string): Song[] {
  if (playlistId === 'liked')
    return likedSongs
  const pl = playlistById(playlistId)
  if (!pl)
    return []
  const rand = mulberry32(pl.id.length * 7919 + pl.count)
  const picked: Song[] = []
  for (let i = 0; i < pl.count; i++)
    picked.push(likedSongs[Math.floor(rand() * 600)])
  return picked
}

/** 每日推荐：30 首 */
export const daily = {
  dateLabel: '10月7日',
  weekday: '星期三',
  songs: (() => {
    const rand = mulberry32(1007)
    const pool = likedSongs.slice(1, 49)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, 30)
  })(),
}

/** 首次同步的进度（第一次登录后） */
export const firstSync = {
  playlistsTotal: 12,
  playlistsDone: 5,
  current: 'memories are still echoing.',
  tracksDone: 2140,
  tracksTotal: 6265,
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

export function artistLine(song: Song): string {
  return song.artists.join(' / ')
}
