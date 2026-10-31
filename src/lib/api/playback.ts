// 播放的接口（Spec #11“服务端：Campanula API”播放一项）。都要登录

/** 在线播放音质，照网易云 song_url_v1 的 level：标准、较高、极高、无损、Hi-Res */
export const QUALITIES = [
  'standard',
  'higher',
  'exhigh',
  'lossless',
  'hires',
] as const

export type Quality = typeof QUALITIES[number]

/** 带编号的播放来源的种类：歌单（我喜欢的音乐也是一张歌单）、专辑、歌手的歌曲（当前排法已经显示的） */
export const NUMBERED_SOURCE_KINDS = ['playlist', 'album', 'artist'] as const

/** 播放来源（GLOSSARY）：这首歌是从哪个列表或哪次搜索放进播放队列的 */
export type PlaySource
/** 带编号 */
  = | { kind: typeof NUMBERED_SOURCE_KINDS[number], id: number }
    /** 每天换一份，没有编号 */
    | { kind: 'daily' }
    /** 这台设备上下载的全部歌，没有编号 */
    | { kind: 'downloads' }
    /** 搜的是哪个词 */
    | { kind: 'search', keyword: string }

/** 这首歌听完了（播完或切走） */
export interface CheckInRequest {
  source: PlaySource
  /** 实际听了多少秒，正整数 */
  seconds: number
}

/** 浏览器拿它直连网易云的音频服务器；这个账号放不了完整的（会员歌对非会员）时是试听片段的地址 */
export type PlayUrlResponse
  = | {
    playable: true
    /** https；音频服务器支持分段请求 */
    url: string
    /** 只是试听片段 */
    trial: boolean
    /** 地址多少秒后过期（实测 1,200 秒） */
    expiresIn: number
  }
  /** 网易云没给地址：无版权，或者这个账号放不了 */
  | { playable: false }

/** 下载音质的默认值：没在设置页设过时是极高（#40，和在线播放音质分开，Spec #11“客户端：下载”） */
export const DOWNLOAD_QUALITY: Quality = 'exhigh'

/** 浏览器拿它直连音频服务器把整首存进这台设备（#38）；只给完整音频的地址，没给（无版权、这个账号下不了完整的）时是 downloadable: false */
export type DownloadUrlResponse
  = | {
    downloadable: true
    /** https 地址；约 20 分钟过期，拿到就下 */
    url: string
    /** 整首有多少字节：下完核对，对不上就是没下全；网易云没给时是 null，不核对（#78） */
    size: number | null
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

export type LyricsResponse
  /** 网易云标着是纯音乐 */
  = | { kind: 'pureMusic' }
  /** 网易云没有这首的歌词 */
    | { kind: 'none' }
    /**
     * word：有逐字歌词；line：只有逐行的，lines 按开始的时刻排。translated、romanized：有没有一行配上了翻译、音译（没有时界面禁用开关）。
     * yrc、romalrc：网易云给的逐字歌词、音译原文，导出时原样写进文件（#79），界面不用；网易云没给是 null
     */
    | { kind: 'word' | 'line', lines: LyricLine[], translated: boolean, romanized: boolean, yrc: string | null, romalrc: string | null }
