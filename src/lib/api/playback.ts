// 播放的接口（Spec #11“服务端：Campanula API”播放一项）。都要登录

/** 在线播放音质，照网易云 song_url_v1 的 level：标准、较高、极高、无损、Hi-Res */
export const QUALITIES = ['standard', 'higher', 'exhigh', 'lossless', 'hires'] as const

export type Quality = typeof QUALITIES[number]

/** 带编号的播放来源的种类：歌单（我喜欢的音乐也是一张歌单）、专辑、歌手的热门歌曲 */
export const NUMBERED_SOURCE_KINDS = ['playlist', 'album', 'artist'] as const

/** 播放来源（GLOSSARY）：这首歌是从哪个列表或哪次搜索放进播放队列的 */
export type PlaySource
  /** 歌单、专辑、歌手：带着它的编号 */
  = | { kind: typeof NUMBERED_SOURCE_KINDS[number], id: number }
  /** 每日推荐：每天换一份，没有编号 */
    | { kind: 'daily' }
  /** 已下载（#38）：这台设备上下载的全部歌，没有编号 */
    | { kind: 'downloads' }
  /** 一次搜索（#31）：搜的是哪个词 */
    | { kind: 'search', keyword: string }

/** POST /api/songs/[id]/check-in 的请求：听歌打卡，这首歌听完了（播完或切走） */
export interface CheckInRequest {
  /** 这首歌自己的播放来源 */
  source: PlaySource
  /** 实际听了多少秒，正整数 */
  seconds: number
}

/** POST /api/songs/[id]/check-in：网易云收下了这次打卡（计入听歌排行有 10–30 分钟延迟） */
export interface CheckInResponse {
  checkedIn: true
}

/**
 * GET /api/songs/[id]/play-url?quality=：一首歌的播放地址，浏览器拿它直连网易云的音频服务器。
 * 这个账号放不了完整的（会员歌对非会员）时是试听片段的地址
 */
export type PlayUrlResponse
  = | {
    playable: true
    /** https 地址；音频服务器支持分段请求 */
    url: string
    /** 只是试听片段 */
    trial: boolean
    /** 地址多少秒后过期（实测 1,200 秒） */
    expiresIn: number
  }
  /** 网易云没给地址：无版权，或者这个账号放不了 */
  | { playable: false }

/** 下载音质：设置页的下载音质（#40）加上之前固定是极高，和在线播放音质分开（Spec #11“客户端：下载”） */
export const DOWNLOAD_QUALITY: Quality = 'exhigh'

/**
 * GET /api/songs/[id]/download-url?quality=：下载一首用的地址，浏览器拿它直连网易云的音频服务器，把整首存进这台设备（#38）。
 * 只给完整音频的地址：网易云没给（无版权、这个账号下不了完整的）时是 downloadable: false
 */
export type DownloadUrlResponse
  = | {
    downloadable: true
    /** https 地址；约 20 分钟过期，拿到就下 */
    url: string
    /** 整首有多少字节：下完核对，对不上就是没下全 */
    size: number
  }
  | { downloadable: false }

/** 逐字歌词里的一个词：一个字，或者带着后面空格的一个单词 */
export interface LyricWord {
  /** 开始唱的时刻（秒） */
  start: number
  /** 唱完的时刻（秒） */
  end: number
  text: string
}

/** 一行歌词 */
export interface LyricLine {
  /** 这一行开始的时刻（秒）：点这一行就从这里放 */
  start: number
  text: string
  /** 逐字歌词里每个词的起止；逐行歌词、作词作曲这类署名行是 null */
  words: LyricWord[] | null
  /** 这一行的翻译；这首歌没有翻译、这一行没配上时是 null */
  translation: string | null
  /** 这一行的音译（日文假名、粤语等注的罗马字）；没有时是 null */
  romanization: string | null
}

/** GET /api/songs/[id]/lyrics：一首歌的歌词 */
export type LyricsResponse
  /** 网易云标着是纯音乐 */
  = | { kind: 'pureMusic' }
  /** 网易云没有这首的歌词 */
    | { kind: 'none' }
  /**
   * word：有逐字歌词；line：只有逐行的。lines 按开始的时刻排。
   * translated、romanized：有没有一行配上了翻译、音译（没有时界面禁用开关）
   */
    | { kind: 'word' | 'line', lines: LyricLine[], translated: boolean, romanized: boolean }
