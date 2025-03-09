export interface LyricItem {
  /** 歌词时间，单位：毫秒 */
  time: number
  /** 歌词内容 */
  text: string
  /** 歌词翻译 */
  translate: string | null
}
