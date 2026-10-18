import type { CollectedAlbum, CollectedArtist, Playlist, Song } from '#lib/api/library.js'
import type { LibraryPatch, PlaylistTracks, Replica } from './local'

// 听众在 Campanula 里改曲库（红心、加入歌单、收藏，Spec #11“客户端：曲库副本”）：每种修改对副本做什么。
// 只算不做：显示时叠在副本上（还没确认的），网易云确认了写进副本，同步拿回来的旧数据上再叠一次（确认得比它晚的）。
// 同一件事做两遍结果不变（已经红心的再红心、已经在歌单里的再加），所以重复叠也没关系

/** 收藏一张不在曲库里的歌单时，打开着它就带上已经取到的曲目：收藏后它进了曲库，不用再拉一遍 */
export interface PlaylistSeed {
  tracks: PlaylistTracks
  songs: readonly Song[]
}

export type Change
  = | { kind: 'heart', song: Song, hearted: boolean }
  /** 加入歌单：自建歌单，或我喜欢的音乐（等于红心） */
    | { kind: 'add', playlist: Playlist, song: Song }
    | { kind: 'collectAlbum', album: CollectedAlbum, collected: boolean }
    | { kind: 'collectArtist', artist: CollectedArtist, collected: boolean }
    | { kind: 'collectPlaylist', playlist: Playlist, collected: boolean, seed: PlaylistSeed | null }

/** 这个修改是不是红心（加入我喜欢的音乐等于红心）：是的话红心还是取消红心 */
export function heartOf(change: Change): { song: Song, hearted: boolean } | null {
  if (change.kind === 'heart')
    return change
  if (change.kind === 'add' && change.playlist.kind === 'liked')
    return { song: change.song, hearted: true }
  return null
}

/**
 * 改的是哪样东西：同一样东西的几次修改按先后一次一次提交，上一次网易云回了才发下一次，
 * 免得连点两下（红心、取消红心）到网易云的先后颠倒
 */
export function targetOf(change: Change): string {
  const heart = heartOf(change)
  if (heart)
    return `heart:${heart.song.id}`
  switch (change.kind) {
    case 'add':
      return `add:${change.playlist.id}:${change.song.id}`
    case 'collectAlbum':
      return `album:${change.album.id}`
    case 'collectArtist':
      return `artist:${change.artist.id}`
    case 'collectPlaylist':
      return `playlist:${change.playlist.id}`
    default:
      throw new Error(`不认识的修改：${JSON.stringify(change)}`)
  }
}

/** 列表最前面加上 id，已经有了就不动 */
function prepended(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids : [id, ...ids]
}

/** 一张歌单的曲目最前面加上这首；本机还没有这张歌单的曲目、或者已经在里面了是 null */
function tracksWith(replica: Replica, playlistId: number, songId: number): PlaylistTracks | null {
  const tracks = replica.tracks.get(playlistId)
  return tracks && !tracks.trackIds.includes(songId) ? { ...tracks, trackIds: [songId, ...tracks.trackIds] } : null
}

/** 本机还没有的歌曲信息 */
function missingSongs(replica: Replica, songs: readonly Song[]): Song[] | undefined {
  const missing = songs.filter(song => !replica.songs.has(song.id))
  return missing.length > 0 ? missing : undefined
}

function heartPatch(replica: Replica, song: Song, hearted: boolean): LibraryPatch {
  const { hearts } = replica
  const liked = replica.playlists?.find(playlist => playlist.kind === 'liked')
  const likedTracks = liked && replica.tracks.get(liked.id)
  let tracks: ReadonlyMap<number, PlaylistTracks> | undefined
  if (liked && likedTracks) {
    const trackIds = hearted ? prepended(likedTracks.trackIds, song.id) : likedTracks.trackIds.filter(id => id !== song.id)
    if (trackIds.length !== likedTracks.trackIds.length)
      tracks = new Map([[liked.id, { ...likedTracks, trackIds }]])
  }
  return {
    hearts: hearts ? (hearted ? prepended(hearts, song.id) : hearts.filter(id => id !== song.id)) : undefined,
    tracks,
    songs: hearted ? missingSongs(replica, [song]) : undefined,
  }
}

/** 收藏的歌单排在自建歌单后面、收藏的歌单最前（和刚在网易云里收藏的一样） */
function withCollected(playlists: Playlist[], playlist: Playlist): Playlist[] {
  if (playlists.some(item => item.id === playlist.id))
    return playlists
  const at = playlists.findIndex(item => item.kind === 'collected')
  return at < 0 ? [...playlists, playlist] : [...playlists.slice(0, at), playlist, ...playlists.slice(at)]
}

function toggled<T extends { id: number }>(items: T[] | null, item: T, collected: boolean): T[] | undefined {
  if (!items)
    return undefined
  if (collected)
    return items.some(each => each.id === item.id) ? items : [item, ...items]
  return items.filter(each => each.id !== item.id)
}

/** 这个修改对副本做什么；副本里还没有的部分（首次同步还没拿到）不动 */
export function changePatch(replica: Replica, change: Change): LibraryPatch {
  const heart = heartOf(change)
  if (heart)
    return heartPatch(replica, heart.song, heart.hearted)
  switch (change.kind) {
    case 'add': {
      const tracks = tracksWith(replica, change.playlist.id, change.song.id)
      return { tracks: tracks ? new Map([[change.playlist.id, tracks]]) : undefined, songs: missingSongs(replica, [change.song]) }
    }
    case 'collectAlbum':
      return { albums: toggled(replica.albums, change.album, change.collected) }
    case 'collectArtist':
      return { artists: toggled(replica.artists, change.artist, change.collected) }
    case 'collectPlaylist': {
      const { playlist, collected, seed } = change
      const playlists = replica.playlists && (collected ? withCollected(replica.playlists, playlist) : replica.playlists.filter(item => item.id !== playlist.id))
      const seeded = collected && seed && !replica.tracks.has(playlist.id)
      return {
        playlists: playlists ?? undefined,
        tracks: seeded ? new Map([[playlist.id, seed.tracks]]) : undefined,
        songs: seeded ? missingSongs(replica, seed.songs) : undefined,
      }
    }
    default:
      throw new Error(`不认识的修改：${JSON.stringify(change)}`)
  }
}
