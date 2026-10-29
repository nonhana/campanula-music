import type { Song } from '#lib/api/library.js'

/** 设计页专用的假歌：不联网、不来自曲库，只用来摆下载行和完成态 */
export const designSong = (id: number, name: string, artist: string): Song => ({
  id,
  name,
  artists: [
    { id: null, name: artist },
  ],
  album: { id: null, name: null, coverUrl: null },
  duration: 212_000,
  downloadSize: null,
  availability: 'full',
  trackNumber: 1,
  disc: '1',
  aliases: [],
  translations: [],
  publishedAt: null,
})
