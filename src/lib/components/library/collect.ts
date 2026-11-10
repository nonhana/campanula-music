import type { CollectTarget } from '#lib/app/app.js';
import type { LibraryState } from '#lib/app/library.js';

export type CollectState = 'own' | 'collected' | 'not' | 'unknown';

export const collectState = (
  library: LibraryState,
  target: CollectTarget,
): CollectState => {
  switch (target.kind) {
    case 'playlist': {
      if (library.playlists === null) return 'unknown';
      const listed = library.playlists.find(
        (playlist) => playlist.id === target.id,
      );
      return !listed
        ? 'not'
        : listed.kind === 'collected'
          ? 'collected'
          : 'own';
    }
    case 'album':
      return library.albums === null
        ? 'unknown'
        : library.albums.some((album) => album.id === target.id)
          ? 'collected'
          : 'not';
    case 'artist':
      return library.artists === null
        ? 'unknown'
        : library.artists.some((artist) => artist.id === target.id)
          ? 'collected'
          : 'not';
    default: {
      const unhandled: never = target.kind;
      throw new Error(`不认识要收藏的东西：${JSON.stringify(unhandled)}`);
    }
  }
};

export const COLLECT_NOUNS = {
  playlist: '歌单',
  album: '专辑',
  artist: '歌手',
} as const satisfies Record<CollectTarget['kind'], string>;
