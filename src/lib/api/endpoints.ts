import { resolve } from '$app/paths'

import type { AccountResponse } from './account.js'
import type { CoverTokenResponse, SetCoverRequest, SetCoverResponse } from './cover.js'
import type { DailyResponse } from './discover.js'
import type { GetEndpoint } from './endpoint.js'
import { get, post } from './endpoint.js'
import type { AddTracksRequest, AlbumResponse, ArtistAlbumsResponse, ArtistResponse, CollectedAlbumsResponse, CollectedArtistsResponse, CollectRequest, CreatePlaylistRequest, CreatePlaylistResponse, DescribePlaylistRequest, HeartRequest, HeartsResponse, PlaylistCollectRequest, PlaylistOrderRequest, PlaylistPageResponse, PlaylistsResponse, PlaylistTagsResponse, RemoveTracksRequest, RenamePlaylistRequest, SongOrderRequest, SongsRequest, SongsResponse, TagPlaylistRequest, TrackIdsResponse } from './library.js'
import type { CaptchaRequest, CaptchaResponse, LogoutResponse, QrCheckRequest, QrCheckResponse, QrResponse, SmsLoginRequest, SmsLoginResponse } from './login.js'
import type { CheckInRequest, DownloadUrlResponse, LyricsResponse, PlayUrlResponse, Quality } from './playback.js'
import type { SearchKind, SearchPageResponse, SuggestionsResponse } from './search.js'
import type { WriteResponse } from './write.js'

// Campanula 自己的接口目录（ADR-0013）：一个端点一条。路径借 SvelteKit 生成的路由 id（#63 之后路径参数是数字），
// 改错路由 id 或参数 pnpm check 会报错；关键词、查询参数的编码只在这里做，浏览器只打包拼路径的小函数（ADR-0005）。

/** 歌单、专辑、歌手、歌曲的路径参数都是网易云的编号 */
interface NeteaseIdParams {
  id: number
}

/** 搜索结果的一页：items 的形状由 kind 定（服务端的 searches 按 kind 塑形），所以响应类型跟着 kind 走 */
export const searchPage = <K extends SearchKind>(kind: K): GetEndpoint<{ keywords: string, offset: number }, SearchPageResponse<K>> => get<SearchPageResponse<K>, { keywords: string, offset: number }>(({ keywords, offset }) =>
  `${resolve('/api/search/[kind]', { kind })}?keywords=${encodeURIComponent(keywords)}&offset=${offset}`)

export const endpoints = {

  /** 没有登录 Cookie 时是 null，不调网易云 */
  account: get<AccountResponse>(() => resolve('/api/account')),

  loginQr: post<QrResponse>(() => resolve('/api/login/qr')),

  /** 登录成功时服务端已经设好登录 Cookie */
  checkLoginQr: post<QrCheckResponse, QrCheckRequest>(() => resolve('/api/login/qr/check')),

  /** 只支持中国大陆手机号（+86） */
  sendCaptcha: post<CaptchaResponse, CaptchaRequest>(() => resolve('/api/login/captcha')),

  loginSms: post<SmsLoginResponse, SmsLoginRequest>(() => resolve('/api/login/sms')),

  logout: post<LogoutResponse>(() => resolve('/api/logout')),

  /** GET /api/hearts?uid=：红心了哪些歌。决定红心状态以它为准（我喜欢的音乐的歌曲数会对不上几首，#21 留言） */
  hearts: get<HeartsResponse, { uid: number }>(({ uid }) => `${resolve('/api/hearts')}?uid=${uid}`),

  /** POST /api/hearts：红心或取消红心一首歌（一次只能一首，hana-music-api 的 like 只收一个编号） */
  heart: post<WriteResponse, HeartRequest>(() => resolve('/api/hearts')),

  /** GET /api/playlists?uid=：歌单列表，我喜欢的音乐在最前，然后是自建的、收藏的，和网易云的顺序一样；在网易云里删掉的歌单不在里面 */
  playlists: get<PlaylistsResponse, { uid: number }>(({ uid }) => `${resolve('/api/playlists')}?uid=${uid}`),

  /** POST /api/playlists：新建自建歌单。name 去掉了首尾空白，1 到 PLAYLIST_NAME_WIDTH 个宽度 */
  createPlaylist: post<CreatePlaylistResponse, CreatePlaylistRequest>(() => resolve('/api/playlists')),

  /** 不在曲库里的一张歌单，每次打开都联网取（ADR-0007）；头部和全部曲目编号，打不开时说明原因 */
  playlist: get<PlaylistPageResponse, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]', { id })),

  /** 按歌单里的顺序 */
  trackIds: get<TrackIdsResponse, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/track-ids', { id })),

  /** 1 到 SONGS_PER_REQUEST 首 */
  songs: post<SongsResponse, SongsRequest>(() => resolve('/api/songs')),

  /** POST /api/playlists/[id]/tracks：加入歌单（自建歌单；我喜欢的音乐用红心）。1 到 TRACKS_PER_CHANGE 首 */
  addTracks: post<WriteResponse, AddTracksRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/tracks', { id })),

  /** 1 到 TRACKS_PER_CHANGE 首 */
  removeTracks: post<WriteResponse, RemoveTracksRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/tracks/remove', { id })),

  /** POST /api/playlists/[id]/order：整张歌单的新顺序（自建歌单、我喜欢的音乐），按歌单里的先后排列 */
  songOrder: post<WriteResponse, SongOrderRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/order', { id })),

  /** POST /api/library/order：曲库里能排序的歌单的新顺序（#37）：我喜欢的音乐和全部自建歌单，我喜欢的音乐必须在最前 */
  playlistOrder: post<WriteResponse, PlaylistOrderRequest>(() => resolve('/api/library/order')),

  /** POST /api/playlists/[id]/collect：收藏或取消收藏歌单。收藏时要带网易云的反作弊令牌，取消收藏不带 */
  collectPlaylist: post<WriteResponse, PlaylistCollectRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/collect', { id })),

  /** POST /api/playlists/[id]/cover/token：申请封面的上传凭证（imgId、token、uploadUrl） */
  coverToken: post<CoverTokenResponse, void, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/cover/token', { id })),

  /** POST /api/playlists/[id]/cover：把已经直传成功的图片设为封面，回新封面的地址 */
  setCover: post<SetCoverResponse, SetCoverRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/cover', { id })),

  /** POST /api/playlists/[id]/name：改自建歌单的名称，和新建一样去掉了首尾空白、1 到 PLAYLIST_NAME_WIDTH 个宽度 */
  renamePlaylist: post<WriteResponse, RenamePlaylistRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/name', { id })),

  /** POST /api/playlists/[id]/description：改简介，最多 PLAYLIST_DESCRIPTION_LENGTH 个字；空字符串是清空 */
  describePlaylist: post<WriteResponse, DescribePlaylistRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/description', { id })),

  /** POST /api/playlists/[id]/tags：换一组标签，0 到 PLAYLIST_TAGS_MAX 个，从标签库里选的 */
  tagPlaylist: post<WriteResponse, TagPlaylistRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/tags', { id })),

  publishPlaylist: post<WriteResponse, void, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/public', { id })),

  deletePlaylist: post<WriteResponse, void, NeteaseIdParams>(({ id }) =>
    resolve('/api/playlists/[id=neteaseId]/delete', { id })),

  /** 每次都从网易云取，不写死（Spec #11；验证关卡②录到 70 个、5 类） */
  playlistTags: get<PlaylistTagsResponse>(() => resolve('/api/playlist-tags')),

  /** GET /api/albums：收藏的专辑，最近收藏的在前，和网易云的顺序一样 */
  albums: get<CollectedAlbumsResponse>(() => resolve('/api/albums')),

  /** GET /api/artists：收藏的歌手，最近收藏的在前，和网易云的顺序一样 */
  artists: get<CollectedArtistsResponse>(() => resolve('/api/artists')),

  album: get<AlbumResponse, NeteaseIdParams>(({ id }) =>
    resolve('/api/albums/[id=neteaseId]', { id })),

  /** GET /api/artists/[id]：歌手页的头部、热门歌曲（网易云给 50 首）和第一页专辑（新的在前） */
  artist: get<ArtistResponse, NeteaseIdParams>(({ id }) =>
    resolve('/api/artists/[id=neteaseId]', { id })),

  /** 从第 offset 张往后的一页专辑 */
  artistAlbums: get<ArtistAlbumsResponse, { id: number, offset: number }>(({ id, offset }) =>
    `${resolve('/api/artists/[id=neteaseId]/albums', { id })}?offset=${offset}`),

  collectAlbum: post<WriteResponse, CollectRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/albums/[id=neteaseId]/collect', { id })),

  collectArtist: post<WriteResponse, CollectRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/artists/[id=neteaseId]/collect', { id })),

  /** GET /api/daily：网易云今天给这个账号的每日推荐，按网易云的顺序 */
  daily: get<DailyResponse>(() => resolve('/api/daily')),

  /** GET /api/search/suggestions?keywords=：网易云给的建议，单曲、歌手、专辑、歌单依次排 */
  suggestions: get<SuggestionsResponse, { keywords: string }>(({ keywords }) =>
    `${resolve('/api/search/suggestions')}?keywords=${encodeURIComponent(keywords)}`),

  /** GET /api/songs/[id]/play-url?quality=：一首歌的播放地址，浏览器拿它直连网易云的音频服务器 */
  playUrl: get<PlayUrlResponse, { id: number, quality: Quality }>(({ id, quality }) =>
    `${resolve('/api/songs/[id=neteaseId]/play-url', { id })}?quality=${quality}`),

  /** GET /api/songs/[id]/download-url?quality=：下载一首用的地址（#38），只给完整音频 */
  downloadUrl: get<DownloadUrlResponse, { id: number, quality: Quality }>(({ id, quality }) =>
    `${resolve('/api/songs/[id=neteaseId]/download-url', { id })}?quality=${quality}`),

  lyrics: get<LyricsResponse, NeteaseIdParams>(({ id }) =>
    resolve('/api/songs/[id=neteaseId]/lyrics', { id })),

  /** POST /api/songs/[id]/check-in：听歌打卡，这首歌听完了（播完或切走）；计入听歌排行有 10–30 分钟延迟 */
  checkIn: post<WriteResponse, CheckInRequest, NeteaseIdParams>(({ id }) =>
    resolve('/api/songs/[id=neteaseId]/check-in', { id })),
}
