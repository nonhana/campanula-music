import type { CollectTarget } from '#lib/app/app.js'
import type { LibraryState } from '#lib/app/library.js'

// 收藏开关看的状态：一张歌单、一张专辑、一位歌手在曲库里是什么样子。页面头部的“收藏 / 已收藏”、搜索结果里的收藏按钮、“自建”小标签都按它画

/**
 * own：自建歌单、我喜欢的音乐（自己的，没有收藏这回事）；collected：已收藏；not：没收藏；
 * unknown：对应的列表首次同步还没拿到，还不知道收没收藏
 */
export type CollectState = 'own' | 'collected' | 'not' | 'unknown'

export function collectState(library: LibraryState, target: CollectTarget): CollectState {
  switch (target.kind) {
    case 'playlist': {
      if (library.playlists === null)
        return 'unknown'
      const listed = library.playlists.find(playlist => playlist.id === target.id)
      return !listed ? 'not' : listed.kind === 'collected' ? 'collected' : 'own'
    }
    case 'album':
      return library.albums === null ? 'unknown' : library.albums.some(album => album.id === target.id) ? 'collected' : 'not'
    case 'artist':
      return library.artists === null ? 'unknown' : library.artists.some(artist => artist.id === target.id) ? 'collected' : 'not'
    default: {
      const unhandled: never = target.kind
      throw new Error(`不认识要收藏的东西：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 读屏读出的是哪一类：收藏歌单「…」、收藏专辑「…」、收藏歌手「…」 */
export const COLLECT_NOUNS = { playlist: '歌单', album: '专辑', artist: '歌手' } as const satisfies Record<CollectTarget['kind'], string>
