import type { Song } from './library'

// 发现的接口（Spec #11“服务端：Campanula API”发现一项）：只有每日推荐，要登录

/** 网易云今天给这个账号的每日推荐，按网易云的顺序 */
export interface DailyResponse {
  songs: Song[]
}
