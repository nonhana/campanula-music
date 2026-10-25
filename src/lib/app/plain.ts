import type { Song } from '#lib/api/library.js'
import type { PlaySource } from '#lib/api/playback.js'

/**
 * 界面传来的 Song 可能是 Svelte 5 的 $state 代理，代理进不了 IndexedDB（structured clone 克隆不了代理）。
 * 存进本机、放进播放队列之前复制成普通对象；只复制 Song 声明的字段，代理裹着的其它东西不带进去。
 */
export const plainSong = (song: Song): Song => ({
  id: song.id,
  name: song.name,
  artists: song.artists.map(artist => ({
    id: artist.id,
    name: artist.name,
  })),
  album: {
    id: song.album.id,
    name: song.album.name,
    coverUrl: song.album.coverUrl,
  },
  duration: song.duration,
  downloadSize: song.downloadSize,
  availability: song.availability,
  trackNumber: song.trackNumber,
  disc: song.disc,
  aliases: [...song.aliases],
  translations: [...song.translations],
  publishedAt: song.publishedAt,
})

/** 播放来源同样可能被 $state 包成代理；播放队列会把它存进本机，复制成普通对象 */
export const plainSource = (source: PlaySource): PlaySource => {
  switch (source.kind) {
    case 'playlist':
    case 'album':
    case 'artist':
      return {
        kind: source.kind,
        id: source.id,
      }
    case 'search':
      return {
        kind: 'search',
        keyword: source.keyword,
      }
    case 'daily':
    case 'downloads':
      return { kind: source.kind }
    default: {
      const unhandled: never = source
      throw new Error(`不认识的播放来源：${JSON.stringify(unhandled)}`)
    }
  }
}
