import type { Playlist } from '#lib/api/library.js'

/** 歌单的名字：我喜欢的音乐在网易云里叫“某某喜欢的音乐”，界面上统一叫我喜欢的音乐 */
export const playlistName = (playlist: Playlist): string => playlist.kind === 'liked'
  ? '我喜欢的音乐'
  : playlist.name
