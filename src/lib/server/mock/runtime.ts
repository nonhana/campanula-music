// 开发环境的网易云替身：Vite 只在 CAMPANULA_MOCK=1 的 dev 服务器里把 hana-music-api 换到这里。
// 读按模块 + 查询从录制和状态化 store 里取，写改 store；没覆盖的明确报错并记进覆盖报告。
import type { ModuleCallConfig } from 'hana-music-api'
import type { MockConfig, ScenarioName } from './scenarios.ts'
import type { SeedName } from './seed.ts'
import type { MockResult } from './store.ts'
import { readFile } from 'node:fs/promises'
import { AUDIO_PREFIX, clearUploads, localize, UPLOAD_PATH, UPLOAD_PREFIX } from './assets.ts'
import { fixtureOutcome } from './fixture-format.ts'
import { queryKey } from './query-key.ts'
import { readFixture } from './read-fixture.ts'
import { configOf, isScenarioName } from './scenarios.ts'
import { POEMS_PLAYLIST } from './seed.ts'
import { MockStore } from './store.ts'

/** 这份代码只能出现在 dev 产物里；构建检查靠这个标记确认它没进生产包 */
export const MOCK_RUNTIME_MARKER = '__CAMPANULA_MOCK_RUNTIME__'

const INDEX_FILE = new URL('../../../../tests/fixtures/netease/index.json', import.meta.url)
const SESSION_MODULES = new Set(['user_account', 'user_detail', 'vip_info', 'vip_info_v2', 'login_refresh', 'login_cellphone', 'login_qr_key', 'login_qr_create', 'login_qr_check', 'captcha_sent', 'logout', 'login_status'])
const DEVICE_ID = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const CREDENTIALS = { MUSIC_U: 'mock-music-u', __csrf: 'mock-csrf' }
function cookieFor(musicU = 'mock-music-u'): string[] {
  return [`MUSIC_U=${musicU}; Path=/; Max-Age=15552000`, '__csrf=mock-csrf; Path=/']
}

/** 照 SDK 抛出 { status, body } 的样子：服务端的 translate() 靠这两个属性认网易云的失败 */
class SdkFailure extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`Mock SDK 失败 ${status}`)
  }
}

interface IndexEntry {
  path: string
  module: string
  queryKey: string
  query: unknown
  outcome: string
  validated: boolean
}

/** 同一个模块 + 查询可能录了失败和成功两份：优先成功，其次失败；没有校验过的录制不拿来回答 */
function choose(entries: IndexEntry[]): IndexEntry | null {
  return entries.find(entry => entry.validated && entry.outcome === 'ok')
    ?? entries.find(entry => entry.validated)
    ?? null
}

interface Index {
  recordings: number
  modules: Record<string, { count: number }>
  entries: IndexEntry[]
}

let indexPromise: Promise<Index> | null = null
const fixtureCache = new Map<string, Promise<{ rejected: boolean, status: number, body: unknown }>>()
interface RuntimeState {
  config: MockConfig
  store: MockStore
  calls: { module: string, query: unknown }[]
  misses: { module: string, query: unknown, scenario: string }[]
  songDetailCalls: number
  lastCoverImgId: string
}

// Vite 的中间件和 SDK 替身可能是两份模块实例：状态放在 globalThis 上，自动登录/场景/重置和曲库看到的是同一份
const STATE_KEY = '__CAMPANULA_MOCK_STATE__'
const state: RuntimeState = ((globalThis as Record<string, unknown>)[STATE_KEY] ??= {
  config: configOf('default'),
  store: new MockStore('before'),
  calls: [],
  misses: [],
  songDetailCalls: 0,
  lastCoverImgId: 'mock-cover',
}) as RuntimeState

async function index(): Promise<Index> {
  indexPromise ??= readFile(INDEX_FILE, 'utf8').then(text => JSON.parse(text) as Index)
  return indexPromise
}

async function fixture(entry: IndexEntry): Promise<{ rejected: boolean, status: number, body: unknown }> {
  let loaded = fixtureCache.get(entry.path)
  if (!loaded) {
    loaded = readFixture(entry.path).then((raw) => {
      const { rejected, response } = fixtureOutcome(raw.module, raw.response)
      return { rejected, status: response.status, body: response.body }
    })
    fixtureCache.set(entry.path, loaded)
  }
  return loaded
}

function miss(module: string, query: unknown): never {
  state.misses.push({ module, query, scenario: state.config.name })
  console.error(`Mock 未覆盖：模块 ${module}，查询 ${JSON.stringify(query)}，场景 ${state.config.name}。看 GET /api/mock/coverage 补录制`)
  throw new SdkFailure(500, { code: 500, msg: `Mock 未覆盖：${module}` })
}

async function entryFor(module: string, query: unknown): Promise<IndexEntry | null> {
  const current = await index()
  const key = queryKey(query)
  const candidates = current.entries.filter(entry => entry.module === module && entry.queryKey === key)
  if (candidates.length > 0)
    return choose(candidates)
  // cloudsearch 的页面大小按票不一样（录到 100 的、5 的），服务端一律要 30：按关键词/类型/offset 找一页够大的
  if (module === 'cloudsearch') {
    const wanted = query as { keywords?: unknown, type?: unknown, offset?: unknown, limit?: unknown }
    const pick = current.entries
      .filter(entry => entry.module === module && entry.validated)
      .map(entry => ({ entry, query: entry.query as { keywords?: unknown, type?: unknown, offset?: unknown, limit?: unknown } }))
      .filter(({ query: item }) => item.keywords === wanted.keywords && item.type === wanted.type && Number(item.offset ?? 0) === Number(wanted.offset ?? 0) && Number(item.limit ?? 0) >= Number(wanted.limit ?? 0))
      .sort((a, b) => Number(a.query.limit) - Number(b.query.limit))
    if (pick[0])
      return pick[0].entry
  }
  // 边输入边给建议：录制了“夜に”就够回答“夜”，录了“夜に駆ける”就够回答“夜に駆”
  if (module === 'search_suggest') {
    const keywords = typeof query === 'object' && query !== null ? String((query as Record<string, unknown>).keywords ?? '') : ''
    const suggestions = current.entries
      .filter(entry => entry.module === module && entry.validated)
      .map(entry => ({ entry, words: String((entry.query as { keywords?: unknown }).keywords ?? '') }))
      .filter(({ words }) => words.startsWith(keywords))
      .sort((a, b) => a.words.length - b.words.length)
    if (suggestions[0])
      return suggestions[0].entry
  }
  return null
}

async function fallback(module: string, query: unknown, { generic = false } = {}): Promise<unknown> {
  const entry = await entryFor(module, query) ?? (generic ? choose((await index()).entries.filter(item => item.module === module)) : null)
  if (!entry)
    return miss(module, query)
  const loaded = await fixture(entry)
  if (loaded.rejected)
    throw new SdkFailure(loaded.status, loaded.body)
  return localize(loaded.body)
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

/** 写操作的结果：成功就本地化返回，失败照 SDK 的样子抛出去 */
function write(result: MockResult): { status: number, body: unknown, cookie: string[] } {
  if (!result.ok)
    throw new SdkFailure(result.status, result.body)
  return { status: 200, body: localize(result.body), cookie: [] }
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value)
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function idsOf(value: unknown): number[] {
  if (Array.isArray(value))
    return value.map(num)
  return str(value).split(',').filter(Boolean).map(Number)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function configure(input: ScenarioName | (Partial<MockConfig> & { name?: ScenarioName }) = 'default'): Promise<void> {
  const name = typeof input === 'string' ? input : input.name ?? 'default'
  if (!isScenarioName(name))
    throw new Error(`不认识的 mock 场景：${String(name)}`)
  const base = configOf(name)
  state.config = { ...base, ...(typeof input === 'string' ? {} : input) }
  state.calls = []
  state.misses = []
  state.songDetailCalls = 0
  clearUploads()
  await state.store.reset(state.config.seed)
  if (state.config.deletedPlaylist)
    await state.store.deletePlaylist(POEMS_PLAYLIST)
  if (state.config.emptyPlaylist)
    await state.store.clearPlaylist(POEMS_PLAYLIST)
}

export async function reset(): Promise<void> {
  await configure('default')
}

export function loginCredentials(): { deviceId: string, credentials: Record<string, string> } {
  return { deviceId: DEVICE_ID, credentials: { ...CREDENTIALS } }
}

export function status(): { enabled: true, scenario: ScenarioName, seed: SeedName, offline: boolean } {
  return { enabled: true, scenario: state.config.name, seed: state.config.seed, offline: state.config.offline }
}

export async function coverage(): Promise<Record<string, unknown>> {
  const current = await index()
  const used = [...new Set(state.calls.map(call => call.module))].sort()
  return {
    scenario: state.config.name,
    seed: state.config.seed,
    calls: state.calls.length,
    usedModules: used,
    misses: state.misses,
    index: { recordings: current.recordings, modules: Object.keys(current.modules).sort() },
  }
}

function hasCredentials(callConfig: ModuleCallConfig): boolean {
  const cookie = callConfig.cookie
  return typeof cookie === 'object' && cookie !== null ? Boolean(cookie.MUSIC_U) : Boolean(cookie)
}

export async function invokeModule(module: string, query: Record<string, unknown> = {}, callConfig: ModuleCallConfig = {}): Promise<{ status: number, body: unknown, cookie: string[] }> {
  state.calls.push({ module, query })
  if (state.config.latencyMs > 0)
    await sleep(state.config.latencyMs)
  if (state.config.offline)
    throw new SdkFailure(503, { code: 503, msg: 'Mock 断网' })
  if (state.config.rateLimited && !SESSION_MODULES.has(module))
    throw new SdkFailure(405, { code: 405, msg: '操作过于频繁，请稍后再试', retryAfter: 30 })

  const data = await state.store.load()
  const templates = data.templates as Record<string, unknown>

  switch (module) {
    case 'user_account':
      return { status: 200, body: localize(state.config.loginExpired ? templates.accountInvalid : hasCredentials(callConfig) ? templates.account : templates.accountAnonymous), cookie: [] }
    case 'login_cellphone':
      if (state.config.loginExpired)
        throw new SdkFailure(301, { code: 301, msg: '需要登录' })
      return { status: 200, body: localize(templates.loginCellphone), cookie: cookieFor() }
    case 'login_qr_check':
      if (state.config.loginExpired)
        throw new SdkFailure(301, { code: 301, msg: '需要登录' })
      return { status: 200, body: localize(templates.qrSuccess), cookie: cookieFor() }
    case 'login_qr_key':
    case 'login_qr_create':
    case 'captcha_sent':
    case 'login_status':
    case 'verify_getQr':
      return { status: 200, body: localize(await fallback(module, query, { generic: true })), cookie: [] }
    case 'login_refresh':
      if (state.config.loginExpired || !hasCredentials(callConfig))
        throw new SdkFailure(301, { code: 301, msg: '需要登录' })
      return { status: 200, body: localize(templates.loginRefresh), cookie: cookieFor(`mock-music-u-${Date.now()}`) }
    case 'logout':
      return { status: 200, body: localize(await fallback(module, query, { generic: true })), cookie: [] }
    case 'likelist':
      if (state.config.loginExpired)
        throw new SdkFailure(301, { code: 301, msg: '需要登录' })
      return { status: 200, body: localize(await state.store.likelist()), cookie: [] }
    case 'user_playlist': {
      const body = await state.store.userPlaylist(num(query.offset ?? 0), num(query.limit ?? 1000))
      if (state.config.loginExpired) {
        const list = (body.playlist as Record<string, unknown>[]).map(item => ({ ...item, subscribed: null }))
        return { status: 200, body: localize({ ...body, playlist: list }), cookie: [] }
      }
      return { status: 200, body: localize(body), cookie: [] }
    }
    case 'playlist_detail': {
      const detail = await state.store.playlistDetail(num(query.id))
      return { status: 200, body: localize(detail ?? await fallback(module, query)), cookie: [] }
    }
    case 'song_detail': {
      state.songDetailCalls += 1
      if (state.config.partialSync && state.songDetailCalls >= 2) {
        const failed = await fixture((await index()).entries.find(entry => entry.path === 'library/song_detail.liked-page4.502-null-artist.json.gz')!)
        throw new SdkFailure(failed.status, failed.body)
      }
      const body = await state.store.songDetail(idsOf(query.ids))
      return { status: 200, body: localize(body ?? await fallback(module, query)), cookie: [] }
    }
    case 'album_sublist':
      return { status: 200, body: localize(await state.store.albumSublist(num(query.offset ?? 0), num(query.limit ?? 1000))), cookie: [] }
    case 'artist_sublist':
      return { status: 200, body: localize(await state.store.artistSublist(num(query.offset ?? 0), num(query.limit ?? 1000))), cookie: [] }
    case 'song_url_v1': {
      const id = num(query.id)
      const part = await state.store.songPart(id)
      if (!part)
        return { status: 200, body: localize(await fallback(module, query)), cookie: [] }
      if (part.privilege.st < 0)
        return { status: 200, body: localize(clone(templates.songUrlNoCopyright)), cookie: [] }
      const body = clone(templates.songUrl) as { data: Record<string, unknown>[] }
      Object.assign(body.data[0]!, {
        id,
        url: `${AUDIO_PREFIX}/${id}.wav`,
        size: 32000,
        time: 2000,
        br: 128000,
        md5: `mock-${id}`,
        code: 200,
        fee: 0,
        payed: 0,
        level: 'exhigh',
        type: 'mp3',
        freeTrialInfo: null,
        expi: 1200,
        urlSource: 0,
      })
      return { status: 200, body: localize(body), cookie: [] }
    }
    case 'image_upload_token': {
      const imgId = String(Date.now() + state.calls.length)
      state.lastCoverImgId = imgId
      const body = clone(templates.imageUploadToken) as { data: Record<string, unknown> }
      Object.assign(body.data, { imgId, token: 'mock-upload-token', uploadUrl: `${UPLOAD_PATH}/${imgId}`, url_pre: `${UPLOAD_PREFIX}/${imgId}` })
      return { status: 200, body: localize(body), cookie: [] }
    }
    case 'playlist_cover_update': {
      const imgId = str(query.imgId ?? state.lastCoverImgId)
      return write(await state.store.setCover(num(query.id), `${UPLOAD_PREFIX}/${imgId}`))
    }
    case 'playlist_create': {
      return write(await state.store.createPlaylist(str(query.name), num(query.privacy)))
    }
    case 'playlist_delete': {
      return write(await state.store.deletePlaylist(num(query.id)))
    }
    case 'playlist_name_update': {
      return write(await state.store.renamePlaylist(num(query.id), str(query.name)))
    }
    case 'playlist_desc_update': {
      return write(await state.store.describePlaylist(num(query.id), str(query.desc)))
    }
    case 'playlist_tags_update': {
      return write(await state.store.tagPlaylist(num(query.id), str(query.tags).split(';').filter(Boolean)))
    }
    case 'playlist_privacy': {
      return write(await state.store.publishPlaylist(num(query.id)))
    }
    case 'playlist_order_update': {
      return write(await state.store.orderPlaylists(JSON.parse(str(query.ids)) as number[]))
    }
    case 'playlist_tracks':
      return write(await (str(query.op) === 'add'
        ? state.store.addTracks(num(query.pid), idsOf(query.tracks))
        : state.store.removeTracks(num(query.pid), idsOf(query.tracks))))
    case 'song_order_update': {
      return write(await state.store.orderTracks(num(query.pid), JSON.parse(str(query.ids)) as number[]))
    }
    case 'like': {
      return write(await state.store.heart(num(query.id), Boolean(query.like)))
    }
    case 'album_sub': {
      return write(await state.store.collectAlbum(num(query.id), num(query.t) === 1))
    }
    case 'artist_sub': {
      return write(await state.store.collectArtist(num(query.id), num(query.t) === 1))
    }
    case 'playlist_subscribe': {
      const id = num(query.id)
      const collected = num(query.t) === 1
      if (collected && !(await state.store.playlistDetail(id))) {
        const body = await fallback('playlist_detail', { id }) as Parameters<typeof state.store.adoptPlaylist>[0]
        await state.store.adoptPlaylist(body)
      }
      return write(await state.store.subscribePlaylist(id, collected))
    }
    case 'scrobble':
      return { status: 200, body: localize(templates.scrobble), cookie: [] }
    case 'recommend_songs':
      return { status: 200, body: localize(templates.recommendSongs), cookie: [] }
    case 'playlist_catlist':
      return { status: 200, body: localize(templates.playlistCatlist), cookie: [] }
    case 'user_detail':
    case 'vip_info':
    case 'vip_info_v2':
    case 'user_record':
    case 'playlist_track_all':
    case 'album':
    case 'artist_album':
    case 'artist_top_song':
    case 'artist_detail':
    case 'lyric_new':
    case 'cloudsearch':
      return { status: 200, body: await fallback(module, query), cookie: [] }
    case 'search_suggest':
      return { status: 200, body: await fallback(module, query), cookie: [] }
    default:
      return miss(module, query)
  }
}
