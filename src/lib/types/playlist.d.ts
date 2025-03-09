// 歌单 Item 信息
export interface PlaylistItem {
  /** 主键 ID */
  id: number
  /** 歌单名称 */
  name: string
  /** 歌单描述 */
  description: string
  /** 歌单封面 */
  cover: string | null
  /** 歌单歌曲数量 */
  musicCount: number
  /** 歌单来源 ID （网易云歌单 ID） */
  sourceId: string
}
