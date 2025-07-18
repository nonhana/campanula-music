export interface SongUrlQuery {
  /** 歌曲ID */
  id: string | number
  /** 音质等级 */
  level?: 'standard' | 'exhigh' | 'lossless' | 'hires' | 'jyeffect' | 'sky' | 'jymaster'
  /** Cookie 字符串或对象 */
  cookie?: string | Record<string, string>
  /** User-Agent */
  ua?: string
  /** 代理设置 */
  proxy?: string
  /** 真实IP */
  realIP?: string
  /** 加密方式 */
  crypto?: 'eapi' | 'weapi' | 'api' | 'linuxapi'
}
