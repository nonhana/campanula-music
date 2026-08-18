/** 网易云门面领域类型（服务端门面与客户端共用，不含任何 server-only 依赖）。 */

/** 领域错误码：门面失败统一按此分类，客户端按码呈现文案 */
export type NcmErrorCode
  = | 'UNAUTHENTICATED' // 绑定失效，需要重新扫码
    | 'RATE_LIMITED' // 被限流
    | 'RESOURCE_UNAVAILABLE' // 无版权或资源不可用
    | 'UNKNOWN' // 兜底

/** 搜索目标类型（对应网易云搜索 type 参数：1 单曲 / 1000 歌单 / 100 歌手） */
export type NcmSearchType = 'song' | 'playlist' | 'artist'

/** 音质档位（对应网易云 song/url/v1 的 level 参数） */
export type NcmSoundLevel = 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires'

/** 搜索结果中的歌手引用 */
export interface NcmSearchArtistRef {
  id: number
  name: string
}

/** 歌曲条目（歌单详情歌曲与搜索结果共用同一外形） */
export interface NcmSong {
  id: number
  name: string
  artists: NcmSearchArtistRef[]
  album: {
    id: number
    name: string
    /** 封面图 URL；搜索接口不返回时可空 */
    cover: string
  }
  /** 时长，单位：毫秒 */
  duration: number
}

/** 歌曲搜索结果（与通用歌曲条目同形） */
export type NcmSearchSong = NcmSong

/** 歌单条目（我的歌单与搜索结果共用同一外形） */
export interface NcmPlaylist {
  id: number
  name: string
  /** 封面图 URL */
  cover: string
  /** 歌曲数量 */
  trackCount: number
  /** 播放次数 */
  playCount: number
  /** 创建者昵称 */
  creator: string
}

/** 歌单搜索结果（与通用歌单条目同形） */
export type NcmSearchPlaylist = NcmPlaylist

/** 歌单详情：完整歌曲列表（trackIds 补全后） */
export interface NcmPlaylistDetail {
  id: number
  name: string
  /** 封面图 URL */
  cover: string
  /** 创建者昵称 */
  creator: string
  /** 歌单描述；无描述时为 null */
  description: string | null
  /** 歌曲数量 */
  trackCount: number
  /** 播放次数 */
  playCount: number
  /** 全部歌曲（详情接口仅返回部分，须经完整 trackIds 二次请求补全） */
  songs: NcmSong[]
}

/** 我的歌单：创建的歌单与收藏的歌单两组 */
export interface NcmUserPlaylists {
  created: NcmPlaylist[]
  collected: NcmPlaylist[]
}

/** 歌手搜索结果 */
export interface NcmSearchArtist {
  id: number
  name: string
  /** 头像图 URL */
  avatar: string
}

/** 试听片段起止（单位：毫秒）；网易云对未携带有效账号许可的请求返回截取片段 */
export interface NcmTrialClip {
  /** 片段起始时间 */
  start: number
  /** 片段结束时间 */
  end: number
}

/**
 * 单首歌曲的播放来源（网易云 song/url/v1 返回体 data 项的领域映射，与请求 ids 对齐）。
 * 命中试听片段/无版权限制时如实呈现，不伪装成完整播放。
 */
export type NcmSongSource
  = | { id: number, status: 'playable', url: string, trial: null }
    | { id: number, status: 'trial', url: string, trial: NcmTrialClip }
    | { id: number, status: 'unavailable', url: null, trial: null }

/** 单次搜索的结果页（按搜索类型分叉） */
export type NcmSearchPage
  = | { type: 'song', songs: NcmSearchSong[], total: number }
    | { type: 'playlist', playlists: NcmSearchPlaylist[], total: number }
    | { type: 'artist', artists: NcmSearchArtist[], total: number }
