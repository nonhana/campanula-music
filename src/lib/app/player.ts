import type { Song } from '$lib/api/library'
import type { PlayUrlResponse, Quality } from '$lib/api/playback'
import type { Api, RequestFailure } from './api'
import type { AudioCapability, Clock } from './browser'
import type { PlaylistSongs } from './library'

// 播放队列与播放（Spec #11“客户端：播放队列与播放”）。
// 两个播放器轮流放（ADR-0010）：换歌时在空闲的那个上放，它出声了再停旧的，换歌的过程中一直有一个在放。
// 当前这首出声后，空闲的那个先取好下一首的播放地址、缓冲着；当前这首快放完时它开始放（交接）。
// 播放地址约 20 分钟过期：暂停很久后再放、或者放着放着过期了，重新取地址，从原来的位置接着放。
// 播放队列一变（下一首播放、插播、移出、换播放模式、补上没同步完的歌）就重新准备空闲的播放器。
// 下一首播放、加入播放队列、插播的边角照逻辑原型定下的规则①–⑤（docs/prototype/logic.md）。

/** 在线播放音质：设置页（#27）之前都用极高 */
const QUALITY: Quality = 'exhigh'
/** 当前这首剩这么多秒时，空闲的播放器开始放下一首（探针在真机上验证过 1 秒，ADR-0010） */
const HANDOVER_LEAD = 1
/** 下一首还没缓冲好时更早开始交接，给它留出加载的时间 */
const UNBUFFERED_HANDOVER_LEAD = 5
/** 播放地址提前这么久当作过期：快过期的地址放到一半就取不到后面的数据了 */
const URL_EXPIRY_MARGIN_MS = 60_000
/** 缓冲这么久还没出声，提示网络慢 */
const SLOW_BUFFERING_MS = 8_000
/** 下一首没准备好（没取到地址、没加载出来、地址过期了）时，当前这首剩这么多秒再准备一次，免得放完才去取、中间断掉 */
const PREPARE_AGAIN_LEAD = 20
/** 再准备之间至少隔这么久 */
const PREPARE_AGAIN_INTERVAL_MS = 5_000

/** 播放来源（GLOSSARY）：这首歌是从哪个列表放进播放队列的。我喜欢的音乐也是一张歌单；artist 是歌手的热门歌曲 */
export interface PlaySource {
  kind: 'playlist' | 'album' | 'artist'
  /** 歌单、专辑、歌手的编号 */
  id: number
}

/** 播放队列里的一首：每首各自记着播放来源 */
export interface QueueEntry {
  song: Song
  source: PlaySource
}

/**
 * - loading：在取当前这首的播放地址，一定有一个取地址的请求在路上
 * - buffering：地址有了，在等音频服务器的数据
 * - playing：在出声
 * - paused：停着（听众暂停了、出了问题停下了、播放队列是空的）
 */
export type PlaybackStatus = 'loading' | 'buffering' | 'playing' | 'paused'

/** 要告诉听众的事 */
export type PlayerNotice
  /** 没取到播放地址，停下了：按播放重试 */
  = | { kind: 'urlFailed', failure: Exclude<RequestFailure, { kind: 'needsLogin' }> }
  /** 音频没加载下来（放到一半断流、一开始就没加载出来），停下了：按播放从原来的位置接着放 */
    | { kind: 'streamFailed' }
  /** 缓冲很久了还没出声：还在等，接上了就接着放 */
    | { kind: 'slow' }
  /** 网易云没给这首的播放地址，跳过了 */
    | { kind: 'skipped', song: Song }
  /** 播放队列里没有能放的歌 */
    | { kind: 'nothingPlayable' }

/**
 * 当前这首是因为什么换上来的。界面换碟看它往哪转（DESIGN.md Cover Wheel），不靠前后序号猜：随机播放时序号不连续。
 * - next / previous：听众按了下一首、上一首
 * - pick：在列表里点歌、在播放队列里点歌
 * - continue：当前这首放完，自动接着放下一首（包括快放完时两个播放器交接，ADR-0010）
 * - skip：网易云没给要放的那首的播放地址，跳到它后面能放的
 */
export type SongChange = 'next' | 'previous' | 'pick' | 'continue' | 'skip'

/**
 * 播放模式：列表循环（loop）、单曲循环（one，放完从头再放这首；按下一首、上一首照样换歌）、
 * 随机播放（shuffle，按另排的一份播放顺序放，播放队列的先后不变）
 */
export type PlayMode = 'loop' | 'one' | 'shuffle'

export interface PlayerState {
  queue: readonly QueueEntry[]
  /** 当前这首在播放队列里的位置；播放队列是空的时是 null */
  current: number | null
  status: PlaybackStatus
  /** 当前这首放到第几秒 */
  position: number
  /** 当前这首多长（秒）；还不知道时是 null */
  duration: number | null
  /** 当前这首只放试听片段 */
  trial: boolean
  /** 音量，0 到 1 */
  volume: number
  notice: PlayerNotice | null
  /** 当前这首是因为什么换上来的；还没换过歌（播放队列是空的）时是 null */
  change: SongChange | null
  mode: PlayMode
  /**
   * 按上一首、下一首会换到播放队列里的第几首（随机播放时按另排的顺序，跳过放不了的）。手机播放页拖封面时，转盘上露出来的就是这两首。
   * 没有别的能放的歌（播放队列是空的、只有当前这首能放）时是 null：这时按下一首只会从头再放这首
   */
  neighbors: { previous: number | null, next: number | null }
}

const NO_NEIGHBORS: PlayerState['neighbors'] = { previous: null, next: null }

export const INITIAL_PLAYER: PlayerState = { queue: [], current: null, status: 'paused', position: 0, duration: null, trial: false, volume: 1, notice: null, change: null, mode: 'loop', neighbors: NO_NEIGHBORS }

export interface PlayerContext {
  api: Api
  clock: Clock
  audio: () => AudioCapability
  write: (player: PlayerState) => void
  /** 取播放地址时网易云说需要登录，续期也没成功 */
  loginExpired: () => void
}

export interface Player {
  /** 在列表里点一首歌：用整个列表替换播放队列，从这首开始放。列表还没同步全（complete 是 false）时同步全了再补上（规则⑫） */
  play: (source: PlaySource, songs: readonly Song[], songId: number, complete: boolean) => void
  /** 曲库变了：点歌时还没同步全的歌单同步全了，就把还没进播放队列的歌补回它们在歌单里的位置（规则⑫） */
  libraryChanged: (songsOf: (playlistId: number) => PlaylistSongs | null) => void
  /** 在放就暂停，停着就接着放 */
  toggle: () => void
  next: () => void
  previous: () => void
  /** 放播放队列里的第 index 首，播放队列不变。正在放的那首、无版权的不动 */
  jump: (index: number) => void
  /** 下一首播放（GLOSSARY）：排在当前这首后面，等它放完再放。播放队列是空的就直接开始放（规则①） */
  playNext: (source: PlaySource, song: Song) => void
  /** 加入播放队列：排到最后。播放队列是空的就直接开始放（规则①） */
  addToQueue: (source: PlaySource, song: Song) => void
  /** 插播（GLOSSARY）：排在当前这首后面并立即播放 */
  interject: (source: PlaySource, song: Song) => void
  /** 从播放队列移出第 index 首。正在放的那首移不掉 */
  removeFromQueue: (index: number) => void
  /** 清空播放队列：停下 */
  clearQueue: () => void
  /** 当前这首跳到第 position 秒（超出的算开头、结尾）：在放就从那里接着放，停着就等按播放 */
  seek: (position: number) => void
  /** 当前这首从第 position 秒开始放：跳过去，停着的也接着放（点歌词的一行） */
  playFrom: (position: number) => void
  setVolume: (volume: number) => void
  /** 换播放模式。换成随机播放时当前这首和还没放到的“下一首播放”留在最前，其余打乱；换回来时从当前这首接着按播放队列往下 */
  setMode: (mode: PlayMode) => void
  dismissNotice: () => void
  /** 退出登录：停下，清空播放队列 */
  stop: () => void
}

/** 取到的播放地址 */
interface PlayUrl {
  url: string
  trial: boolean
  /** 毫秒 */
  expiresAt: number
}

/** 取播放地址的结果；url 是 null：网易云没给地址 */
type Fetched = { ok: true, url: PlayUrl | null } | { ok: false, failure: RequestFailure }

/** 一个播放器和它装着的歌 */
interface Deck {
  audio: AudioCapability
  song: Song | null
  url: PlayUrl | null
  /** 数据够放到底了（canplaythrough） */
  buffered: boolean
}

/** 正在换过去的播放器：放的是它装着的那首（deck.song），出声了就停掉旧的。handover：当前这首快放完了自动换（当前这首还没换过去） */
interface Incoming {
  deck: Deck
  handover: boolean
}

function durationOf(deck: Deck): number | null {
  return Number.isFinite(deck.audio.duration) ? deck.audio.duration : null
}

/** 打乱的一份（Fisher–Yates） */
function shuffled(ids: readonly number[]): number[] {
  const result = [...ids]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * 规则⑫：点歌时还没同步全的歌单同步全了，把点歌时还没有（不在 have 里）、现在也不在播放队列里的歌补进去，放回它们在歌单里的位置：
 * 排在歌单里它后面、已经在播放队列里的那首前面；后面没有的，排在歌单里最后一首已经在播放队列里的歌后面（一首都没有就排到最后）。
 * 已经同步的部分不一定在歌单最前面（别的歌单里同步过的歌也有歌曲信息）。点歌后听众移出的歌（在 have 里）不再补回来。
 * 还没放到的“下一首播放”（upNext，紧跟在当前这首后面）不当作位置，补上的歌也不插到它们前面。没有要补的就原样返回
 */
function fillIn(queue: readonly QueueEntry[], playlist: PlaylistSongs, have: ReadonlySet<number>, upNext: readonly number[]): readonly QueueEntry[] {
  const inQueue = new Set(queue.map(entry => entry.song.id))
  const source: PlaySource = { kind: 'playlist', id: playlist.playlist.id }
  /** 要补在某首前面的歌，按歌单的先后 */
  const before = new Map<number, QueueEntry[]>()
  let waiting: QueueEntry[] = []
  let last: number | null = null
  let missing = 0
  for (const song of playlist.songs) {
    if (inQueue.has(song.id)) {
      if (upNext.includes(song.id))
        continue
      if (waiting.length > 0)
        before.set(song.id, waiting)
      waiting = []
      last = song.id
    }
    else if (!have.has(song.id)) {
      waiting.push({ song, source })
      missing += 1
    }
  }
  if (missing === 0)
    return queue
  const filled: QueueEntry[] = []
  /** 排在 last 后面的还没补：跳过紧跟着的“下一首播放”再补 */
  let tail = last === null
  for (const entry of queue) {
    if (tail && !upNext.includes(entry.song.id)) {
      filled.push(...waiting)
      tail = false
    }
    filled.push(...(before.get(entry.song.id) ?? []), entry)
    if (entry.song.id === last)
      tail = true
  }
  if (tail)
    filled.push(...waiting)
  return filled
}

export function createPlayer(context: PlayerContext): Player {
  const { api, clock } = context
  let state: PlayerState = INITIAL_PLAYER
  let incoming: Incoming | null = null
  /** 交接时新的播放器没加载出来：让当前这首放完，再停下提示 */
  let handoverFailed = false
  /** 每换一次要放的歌、每暂停一次就加一：在取的地址回来时已经换了或停了，就不放了 */
  let attempt = 0
  /** 正在换过去的那首从第几秒开始放：start 定下，还在取地址时听众又跳到别处（seek）就改它 */
  let startAt = 0
  /** 每准备一次空闲的播放器就加一：准备到一半又换了歌，就不往里装了 */
  let preparing = 0
  /** 当前这首已经准备过下一首 */
  let prepared = false
  /** 点歌时这张歌单还没同步全：同步全了把后面的补上（规则⑫）。have：点歌时已经同步了的那些歌 */
  let filling: { playlistId: number, have: ReadonlySet<number> } | null = null
  /**
   * 听众选了“下一首播放”、还没放到的歌，后加的在前（规则⑤）：它们就紧跟在当前这首后面。
   * 放到了就不再算（逻辑原型的随机操作检查：当前这首不会还记在“下一首播放”里）；退回上一首、在播放队列里点别的歌、点歌、清空后都不算了
   */
  let upNext: readonly number[] = []
  /**
   * 随机播放时的播放顺序（歌曲编号，和播放队列里的歌一一对应，转一圈接着从头）；不是随机播放时是 null，按播放队列的先后放。
   * 下一首播放排在当前这首紧后面、加入播放队列排到最后，随机播放时也照字面（规则③）
   */
  let order: readonly number[] | null = null
  /** indexOfSong 用的：播放队列里每首歌的位置，播放队列换了才重算 */
  let positions: { queue: readonly QueueEntry[], index: Map<number, number> } = { queue: [], index: new Map() }
  /** 这个播放队列里网易云没给地址的歌：不再放 */
  const unavailable = new Set<number>()
  const urls = new Map<number, PlayUrl>()
  const fetching = new Map<number, Promise<Fetched>>()
  /** 退出一次就加一：退出前发出去的取地址请求回来时，地址不再存 */
  let epoch = 0
  /** 上一次准备下一首的时刻：没准备好时快放完再准备一次，不要每次 timeupdate 都发请求 */
  let lastPrepare = Number.NEGATIVE_INFINITY
  let cancelSlow: (() => void) | null = null
  let active = deck()
  let spare = deck()

  /**
   * 发布一次：每次都按播放顺序、放不了的歌重算 neighbors（它们变的时候都跟着一次发布）。
   * 所以 state.current 要一直指着 queue 里的当前这首：换播放队列时 queue 和 current 一起发布（publishQueue、play）
   */
  function publish(next: Partial<PlayerState>): void {
    state = { ...state, ...next }
    if (next.current !== undefined && upNext.length > 0)
      upNext = upNext.filter(id => id !== currentId())
    state.neighbors = neighbors()
    context.write(state)
  }

  function fresh(url: PlayUrl | null): url is PlayUrl {
    return url !== null && clock.now() < url.expiresAt - URL_EXPIRY_MARGIN_MS
  }

  /** 播放器装着这首歌、地址没过期、没出错：可以直接放 */
  function holds(deck: Deck, song: Song): boolean {
    return deck.song?.id === song.id && fresh(deck.url) && !deck.audio.error
  }

  /**
   * 这个播放器放的是当前这首，它的事件才算数。听众要放的那首还没出声时，当前这首在正在换过去的那个播放器上；
   * 换歌时旧的那个还在出声，直到新的出声：它的进度、放完、出错都不算到新的这首上。
   * 在取当前这首的地址时（loading）哪个都不算：单曲的播放队列换到自己时，旧的那个放的也是这首
   */
  function isCurrent(deck: Deck): boolean {
    if (state.status === 'loading')
      return false
    const shown = incoming && !incoming.handover ? incoming.deck : active
    return deck === shown && state.current !== null && deck.song?.id === state.queue[state.current].song.id
  }

  /** 取一首歌的播放地址：没过期的直接用；同一首同时只取一次。取地址是听众在等的前台请求，马上发 */
  function playUrl(song: Song): Promise<Fetched> {
    const cached = urls.get(song.id) ?? null
    if (fresh(cached))
      return Promise.resolve({ ok: true, url: cached })
    let request = fetching.get(song.id)
    if (!request) {
      const requestedAt = clock.now()
      const mine = epoch
      request = api.get<PlayUrlResponse>(`/api/songs/${song.id}/play-url?quality=${QUALITY}`).then((result): Fetched => {
        if (!result.ok)
          return result
        if (!result.value.playable)
          return { ok: true, url: null }
        const url = { url: result.value.url, trial: result.value.trial, expiresAt: requestedAt + result.value.expiresIn * 1000 }
        if (mine === epoch)
          urls.set(song.id, url)
        return { ok: true, url }
      }).finally(() => {
        if (mine === epoch)
          fetching.delete(song.id)
      })
      fetching.set(song.id, request)
    }
    return request
  }

  function playable(entry: QueueEntry): boolean {
    return entry.song.availability !== 'noCopyright' && !unavailable.has(entry.song.id)
  }

  /**
   * 从第 from 首往后（step 1）或往前（-1）数，第一首能放的：按播放顺序（随机播放时是另排的那份），转一圈回到 from 自己也算。
   * 一首能放的都没有是 null
   */
  function playableFrom(from: number, step: 1 | -1): number | null {
    const { queue } = state
    const at = order ? order.indexOf(queue[from].song.id) : from
    for (let offset = 1; offset <= queue.length; offset += 1) {
      const k = ((at + step * offset) % queue.length + queue.length) % queue.length
      const index = order ? indexOfSong(order[k]) : k
      if (playable(queue[index]))
        return index
    }
    return null
  }

  /** 当前这首放完以后自动接着放的那首（单曲循环时是它自己）：一首能放的都没有、播放队列是空的时是 null */
  function following(): number | null {
    if (state.current === null)
      return null
    if (state.mode === 'one' && playable(state.queue[state.current]))
      return state.current
    return playableFrom(state.current, 1)
  }

  /** 按上一首、下一首会换到哪首（PlayerState.neighbors）：转一圈回到当前这首自己不算 */
  function neighbors(): PlayerState['neighbors'] {
    const { current } = state
    if (current === null)
      return NO_NEIGHBORS
    const other = (index: number | null) => (index === current ? null : index)
    return { previous: other(playableFrom(current, -1)), next: other(playableFrom(current, 1)) }
  }

  /** 这首歌在播放队列里的位置（播放队列里同一首歌只有一份）；不在里面是 -1 */
  function indexOfSong(id: number): number {
    if (positions.queue !== state.queue)
      positions = { queue: state.queue, index: new Map(state.queue.map((entry, index) => [entry.song.id, index])) }
    return positions.index.get(id) ?? -1
  }

  function load(deck: Deck, song: Song, url: PlayUrl): void {
    deck.song = song
    deck.url = url
    deck.buffered = false
    deck.audio.preload = 'auto'
    deck.audio.src = url.url
  }

  function play(deck: Deck): void {
    // 出没出声看 playing 事件，加载出错看 error 事件；暂停、换地址打断的 play() 不用管
    void deck.audio.play().catch(() => {})
  }

  function pauseAll(): void {
    incoming = null
    stopSlow()
    active.audio.pause()
    spare.audio.pause()
  }

  function startSlow(): void {
    stopSlow()
    cancelSlow = clock.after(SLOW_BUFFERING_MS, () => {
      cancelSlow = null
      if (state.status === 'buffering')
        publish({ notice: { kind: 'slow' } })
    })
  }

  function stopSlow(): void {
    cancelSlow?.()
    cancelSlow = null
  }

  /** 出声了：网络慢的提示不用再显示 */
  function noticeAfterSounding(): PlayerNotice | null {
    return state.notice?.kind === 'slow' ? null : state.notice
  }

  /**
   * 从 position 秒开始放播放队列里的第 index 首：在空闲的播放器上放，出声了再停旧的。
   * change：为什么换成这首；是 null 时是同一首接着放（暂停后、地址过期后），原因不变
   */
  async function start(index: number, position: number, change: SongChange | null, notice: PlayerNotice | null = null): Promise<void> {
    const mine = ++attempt
    preparing += 1
    prepared = false
    handoverFailed = false
    const { song } = state.queue[index]
    // 正在换过去、还没出声的那首不要了（连按几次下一首）：停下它，免得它缓冲好了和当前这首一起出声
    if (incoming && !holds(incoming.deck, song))
      incoming.deck.audio.pause()
    incoming = null
    stopSlow()
    startAt = position
    publish({ current: index, position, duration: null, trial: false, notice, change: change ?? state.change })
    if (!holds(spare, song)) {
      let url = urls.get(song.id) ?? null
      if (!fresh(url)) {
        publish({ status: 'loading' })
        const fetched = await playUrl(song)
        if (mine !== attempt)
          return
        if (!fetched.ok)
          return urlFailed(fetched.failure)
        if (!fetched.url)
          return skip(song)
        url = fetched.url
      }
      load(spare, song, url)
    }
    // 不读 state.position：单曲的播放队列换到自己时，旧的播放器放的是同一首，取地址期间它还在报进度
    spare.audio.currentTime = startAt
    incoming = { deck: spare, handover: false }
    publish({ status: 'buffering', duration: durationOf(spare), trial: spare.url!.trial })
    play(spare)
  }

  function urlFailed(failure: RequestFailure): void {
    pauseAll()
    if (failure.kind === 'needsLogin') {
      publish({ status: 'paused' })
      context.loginExpired()
      return
    }
    publish({ status: 'paused', notice: { kind: 'urlFailed', failure } })
  }

  /** 网易云没给这首的播放地址：跳过它放下一首能放的 */
  function skip(song: Song): void {
    unavailable.add(song.id)
    const next = playableFrom(state.current!, 1)
    if (next === null) {
      pauseAll()
      publish({ status: 'paused', notice: { kind: 'nothingPlayable' } })
      return
    }
    void start(next, 0, 'skip', { kind: 'skipped', song })
  }

  /** 当前这首出声了：空闲的播放器取好下一首的地址、缓冲着 */
  async function prepareNext(): Promise<void> {
    if (prepared || state.current === null)
      return
    prepared = true
    lastPrepare = clock.now()
    const mine = ++preparing
    const index = following()
    if (index === null)
      return
    const { song } = state.queue[index]
    if (holds(spare, song))
      return
    const fetched = await playUrl(song)
    if (mine !== preparing)
      return
    if (!fetched.ok) {
      // 快放完时（handOver）再准备一次
      if (fetched.failure.kind === 'needsLogin')
        context.loginExpired()
      return
    }
    if (!fetched.url) {
      unavailable.add(song.id)
      publish({ notice: { kind: 'skipped', song } })
      prepared = false
      return prepareNext()
    }
    load(spare, song, fetched.url)
  }

  /** 当前这首快放完了：空闲的播放器装好了下一首，就让它开始放；还没装好就再准备一次 */
  function handOver(): void {
    if (incoming || handoverFailed || state.status !== 'playing' || state.current === null)
      return
    const next = following()
    if (next === null)
      return
    const remaining = active.audio.duration - active.audio.currentTime
    if (!holds(spare, state.queue[next].song)) {
      if (remaining <= PREPARE_AGAIN_LEAD && clock.now() - lastPrepare >= PREPARE_AGAIN_INTERVAL_MS) {
        prepared = false
        void prepareNext()
      }
      return
    }
    if (remaining > (spare.buffered ? HANDOVER_LEAD : UNBUFFERED_HANDOVER_LEAD))
      return
    incoming = { deck: spare, handover: true }
    play(spare)
  }

  /** 正在换过去的播放器出声了：停掉旧的，它就是当前的。快放完时交接的，这时才换成下一首 */
  function arrived({ deck, handover }: Incoming): void {
    incoming = null
    stopSlow()
    if (deck !== active) {
      const old = active
      active = deck
      spare = old
      old.audio.pause()
    }
    prepared = false
    // 有歌出声了：之前没给地址的歌，下一轮再试一次（网易云偶尔一时不给）
    unavailable.clear()
    publish({ current: indexOfSong(deck.song!.id), status: 'playing', position: deck.audio.currentTime, duration: durationOf(deck), trial: deck.url!.trial, notice: noticeAfterSounding(), change: handover ? 'continue' : state.change })
    void prepareNext()
  }

  /** 当前这首放完了 */
  function ended(): void {
    if (state.current === null)
      return
    if (incoming?.handover) {
      // 交接中、下一首还没出声：它就是当前这首了，等它出声
      incoming = { ...incoming, handover: false }
      publish({ current: indexOfSong(incoming.deck.song!.id), status: 'buffering', position: 0, duration: durationOf(incoming.deck), trial: incoming.deck.url!.trial, change: 'continue' })
      startSlow()
      return
    }
    if (incoming)
      return
    const next = following()
    if (handoverFailed) {
      handoverFailed = false
      publish({ current: next ?? state.current, status: 'paused', position: 0, duration: null, notice: { kind: 'streamFailed' }, change: next === null ? state.change : 'continue' })
      return
    }
    if (next === null) {
      publish({ status: 'paused', position: 0 })
      return
    }
    void start(next, 0, 'continue')
  }

  /** 当前这首的音频没加载下来 */
  function streamFailed(deck: Deck): void {
    // 地址过期了：重新取，从原来的位置接着放
    if (!fresh(deck.url) && state.current !== null) {
      void start(state.current, state.position, null, state.notice)
      return
    }
    pauseAll()
    publish({ status: 'paused', notice: { kind: 'streamFailed' } })
  }

  function listen(deck: Deck): void {
    const { audio } = deck
    audio.addEventListener('playing', () => {
      if (incoming?.deck === deck)
        return arrived(incoming)
      if (incoming || !isCurrent(deck))
        return
      stopSlow()
      publish({ status: 'playing', notice: noticeAfterSounding() })
      void prepareNext()
    })
    audio.addEventListener('waiting', () => {
      if (!isCurrent(deck) || audio.paused)
        return
      if (state.status === 'playing')
        publish({ status: 'buffering' })
      startSlow()
    })
    audio.addEventListener('pause', () => {
      // 不是 App 暂停的（例如系统拿走了音频焦点）。事件是排着的：送到时已经又放了就不算
      if (!incoming && isCurrent(deck) && audio.paused && !audio.ended && (state.status === 'playing' || state.status === 'buffering')) {
        stopSlow()
        publish({ status: 'paused' })
      }
    })
    audio.addEventListener('timeupdate', () => {
      if (!isCurrent(deck))
        return
      publish({ position: audio.currentTime })
      handOver()
    })
    audio.addEventListener('durationchange', () => {
      if (isCurrent(deck))
        publish({ duration: durationOf(deck) })
    })
    audio.addEventListener('canplaythrough', () => {
      deck.buffered = true
    })
    audio.addEventListener('ended', () => {
      if (isCurrent(deck))
        ended()
    })
    audio.addEventListener('error', () => {
      if (incoming?.deck === deck && incoming.handover) {
        // 交接失败：让当前这首放完，再停下提示
        incoming = null
        handoverFailed = true
        audio.pause()
        return
      }
      if (isCurrent(deck))
        return streamFailed(deck)
      // 缓冲着的下一首没加载出来：交接时不用它，快放完时（handOver）重新取地址再准备
      if (deck.song)
        urls.delete(deck.song.id)
      deck.song = null
      deck.url = null
    })
  }

  function deck(): Deck {
    const created: Deck = { audio: context.audio(), song: null, url: null, buffered: false }
    created.audio.volume = state.volume
    listen(created)
    return created
  }

  function resume(): void {
    const index = state.current!
    const { song } = state.queue[index]
    if (holds(active, song) && !active.audio.ended) {
      // 暂停时下一首的地址可能过期了：出声后重新准备
      prepared = false
      publish({ status: 'buffering', notice: null })
      play(active)
      return
    }
    void start(index, state.position, null)
  }

  /** 当前这首跳到第 position 秒（见 Player.seek） */
  function seek(position: number): void {
    if (state.current === null)
      return
    const { song } = state.queue[state.current]
    const at = Math.min(Math.max(0, position), state.duration ?? song.duration / 1000)
    if (incoming?.handover) {
      // 快放完时空闲的播放器已经开始放下一首：往回跳就不交接了，它停下等着，再放到结尾时重新交接
      incoming.deck.audio.pause()
      incoming.deck.audio.currentTime = 0
      incoming = null
    }
    // 正在换过去的播放器（还没出声）、装着这首的当前播放器直接跳；都不是的（在取地址、地址过期了）放的时候从这里开始
    const deck = incoming?.deck ?? (holds(active, song) ? active : null)
    if (deck)
      deck.audio.currentTime = at
    startAt = at
    publish({ position: at })
  }

  /** 当前这首的编号；播放队列是空的时是 null */
  function currentId(): number | null {
    return state.current === null ? null : state.queue[state.current].song.id
  }

  /**
   * 播放队列变了：当前这首按编号找回位置（播放队列里同一首歌只有一份）。
   * 调用的地方都把当前这首留在播放队列里（正在放的那首移不掉、挪不走）；找不到就是这条约定被打破了，明确报错
   */
  function publishQueue(queue: readonly QueueEntry[]): void {
    const id = currentId()
    const current = queue.findIndex(entry => entry.song.id === id)
    if (current === -1)
      throw new Error(`播放队列变了，当前这首（${id}）不在新的播放队列里`)
    publish({ queue, current })
  }

  /**
   * 下一首播放（next）、加入播放队列（end）、插播（now）：播放队列是空的就只放这一首，直接开始放（规则①）；
   * 这首本来就在播放队列里的话，从原位置挪过来，播放来源改成新的（规则②）。
   * 正在放的那首什么都不变、不从头放；暂停着时插播它就是接着放。无版权的歌不放进来
   */
  function add(source: PlaySource, song: Song, how: 'next' | 'end' | 'now'): void {
    if (song.availability === 'noCopyright')
      return
    const id = currentId()
    if (id === null) {
      if (order)
        order = [song.id]
      publish({ queue: [{ song, source }] })
      void start(0, 0, 'pick')
      return
    }
    if (song.id === id) {
      if (how === 'now' && state.status === 'paused')
        resume()
      return
    }
    const rest = state.queue.filter(entry => entry.song.id !== song.id)
    const at = how === 'end' ? rest.length : rest.findIndex(entry => entry.song.id === id) + 1
    upNext = how === 'next' ? [song.id, ...upNext.filter(each => each !== song.id)] : upNext.filter(each => each !== song.id)
    if (order) {
      const others = order.filter(each => each !== song.id)
      const after = how === 'end' ? others.length : others.indexOf(id) + 1
      order = [...others.slice(0, after), song.id, ...others.slice(after)]
    }
    publishQueue([...rest.slice(0, at), { song, source }, ...rest.slice(at)])
    if (how === 'now')
      void start(at, 0, 'pick')
    else
      queueChanged()
  }

  /**
   * 播放队列变了（下一首播放、加入播放队列、移出、换播放模式、补上没同步完的歌）：下一首可能变了，空闲的播放器重新准备（ADR-0010）。
   * 已经开始交接、还没出声的那首不再是下一首的话，停下它，快放完时重新交接；之前交接失败的也重新准备、重新交接。
   * 听众点的歌还没出声时，等它出声后再准备
   */
  function queueChanged(): void {
    if (incoming?.handover) {
      const next = following()
      if (next !== null && state.queue[next].song.id === incoming.deck.song!.id)
        return
      incoming.deck.audio.pause()
      incoming.deck.audio.currentTime = 0
      incoming = null
    }
    handoverFailed = false
    prepared = false
    if (!incoming && state.status === 'playing')
      void prepareNext()
  }

  /** 清空播放队列：停下，两个播放器都不出声；还在取的地址、在准备的下一首回来了也不放 */
  function clear(): void {
    attempt += 1
    preparing += 1
    handoverFailed = false
    upNext = []
    if (order)
      order = []
    filling = null
    pauseAll()
    unavailable.clear()
    publish({ ...INITIAL_PLAYER, volume: state.volume, mode: state.mode })
  }

  return {
    play(source, songs, songId, complete) {
      const index = songs.findIndex(song => song.id === songId)
      if (index === -1 || songs[index].availability === 'noCopyright')
        return
      unavailable.clear()
      upNext = []
      order = state.mode === 'shuffle' ? [songId, ...shuffled(songs.flatMap(song => song.id === songId ? [] : [song.id]))] : null
      filling = complete ? null : { playlistId: source.id, have: new Set(songs.map(song => song.id)) }
      publish({ queue: songs.map(song => ({ song, source })), current: index })
      void start(index, 0, 'pick')
    },
    libraryChanged(songsOf) {
      if (filling === null)
        return
      const playlist = songsOf(filling.playlistId)
      if (playlist && !playlist.complete)
        return
      const { have } = filling
      filling = null
      if (!playlist || state.current === null)
        return
      const queue = fillIn(state.queue, playlist, have, upNext)
      if (queue === state.queue)
        return
      if (order) {
        const known = new Set(order)
        order = [...order, ...shuffled(queue.flatMap(entry => known.has(entry.song.id) ? [] : [entry.song.id]))]
      }
      publishQueue(queue)
      queueChanged()
    },
    toggle() {
      if (state.current === null)
        return
      if (state.status === 'paused')
        return resume()
      attempt += 1
      pauseAll()
      publish({ status: 'paused' })
    },
    next() {
      const index = state.current === null ? null : playableFrom(state.current, 1)
      if (index !== null)
        void start(index, 0, 'next')
    },
    previous() {
      const index = state.current === null ? null : playableFrom(state.current, -1)
      if (index === null)
        return
      upNext = []
      void start(index, 0, 'previous')
    },
    jump(index) {
      const entry = state.queue[index]
      if (!entry || index === state.current || entry.song.availability === 'noCopyright')
        return
      upNext = []
      void start(index, 0, 'pick')
    },
    playNext: (source, song) => add(source, song, 'next'),
    addToQueue: (source, song) => add(source, song, 'end'),
    interject: (source, song) => add(source, song, 'now'),
    removeFromQueue(index) {
      if (index === state.current || !state.queue[index])
        return
      const { id } = state.queue[index].song
      upNext = upNext.filter(each => each !== id)
      if (order)
        order = order.filter(each => each !== id)
      publishQueue(state.queue.filter((_, i) => i !== index))
      queueChanged()
    },
    clearQueue: clear,
    seek,
    playFrom(position) {
      if (state.current === null)
        return
      seek(position)
      if (state.status === 'paused')
        resume()
    },
    setVolume(volume) {
      active.audio.volume = volume
      spare.audio.volume = volume
      publish({ volume })
    },
    setMode(mode) {
      if (mode === state.mode)
        return
      const id = currentId()
      if (mode === 'shuffle') {
        const first = id === null ? [] : [id, ...upNext]
        order = [...first, ...shuffled(state.queue.flatMap(entry => first.includes(entry.song.id) ? [] : [entry.song.id]))]
      }
      else {
        order = null
      }
      publish({ mode })
      queueChanged()
    },
    dismissNotice() {
      publish({ notice: null })
    },
    stop() {
      epoch += 1
      for (const each of [active, spare]) {
        each.song = null
        each.url = null
      }
      urls.clear()
      fetching.clear()
      clear()
    },
  }
}
