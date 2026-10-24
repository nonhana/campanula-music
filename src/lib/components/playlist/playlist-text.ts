import type { Playlist } from '#lib/api/library.js'

/**
 * 歌单的名字：我喜欢的音乐在网易云里叫“某某喜欢的音乐”，界面上统一叫我喜欢的音乐；网易云没给名字时写“未命名歌单”（#78），
 * 只在显示时换，数据里仍是 null。不在曲库里的歌单、搜索结果没有 kind
 */
export const playlistName = (playlist: { name: string | null, kind?: Playlist['kind'] | null }): string => playlist.kind === 'liked'
  ? '我喜欢的音乐'
  : playlist.name ?? '未命名歌单'
