// Mock 的状态化曲库：读都从这里生成，写都改这里；刷新页面看到的是同一份内存状态，
// reset 回到种子。只存在于开发服务器，生产构建不加载（见 scripts/check-mock-isolation.mts）。
import type { PlaylistDetailBody, RawPlaylist, SeedData, SeedName, SongPart } from './seed.ts'
import { canSortPlaylist, playlistKindOf, reorderSortable } from '#lib/api/library.js'
import { buildSeed, patchPlaylistDetail } from './seed.ts'

export type MockResult
  = | { ok: true, body: unknown }
    | { ok: false, status: number, body: unknown }

const SELF_UID = 10000001
const DELETED = 10

/** 能手动排序的歌单：我喜欢的音乐和自建歌单（收藏的歌单不参与，#37） */
function sortablePlaylist(playlist: RawPlaylist): boolean {
  return canSortPlaylist(playlistKindOf(playlist.specialType, playlist.creator.userId, SELF_UID))
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function summaryOf(data: SeedData, id: number): RawPlaylist | undefined {
  return data.byId.get(id)
}

/** RawPlaylist 有索引签名，`'ok' in` 收窄不了：用显式的守卫 */
function isMockResult(value: MockResult | RawPlaylist): value is MockResult {
  return typeof (value as { ok?: unknown }).ok === 'boolean'
}

/** 写歌单前先找它：不存在或已经删了就是 404，省得每个写方法重复一遍 */
function playlistFor(data: SeedData, id: number): MockResult | RawPlaylist {
  const playlist = summaryOf(data, id)
  if (!playlist || playlist.status === DELETED)
    return { ok: false, status: 404, body: clone(data.templates.missingPlaylist as Record<string, unknown>) }
  return playlist
}

function partsOf(data: SeedData, trackIds: readonly number[]): SongPart[] {
  return trackIds.flatMap((id) => {
    const part = data.songs.get(id)
    return part ? [part] : []
  })
}

function syncSummary(playlist: RawPlaylist, data: SeedData, now = Date.now()): void {
  playlist.trackIds = playlist.trackIds.filter(track => typeof track.id === 'number')
  playlist.trackCount = playlist.trackIds.length
  playlist.tracks = partsOf(data, playlist.trackIds.map(track => track.id)).map(part => part.song)
  playlist.trackUpdateTime = now
  playlist.updateTime = now
}

export class MockStore {
  private data: SeedData | null = null
  private loading: Promise<SeedData> | null = null

  constructor(public seed: SeedName = 'before') {}

  async load(): Promise<SeedData> {
    if (this.data)
      return this.data
    this.loading ??= buildSeed(this.seed).then((data) => {
      // 种子里没有、场景要用的歌单（新建的、4 首的）也在 byId 里
      for (const detail of data.details.values()) {
        if (!data.byId.has(detail.playlist.id))
          data.byId.set(detail.playlist.id, detail.playlist)
      }
      this.data = data
      return data
    })
    return this.loading
  }

  async reset(seed: SeedName = this.seed): Promise<void> {
    this.seed = seed
    this.data = null
    this.loading = null
    await this.load()
  }

  /** 收藏不在曲库里的歌单：把录制里的详情收进状态，之后列表、详情、曲目都能读 */
  async adoptPlaylist(detail: PlaylistDetailBody): Promise<void> {
    const data = await this.load()
    data.byId.set(detail.playlist.id, detail.playlist)
    data.details.set(detail.playlist.id, detail)
    if (!data.playlists.some(playlist => playlist.id === detail.playlist.id))
      data.playlists.push(detail.playlist)
  }

  async userPlaylist(offset = 0, limit = 1000): Promise<Record<string, unknown>> {
    const data = await this.load()
    // 和网易云一样，列表里的歌单只有头部：tracks / trackIds 是 null（详情才带曲目），不然一份列表几十 MB
    const playlist = data.playlists.slice(offset, offset + limit).map(item => ({ ...clone(item), tracks: null, trackIds: null }))
    return { ...clone(data.templates.userPlaylist as Record<string, unknown>), playlist, more: false }
  }

  async playlistDetail(id: number): Promise<PlaylistDetailBody | null> {
    const data = await this.load()
    const playlist = summaryOf(data, id)
    if (!playlist)
      return null
    const template = clone(data.details.get(id) ?? data.templates.emptyPlaylistDetail)
    const parts = partsOf(data, playlist.trackIds.map(track => track.id))
    return patchPlaylistDetail(template, playlist, parts)
  }

  async songPart(id: number): Promise<SongPart | undefined> {
    const data = await this.load()
    return data.songs.get(id)
  }

  async songDetail(ids: readonly number[]): Promise<Record<string, unknown> | null> {
    const data = await this.load()
    const parts = partsOf(data, ids)
    if (ids.length > 0 && parts.length === 0)
      return null
    return {
      ...clone(data.templates.songDetail as Record<string, unknown>),
      songs: parts.map(part => part.song),
      privileges: parts.map(part => part.privilege),
    }
  }

  async likelist(): Promise<Record<string, unknown>> {
    const data = await this.load()
    return { ...clone(data.templates.likelist as Record<string, unknown>), ids: [...data.liked] }
  }

  async albumSublist(offset = 0, limit = 1000): Promise<Record<string, unknown>> {
    const data = await this.load()
    return {
      ...clone(data.templates.albumSublist as Record<string, unknown>),
      data: clone(data.albums.slice(offset, offset + limit)),
      hasMore: offset + limit < data.albums.length,
      count: data.albums.length,
    }
  }

  async artistSublist(offset = 0, limit = 1000): Promise<Record<string, unknown>> {
    const data = await this.load()
    return {
      ...clone(data.templates.artistSublist as Record<string, unknown>),
      data: clone(data.artists.slice(offset, offset + limit)),
      hasMore: offset + limit < data.artists.length,
      count: data.artists.length,
    }
  }

  async heart(songId: number, hearted: boolean): Promise<MockResult> {
    const data = await this.load()
    const liked = summaryOf(data, 900000001)
    if (hearted) {
      if (!data.liked.has(songId)) {
        data.liked.add(songId)
        if (liked)
          liked.trackIds.unshift({ id: songId })
      }
    }
    else {
      data.liked.delete(songId)
      if (liked)
        liked.trackIds = liked.trackIds.filter(track => track.id !== songId)
    }
    if (liked)
      syncSummary(liked, data)
    return { ok: true, body: clone(data.templates[hearted ? 'likeAdd' : 'likeRemove'] as Record<string, unknown>) }
  }

  async addTracks(playlistId: number, songIds: readonly number[]): Promise<MockResult> {
    const data = await this.load()
    const found = playlistFor(data, playlistId)
    if (isMockResult(found))
      return found
    const playlist = found
    const existing = new Set(playlist.trackIds.map(track => track.id))
    const added = songIds.filter(id => !existing.has(id))
    if (added.length === 0)
      return { ok: false, status: 502, body: clone(data.templates.duplicateTracks as Record<string, unknown>) }
    playlist.trackIds = [...added.map(id => ({ id })), ...playlist.trackIds]
    syncSummary(playlist, data)
    return { ok: true, body: { ...clone(data.templates.playlistAdd as Record<string, unknown>), count: added.length } }
  }

  async removeTracks(playlistId: number, songIds: readonly number[]): Promise<MockResult> {
    const data = await this.load()
    const found = playlistFor(data, playlistId)
    if (isMockResult(found))
      return found
    const playlist = found
    const remove = new Set(songIds)
    playlist.trackIds = playlist.trackIds.filter(track => !remove.has(track.id))
    syncSummary(playlist, data)
    return { ok: true, body: { ...clone(data.templates.playlistRemove as Record<string, unknown>), count: songIds.length } }
  }

  async orderTracks(playlistId: number, songIds: readonly number[]): Promise<MockResult> {
    const data = await this.load()
    const found = playlistFor(data, playlistId)
    if (isMockResult(found))
      return found
    const playlist = found
    const before = playlist.trackIds.map(track => track.id)
    if (before.length !== songIds.length || !before.every(id => songIds.includes(id)))
      return { ok: false, status: 400, body: clone(data.templates.orderUnconfirmed as Record<string, unknown>) }
    playlist.trackIds = songIds.map(id => ({ id }))
    syncSummary(playlist, data)
    return { ok: true, body: clone(data.templates.playlistOrder as Record<string, unknown>) }
  }

  async orderPlaylists(ids: readonly number[]): Promise<MockResult> {
    const data = await this.load()
    data.playlists = reorderSortable(data.playlists, ids, sortablePlaylist)
    return { ok: true, body: clone(data.templates.playlistOrderUpdate as Record<string, unknown>) }
  }

  async createPlaylist(name: string, privacy: number): Promise<MockResult> {
    const data = await this.load()
    const id = Math.max(...data.playlists.map(playlist => playlist.id), 900000000) + 1
    const template = clone(data.templates.createPlaylist as Record<string, unknown>)
    const base = clone(data.details.get(900000001)?.playlist ?? data.playlists[0]!)
    const playlist: RawPlaylist = {
      ...base,
      id,
      name,
      privacy,
      trackCount: 0,
      trackIds: [],
      tracks: [],
      status: 0,
      specialType: 0,
      subscribed: false,
      creator: { ...base.creator, userId: SELF_UID, nickname: '测试听众' },
      createTime: Date.now(),
      updateTime: Date.now(),
      trackUpdateTime: Date.now(),
      playCount: 0,
      description: null,
      tags: [],
    }
    data.playlists.push(playlist)
    data.byId.set(id, playlist)
    data.details.set(id, patchPlaylistDetail(clone(data.templates.emptyPlaylistDetail), playlist, []))
    return {
      ok: true,
      body: {
        ...template,
        id,
        playlist: { ...(template.playlist as Record<string, unknown>), id, name, privacy, trackCount: 0 },
      },
    }
  }

  async deletePlaylist(id: number): Promise<MockResult> {
    const data = await this.load()
    const playlist = summaryOf(data, id)
    if (!playlist)
      return { ok: false, status: 404, body: clone(data.templates.missingPlaylist as Record<string, unknown>) }
    playlist.status = DELETED
    data.playlists = data.playlists.filter(item => item.id !== id)
    return { ok: true, body: clone(data.templates.playlistDelete as Record<string, unknown>) }
  }

  async renamePlaylist(id: number, name: string): Promise<MockResult> {
    const data = await this.load()
    const playlist = summaryOf(data, id)
    if (!playlist)
      return { ok: false, status: 404, body: clone(data.templates.missingPlaylist as Record<string, unknown>) }
    playlist.name = name
    playlist.updateTime = Date.now()
    return { ok: true, body: clone(data.templates.playlistName as Record<string, unknown>) }
  }

  async describePlaylist(id: number, description: string): Promise<MockResult> {
    const data = await this.load()
    const playlist = summaryOf(data, id)
    if (!playlist)
      return { ok: false, status: 404, body: clone(data.templates.missingPlaylist as Record<string, unknown>) }
    playlist.description = description
    playlist.updateTime = Date.now()
    return { ok: true, body: clone(data.templates.playlistDesc as Record<string, unknown>) }
  }

  async tagPlaylist(id: number, tags: readonly string[]): Promise<MockResult> {
    const data = await this.load()
    const playlist = summaryOf(data, id)
    if (!playlist)
      return { ok: false, status: 404, body: clone(data.templates.missingPlaylist as Record<string, unknown>) }
    playlist.tags = [...tags]
    playlist.updateTime = Date.now()
    return { ok: true, body: clone(data.templates.playlistTags as Record<string, unknown>) }
  }

  async publishPlaylist(id: number): Promise<MockResult> {
    const data = await this.load()
    const playlist = summaryOf(data, id)
    if (!playlist)
      return { ok: false, status: 404, body: clone(data.templates.missingPlaylist as Record<string, unknown>) }
    playlist.privacy = 0
    playlist.updateTime = Date.now()
    return { ok: true, body: clone(data.templates.playlistPrivacy as Record<string, unknown>) }
  }

  async setCover(id: number, url: string): Promise<MockResult> {
    const data = await this.load()
    const playlist = summaryOf(data, id)
    if (!playlist)
      return { ok: false, status: 404, body: clone(data.templates.missingPlaylist as Record<string, unknown>) }
    playlist.coverImgUrl = url
    playlist.updateTime = Date.now()
    return { ok: true, body: { ...clone(data.templates.coverUpdate as Record<string, unknown>), data: { code: 200, url } } }
  }

  async subscribePlaylist(id: number, collected: boolean): Promise<MockResult> {
    const data = await this.load()
    const playlist = summaryOf(data, id)
    if (!playlist)
      return { ok: false, status: 404, body: clone(data.templates.missingPlaylist as Record<string, unknown>) }
    playlist.subscribed = collected
    if (collected && !data.playlists.some(item => item.id === id))
      data.playlists.push(playlist)
    if (!collected)
      data.playlists = data.playlists.filter(item => item.id !== id || item.creator.userId === SELF_UID)
    return { ok: true, body: clone(data.templates[collected ? 'playlistSubscribe' : 'playlistUnsubscribe'] as Record<string, unknown>) }
  }

  async collectAlbum(id: number, collected: boolean): Promise<MockResult> {
    const data = await this.load()
    if (collected && !data.albums.some(album => album.id === id)) {
      const album = data.albumSummaries.get(id)
      if (!album)
        return { ok: false, status: 404, body: { code: 404, msg: 'Mock 没有这张专辑的收录信息' } }
      data.albums.unshift(clone(album))
    }
    if (!collected)
      data.albums = data.albums.filter(album => album.id !== id)
    return { ok: true, body: clone(data.templates[collected ? 'albumSub' : 'albumUnsub'] as Record<string, unknown>) }
  }

  async collectArtist(id: number, collected: boolean): Promise<MockResult> {
    const data = await this.load()
    if (collected && !data.artists.some(artist => artist.id === id)) {
      const artist = data.artistSummaries.get(id)
      if (!artist)
        return { ok: false, status: 404, body: { code: 404, msg: 'Mock 没有这位歌手的收藏信息' } }
      data.artists.unshift(clone(artist))
    }
    if (!collected)
      data.artists = data.artists.filter(artist => artist.id !== id)
    return { ok: true, body: clone(data.templates[collected ? 'artistSub' : 'artistUnsub'] as Record<string, unknown>) }
  }

  async clearPlaylist(id: number): Promise<void> {
    const data = await this.load()
    const playlist = summaryOf(data, id)
    if (playlist) {
      playlist.trackIds = []
      syncSummary(playlist, data)
    }
  }
}
