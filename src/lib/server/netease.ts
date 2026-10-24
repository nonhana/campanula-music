import { NETEASE_REAL_IP } from '$app/env/private'
import type { ModuleCallConfig, ModuleIdentifier, ModuleResponseOf, PlaylistSummary } from 'hana-music-api'
import { invokeModule } from 'hana-music-api'

import type { Account } from '#lib/api/account.js'
import type { CoverTokenResponse, SetCoverResponse } from '#lib/api/cover.js'
import type { DailyResponse } from '#lib/api/discover.js'
import type { NeteaseFailure } from '#lib/api/errors.js'
import type { AlbumResponse, ArtistAlbum, ArtistAlbumsResponse, ArtistResponse, Availability, CollectedAlbum, CollectedArtist, Credit, Playlist, PlaylistCollectRequest, PlaylistInfo, PlaylistPageResponse, PlaylistTagGroup, PlaylistUnavailable, Song } from '#lib/api/library.js'
import { ARTIST_ALBUMS_PER_REQUEST, playlistKindOf } from '#lib/api/library.js'
import type { QrResponse } from '#lib/api/login.js'
import type { DownloadUrlResponse, LyricsResponse, PlaySource, PlayUrlResponse, Quality } from '#lib/api/playback.js'
import type { SearchKind, SearchPageResponse, SuggestionsResponse } from '#lib/api/search.js'
import { SEARCH_RESULTS_PER_REQUEST } from '#lib/api/search.js'
import type { WriteResponse } from '#lib/api/write.js'

import { lyricsOf } from './lyrics'

// 网易云适配层（Spec #11“服务端：网易云适配层”）：服务端里只有这里调 hana-music-api。
// 每次调用都带上听众的凭据和 deviceId，站长配了真实国内 IP 就作为 realIP 传入；
// 网易云的结果翻译成 Campanula 的错误约定（#lib/api/errors），返回体映射成界面要用的数据。

/** 网易云那边的这个听众 */
export interface Listener {
  deviceId: string
  /** 网易云凭据（Cookie 的名字和值）；还没登录时是 null，SDK 用匿名身份 */
  credentials: Record<string, string> | null
}

/** 调网易云失败：failure 交给客户端；body 是网易云原样的返回，只给这一层自己看 */
export class NeteaseError extends Error {
  constructor(readonly failure: NeteaseFailure, readonly body: unknown) {
    super(`网易云：${failure.kind}`)
  }
}

type QueryOf<K extends ModuleIdentifier> = Parameters<typeof invokeModule<K>>[1]

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * SDK 失败时抛出 { status, body, cookie }（照 SDK 2.7.1 的 normalizeFailure、classifyConsumedRateLimit，文档见它的 programmatic-api.md）：
 * - 网易云的业务拒绝：body 是网易云原样的返回，status 取返回码（不在 101~599 时是 400）；
 * - 返回结构不认识：status 502，body.upstreamShape 写明哪里不对；
 * - 网易云限流（HTTP 429、返回码 429，或返回码 405 带“操作频繁”“操作过于频繁”，不管 HTTP 状态是多少）：status 是 429 或 405，
 *   body 是网易云原样的返回加上 retryAfter（秒，网易云没给 Retry-After 时是 30；405 那种录到的一次没给，nonhana/hana-music-api#60）。只有这种失败带 retryAfter；
 * - SDK 自己生成的失败（超时 504、连不上或读不懂返回 502、匿名注册失败 502）：body 只有 code 和 msg。
 */
const translate = (thrown: unknown): { failure: NeteaseFailure, body: unknown } => {
  if (!isRecord(thrown) || typeof thrown.status !== 'number' || !('body' in thrown))
    throw thrown // 不是 SDK 的失败返回，是 Campanula 自己的缺陷
  const { status, body } = thrown
  const fields = isRecord(body)
    ? body
    : {}
  const code = typeof fields.code === 'number'
    ? fields.code
    : status
  if (code === 301) {
    return {
      failure: { kind: 'needsLogin' },
      body,
    }
  }
  if (typeof fields.retryAfter === 'number') {
    return {
      failure: { kind: 'rateLimited', retryAfter: fields.retryAfter },
      body,
    }
  }
  if (isRecord(fields.upstreamShape)) {
    return {
      failure: { kind: 'upstreamChanged' },
      body,
    }
  }
  if (status >= 500 && Object.keys(fields).every(key => key === 'code' || key === 'msg')) {
    return {
      failure: { kind: 'neteaseUnavailable' },
      body,
    }
  }
  const message = typeof fields.message === 'string'
    ? fields.message
    : typeof fields.msg === 'string'
      ? fields.msg
      : ''
  return {
    failure: { kind: 'rejected', code, message },
    body,
  }
}

/** 日志里只写模块和失败的种类、网易云的返回码和说明，不写请求参数和 Cookie（手机号、验证码、凭据都在里面） */
const describe = (failure: NeteaseFailure): string => {
  switch (failure.kind) {
    case 'needsLogin':
      return '需要登录'
    case 'rateLimited':
      return `操作频繁，${failure.retryAfter} 秒后再试`
    case 'upstreamChanged':
      return '返回的结构变了'
    case 'neteaseUnavailable':
      return '连不上、超时或网易云出错'
    case 'rejected':
      return `网易云拒绝（${failure.code}）${failure.message}`
    default: {
      const unhandled: never = failure
      throw new Error(`不认识的失败：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 只有个别模块要的调用配置：收藏歌单的反作弊令牌（只透传，不记日志，见 describe） */
type ExtraConfig = Pick<ModuleCallConfig, 'checkToken'>

const call = async <K extends ModuleIdentifier>(module: K, query: QueryOf<K>, listener: Listener, extra: ExtraConfig = {}): Promise<ModuleResponseOf<K>> => {
  // state 里的 deviceId 用在每次请求的 Cookie 头里。顶层的 deviceId 不在 SDK 的类型里，是给隐式匿名注册用的：
  // 没登录的调用由 SDK 先匿名注册，拿到的匿名身份 SDK 自己存在进程里，同一个实例里之后的匿名调用都共用它，
  // 所以只有实例里第一次匿名注册用到这个 deviceId（SDK 2.2.0 ensureAnonymousEffect）。Campanula 自己不存任何状态
  const config: ModuleCallConfig & { deviceId: string } = {
    cookie: listener.credentials ?? undefined,
    deviceId: listener.deviceId,
    state: { deviceId: listener.deviceId },
    realIP: NETEASE_REAL_IP || undefined,
    ...extra,
  }
  try {
    return await invokeModule(module, query, config)
  }
  catch (thrown) {
    const { failure, body } = translate(thrown)
    console.warn(`网易云 ${module} 失败：${describe(failure)}`)
    throw new NeteaseError(failure, body)
  }
}

/**
 * 从网易云下发的 Set-Cookie 里取出凭据，叠在 base 上：只留名字和值（同名的后者覆盖），值为空或已经过期的删掉。
 * 没有下发新的 MUSIC_U 就算不上登录或续期成功：当作上游结构变了，和 call() 一样记一条日志
 */
const credentialsFrom = (module: ModuleIdentifier, setCookies: readonly string[], base: Record<string, string> = {}): Record<string, string> => {
  const credentials: Record<string, string> = { ...base }
  for (const line of setCookies) {
    const [pair = '', ...attributes] = line.split(';')
    const at = pair.indexOf('=')
    if (at <= 0)
      continue
    const name = pair.slice(0, at).trim()
    const value = pair.slice(at + 1).trim()
    const expired = attributes.some(attribute => /^\s*max-age\s*=\s*(?:0|-\d+)\s*$/i.test(attribute))
    if (value && !expired)
      credentials[name] = value
    else
      delete credentials[name]
  }
  if (!credentials.MUSIC_U || credentials.MUSIC_U === base.MUSIC_U)
    throw shapeChanged(module, '没有下发新的 MUSIC_U')
  return credentials
}

/** 网易云的返回 SDK 认得、但对不上 Campanula 依赖的约定：当作上游结构变了，和 call() 一样记一条日志 */
const shapeChanged = (module: ModuleIdentifier, detail: string): NeteaseError => {
  const failure = { kind: 'upstreamChanged' } as const
  console.warn(`网易云 ${module} 失败：${describe(failure)}（${detail}）`)
  return new NeteaseError(failure, null)
}

/** 一张新的登录二维码 */
export const createLoginQr = async (listener: Listener): Promise<QrResponse> => {
  const { body: { data: { unikey: key } } } = await call('login_qr_key', {}, listener)
  const { body } = await call('login_qr_create', { key, qrimg: true }, listener)
  return { key, image: body.data.qrimg }
}

/** 扫码状态；确认登录时带着凭据 */
export type QrCheck
  = | { status: 'waiting' }
    | { status: 'scanned', nickname: string, avatarUrl: string }
    | { status: 'expired' }
    | { status: 'needsVerification', image: string }
    | { status: 'confirmed', credentials: Record<string, string> }

/**
 * 8821 时网易云给的行为验证参数，换成 verify_getQr 的参数；没给全就是 null。
 * 8821 还没录到过：字段照开源实现 saltbo/zme 的 NeteaseRiskData（params 可能是对象也可能是 JSON 字符串），
 * 见 tests/fixtures/netease/README.md“构造的数据”
 */
const verificationOf = (body: unknown): { vid: string, type: string, token: string, evid: string, sign: string } | null => {
  const data = isRecord(body) && isRecord(body.data)
    ? body.data
    : null
  if (!data)
    return null
  let params: unknown = data.params
  if (typeof params === 'string') {
    try {
      params = JSON.parse(params)
    }
    catch {
      return null
    }
  }
  const { verifyId, verifyType, verifyToken } = data
  const isId = (value: unknown) => typeof value === 'string' || typeof value === 'number'
  if (!isId(verifyId) || !isId(verifyType) || typeof verifyToken !== 'string' || !verifyToken || !isRecord(params)
    || typeof params.event_id !== 'string' || typeof params.sign !== 'string') {
    return null
  }
  return {
    vid: String(verifyId),
    type: String(verifyType),
    token: verifyToken,
    evid: params.event_id,
    sign: params.sign,
  }
}

export const checkLoginQr = async (key: string, listener: Listener): Promise<QrCheck> => {
  let response: ModuleResponseOf<'login_qr_check'>
  try {
    response = await call('login_qr_check', { key }, listener)
  }
  catch (error) {
    // 扫码确认后网易云要求行为验证：取验证用的二维码，听众用网易云 App 扫了在手机上验证。
    // 网易云没给验证参数时没法验证，原样当作网易云的拒绝交给界面
    if (!(error instanceof NeteaseError && error.failure.kind === 'rejected' && error.failure.code === 8821))
      throw error
    const verification = verificationOf(error.body)
    if (!verification)
      throw error
    const { body } = await call('verify_getQr', verification, listener)
    return { status: 'needsVerification', image: body.data.qrimg }
  }
  const { body, cookie } = response
  switch (body.code) {
    case 800:
      return { status: 'expired' }
    case 801:
      return { status: 'waiting' }
    case 802:
      return { status: 'scanned', nickname: body.nickname, avatarUrl: body.avatarUrl }
    case 803:
      return {
        status: 'confirmed',
        credentials: credentialsFrom('login_qr_check', cookie),
      }
    default: {
      const unhandled: never = body
      throw new Error(`不认识的扫码状态：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 发短信验证码（只支持 +86） */
export const sendCaptcha = async (phone: string, listener: Listener): Promise<void> => {
  await call('captcha_sent', { phone, ctcode: '86' }, listener)
}

/** 短信验证码登录：拿到凭据，以及登录的账号 */
export const loginWithCaptcha = async (phone: string, captcha: string, listener: Listener): Promise<{ credentials: Record<string, string>, account: Account }> => {
  const { body, cookie } = await call('login_cellphone', { phone, captcha, countrycode: '86' }, listener)
  return {
    credentials: credentialsFrom('login_cellphone', cookie),
    account: { id: body.profile.userId, nickname: body.profile.nickname, avatarUrl: body.profile.avatarUrl },
  }
}

/** 当前登录的账号。凭据已经失效时网易云照样回 200，但只剩匿名身份、没有个人资料：当作需要登录 */
export const fetchAccount = async (listener: Listener): Promise<Account> => {
  const { body } = await call('user_account', {}, listener)
  if (!body.account || body.account.anonimousUser || !body.profile)
    throw new NeteaseError({ kind: 'needsLogin' }, body)
  return { id: body.profile.userId, nickname: body.profile.nickname, avatarUrl: body.profile.avatarUrl }
}

/** 已经登录的听众：带着网易云凭据 */
export type SignedInListener = Listener & { credentials: Record<string, string> }

/**
 * 续期：网易云下发新的 MUSIC_U（重新算 180 天）和新的 __csrf，叠在原来的凭据上。
 * 续期后旧的凭据不会马上失效（验证关卡①：17.6 分钟后还能用）
 */
export const renewLogin = async (listener: SignedInListener): Promise<Record<string, string>> => {
  const { cookie } = await call('login_refresh', {}, listener)
  return credentialsFrom('login_refresh', cookie, listener.credentials)
}

/** 退出登录：网易云只注销同一个 deviceId 上的登录，听众在其他设备上的登录不受影响（验证关卡①） */
export const logout = async (listener: Listener): Promise<void> => {
  await call('logout', {}, listener)
}

// 曲库（Spec #11“服务端：Campanula API”曲库一项）。uid 是界面问到的当前账号，凭据才决定网易云把谁当作听众

/** 红心了哪些歌（likelist）。凭据失效时网易云回 301（#21 实测），曲库同步靠它先认出登录失效 */
export const fetchHearts = async (uid: number, listener: Listener): Promise<number[]> => {
  const { body } = await call('likelist', { uid }, listener)
  return [...body.ids]
}

/** user_playlist 一次最多要这么多张；网易云说还有（more）就接着要 */
const PLAYLISTS_PER_CALL = 1000
/** 隐私歌单的 privacy（公开的是 0，验证关卡②） */
const PRIVATE_PLAYLIST = 10

/** 歌单头部的信息：歌单列表（user_playlist）和歌单详情（playlist_detail）给的是同一份歌单（SDK 2.12.0），曲库里的、不在曲库里的都用这一份 */
const playlistInfo = (playlist: PlaylistSummary): PlaylistInfo => ({
  id: playlist.id,
  name: playlist.name,
  coverUrl: playlist.coverImgUrl,
  creator: playlist.creator.nickname,
  playCount: playlist.playCount,
  description: playlist.description,
  tags: [...playlist.tags],
})

/** 曲库里的一张歌单：歌单列表里的、新建后读回的详情里的是同一份 */
const libraryPlaylist = (playlist: PlaylistSummary, kind: Playlist['kind']): Playlist => ({
  ...playlistInfo(playlist),
  kind,
  private: playlist.privacy === PRIVATE_PLAYLIST,
  trackCount: playlist.trackCount,
  tracksUpdatedAt: playlist.trackUpdateTime,
})

/**
 * 歌单列表：我喜欢的音乐、自建的、收藏的，顺序和网易云给的一样。
 * 凭据已经失效时网易云不报错，回 200 的匿名视角：每张歌单的 subscribed 都是 null（已登录时是 true / false，#21 实测），
 * 而且看不到隐私歌单。当作需要登录：拿它去同步，隐私歌单就像被删了一样。
 * 要全部都是 null 才算：万一已登录时有哪张歌单是 null，不至于把听众当成掉了登录
 */
export const fetchPlaylists = async (uid: number, listener: Listener): Promise<Playlist[]> => {
  const playlists: Playlist[] = []
  for (let offset = 0; ; offset += PLAYLISTS_PER_CALL) {
    const { body } = await call('user_playlist', { uid, limit: PLAYLISTS_PER_CALL, offset }, listener)
    if (body.playlist.length > 0 && body.playlist.every(playlist => playlist.subscribed === null))
      throw new NeteaseError({ kind: 'needsLogin' }, body)
    for (const playlist of body.playlist)
      playlists.push(libraryPlaylist(playlist, playlistKindOf(playlist.specialType, playlist.creator.userId, uid)))
    if (!body.more)
      return playlists
  }
}

/**
 * 新建自建歌单。新建的返回里 SDK 只声明了编号和名称（creator 是 null，#33 录制），封面、隐私、曲目更新时间都要读：
 * 建好马上读一次它的详情（和歌单列表里的写法一样）。连着新建两张网易云会回 405“操作过于频繁”（#33 录制）
 */
export const createPlaylist = async (name: string, isPrivate: boolean, listener: Listener): Promise<Playlist> => {
  const { body: { id } } = await call('playlist_create', {
    name,
    privacy: String(isPrivate ? PRIVATE_PLAYLIST : 0),
  }, listener)
  const { body } = await call('playlist_detail', { id }, listener)
  return libraryPlaylist(body.playlist, 'own')
}

// 改自建歌单（#33）。歌单已经被删掉时这几样网易云都照样回 200（验证关卡②、#33 录制），要等下一次同步才发现

export const deletePlaylist = async (playlistId: number, listener: Listener): Promise<WriteResponse> => {
  await call('playlist_delete', { id: playlistId }, listener)
  return { kind: 'done' }
}

export const renamePlaylist = async (playlistId: number, name: string, listener: Listener): Promise<WriteResponse> => {
  await call('playlist_name_update', { id: playlistId, name }, listener)
  return { kind: 'done' }
}

export const describePlaylist = async (playlistId: number, description: string, listener: Listener): Promise<WriteResponse> => {
  await call('playlist_desc_update', { id: playlistId, desc: description }, listener)
  return { kind: 'done' }
}

/** 网易云要的是用分号连起来的一串标签 */
export const tagPlaylist = async (playlistId: number, tags: readonly string[], listener: Listener): Promise<WriteResponse> => {
  await call('playlist_tags_update', {
    id: playlistId,
    tags: tags.join(';'),
  }, listener)
  return { kind: 'done' }
}

/** 隐私歌单改公开：已经是公开的再改一次也回 200（验证关卡②） */
export const publishPlaylist = async (playlistId: number, listener: Listener): Promise<WriteResponse> => {
  await call('playlist_privacy', { id: playlistId }, listener)
  return { kind: 'done' }
}

/**
 * 申请封面的上传凭证（#34）：imgId 是这张图的编号，token 直传时放进 x-nos-token，uploadUrl 是图片存储的地址。
 * token 是凭据，只交给浏览器、不记日志（ADR-0003；hana-music-api 的 image_upload_token）
 */
export const coverUploadToken = async (listener: Listener): Promise<CoverTokenResponse> => {
  const { body } = await call('image_upload_token', {}, listener)
  return {
    imgId: String(body.data.imgId),
    token: body.data.token,
    uploadUrl: body.data.uploadUrl,
  }
}

/**
 * 用直传成功的图片编号设为封面（#34）：返回新封面的地址，用它显示（刚设完读歌单详情有时还是旧的，验证关卡②）。
 * 网易云不检查图片：只申请了凭证、没直传也回 200，所以调用方只在直传成功后调它
 */
export const setPlaylistCover = async (playlistId: number, imgId: string, listener: Listener): Promise<SetCoverResponse> => {
  const { body } = await call('playlist_cover_update', { id: playlistId, imgId }, listener)
  if (body.code !== 200)
    throw new NeteaseError({ kind: 'rejected', code: body.code, message: body.msg }, body)
  return { url: body.data.url }
}

/** 一张歌单的全部曲目编号（SDK 的 playlist_detail 一次要 10 万首）。我喜欢的音乐约 5,000 首时网易云原始返回约 3.1 MB，这里只留编号 */
export const fetchTrackIds = async (playlistId: number, listener: Listener): Promise<number[]> => {
  const { body } = await call('playlist_detail', { id: playlistId }, listener)
  return body.playlist.trackIds.map(track => track.id)
}

/** 已删除的歌单的 status：网易云照样回 200 和完整歌单，正常的是 0（验证关卡②，#56 录制里创建者本人看、别人看都是 10） */
const DELETED_PLAYLIST = 10
/** playlist_detail 打不开时网易云的返回码（#56 录制）：不存在 404“歌单不存在”，别人的隐私歌单 401“该歌单已被创建者设置为隐私” */
const UNAVAILABLE_CODES: Readonly<Record<number, PlaylistUnavailable>> = { 404: 'missing', 401: 'private' }

/** 不在曲库里的一张歌单：头部和全部曲目编号；已删除、不存在、别人的隐私歌单说明打不开的原因 */
export const fetchPlaylistPage = async (playlistId: number, listener: Listener): Promise<PlaylistPageResponse> => {
  const playlist = await call('playlist_detail', { id: playlistId }, listener).then(({ body }) => body.playlist, (error: unknown) => {
    const reason = error instanceof NeteaseError && error.failure.kind === 'rejected'
      ? UNAVAILABLE_CODES[error.failure.code]
      : undefined
    if (!reason)
      throw error
    return reason
  })
  if (typeof playlist === 'string')
    return { kind: 'unavailable', reason: playlist }
  if (playlist.status === DELETED_PLAYLIST)
    return { kind: 'unavailable', reason: 'deleted' }
  return {
    kind: 'shown',
    playlist: playlistInfo(playlist),
    trackIds: playlist.trackIds.map(track => track.id),
    tracksUpdatedAt: playlist.trackUpdateTime,
  }
}

/**
 * 歌单的标签库（编辑歌单的标签只能从这里选）：网易云的分类（categories，编号 → 名字）按编号排，
 * 每类里是标签（sub 里 category 是这一类的），照网易云的顺序
 */
export const fetchPlaylistTags = async (listener: Listener): Promise<PlaylistTagGroup[]> => {
  const { body } = await call('playlist_catlist', {}, listener)
  return Object.entries(body.categories)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([category, name]) => ({
      name,
      tags: body.sub.filter(tag => tag.category === Number(category)).map(tag => tag.name),
    }))
}

/** 网易云的歌（歌曲信息、专辑页、热门歌曲里的结构一样） */
interface NeteaseSong {
  id: number
  name: string
  ar: readonly Credit[]
  // 单曲搜索（cloudsearch）里专辑名是可选的（SDK 2.13.0 起），其余接口都是必有的
  al: { id: number, name?: string | null, picUrl: string }
  dt: number
}

/**
 * 网易云的权限信息里 Campanula 用到的：st 小于 0 是无版权（登录后录到的都是 -200），pl 是能在线放的最高码率，0 是放不了完整的。
 * 没登录时单曲搜索里每首歌的 st 都是 -100（#31 留言），Campanula 只在登录后搜，不会遇到
 */
interface Privilege {
  st: number
  pl: number
}

const availabilityOf = (privilege: Privilege): Availability => {
  if (privilege.st < 0)
    return 'noCopyright'
  return privilege.pl > 0
    ? 'full'
    : 'trial'
}

/** 网易云的歌只留界面用得到的字段 */
const songOf = (song: NeteaseSong, privilege: Privilege): Song => ({
  id: song.id,
  name: song.name,
  artists: song.ar.map(creditOf),
  album: { id: song.al.id, name: song.al.name ?? null, coverUrl: song.al.picUrl },
  duration: song.dt,
  availability: availabilityOf(privilege),
})

/** 专辑页、热门歌曲、每日推荐、单曲搜索里每首歌带着自己的权限信息 */
const songWithPrivilegeOf = (song: NeteaseSong & { privilege: Privilege }): Song => songOf(song, song.privilege)

const creditOf = (artist: Credit): Credit => ({ id: artist.id, name: artist.name })

/** 歌曲信息，按 ids 的顺序；网易云没给的不在里面 */
export const fetchSongs = async (ids: readonly number[], listener: Listener): Promise<Song[]> => {
  const { body } = await call('song_detail', {
    ids: ids.join(','),
  }, listener)
  const byId = new Map(body.songs.map(song => [song.id, song]))
  // 权限信息在另一个数组里，按编号对上（录到的 51 份都是一首一条）
  const privileges = new Map(body.privileges.map(privilege => [privilege.id, privilege]))
  return ids.flatMap((id) => {
    const song = byId.get(id)
    if (!song)
      return []
    const privilege = privileges.get(id)
    if (!privilege)
      throw shapeChanged('song_detail', `歌曲 ${id} 没有权限信息`)
    return [
      songOf(song, privilege),
    ]
  })
}

/** 网易云给的音频地址是 http，换成 https（音频服务器支持，页面是 https 的） */
const https = (url: string): string => url.replace(/^http:\/\//, 'https://')

/** 一首歌的播放地址 */
export const fetchPlayUrl = async (songId: number, quality: Quality, listener: Listener): Promise<PlayUrlResponse> => {
  const { body } = await call('song_url_v1', { id: songId, level: quality }, listener)
  const item = body.data.find(data => data.id === songId)
  if (!item?.url)
    return { playable: false }
  return {
    playable: true,
    url: https(item.url),
    trial: item.freeTrialInfo !== null,
    expiresIn: item.expi,
  }
}

/**
 * 下载一首用的地址（song_download_url_v1，SDK 声明了 url、size）。网易云没给地址（无版权，这个账号下不了完整的）时 url 是 null。
 * 地址是 http 的，换成 https（音频服务器支持，验证关卡③）
 */
export const fetchDownloadUrl = async (songId: number, quality: Quality, listener: Listener): Promise<DownloadUrlResponse> => {
  const { body } = await call('song_download_url_v1', { id: songId, level: quality }, listener)
  if (body.data.id !== songId)
    throw shapeChanged('song_download_url_v1', `要的是歌曲 ${songId}，回的是 ${body.data.id}`)
  if (!body.data.url)
    return { downloadable: false }
  return {
    downloadable: true,
    url: https(body.data.url),
    size: body.data.size,
  }
}

/** 打卡时告诉网易云的播放来源（SDK scrobble 的 source、sourceid，照它文档的“播放来源”） */
const checkInSourceOf = (source: PlaySource): { source: string, sourceid: number } => {
  switch (source.kind) {
    case 'playlist':
      return { source: 'list', sourceid: source.id }
    case 'album':
    case 'artist':
      return { source: source.kind, sourceid: source.id }
    // 每日推荐、一次搜索、已下载都没有稳定的编号：SDK 文档说传 0
    case 'daily':
      return { source: 'recommend', sourceid: 0 }
    case 'search':
      return { source: 'search', sourceid: 0 }
    case 'downloads':
      return { source: 'download', sourceid: 0 }
    default: {
      const unhandled: never = source
      throw new Error(`不认识的播放来源：${JSON.stringify(unhandled)}`)
    }
  }
}

/**
 * 听歌打卡。网易云回 200 不等于计入了听歌排行，计入有 10–30 分钟延迟
 * （验证关卡①；SDK 2.8.1 起改发 clientlog 才计入，nonhana/hana-music-api#31；#28、#29、#31（从搜索来的）真账号上确认计入）
 */
export const checkIn = async (songId: number, source: PlaySource, seconds: number, listener: Listener): Promise<WriteResponse> => {
  await call('scrobble', {
    id: songId,
    ...checkInSourceOf(source),
    time: seconds,
  }, listener)
  return { kind: 'done' }
}

/** 一首歌的歌词：逐字、逐行、翻译、音译（lyric_new；旧的 lyric 模块 SDK 没有收窄，不用） */
export const fetchLyrics = async (songId: number, listener: Listener): Promise<LyricsResponse> => {
  const { body } = await call('lyric_new', { id: songId }, listener)
  return lyricsOf(body)
}

/** 收藏的专辑、歌手一次要这么多（#23 实测网易云接受 1,000，作者的 55 张、236 位一次取完）；网易云说还有（hasMore）就接着要 */
const COLLECTED_PER_CALL = 1000

/** 一页一页要到底：page 取从第 offset 个起的一页 */
const everyPage = async <T>(page: (offset: number) => Promise<{ items: T[], hasMore: boolean }>): Promise<T[]> => {
  const items: T[] = []
  for (let offset = 0; ; offset += COLLECTED_PER_CALL) {
    const next = await page(offset)
    items.push(...next.items)
    if (!next.hasMore)
      return items
  }
}

/** 收藏的专辑，和网易云的顺序一样（最近收藏的在前） */
export const fetchCollectedAlbums = (listener: Listener): Promise<CollectedAlbum[]> => everyPage(async (offset) => {
  const { body } = await call('album_sublist', { limit: COLLECTED_PER_CALL, offset }, listener)
  return {
    items: body.data.map(album => ({
      id: album.id,
      name: album.name,
      coverUrl: album.picUrl,
      artists: album.artists.map(creditOf),
      songCount: album.size,
    })),
    hasMore: body.hasMore,
  }
})

/** 收藏的歌手，和网易云的顺序一样（最近收藏的在前） */
export const fetchCollectedArtists = (listener: Listener): Promise<CollectedArtist[]> => everyPage(async (offset) => {
  const { body } = await call('artist_sublist', { limit: COLLECTED_PER_CALL, offset }, listener)
  return {
    items: body.data.map(artist => ({ id: artist.id, name: artist.name, avatarUrl: artist.picUrl })),
    hasMore: body.hasMore,
  }
})

/** 专辑页：曲目和简介 */
export const fetchAlbum = async (albumId: number, listener: Listener): Promise<AlbumResponse> => {
  const { body: { album, songs } } = await call('album', { id: albumId }, listener)
  return {
    album: {
      id: album.id,
      name: album.name,
      coverUrl: album.picUrl,
      artist: creditOf(album.artist),
      publishedAt: album.publishTime,
      description: album.description,
      songCount: album.size,
    },
    songs: songs.map(songWithPrivilegeOf),
  }
}

/** 歌手的一页专辑（新的在前）：从第 offset 张起，每页 ARTIST_ALBUMS_PER_REQUEST 张 */
const artistAlbums = (artistId: number, offset: number, listener: Listener) => call('artist_album', { id: artistId, limit: ARTIST_ALBUMS_PER_REQUEST, offset }, listener)

const artistAlbumOf = (album: { id: number, name: string, picUrl: string, publishTime: number }): ArtistAlbum => ({
  id: album.id,
  name: album.name,
  coverUrl: album.picUrl,
  publishedAt: album.publishTime,
})

/** 歌手页：头部（在专辑那一页的返回里）、热门歌曲和第一页专辑，两个调用一起发 */
export const fetchArtist = async (artistId: number, listener: Listener): Promise<ArtistResponse> => {
  const [top, albums] = await Promise.all([
    call('artist_top_song', { id: artistId }, listener),
    artistAlbums(artistId, 0, listener),
  ])
  const { artist } = albums.body
  return {
    artist: {
      id: artist.id,
      name: artist.name,
      avatarUrl: artist.img1v1Url,
      songCount: artist.musicSize,
      albumCount: artist.albumSize,
    },
    hotSongs: top.body.songs.map(songWithPrivilegeOf),
    albums: albums.body.hotAlbums.map(artistAlbumOf),
    moreAlbums: albums.body.more,
  }
}

/** 歌手页后面的专辑 */
export const fetchArtistAlbums = async (artistId: number, offset: number, listener: Listener): Promise<ArtistAlbumsResponse> => {
  const { body } = await artistAlbums(artistId, offset, listener)
  return {
    albums: body.hotAlbums.map(artistAlbumOf),
    more: body.more,
  }
}

/**
 * 每日推荐。凭据失效时网易云照样回 200，给的是 30 首通用推荐（验证关卡①），这里认不出来：
 * 登录失效靠打开 App 时问账号、后台同步时的红心（回 301）发现
 */
export const fetchDaily = async (listener: Listener): Promise<DailyResponse> => {
  const { body } = await call('recommend_songs', {}, listener)
  return {
    songs: body.data.dailySongs.map(songWithPrivilegeOf),
  }
}

// 写操作（Spec #11“服务端：Campanula API”写操作一项，#30）。同一件事重复做（已经红心的再红心、已经收藏的再收藏），
// 网易云多半照样回 200（验证关卡②）；回的不是 200 但结果已经是听众要的样子的，也当成做好了

/** 红心或取消红心一首歌（like 一次只收一首）。重复做都回 200（验证关卡②） */
export const heart = async (songId: number, hearted: boolean, listener: Listener): Promise<WriteResponse> => {
  await call('like', { id: songId, like: hearted }, listener)
  return { kind: 'done' }
}

/** 网易云拒绝时的返回码：加歌时整批都已经在歌单里、歌单已经被删掉（验证关卡②） */
const TRACKS_DUPLICATE = 502
const PLAYLIST_MISSING = 404
/** 已经取消收藏的专辑再取消：网易云回 404“用户未收藏此专辑”（验证关卡②） */
const ALBUM_NOT_COLLECTED = 404

/** 网易云拒绝的那部分失败；别的失败是 null */
const rejection = (error: unknown): Extract<NeteaseFailure, { kind: 'rejected' }> | null => error instanceof NeteaseError && error.failure.kind === 'rejected'
  ? error.failure
  : null

/** 这张歌单在网易云里已经不在了（歌单不存在，404）：统一成 missing；别的失败是 null。写接口的 missing 只在这里判断（读路径的 404 仍由 fetchPlaylistPage 映射成 PlaylistUnavailable） */
const missing = (error: unknown): { kind: 'missing' } | null => rejection(error)?.code === PLAYLIST_MISSING
  ? { kind: 'missing' }
  : null

/**
 * 加入自建歌单：新加的排在最前，已经在歌单里的网易云跳过；整批都已经在歌单里时网易云回 502“歌单内歌曲重复”，也算加好了。
 * 歌单已经被删掉时网易云回 404“歌单不存在”（验证关卡②）
 */
export const addTracks = async (playlistId: number, songIds: readonly number[], listener: Listener): Promise<WriteResponse> => {
  try {
    await call('playlist_tracks', {
      op: 'add',
      pid: playlistId,
      tracks: songIds.join(','),
    }, listener)
  }
  catch (error) {
    const refused = rejection(error)
    // 只有“整批都已经在歌单里”这一种 502 算加好了；别的 502 是网易云拒绝，不能当成成功
    if (refused?.code === TRACKS_DUPLICATE && refused.message.includes('歌单内歌曲重复'))
      return { kind: 'done' }
    const gone = missing(error)
    if (gone)
      return gone
    throw error
  }
  return { kind: 'done' }
}

/**
 * 从自建歌单移除歌：不在歌单里的歌网易云也照样回 200（验证关卡②）。
 * 歌单已经被删掉时网易云回 404“歌单不存在”（验证关卡②）；别的失败原样交给调用方
 */
export const removeTracks = async (playlistId: number, songIds: readonly number[], listener: Listener): Promise<WriteResponse> => {
  try {
    await call('playlist_tracks', {
      op: 'del',
      pid: playlistId,
      tracks: songIds.join(','),
    }, listener)
  }
  catch (error) {
    const gone = missing(error)
    if (gone)
      return gone
    throw error
  }
  return { kind: 'done' }
}

/** 网易云整张歌单排序时回 -1“请求异常，请稍后重试”：几千首位置都变时其实已经生效（验证关卡②），要重读确认 */
const ORDER_UNCONFIRMED = -1

/**
 * 整张歌单的新顺序（自建歌单、我喜欢的音乐）：一次提交全部曲目编号，按歌单里的先后排列。
 * 歌单已经被删掉时网易云回 404“歌单不存在”。改动几千首位置时网易云约 3.3 秒后回 HTTP 400 / -1，但新顺序其实已经生效，
 * 所以认成 unconfirmed，由客户端重新读一次这张歌单、和提交的顺序比一比
 */
export const updateSongOrder = async (playlistId: number, songIds: readonly number[], listener: Listener): Promise<WriteResponse> => {
  try {
    await call('song_order_update', {
      pid: playlistId,
      ids: JSON.stringify(songIds),
    }, listener)
  }
  catch (error) {
    if (rejection(error)?.code === ORDER_UNCONFIRMED)
      return { kind: 'unconfirmed' }
    const gone = missing(error)
    if (gone)
      return gone
    throw error
  }
  return { kind: 'done' }
}

/**
 * 曲库里能排序的歌单的新顺序（#37）：一次提交我喜欢的音乐和全部自建歌单的编号，我喜欢的音乐在最前。
 * 已经删掉的歌单网易云会忽略、照样回 200（验证关卡②录到了这种返回），所以没有 missing；
 * 别的失败原样交给调用方，客户端退回原来的顺序
 */
export const updatePlaylistOrder = async (playlistIds: readonly number[], listener: Listener): Promise<WriteResponse> => {
  await call('playlist_order_update', {
    ids: JSON.stringify(playlistIds),
  }, listener)
  return { kind: 'done' }
}

export const collectAlbum = async (albumId: number, collected: boolean, listener: Listener): Promise<WriteResponse> => {
  await call('album_sub', {
    id: albumId,
    t: collected ? 1 : 0,
  }, listener).catch((error: unknown) => {
    if (collected || rejection(error)?.code !== ALBUM_NOT_COLLECTED)
      throw error
  })
  return { kind: 'done' }
}

export const collectArtist = async (artistId: number, collected: boolean, listener: Listener): Promise<WriteResponse> => {
  await call('artist_sub', {
    id: artistId,
    t: collected ? 1 : 0,
  }, listener)
  return { kind: 'done' }
}

/**
 * 收藏歌单带上浏览器现取的反作弊令牌（官方网页版的写法，SDK 2.12.0），取消收藏不带（#30 留言）。
 * 歌单已经被删掉：照加歌、歌单详情的样子当成网易云回 404“歌单不存在”（收藏时的这种返回还没录到过）
 */
export const collectPlaylist = async (playlistId: number, change: PlaylistCollectRequest, listener: Listener): Promise<WriteResponse> => {
  try {
    await call('playlist_subscribe', {
      id: playlistId,
      t: change.collected ? 1 : 0,
    }, listener, change.collected
      ? { checkToken: change.checkToken }
      : {})
  }
  catch (error) {
    const gone = missing(error)
    if (gone)
      return gone
    throw error
  }
  return { kind: 'done' }
}

// 搜索（Spec #11“服务端：Campanula API”搜索一项，#31）

/** 比较歌名是否看起来一样时用的写法：全角半角归一（NFKC），波浪线的几种写法（～〜∼~）当成一个 */
const lookalike = (name: string): string => name.normalize('NFKC').replace(/[\u301C\u223C]/g, '~')

/**
 * 边输入边给的建议（网页版的建议）：网易云给了哪类就列哪类，不另外补，也不跨类别去重。网易云说的先后（order）SDK 没声明，
 * 这里固定成单曲、歌手、专辑、歌单（#31 录到的几次网易云都是这个顺序）。
 * 点单曲是搜这首的名字：名字看起来一样的几首（例如一个用 ～、一个用 〜）只留第一首
 */
export const fetchSuggestions = async (keywords: string, listener: Listener): Promise<SuggestionsResponse> => {
  const { body } = await call('search_suggest', { keywords }, listener)
  const { songs = [], artists = [], albums = [], playlists = [] } = body.result
  const looks = songs.map(song => lookalike(song.name))
  return {
    suggestions: [
      ...songs.filter((_, index) => looks.indexOf(looks[index]) === index).map(song => ({ kind: 'song' as const, name: song.name })),
      ...artists.map(artist => ({ kind: 'artist' as const, id: artist.id, name: artist.name })),
      ...albums.map(album => ({ kind: 'album' as const, id: album.id, name: album.name })),
      ...playlists.map(playlist => ({ kind: 'playlist' as const, id: playlist.id, name: playlist.name })),
    ],
  }
}

/** 每类结果是网易云 cloudsearch 的哪个 type */
const CLOUDSEARCH_TYPES: Record<SearchKind, number> = {
  songs: 1,
  playlists: 1000,
  artists: 100,
  albums: 10,
}

/** 这类结果从网易云的第 offset 个起的一页。一个都没搜到时网易云不给列表，只给总数 0（#32 录制） */
const cloudsearch = async (kind: SearchKind, keywords: string, offset: number, listener: Listener) => {
  const { body } = await call('cloudsearch', {
    keywords,
    type: CLOUDSEARCH_TYPES[kind],
    limit: SEARCH_RESULTS_PER_REQUEST,
    offset,
  }, listener)
  return body.result
}

/** 四类搜索结果的一页，只留界面用得到的字段 */
export const searches: { [K in SearchKind]: (keywords: string, offset: number, listener: Listener) => Promise<SearchPageResponse<K>> } = {
  async songs(keywords, offset, listener) {
    const { songs = [], songCount = 0 } = await cloudsearch('songs', keywords, offset, listener)
    return {
      items: songs.map(songWithPrivilegeOf),
      total: songCount,
    }
  },
  async playlists(keywords, offset, listener) {
    const { playlists = [], playlistCount = 0 } = await cloudsearch('playlists', keywords, offset, listener)
    return {
      items: playlists.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        coverUrl: playlist.coverImgUrl,
        creator: playlist.creator.nickname,
        trackCount: playlist.trackCount,
        playCount: playlist.playCount,
      })),
      total: playlistCount,
    }
  },
  async artists(keywords, offset, listener) {
    const { artists = [], artistCount = 0 } = await cloudsearch('artists', keywords, offset, listener)
    return {
      items: artists.map(artist => ({
        id: artist.id,
        name: artist.name,
        avatarUrl: artist.picUrl,
        songCount: artist.musicSize,
      })),
      total: artistCount,
    }
  },
  async albums(keywords, offset, listener) {
    const { albums = [], albumCount = 0 } = await cloudsearch('albums', keywords, offset, listener)
    return {
      items: albums.map(album => ({
        id: album.id,
        name: album.name,
        coverUrl: album.picUrl,
        artists: album.artists.map(creditOf),
        publishedAt: album.publishTime,
      })),
      total: albumCount,
    }
  },
}
