import type { Account } from '$lib/api/account'
import type { NeteaseFailure } from '$lib/api/errors'
import type { Playlist, Song } from '$lib/api/library'
import type { QrResponse } from '$lib/api/login'
import type { ModuleCallConfig, ModuleIdentifier, ModuleResponseOf } from 'hana-music-api'
import { env } from '$env/dynamic/private'
import { invokeModule } from 'hana-music-api'

// 网易云适配层（Spec #11“服务端：网易云适配层”）：服务端里只有这里调 hana-music-api。
// 每次调用都带上听众的凭据和 deviceId，站长配了真实国内 IP 就作为 realIP 传入；
// 网易云的结果翻译成 Campanula 的错误约定（$lib/api/errors），返回体映射成界面要用的数据。

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * SDK 失败时抛出 { status, body, cookie }（照 SDK 2.3.0 的 normalizeFailure、classifyConsumedRateLimit；npm 包的 README 只写了 429）：
 * - 网易云的业务拒绝：body 是网易云原样的返回，status 取返回码（不在 101~599 时是 400）；
 * - 返回结构不认识：status 502，body.upstreamShape 写明哪里不对；
 * - 网易云限流（HTTP 429、返回码 429，或 405 带“操作频繁”“操作过于频繁”）：status 是 429 或 405，
 *   body 是网易云原样的返回加上 retryAfter（秒，网易云没给 Retry-After 时是 30）。只有这种失败带 retryAfter；
 * - SDK 自己生成的失败（超时 504、连不上或读不懂返回 502、匿名注册失败 502）：body 只有 code 和 msg。
 */
function translate(thrown: unknown): { failure: NeteaseFailure, body: unknown } {
  if (!isRecord(thrown) || typeof thrown.status !== 'number' || !('body' in thrown))
    throw thrown // 不是 SDK 的失败返回，是 Campanula 自己的缺陷
  const { status, body } = thrown
  const fields = isRecord(body) ? body : {}
  const code = typeof fields.code === 'number' ? fields.code : status
  if (code === 301)
    return { failure: { kind: 'needsLogin' }, body }
  if (typeof fields.retryAfter === 'number')
    return { failure: { kind: 'rateLimited', retryAfter: fields.retryAfter }, body }
  if (isRecord(fields.upstreamShape))
    return { failure: { kind: 'upstreamChanged' }, body }
  if (status >= 500 && Object.keys(fields).every(key => key === 'code' || key === 'msg'))
    return { failure: { kind: 'neteaseUnavailable' }, body }
  const message = typeof fields.message === 'string' ? fields.message : typeof fields.msg === 'string' ? fields.msg : ''
  return { failure: { kind: 'rejected', code, message }, body }
}

/** 日志里只写模块和失败的种类、网易云的返回码和说明，不写请求参数和 Cookie（手机号、验证码、凭据都在里面） */
function describe(failure: NeteaseFailure): string {
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

async function call<K extends ModuleIdentifier>(module: K, query: QueryOf<K>, listener: Listener): Promise<ModuleResponseOf<K>> {
  // state 里的 deviceId 用在每次请求的 Cookie 头里。顶层的 deviceId 不在 SDK 的类型里，是给隐式匿名注册用的：
  // 没登录的调用由 SDK 先匿名注册，拿到的匿名身份 SDK 自己存在进程里，同一个实例里之后的匿名调用都共用它，
  // 所以只有实例里第一次匿名注册用到这个 deviceId（SDK 2.2.0 ensureAnonymousEffect）。Campanula 自己不存任何状态
  const config: ModuleCallConfig & { deviceId: string } = {
    cookie: listener.credentials ?? undefined,
    deviceId: listener.deviceId,
    state: { deviceId: listener.deviceId },
    realIP: env.NETEASE_REAL_IP || undefined,
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
function credentialsFrom(module: ModuleIdentifier, setCookies: readonly string[], base: Record<string, string> = {}): Record<string, string> {
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
  if (!credentials.MUSIC_U || credentials.MUSIC_U === base.MUSIC_U) {
    const failure = { kind: 'upstreamChanged' } as const
    console.warn(`网易云 ${module} 失败：${describe(failure)}（没有下发新的 MUSIC_U）`)
    throw new NeteaseError(failure, null)
  }
  return credentials
}

/** 一张新的登录二维码 */
export async function createLoginQr(listener: Listener): Promise<QrResponse> {
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
function verificationOf(body: unknown): { vid: string, type: string, token: string, evid: string, sign: string } | null {
  const data = isRecord(body) && isRecord(body.data) ? body.data : null
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
  return { vid: String(verifyId), type: String(verifyType), token: verifyToken, evid: params.event_id, sign: params.sign }
}

export async function checkLoginQr(key: string, listener: Listener): Promise<QrCheck> {
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
      return { status: 'confirmed', credentials: credentialsFrom('login_qr_check', cookie) }
    default: {
      const unhandled: never = body
      throw new Error(`不认识的扫码状态：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 发短信验证码（只支持 +86） */
export async function sendCaptcha(phone: string, listener: Listener): Promise<void> {
  await call('captcha_sent', { phone, ctcode: '86' }, listener)
}

/** 短信验证码登录：拿到凭据，以及登录的账号 */
export async function loginWithCaptcha(phone: string, captcha: string, listener: Listener): Promise<{ credentials: Record<string, string>, account: Account }> {
  const { body, cookie } = await call('login_cellphone', { phone, captcha, countrycode: '86' }, listener)
  return {
    credentials: credentialsFrom('login_cellphone', cookie),
    account: { id: body.profile.userId, nickname: body.profile.nickname, avatarUrl: body.profile.avatarUrl },
  }
}

/** 当前登录的账号。凭据已经失效时网易云照样回 200，但只剩匿名身份、没有个人资料：当作需要登录 */
export async function fetchAccount(listener: Listener): Promise<Account> {
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
export async function renewLogin(listener: SignedInListener): Promise<Record<string, string>> {
  const { cookie } = await call('login_refresh', {}, listener)
  return credentialsFrom('login_refresh', cookie, listener.credentials)
}

/** 退出登录：网易云只注销同一个 deviceId 上的登录，听众在其他设备上的登录不受影响（验证关卡①） */
export async function logout(listener: Listener): Promise<void> {
  await call('logout', {}, listener)
}

// 曲库（Spec #11“服务端：Campanula API”曲库一项）。uid 是界面问到的当前账号，凭据才决定网易云把谁当作听众

/** 红心了哪些歌（likelist）。凭据失效时网易云回 301（#21 实测），曲库同步靠它先认出登录失效 */
export async function fetchHearts(uid: number, listener: Listener): Promise<number[]> {
  const { body } = await call('likelist', { uid }, listener)
  return [...body.ids]
}

/** user_playlist 一次最多要这么多张；网易云说还有（more）就接着要 */
const PLAYLISTS_PER_CALL = 1000
/** 我喜欢的音乐在 user_playlist 里的 specialType */
const LIKED_SPECIAL_TYPE = 5

/** 歌单列表：我喜欢的音乐、自建的、收藏的，顺序和网易云给的一样 */
export async function fetchPlaylists(uid: number, listener: Listener): Promise<Playlist[]> {
  const playlists: Playlist[] = []
  for (let offset = 0; ; offset += PLAYLISTS_PER_CALL) {
    const { body } = await call('user_playlist', { uid, limit: PLAYLISTS_PER_CALL, offset }, listener)
    for (const playlist of body.playlist) {
      playlists.push({
        id: playlist.id,
        name: playlist.name,
        coverUrl: playlist.coverImgUrl,
        kind: playlist.specialType === LIKED_SPECIAL_TYPE ? 'liked' : playlist.creator.userId === uid ? 'own' : 'collected',
        trackCount: playlist.trackCount,
        tracksUpdatedAt: playlist.trackUpdateTime,
      })
    }
    if (!body.more)
      return playlists
  }
}

/** 一张歌单的全部曲目编号（SDK 的 playlist_detail 一次要 10 万首）。我喜欢的音乐约 5,000 首时网易云原始返回约 3.1 MB，这里只留编号 */
export async function fetchTrackIds(playlistId: number, listener: Listener): Promise<number[]> {
  const { body } = await call('playlist_detail', { id: playlistId }, listener)
  return body.playlist.trackIds.map(track => track.id)
}

/** 歌曲信息，按 ids 的顺序；网易云没给的不在里面 */
export async function fetchSongs(ids: readonly number[], listener: Listener): Promise<Song[]> {
  const { body } = await call('song_detail', { ids: ids.join(',') }, listener)
  const byId = new Map(body.songs.map(song => [song.id, song]))
  return ids.flatMap((id) => {
    const song = byId.get(id)
    return song
      ? [{
          id: song.id,
          name: song.name,
          artists: song.ar.map(artist => ({ id: artist.id, name: artist.name })),
          album: { id: song.al.id, name: song.al.name, coverUrl: song.al.picUrl },
          duration: song.dt,
        }]
      : []
  })
}
