/**
 * Campanula App 核心状态
 *
 * 这是测试接入点"去掉界面的整个 App"的核心。
 * 输入：听众的操作和环境事件
 * 输出：听众看得到的状态、发出的请求、本机存储
 */

export interface AppState {
  /** 当前登录的账号，未登录时为 null */
  currentAccount: Account | null
  /** 曲库：我喜欢的音乐、歌单、专辑、歌手 */
  library: Library
  /** 播放队列 */
  playQueue: Song[]
  /** 当前正在播放的歌曲索引，-1 表示没有播放 */
  currentIndex: number
  /** 下载列表 */
  downloads: Download[]
}

export interface Account {
  uid: number
  nickname: string
  avatarUrl: string
}

export interface Library {
  /** 我喜欢的音乐 */
  likedSongs: Song[]
  /** 歌单列表 */
  playlists: Playlist[]
  /** 收藏的专辑 */
  albums: Album[]
  /** 收藏的歌手 */
  artists: Artist[]
}

export interface Song {
  id: number
  name: string
  artists: string[]
  album: string
  duration: number
}

export interface Playlist {
  id: number
  name: string
  description?: string
  coverUrl: string
  trackCount: number
}

export interface Album {
  id: number
  name: string
  artist: string
  coverUrl: string
}

export interface Artist {
  id: number
  name: string
  avatarUrl: string
}

export interface Download {
  songId: number
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  progress: number
  error?: string
}

/**
 * 创建初始的 App 状态（未登录）
 */
export function createInitialAppState(): AppState {
  return {
    currentAccount: null,
    library: {
      likedSongs: [],
      playlists: [],
      albums: [],
      artists: [],
    },
    playQueue: [],
    currentIndex: -1,
    downloads: [],
  }
}
