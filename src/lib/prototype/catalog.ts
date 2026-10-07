// PROTOTYPE：歌手页、专辑页、搜索、歌单标签、已下载用的假数据。全部从 data.ts 派生，不调用任何接口。
import type { Album, Artist, Playlist, Song } from './data'
import { albums, artists, likedSongs, onlinePlaylists, playlists } from './data'

/** 曲库里的“原曲”（不含为了凑 4,815 首而派生的版本） */
export const baseSongs: Song[] = likedSongs.slice(0, 50)

// ---------- 歌手 ----------

export interface ArtistDetail extends Artist {
  /** 在曲库里 = 已收藏 */
  collected: boolean
  /** 热门歌曲（最多 10 首） */
  hotSongs: Song[]
  albums: Album[]
}

/** 歌名里的歌手名 → 歌手页 id；不在曲库收藏里的歌手用 `n:名字` */
export function artistIdOf(name: string): string {
  return artists.find(a => a.name === name)?.id ?? `n:${name}`
}

export function artistById(id: string): ArtistDetail {
  const known = artists.find(a => a.id === id)
  const name = known?.name ?? (id.startsWith('n:') ? id.slice(2) : '初音ミク')
  const hot = baseSongs.filter(s => s.artists.includes(name) || s.title.includes(name))
  const own = albumsOfArtist(name)
  return {
    id: known?.id ?? id,
    name,
    avatar: known?.avatar ?? hot[0]?.cover ?? 'pl-miku',
    songCount: known?.songCount ?? hot.length,
    albumCount: known?.albumCount ?? own.length,
    collected: Boolean(known),
    hotSongs: hot.slice(0, 10),
    albums: own,
  }
}

function hashYear(name: string): number {
  let h = 0
  for (const ch of name)
    h = (h * 31 + ch.codePointAt(0)!) | 0
  return 2016 + Math.abs(h) % 10
}

function albumFromSong(song: Song): Album {
  return {
    id: song.albumId,
    name: song.album,
    artist: song.artists[0],
    cover: song.cover,
    year: hashYear(song.album),
    count: baseSongs.filter(s => s.album === song.album).length,
    description: '',
  }
}

/** 某位歌手的专辑：收藏过的专辑 + 曲库歌曲所在的专辑 */
export function albumsOfArtist(name: string): Album[] {
  const out = albums.filter(a => a.artist === name)
  for (const s of baseSongs) {
    if (s.artists[0] !== name || out.some(a => a.name === s.album))
      continue
    out.push(albumFromSong(s))
  }
  return out.sort((a, b) => b.year - a.year)
}

// ---------- 专辑 ----------

export interface AlbumDetail extends Album {
  /** 在曲库里 = 已收藏 */
  collected: boolean
  tracks: Song[]
}

export function albumIdOf(song: Song): string {
  return albums.find(a => a.name === song.album)?.id ?? song.albumId
}

export function albumById(id: string): AlbumDetail {
  const known = albums.find(a => a.id === id)
  const fromSong = known ? undefined : baseSongs.find(s => s.albumId === id)
  const album = known ?? (fromSong ? albumFromSong(fromSong) : albums[0])
  const tracks = baseSongs.filter(s => s.album === album.name)
  return { ...album, count: tracks.length, collected: albums.some(a => a.id === album.id), tracks }
}

// ---------- 搜索 ----------

/** 搜索历史只存在这台设备上 */
export const searchHistory = ['ミク', 'Vivid BAD SQUAD', '夜明け', '钢琴', 'Kedam', 'わんだぴょい']

export interface Suggestion {
  text: string
  kind: 'song' | 'artist' | 'album' | 'playlist'
}

function has(text: string, q: string): boolean {
  return text.toLowerCase().includes(q)
}

/** 边输入边给的建议（最多 limit 条，同一文字只出现一次） */
export function suggestions(query: string, limit = 8): Suggestion[] {
  const q = query.trim().toLowerCase()
  if (!q)
    return []
  const out: Suggestion[] = []
  const push = (text: string, kind: Suggestion['kind']) => {
    if (out.length < limit && has(text, q) && !out.some(s => s.text === text))
      out.push({ text, kind })
  }
  for (const a of artists) push(a.name, 'artist')
  for (const s of baseSongs) push(s.title, 'song')
  for (const s of baseSongs) {
    for (const a of s.artists) push(a, 'artist')
  }
  for (const s of baseSongs) push(s.album, 'album')
  for (const p of [...playlists, ...onlinePlaylists]) push(p.name, 'playlist')
  return out
}

export interface SearchResults {
  songs: Song[]
  playlists: Playlist[]
  artists: Artist[]
  albums: Album[]
}

/** 按下搜索后的四类结果（网易云的结果；曲库里有的会带红心） */
export function search(query: string): SearchResults {
  const q = query.trim().toLowerCase()
  if (!q)
    return { songs: [], playlists: [], artists: [], albums: [] }
  const songs = baseSongs.filter(s => has(s.title, q) || has(s.album, q) || s.artists.some(a => has(a, q)))
  const pls = [...playlists.filter(p => p.kind !== 'liked'), ...onlinePlaylists]
    .filter(p => has(p.name, q) || has(p.description, q) || has(p.creator, q))
  const names = new Set<string>()
  const foundArtists: Artist[] = []
  for (const a of artists) {
    if (has(a.name, q)) {
      foundArtists.push(a)
      names.add(a.name)
    }
  }
  for (const s of baseSongs) {
    for (const name of s.artists) {
      if (has(name, q) && !names.has(name)) {
        names.add(name)
        const d = artistById(artistIdOf(name))
        foundArtists.push({ id: d.id, name: d.name, avatar: d.avatar, songCount: d.songCount, albumCount: d.albumCount })
      }
    }
  }
  const foundAlbums: Album[] = []
  for (const s of baseSongs) {
    if ((has(s.album, q) || s.artists.some(a => has(a, q))) && !foundAlbums.some(a => a.name === s.album)) {
      const known = albums.find(a => a.name === s.album)
      foundAlbums.push(known ?? albumFromSong(s))
    }
  }
  return { songs, playlists: pls, artists: foundArtists, albums: foundAlbums }
}

// ---------- 歌单编辑 ----------

/** 网易云的歌单标签只能从固定列表里选，最多 3 个 */
export const MAX_PLAYLIST_TAGS = 3

export const playlistTagGroups: { group: string, tags: string[] }[] = [
  { group: '语种', tags: ['华语', '欧美', '日语', '韩语', '粤语'] },
  { group: '风格', tags: ['流行', '摇滚', '民谣', '电子', '舞曲', '说唱', '轻音乐', '爵士', '乡村', 'R&B/Soul', '古典', '民族', '英伦', '金属', '朋克', '蓝调', '雷鬼', '世界音乐', '拉丁', 'New Age', '古风', '后摇', 'Bossa Nova'] },
  { group: '场景', tags: ['清晨', '夜晚', '学习', '工作', '午休', '下午茶', '地铁', '驾车', '运动', '旅行', '散步', '酒吧'] },
  { group: '情感', tags: ['怀旧', '清新', '浪漫', '伤感', '治愈', '放松', '孤独', '感动', '兴奋', '快乐', '安静', '思念'] },
  { group: '主题', tags: ['综艺', '影视原声', 'ACG', '儿童', '校园', '游戏', '70后', '80后', '90后', '网络歌曲', 'KTV', '经典', '翻唱', '吉他', '钢琴', '器乐', '榜单', '00后'] },
]

// ---------- 已下载 ----------

/** 这台设备上已下载的歌（属于设备，与登录无关） */
export const downloadedSongs: Song[] = likedSongs.filter(s => s.download === 'done')

/** 还没下载完的：下载中、排队中、失败 */
export const downloadTasks: Song[] = likedSongs.filter(s => s.download && s.download !== 'done')

export const storage = {
  /** 已用空间 */
  used: '6.8 GB',
  /** 下载音质（与在线播放音质分开设置） */
  quality: '极高 · 320k',
}
