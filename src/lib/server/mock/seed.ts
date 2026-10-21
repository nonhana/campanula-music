// Mock 的种子：用 tests/fixtures/netease 里录制的网易云返回拼出一份可读写的曲库。
// 只读录制，不连网；歌单列表、歌单详情、歌曲信息、红心、收藏的专辑/歌手都来自录制。
import type { RawFixture } from './fixture-format.ts'
import { readdir } from 'node:fs/promises'
import { fixtureOutcome } from './fixture-format.ts'
import { readFixture } from './read-fixture.ts'

export type SeedName = 'before' | 'after' | 'deleted'

export interface RawSong {
  id: number
  name: string
  ar: unknown[]
  al: { id: number, name: string | null, picUrl: string }
  dt: number
  [key: string]: unknown
}

export interface RawPrivilege {
  id: number
  st: number
  pl: number
  [key: string]: unknown
}

export interface RawPlaylist {
  id: number
  name: string
  coverImgUrl: string
  trackCount: number
  trackUpdateTime: number
  updateTime: number
  playCount: number
  description: string | null
  tags: string[]
  privacy: number
  specialType: number
  subscribed: boolean | null
  status: number
  creator: { userId: number, nickname: string, avatarUrl?: string }
  trackIds: { id: number }[]
  tracks: RawSong[]
  [key: string]: unknown
}

export interface PlaylistDetailBody {
  code: number
  playlist: RawPlaylist
  privileges: RawPrivilege[]
  [key: string]: unknown
}

export interface SongPart {
  song: RawSong
  privilege: RawPrivilege
}

/** 录到的、能在线放的四首歌（playback/liked 里有 song_url_v1 的完整地址） */
export const FOUR_PLAYABLE_IDS = [3433267939, 2662577181, 4208408, 2092188841] as const
export const FOUR_PLAYABLE_PLAYLIST = 900000024
export const POEMS_PLAYLIST = 900000019
export const LIKED_PLAYLIST = 900000001
export const EMPTY_PLAYLIST = 900000023

export interface SeedData {
  seed: SeedName
  playlists: RawPlaylist[]
  byId: Map<number, RawPlaylist>
  details: Map<number, PlaylistDetailBody>
  songs: Map<number, SongPart>
  liked: Set<number>
  likedDetail: PlaylistDetailBody
  albums: Record<string, unknown>[]
  artists: Record<string, unknown>[]
  albumDetails: Map<number, Record<string, unknown>>
  albumSummaries: Map<number, Record<string, unknown>>
  artistSummaries: Map<number, Record<string, unknown>>
  templates: {
    userPlaylist: RawFixture['response']['body']
    albumSublist: RawFixture['response']['body']
    artistSublist: RawFixture['response']['body']
    songDetail: RawFixture['response']['body']
    songUrl: RawFixture['response']['body']
    songUrlNoCopyright: RawFixture['response']['body']
    likelist: RawFixture['response']['body']
    songDownloadUrl: RawFixture['response']['body']
    songDownloadUrlNoCopyright: RawFixture['response']['body']
    imageUploadToken: RawFixture['response']['body']
    coverUpdate: RawFixture['response']['body']
    emptyPlaylistDetail: PlaylistDetailBody
    createPlaylist: RawFixture['response']['body']
    account: RawFixture['response']['body']
    accountAnonymous: RawFixture['response']['body']
    accountInvalid: RawFixture['response']['body']
    userDetail: RawFixture['response']['body']
    loginCellphone: RawFixture['response']['body']
    qrSuccess: RawFixture['response']['body']
    loginRefresh: RawFixture['response']['body']
    playlistCatlist: RawFixture['response']['body']
    recommendSongs: RawFixture['response']['body']
    playlistTrackAll: RawFixture['response']['body']
    scrobble: RawFixture['response']['body']
    lyric: RawFixture['response']['body']
    likeAdd: RawFixture['response']['body']
    likeRemove: RawFixture['response']['body']
    playlistAdd: RawFixture['response']['body']
    playlistRemove: RawFixture['response']['body']
    playlistOrder: RawFixture['response']['body']
    playlistOrderUpdate: RawFixture['response']['body']
    playlistCreate: RawFixture['response']['body']
    playlistDelete: RawFixture['response']['body']
    playlistName: RawFixture['response']['body']
    playlistDesc: RawFixture['response']['body']
    playlistTags: RawFixture['response']['body']
    playlistPrivacy: RawFixture['response']['body']
    playlistSubscribe: RawFixture['response']['body']
    playlistUnsubscribe: RawFixture['response']['body']
    albumSub: RawFixture['response']['body']
    albumUnsub: RawFixture['response']['body']
    artistSub: RawFixture['response']['body']
    artistUnsub: RawFixture['response']['body']
    missingPlaylist: RawFixture['response']['body']
    duplicateTracks: RawFixture['response']['body']
    orderUnconfirmed: RawFixture['response']['body']
  }
}

const SELF_UID = 10000001

function bodyOf(fixture: RawFixture): RawFixture['response']['body'] {
  return fixture.response.body
}

function detailBody(fixture: RawFixture): PlaylistDetailBody {
  return fixture.response.body as PlaylistDetailBody
}

function listDetailFiles(folder: string): Promise<string[]> {
  return readdir(new URL(`../../../../tests/fixtures/netease/${folder}/`, import.meta.url))
    .then(names => names.filter(name => name.endsWith('playlist_detail.json.gz')).sort())
}

function songDetailFiles(folder: string): Promise<string[]> {
  return readdir(new URL(`../../../../tests/fixtures/netease/${folder}/`, import.meta.url))
    .then(names => names.filter(name => name.endsWith('song_detail.json.gz')).sort())
}

/** 搜索结果、专辑、热门歌曲里的歌带着自己的 privilege：收进歌曲库，加入歌单后刷新还能取到 */
function collectInlineSongs(node: unknown, songs: Map<number, SongPart>): void {
  if (Array.isArray(node)) {
    node.forEach(item => collectInlineSongs(item, songs))
    return
  }
  if (node === null || typeof node !== 'object')
    return
  const record = node as Record<string, unknown>
  if (typeof record.id === 'number' && typeof record.name === 'string' && Array.isArray(record.ar) && record.al && typeof record.dt === 'number'
    && record.privilege && typeof record.privilege === 'object') {
    const privilege = record.privilege as RawPrivilege
    if (typeof privilege.id === 'number' && typeof privilege.st === 'number' && typeof privilege.pl === 'number')
      songs.set(record.id, { song: record as unknown as RawSong, privilege })
  }
  Object.values(record).forEach(item => collectInlineSongs(item, songs))
}

function addSongs(songs: Map<number, SongPart>, body: Record<string, unknown>): void {
  const list = Array.isArray(body.songs) ? body.songs as RawSong[] : []
  const privileges = Array.isArray(body.privileges) ? body.privileges as RawPrivilege[] : []
  const byId = new Map(privileges.map(privilege => [privilege.id, privilege]))
  for (const song of list) {
    const privilege = byId.get(song.id)
    if (privilege)
      songs.set(song.id, { song, privilege })
  }
}

/** 用一份歌单详情的曲目补齐歌曲信息：详情里的 tracks 带着这些歌，privileges 按编号对上 */
function addDetailSongs(songs: Map<number, SongPart>, detail: PlaylistDetailBody): void {
  const privileges = new Map((detail.privileges ?? []).map(privilege => [privilege.id, privilege]))
  for (const song of detail.playlist.tracks ?? []) {
    const privilege = privileges.get(song.id)
    if (privilege)
      songs.set(song.id, { song, privilege })
  }
}

/** 歌单列表里的 tracks/trackIds 是 null：详情里才有曲目，把它们补进列表的头部 */
function syncSummaries(playlists: RawPlaylist[], details: Map<number, PlaylistDetailBody>): void {
  for (const playlist of playlists) {
    const detail = details.get(playlist.id)
    if (detail) {
      playlist.trackIds = detail.playlist.trackIds
      playlist.tracks = detail.playlist.tracks
      playlist.trackCount = playlist.trackIds.length
    }
  }
}

/** 这张歌单的头部：新建、改过的歌单没有自己的录制，用模板拼出来 */
function patchPlaylist(playlist: RawPlaylist, next: Partial<RawPlaylist>): RawPlaylist {
  return { ...structuredClone(playlist), ...next }
}

export async function buildSeed(seed: SeedName): Promise<SeedData> {
  const before = 'library/sync/before'
  const chosen = `library/sync/${seed}`
  const playlists = (bodyOf(await readFixture(`${chosen}/001-user_playlist.json.gz`)) as { playlist: RawPlaylist[] }).playlist
  const details = new Map<number, PlaylistDetailBody>()
  for (const name of await listDetailFiles(before)) {
    const body = detailBody(await readFixture(`${before}/${name}`))
    details.set(body.playlist.id, body)
  }
  const beforePoems = details.get(POEMS_PLAYLIST)
  if (seed !== 'before') {
    for (const name of await listDetailFiles(chosen)) {
      const body = detailBody(await readFixture(`${chosen}/${name}`))
      details.set(body.playlist.id, body)
    }
  }

  const songs = new Map<number, SongPart>()
  for (const name of await songDetailFiles(before))
    addSongs(songs, bodyOf(await readFixture(`${before}/${name}`)) as Record<string, unknown>)
  if (seed !== 'before') {
    for (const name of await songDetailFiles(chosen))
      addSongs(songs, bodyOf(await readFixture(`${chosen}/${name}`)) as Record<string, unknown>)
  }
  for (const detail of details.values())
    addDetailSongs(songs, detail)

  for (const path of [
    'library/album-artist/003-artist_top_song.json.gz',
    'library/album-artist/005-artist_top_song.json.gz',
    'library/album-artist/008-album.json.gz',
    'library/album-artist/009-album.json.gz',
    'library/album-artist/010-album.json.gz',
    'library/recommend_songs.json',
    'library/playlist_track_all.json',
    'search/results/001-cloudsearch.json.gz',
    'search/results/002-cloudsearch.json.gz',
    'search/songs/003-cloudsearch.json.gz',
    'search/songs/004-cloudsearch.json.gz',
    'search/kinds/003-cloudsearch.json.gz',
  ])
    collectInlineSongs((await readFixture(path)).response.body, songs)

  const likedDetail = detailBody(await readFixture('library/playlist_detail.liked-full.json.gz'))
  details.set(LIKED_PLAYLIST, likedDetail)
  syncSummaries(playlists, details)
  for (const page of [1, 2, 3, 4, 5])
    addSongs(songs, bodyOf(await readFixture(`library/song_detail.liked-page${page}.json.gz`)) as Record<string, unknown>)
  addDetailSongs(songs, likedDetail)

  // after 录制是“加了一首、又移除了一首”之后：把 before 和 after 的曲目并起来，留一份 3 首的样子（#58 验收要 2/3 首）
  if (seed === 'after') {
    const poems = details.get(POEMS_PLAYLIST)
    if (poems && beforePoems) {
      const ids = [...new Set([...beforePoems.playlist.trackIds, ...poems.playlist.trackIds].map(track => track.id))]
      poems.playlist.trackIds = ids.map(id => ({ id }))
      poems.playlist.tracks = ids.flatMap(id => songs.get(id)?.song ?? [])
      poems.privileges = ids.flatMap(id => songs.get(id)?.privilege ?? [])
      poems.playlist.trackCount = ids.length
    }
  }

  // 详情被改过（after 的 poems）时，列表里的头部也要跟着更新
  syncSummaries(playlists, details)

  // deleted 种子里 poems 已被删掉：歌单列表里没有它，直接打开详情时 status 是 10（#56 录制）
  if (seed === 'deleted') {
    const poems = details.get(POEMS_PLAYLIST)
    if (poems)
      poems.playlist.status = 10
  }

  // 录到的红心是整份曲目编号（4,984 首）：以它为准，likelist.json 只是截到前 30 的旧录制
  const liked = new Set(likedDetail.playlist.trackIds.map(track => track.id))

  const templates = {
    userPlaylist: bodyOf(await readFixture(`${before}/001-user_playlist.json.gz`)),
    albumSublist: bodyOf(await readFixture('library/album-artist/001-album_sublist.json.gz')),
    artistSublist: bodyOf(await readFixture('library/album-artist/002-artist_sublist.json.gz')),
    songDetail: bodyOf(await readFixture('library/song_detail.liked-page1.json.gz')),
    songUrl: bodyOf(await readFixture('playback/song_url_v1.vip-exhigh.json')),
    songUrlNoCopyright: bodyOf(await readFixture('playback/song_url_v1.no-copyright.json')),
    songDownloadUrl: bodyOf(await readFixture('playback/song_download_url_v1.vip-exhigh.json')),
    songDownloadUrlNoCopyright: bodyOf(await readFixture('playback/song_download_url_v1.no-copyright.json')),
    likelist: bodyOf(await readFixture('library/likelist.json')),
    imageUploadToken: bodyOf(await readFixture('playlist-edit/image_upload_token.json')),
    coverUpdate: bodyOf(await readFixture('playlist-edit/playlist_cover_update.imgid.json')),
    emptyPlaylistDetail: detailBody(await readFixture('playlist-edit/create/002-playlist_detail.json.gz')),
    createPlaylist: bodyOf(await readFixture('playlist-edit/create/001-playlist_create.json.gz')),
    account: bodyOf(await readFixture('login/user_account.vip.json')),
    accountAnonymous: bodyOf(await readFixture('login/user_account.anonymous.json')),
    accountInvalid: bodyOf(await readFixture('login/user_account.invalid.json')),
    userDetail: bodyOf(await readFixture('login/user_detail.vip.json')),
    loginCellphone: bodyOf(await readFixture('login/login_cellphone.200.json')),
    qrSuccess: bodyOf(await readFixture('login/login_qr_check.803-success.json')),
    loginRefresh: bodyOf(await readFixture('login/login_refresh.qr.json')),
    playlistCatlist: bodyOf(await readFixture('playlist-edit/playlist_catlist.json')),
    recommendSongs: bodyOf(await readFixture('library/recommend_songs.json')),
    playlistTrackAll: bodyOf(await readFixture('library/playlist_track_all.json')),
    scrobble: bodyOf(await readFixture('playback/check-in/001-scrobble.json.gz')),
    lyric: bodyOf(await readFixture('playback/lyric_new.all-forms.json')),
    likeAdd: bodyOf(await readFixture('like-collect/like.like.json')),
    likeRemove: bodyOf(await readFixture('like-collect/like.unlike.json')),
    playlistAdd: fixtureOutcome('playlist_tracks', (await readFixture('playlist-edit/playlist_tracks.add.json')).response).response.body,
    playlistRemove: fixtureOutcome('playlist_tracks', (await readFixture('playlist-edit/playlist_tracks.del.json')).response).response.body,
    playlistOrder: bodyOf(await readFixture('playlist-edit/song_order_update.whole-4967-small-change.json')),
    playlistOrderUpdate: bodyOf(await readFixture('playlist-edit/playlist_order_update.json')),
    playlistCreate: bodyOf(await readFixture('playlist-edit/create/001-playlist_create.json.gz')),
    playlistDelete: bodyOf(await readFixture('playlist-edit/playlist_delete.json')),
    playlistName: bodyOf(await readFixture('playlist-edit/playlist_name_update.json')),
    playlistDesc: bodyOf(await readFixture('playlist-edit/playlist_desc_update.json')),
    playlistTags: bodyOf(await readFixture('playlist-edit/playlist_tags_update.3-tags.json')),
    playlistPrivacy: bodyOf(await readFixture('playlist-edit/playlist_privacy.json')),
    playlistSubscribe: bodyOf(await readFixture('like-collect/playlist_subscribe.subscribe-token.json')),
    playlistUnsubscribe: bodyOf(await readFixture('like-collect/playlist_subscribe.unsubscribe.json')),
    albumSub: bodyOf(await readFixture('like-collect/album_sub.subscribe.json')),
    albumUnsub: bodyOf(await readFixture('like-collect/album_sub.unsubscribe.json')),
    artistSub: bodyOf(await readFixture('like-collect/artist_sub.subscribe.json')),
    artistUnsub: bodyOf(await readFixture('like-collect/artist_sub.unsubscribe.json')),
    missingPlaylist: bodyOf(await readFixture('playlist-edit/playlist_tracks.add-deleted-playlist.json')),
    duplicateTracks: fixtureOutcome('playlist_tracks', (await readFixture('playlist-edit/playlist_tracks.add-duplicate.json')).response).response.body,
    orderUnconfirmed: bodyOf(await readFixture('playlist-edit/song_order_update.missing-one.json')),
  }

  // 4 首可播放的歌单：录制里没有正好 4 首、4 首都有播放地址的歌单，用 4 首录到过播放地址的歌拼一张 mock 专用歌单
  const poems = playlists.find(playlist => playlist.id === POEMS_PLAYLIST) ?? playlists[1]
  const fourSongs = FOUR_PLAYABLE_IDS.filter(id => songs.has(id))
  if (poems && fourSongs.length === 4) {
    const trackIds = fourSongs.map(id => ({ id }))
    const playlist = patchPlaylist(poems, {
      id: FOUR_PLAYABLE_PLAYLIST,
      name: 'Mock · 4 首可播放',
      coverImgUrl: '/mock-assets/cover/mock-4-playable.svg',
      trackCount: 4,
      trackIds,
      tracks: fourSongs.map(id => songs.get(id)!.song),
      specialType: 0,
      privacy: 0,
      subscribed: false,
      status: 0,
      trackUpdateTime: Date.now(),
      creator: { ...poems.creator, userId: SELF_UID, nickname: '测试听众' },
    })
    playlists.splice(playlists.findIndex(item => item.id === POEMS_PLAYLIST) + 1, 0, playlist)
    const detail = patchPlaylistDetail(templates.emptyPlaylistDetail, playlist, fourSongs.map(id => songs.get(id)!))
    details.set(FOUR_PLAYABLE_PLAYLIST, detail)
  }

  const albums = (bodyOf(await readFixture('library/album-artist/001-album_sublist.json.gz')) as { data: Record<string, unknown>[] }).data
  const artists = (bodyOf(await readFixture('library/album-artist/002-artist_sublist.json.gz')) as { data: Record<string, unknown>[] }).data
  const albumDetails = new Map<number, Record<string, unknown>>()
  const albumSummaries = new Map<number, Record<string, unknown>>(albums.flatMap(album => typeof album.id === 'number' ? [[album.id, album] as const] : []))
  const artistSummaries = new Map<number, Record<string, unknown>>(artists.flatMap(artist => typeof artist.id === 'number' ? [[artist.id, artist] as const] : []))
  for (const name of ['008-album.json.gz', '009-album.json.gz', '010-album.json.gz']) {
    const body = bodyOf(await readFixture(`library/album-artist/${name}`)) as { album?: Record<string, unknown> }
    if (body.album && typeof body.album.id === 'number') {
      albumDetails.set(body.album.id, body.album)
      if (!albumSummaries.has(body.album.id))
        albumSummaries.set(body.album.id, { id: body.album.id, name: body.album.name, picUrl: body.album.picUrl, size: body.album.size, artists: body.album.artists })
    }
  }

  return {
    seed,
    playlists,
    byId: new Map(playlists.map(playlist => [playlist.id, playlist])),
    details,
    songs,
    liked,
    likedDetail,
    albums,
    artists,
    albumDetails,
    albumSummaries,
    artistSummaries,
    templates,
  }
}

/** 用一份详情模板拼出这张歌单的详情：头部照歌单列表里的，曲目按 trackIds 的顺序 */
export function patchPlaylistDetail(template: PlaylistDetailBody, playlist: RawPlaylist, parts: SongPart[]): PlaylistDetailBody {
  const body = structuredClone(template)
  body.playlist = patchPlaylist(playlist, {
    tracks: parts.map(part => part.song),
    trackIds: playlist.trackIds,
  })
  body.privileges = parts.map(part => part.privilege)
  return body
}
