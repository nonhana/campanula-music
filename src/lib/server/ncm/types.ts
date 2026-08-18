/**
 * 网易云门面（provider）骨架。
 *
 * 应用代码只经 NcmProvider 访问网易云，不直接散落 hana-music-api 调用。
 * 本文件定义门面的方法形状；各方法由后续 ticket 逐个实现。
 * 所有失败以 NcmError（见 ./errors）形式抛出。
 */
import type { NcmSearchPage, NcmSearchType } from '$lib/types'

export type { NcmSearchPage, NcmSearchType } from '$lib/types'

/** 调用上下文：绑定凭据与执行配置 */
export interface NcmCallContext {
  cookie: string
}

/** 搜索参数（见 NcmProvider.search） */
export interface NcmSearchParams {
  keywords: string
  type: NcmSearchType
  limit?: number
  offset?: number
}

/** 音质档位 */
export type NcmSoundLevel = 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires'

export interface NcmProvider {
  /** 账号校验：失败抛 NcmError，UNAUTHENTICATED 表示绑定失效 */
  checkAuth: (ctx: NcmCallContext) => Promise<{ userId: number, nickname: string }>

  /** 二维码绑定第一步：获取二维码 key */
  loginQrKey: () => Promise<{ key: string, unikey: string }>

  /** 二维码绑定第二步：由 key 生成二维码内容 */
  loginQrCreate: (key: string) => Promise<{ qrUrl: string }>

  /** 二维码绑定第三步：轮询扫码状态（带时间戳防缓存） */
  loginQrCheck: (key: string) => Promise<{ status: 'waiting' | 'scanned' | 'confirmed' | 'expired', cookie?: string }>

  /** 搜索歌曲/歌单/歌手 */
  search: (ctx: NcmCallContext, params: NcmSearchParams) => Promise<NcmSearchPage>

  /** 歌单详情，含 trackIds 补全全部歌曲 */
  playlistDetail: (ctx: NcmCallContext, id: number) => Promise<unknown>

  /** 播放地址：按音质档位获取，命中试听片段限制如实返回 */
  songUrl: (ctx: NcmCallContext, params: { ids: number[], level: NcmSoundLevel }) => Promise<unknown>

  /** 歌词 */
  lyric: (ctx: NcmCallContext, id: number) => Promise<unknown>

  /** 红心 / 取消红心，写回账号 */
  like: (ctx: NcmCallContext, params: { id: number, like: boolean }) => Promise<void>

  /** 我喜欢的音乐 id 列表 */
  likedList: (ctx: NcmCallContext, userId: number) => Promise<number[]>
}
