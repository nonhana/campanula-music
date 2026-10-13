// 播放的接口（Spec #11“服务端：Campanula API”播放一项）。都要登录

/** 在线播放音质，照网易云 song_url_v1 的 level：标准、较高、极高、无损、Hi-Res */
export const QUALITIES = ['standard', 'higher', 'exhigh', 'lossless', 'hires'] as const

export type Quality = typeof QUALITIES[number]

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
