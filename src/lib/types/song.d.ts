export interface SongItem {
  /** 主键 ID */
  id: number
  /** 歌曲名称 */
  name: string
  /** 歌曲别名 */
  alias: string[]
  /** 歌手信息 */
  artists: {
    /** 歌手 ID */
    id: number
    /** 歌手名称 */
    name: string
  }[]
  /** 歌曲专辑 */
  album: {
    /** 专辑 ID */
    id: number
    /** 专辑名称 */
    name: string
    /** 专辑封面 */
    cover: string
  }
  /** 歌曲时长，单位：毫秒 */
  duration: number
  /** 歌曲来源 */
  source: string
  /** 歌曲来源 ID （网易云歌曲 ID） */
  sourceId: string
}
