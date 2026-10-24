import { endpoints } from '#lib/api/endpoints.js'
import type { Song } from '#lib/api/library.js'
import type { PlaySource, Quality } from '#lib/api/playback.js'

import type { AudioCapability, Clock } from './browser'
import type { PlaylistSongs } from './library'
import type { SessionApi, SessionFailure } from './session-round'

// 播放队列与播放（Spec #11“客户端：播放队列与播放”）。两个播放器轮流放（ADR-0010）：换歌在空闲的那个上放，出声了再停旧的；
// 当前这首出声后空闲的播放器先取下一首地址、缓冲着，快放完时交接。播放地址约 20 分钟过期，过期后重新取并从原位置接着放。
// 下一首播放、加入播放队列、插播的边角照规则①–⑤（docs/prototype/logic.md）。播放队列和进度按网易云账号存在本机，重新打开时恢复。
// 已下载的歌（#38）放本机文件；断网、没登录时没下载的跳过。一首歌听完就交出一次打卡，和进度存在一起（#28）。

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

/** 每首各自记着播放来源 */
export interface QueueEntry {
  song: Song
  source: PlaySource
}

/** loading：在取地址，一定有请求在路上；buffering：地址有了、在等数据；playing：在出声；paused：停着（暂停、出错停下、队列空） */
type PlaybackStatus = 'loading' | 'buffering' | 'playing' | 'paused'

export type PlayerNotice
  /** 没取到播放地址：按播放重试 */
  = | { kind: 'urlFailed', failure: SessionFailure }
    /** 音频没加载下来：按播放从原来的位置接着放 */
    | { kind: 'streamFailed' }
    /** 还在等，接上了就接着放 */
    | { kind: 'slow' }
    | { kind: 'skipped', song: Song }
    | { kind: 'nothingPlayable' }

/** 界面换碟看它往哪转（DESIGN.md Cover Wheel），不靠前后序号猜：随机播放时序号不连续。continue 包括快放完时两个播放器交接（ADR-0010），skip 是没给地址跳到后面能放的 */
export type SongChange = 'next' | 'previous' | 'pick' | 'continue' | 'skip'

/** 单曲循环（one）放完从头再放这首、按下一首照样换歌；随机播放（shuffle）按另排的一份顺序放，播放队列的先后不变 */
export type PlayMode = 'loop' | 'one' | 'shuffle'

export interface PlayerState {
  queue: readonly QueueEntry[]
  current: number | null
  status: PlaybackStatus
  position: number
  duration: number | null
  trial: boolean
  volume: number
  notice: PlayerNotice | null
  /** 当前这首是因为什么换上来的；还没换过歌（播放队列是空的、重新打开 App 刚恢复）时是 null */
  change: SongChange | null
  mode: PlayMode
  /** 按上一首、下一首会换到第几首（随机时按另排的顺序，跳过放不了的）；手机播放页拖封面时转盘上露出的就是这两首。没有别的能放的歌时是 null */
  neighbors: { previous: number | null, next: number | null }
  /** 在线播放音质（设置页）：没设过时是极高。换了从下一首起生效，正在放的那首不换 */
  quality: Quality
}

const NO_NEIGHBORS: PlayerState['neighbors'] = { previous: null, next: null }

export const INITIAL_PLAYER: PlayerState = {
  queue: [],
  current: null,
  status: 'paused',
  position: 0,
  duration: null,
  trial: false,
  volume: 1,
  notice: null,
  change: null,
  mode: 'loop',
  neighbors: NO_NEIGHBORS,
  quality: 'exhigh',
}

/** 播放队列、播放模式、随机顺序、下一首播放、要补的歌单变了时重存 */
export interface SavedQueue {
  entries: readonly QueueEntry[]
  mode: PlayMode
  /** 随机播放时的播放顺序（歌曲编号）；不是随机播放时是 null */
  order: readonly number[] | null
  /** 还没放到的“下一首播放”，后加的在前 */
  upNext: readonly number[]
  /** 点歌时这张歌单还没同步全，同步全了把后面的补上（规则⑫）；have：点歌时已经同步了的那些歌 */
  filling: { playlistId: number, have: readonly number[] } | null
}

export interface SavedProgress {
  songId: number
  position: number
  duration: number | null
  trial: boolean
  /** 这首已经听了多少秒：按实际出声的时间算，跳过去的不算。放到一半关掉 App 不算这首结束，下次接着累计（规则⑥，听歌打卡 #28 用） */
  listened: number
}

export interface SavedPlayer {
  queue: SavedQueue
  progress: SavedProgress
}

/** 一首歌听完了（播完或切走；放到一半关掉 App 不算），实际听了多少秒（取整，至少 1 秒） */
export interface CheckIn {
  songId: number
  source: PlaySource
  seconds: number
}

export interface PlayerContext {
  api: SessionApi
  clock: Clock
  audio: () => AudioCapability
  write: (player: PlayerState) => void
  /** 进度变了（放着时每秒、暂停、跳转、换歌）就存进本机；queue 没变是 undefined，打卡在 checkIns 里。几样要存在同一个事务：重新打开时才对得上，打卡也不会记两次、漏记 */
  save: (progress: SavedProgress, queue: SavedQueue | undefined, checkIns: readonly CheckIn[]) => void
  /** 队列空了（清空、退出登录）就删掉本机存着的；空之前听完的那首的打卡在 checkIns 里，和删在同一个事务里存下 */
  forget: (checkIns: readonly CheckIn[]) => void
  /** 已下载的歌即使在线也放本机文件，断网、没登录时照样能放（#38） */
  downloaded: (songId: number) => boolean
  localFile: (songId: number) => string
  /** 这首现在能不能放（App 的同一条规则）：不能时跳过、不取播放地址 */
  playable: (song: Song) => boolean
}

export interface Player {
  /** 用整个列表替换播放队列，从这首开始放；complete 是 false 时同步全了再补上（规则⑫） */
  play: (source: PlaySource, songs: readonly Song[], songId: number, complete: boolean) => void
  /** 点歌时还没同步全的歌单有全了，就把还没进播放队列的歌补回它们在歌单里的位置（规则⑫）；songsOf 找曲库里的和打开着的不在曲库里的歌单 */
  libraryChanged: (songsOf: (playlistId: number) => PlaylistSongs<{ id: number }> | null) => void
  toggle: () => void
  next: () => void
  previous: () => void
  /** 播放队列不变；正在放的那首、现在放不了的不动 */
  jump: (index: number) => void
  /** 排在当前这首后面；队列空就直接开始放（规则①） */
  playNext: (source: PlaySource, song: Song) => void
  /** 排到最后；队列空就直接开始放（规则①） */
  addToQueue: (source: PlaySource, song: Song) => void
  /** 排在当前这首后面并立即播放 */
  interject: (source: PlaySource, song: Song) => void
  /** 正在放的那首移不掉 */
  removeFromQueue: (index: number) => void
  /** 停下 */
  clearQueue: () => void
  /** 超出的算开头、结尾；在放就从那里接着放，停着就等按播放 */
  seek: (position: number) => void
  /** 点歌词的一行：停着的也接着放 */
  playFrom: (position: number) => void
  setVolume: (volume: number) => void
  /** 换成随机时当前这首和还没放到的“下一首播放”留在最前，其余打乱；换回来从当前这首接着按队列往下 */
  setMode: (mode: PlayMode) => void
  /** 从下一首起生效，正在放的那首照旧放完；空闲的播放器按新音质重新准备 */
  setQuality: (quality: Quality) => void
  dismissNotice: () => void
  /** 停下、清空队列，之前取的播放地址都不要了（地址按账号给） */
  stop: () => void
  /** 恢复存着的播放队列和进度；停着等按播放，不算换歌（change 是 null）。地址没存，按播放时重新取、从原位置接着放 */
  restore: (saved: SavedPlayer) => void
  /** 哪些歌能放变了（#38）：重算上一首、下一首，空闲的播放器按现在能放的重新准备（断网时下一首没下载就换成后面下载了的） */
  availabilityChanged: () => void
  /** 没登录时放着的队列（#38，只有已下载的歌）交给刚登录的账号：接着放、不换歌；登录前已经听的秒数不补记。整份队列重存一次，记成这个账号的 */
  adopt: () => void
}

/** 已下载的歌是本机文件的地址（local），不过期 */
interface PlayUrl {
  url: string
  trial: boolean
  /** 毫秒 */
  expiresAt: number
  local: boolean
}

/** 取播放地址的结果；url 是 null：网易云没给地址；整体是 null：这一轮会话结束了 */
type Fetched = { ok: true, url: PlayUrl | null } | { ok: false, failure: SessionFailure } | null

interface Deck {
  audio: AudioCapability
  song: Song | null
  url: PlayUrl | null
  /** 数据够放到底了（canplaythrough） */
  buffered: boolean
}

/** 正在换过去的播放器：出声了就停掉旧的；handover 是快放完时自动换 */
interface Incoming {
  deck: Deck
  handover: boolean
}

/** 规则⑫：have 是点歌时已经同步了的那些歌 */
interface Filling {
  playlistId: number
  have: ReadonlySet<number>
}

/** 和 SavedQueue 一样，只是 filling.have 是 Set */
type QueueParts = Omit<SavedQueue, 'filling'> & { filling: Filling | null }

const durationOf = (deck: Deck): number | null => Number.isFinite(deck.audio.duration)
  ? deck.audio.duration
  : null

/** Fisher–Yates */
const shuffled = (ids: readonly number[]): number[] => {
  const result = [...ids]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** 当前这首、整秒、时长、试听、在放还是停着 */
const progressKey = (songId: number, state: Pick<PlayerState, 'position' | 'duration' | 'trial' | 'status'>): string => [
  songId,
  Math.floor(state.position),
  state.duration,
  state.trial,
  state.status,
].join()

/**
 * 规则⑫：同步全了就把点歌时还没有（不在 have 里）、现在也不在队列里的歌补回它们在歌单里的位置：排在歌单里它后面、
 * 已经在队列里的那首前面，后面没有就排在最后一首已在队列里的歌后面。已经同步的部分不一定在歌单最前面；
 * 点歌后移出的歌（在 have 里）不再补，upNext 不当作位置。没有要补的就原样返回。
 */
const fillIn = (queue: readonly QueueEntry[], playlist: PlaylistSongs<{ id: number }>, have: ReadonlySet<number>, upNext: readonly number[]): readonly QueueEntry[] => {
  const inQueue = new Set(queue.map(entry => entry.song.id))
  const source: PlaySource = { kind: 'playlist', id: playlist.playlist.id }
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
  /** 跳过紧跟着的“下一首播放”再补 */
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

export const createPlayer = (context: PlayerContext): Player => {
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
  let prepared = false
  /** 点歌时这张歌单还没同步全：同步全了把后面的补上（规则⑫） */
  let filling: Filling | null = null
  /** 还没放到的“下一首播放”，后加的在前（规则⑤）；放到、退回上一首、点别的歌、清空后都不算 */
  let upNext: readonly number[] = []
  /** 随机播放的顺序（歌曲编号，转一圈接着从头）；不是随机时是 null，按队列先后放。下一首播放仍紧跟在当前这首后面、加入队列仍到最后（规则③） */
  let order: readonly number[] | null = null
  /** 队列里每首歌的位置，队列换了才重算 */
  let positions: { queue: readonly QueueEntry[], index: Map<number, number> } = {
    queue: [],
    index: new Map(),
  }
  const unavailable = new Set<number>()
  const urls = new Map<number, PlayUrl>()
  const fetching = new Map<number, Promise<Fetched>>()
  let epoch = 0
  /** 没准备好时快放完再准备一次，不要每次 timeupdate 都发请求 */
  let lastPrepare = Number.NEGATIVE_INFINITY
  let cancelSlow: (() => void) | null = null
  let active: Deck
  let spare: Deck
  /** 各部分原样留着，比引用就知道变没变 */
  let savedQueue: QueueParts | null = null
  let savedProgressKey = ''
  let heard = 0
  let soundingSince: number | null = null
  let finished: CheckIn[] = []

  /** 每次发布都重算 neighbors；state.current 要一直指着 queue 里的当前这首：换队列时 queue 和 current 一起发布（publishQueue、play） */
  const publish = (next: Partial<PlayerState>): void => {
    state = {
      ...state,
      ...next,
    }
    const id = currentId()
    if (next.current !== undefined && id !== null && upNext.includes(id))
      upNext = upNext.filter(each => each !== id)
    state.neighbors = neighbors()
    if (state.status === 'playing' && soundingSince === null) {
      soundingSince = clock.now()
    }
    else if (state.status !== 'playing' && soundingSince !== null) {
      heard = listened()
      soundingSince = null
    }
    context.write(state)
    persist()
  }

  /** 按实际出声的时间算，跳过去的不算 */
  const listened = (): number => heard + (soundingSince === null
    ? 0
    : (clock.now() - soundingSince) / 1000)

  /** 听完（播完或切走；暂停、地址过期后接着放的是同一首，不算）就按实际出声的秒数取整记一次打卡，不到 1 秒不记；之后从 0 秒算起 */
  const endListen = (): void => {
    const seconds = Math.round(listened())
    if (seconds > 0 && state.current !== null) {
      const { song, source } = state.queue[state.current]
      finished.push({ songId: song.id, source, seconds })
    }
    heard = 0
    soundingSince = null
  }

  /** 进度按整秒看：放着时每秒存一次，暂停、跳转、换歌时马上存；队列只在变了时重存，空了就删掉存着的 */
  const persist = (): void => {
    const checkIns = finished
    finished = []
    if (state.current === null) {
      if (savedQueue || checkIns.length > 0) {
        savedQueue = null
        savedProgressKey = ''
        context.forget(checkIns)
      }
      return
    }
    const queueChanged = savedQueue === null || savedQueue.entries !== state.queue || savedQueue.mode !== state.mode || savedQueue.order !== order || savedQueue.upNext !== upNext || savedQueue.filling !== filling
    const { song } = state.queue[state.current]
    const key = progressKey(song.id, state)
    if (!queueChanged && key === savedProgressKey && checkIns.length === 0)
      return
    savedProgressKey = key
    savedQueue = {
      entries: state.queue,
      mode: state.mode,
      order,
      upNext,
      filling,
    }
    context.save(
      {
        songId: song.id,
        position: state.position,
        duration: state.duration,
        trial: state.trial,
        listened: listened(),
      },
      queueChanged
        ? { ...savedQueue, filling: filling && {
            playlistId: filling.playlistId,
            have: [...filling.have],
          } }
        : undefined,
      checkIns,
    )
  }

  const fresh = (url: PlayUrl | null): url is PlayUrl => url !== null && clock.now() < url.expiresAt - URL_EXPIRY_MARGIN_MS

  /** 正在放的这首可以接着放、拖进度（下载完、删了下载时照样，放完再换） */
  const holds = (deck: Deck, song: Song): boolean => deck.song?.id === song.id && fresh(deck.url) && !deck.audio.error

  /** 空闲的播放器装着的能直接用：装着这首，下载了的装本机文件，没下载的装网易云地址 */
  const primed = (deck: Deck, song: Song): boolean => holds(deck, song) && deck.url!.local === context.downloaded(song.id)

  /** 本机文件地址，不取播放地址、不过期；没下载是 null */
  const localUrl = (song: Song): PlayUrl | null => context.downloaded(song.id)
    ? {
        url: context.localFile(song.id),
        trial: false,
        expiresAt: Number.POSITIVE_INFINITY,
        local: true,
      }
    : null

  /** 这个播放器放的是当前这首，它的事件才算数；换歌时旧的那个还在出声，直到新的出声。取地址时（loading）哪个都不算 */
  const isCurrent = (deck: Deck): boolean => {
    if (state.status === 'loading')
      return false
    const shown = incoming && !incoming.handover
      ? incoming.deck
      : active
    return deck === shown && state.current !== null && deck.song?.id === state.queue[state.current].song.id
  }

  /** 已下载的用本机文件，没过期的直接用，同一首同时只取一次；这是听众在等的前台请求，马上发 */
  const playUrl = (song: Song): Promise<Fetched> => {
    const cached = localUrl(song) ?? urls.get(song.id) ?? null
    if (fresh(cached))
      return Promise.resolve({ ok: true, url: cached })
    let request = fetching.get(song.id)
    if (!request) {
      const requestedAt = clock.now()
      const mine = epoch
      request = api.get(endpoints.playUrl, { id: song.id, quality: state.quality }).then((result): Fetched => {
        if (!result)
          return null
        if (!result.ok)
          return result
        if (!result.value.playable)
          return { ok: true, url: null }
        const url = {
          url: result.value.url,
          trial: result.value.trial,
          expiresAt: requestedAt + result.value.expiresIn * 1000,
          local: false,
        }
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

  /** 规则在 App（state.playable），播放器不自己再推一遍 */
  const canPlay = (song: Song): boolean => context.playable(song)

  /** 能放，且网易云没说过给不了地址（下载了的不用取地址） */
  const playable = (entry: QueueEntry): boolean => canPlay(entry.song) && (context.downloaded(entry.song.id) || !unavailable.has(entry.song.id))

  /** 从 from 往后（1）或往前（-1）数第一首能放的，按播放顺序（随机时是另排的），转一圈回到自己也算；都没有是 null */
  const playableFrom = (from: number, step: 1 | -1): number | null => {
    const { queue } = state
    const at = order
      ? order.indexOf(queue[from].song.id)
      : from
    for (let offset = 1; offset <= queue.length; offset += 1) {
      const k = ((at + step * offset) % queue.length + queue.length) % queue.length
      const index = order
        ? indexOfSong(order[k])
        : k
      if (playable(queue[index]))
        return index
    }
    return null
  }

  /** 单曲循环时是它自己；一首能放的都没有、队列空时是 null */
  const following = (): number | null => {
    if (state.current === null)
      return null
    if (state.mode === 'one' && playable(state.queue[state.current]))
      return state.current
    return playableFrom(state.current, 1)
  }

  /** 转一圈回到当前这首自己不算 */
  const neighbors = (): PlayerState['neighbors'] => {
    const { current } = state
    if (current === null)
      return NO_NEIGHBORS
    const other = (index: number | null) => (index === current
      ? null
      : index)
    return {
      previous: other(playableFrom(current, -1)),
      next: other(playableFrom(current, 1)),
    }
  }

  /** 队列里同一首歌只有一份；不在里面是 -1 */
  const indexOfSong = (id: number): number => {
    if (positions.queue !== state.queue) {
      positions = {
        queue: state.queue,
        index: new Map(state.queue.map((entry, index) => [entry.song.id, index])),
      }
    }
    return positions.index.get(id) ?? -1
  }

  const load = (deck: Deck, song: Song, url: PlayUrl): void => {
    deck.song = song
    deck.url = url
    deck.buffered = false
    deck.audio.preload = 'auto'
    deck.audio.src = url.url
  }

  const play = (deck: Deck): void => {
    // 出没出声看 playing、加载出错看 error；暂停、换地址打断的 play() 不用管
    void deck.audio.play().catch(() => {})
  }

  const pauseAll = (): void => {
    incoming = null
    stopSlow()
    active.audio.pause()
    spare.audio.pause()
  }

  const startSlow = (): void => {
    stopSlow()
    cancelSlow = clock.after(SLOW_BUFFERING_MS, () => {
      cancelSlow = null
      if (state.status === 'buffering') {
        publish({
          notice: { kind: 'slow' },
        })
      }
    })
  }

  const stopSlow = (): void => {
    cancelSlow?.()
    cancelSlow = null
  }

  /** 出声了：网络慢的提示不用再显示 */
  const noticeAfterSounding = (): PlayerNotice | null => state.notice?.kind === 'slow'
    ? null
    : state.notice

  /** 在空闲的播放器上放，出声了再停旧的；change 是 null 时是同一首接着放（暂停后、地址过期后），原因不变 */
  const start = async (index: number, position: number, change: SongChange | null, notice: PlayerNotice | null = null): Promise<void> => {
    const mine = ++attempt
    preparing += 1
    prepared = false
    handoverFailed = false
    const { song } = state.queue[index]
    // 连按几次下一首：停下还没出声的那首，免得它缓冲好了和当前这首一起出声
    if (incoming && !primed(incoming.deck, song))
      incoming.deck.audio.pause()
    incoming = null
    stopSlow()
    startAt = position
    if (change !== null)
      endListen()
    publish({
      current: index,
      position,
      duration: null,
      trial: false,
      notice,
      change: change ?? state.change,
    })
    if (!primed(spare, song)) {
      let url = localUrl(song) ?? urls.get(song.id) ?? null
      if (!fresh(url)) {
        publish({ status: 'loading' })
        const fetched = await playUrl(song)
        if (mine !== attempt)
          return
        if (fetched === null) {
          // 这一轮结束了：App 会切到登录失效/未登录；先停下，不显示“取播放地址失败”
          pauseAll()
          publish({ status: 'paused' })
          return
        }
        if (!fetched.ok)
          return urlFailed(fetched.failure)
        if (!fetched.url)
          return skip(song)
        url = fetched.url
      }
      load(spare, song, url)
    }
    // 不读 state.position：单曲的队列换到自己时，旧播放器放的是同一首，取地址期间它还在报进度
    spare.audio.currentTime = startAt
    incoming = { deck: spare, handover: false }
    publish({
      status: 'buffering',
      duration: durationOf(spare),
      trial: spare.url!.trial,
    })
    play(spare)
  }

  const urlFailed = (failure: SessionFailure): void => {
    pauseAll()
    publish({
      status: 'paused',
      notice: { kind: 'urlFailed', failure },
    })
  }

  /** 跳过它放下一首能放的 */
  const skip = (song: Song): void => {
    unavailable.add(song.id)
    const next = playableFrom(state.current!, 1)
    if (next === null) {
      pauseAll()
      publish({
        status: 'paused',
        notice: { kind: 'nothingPlayable' },
      })
      return
    }
    void start(next, 0, 'skip', { kind: 'skipped', song })
  }

  /** 空闲的播放器取好下一首的地址、缓冲着 */
  const prepareNext = async (): Promise<void> => {
    if (prepared || state.current === null)
      return
    prepared = true
    lastPrepare = clock.now()
    const mine = ++preparing
    const index = following()
    if (index === null)
      return
    const { song } = state.queue[index]
    if (primed(spare, song))
      return
    const fetched = await playUrl(song)
    if (mine !== preparing)
      return
    if (!fetched)
      return
    if (!fetched.ok) {
      // 快放完时再准备一次
      return
    }
    if (!fetched.url) {
      unavailable.add(song.id)
      publish({
        notice: { kind: 'skipped', song },
      })
      prepared = false
      return prepareNext()
    }
    load(spare, song, fetched.url)
  }

  /** 空闲的播放器装好了下一首就让它开始放；还没装好就再准备一次 */
  const handOver = (): void => {
    if (incoming || handoverFailed || state.status !== 'playing' || state.current === null)
      return
    const next = following()
    if (next === null)
      return
    const remaining = active.audio.duration - active.audio.currentTime
    if (!primed(spare, state.queue[next].song)) {
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

  /** 停掉旧的，它就是当前的；快放完时交接的，这时才换成下一首 */
  const arrived = ({ deck, handover }: Incoming): void => {
    incoming = null
    stopSlow()
    if (deck !== active) {
      const old = active
      active = deck
      spare = old
      old.audio.pause()
    }
    prepared = false
    // 之前没给地址的歌，下一轮再试一次（网易云偶尔一时不给）
    unavailable.clear()
    if (handover)
      endListen()
    publish({
      current: indexOfSong(deck.song!.id),
      status: 'playing',
      position: deck.audio.currentTime,
      duration: durationOf(deck),
      trial: deck.url!.trial,
      notice: noticeAfterSounding(),
      change: handover ? 'continue' : state.change,
    })
    void prepareNext()
  }

  const ended = (): void => {
    if (state.current === null)
      return
    if (incoming?.handover) {
      // 交接中、下一首还没出声：它就是当前这首了，等它出声
      incoming = { ...incoming, handover: false }
      endListen()
      publish({
        current: indexOfSong(incoming.deck.song!.id),
        status: 'buffering',
        position: 0,
        duration: durationOf(incoming.deck),
        trial: incoming.deck.url!.trial,
        change: 'continue',
      })
      startSlow()
      return
    }
    if (incoming)
      return
    const next = following()
    endListen()
    if (handoverFailed) {
      handoverFailed = false
      publish({
        current: next ?? state.current,
        status: 'paused',
        position: 0,
        duration: null,
        notice: { kind: 'streamFailed' },
        change: next === null
          ? state.change
          : 'continue',
      })
      return
    }
    if (next === null) {
      publish({ status: 'paused', position: 0 })
      return
    }
    void start(next, 0, 'continue')
  }

  const streamFailed = (deck: Deck): void => {
    // 地址过期了：重新取，从原位置接着放
    if (!fresh(deck.url) && state.current !== null) {
      void start(state.current, state.position, null, state.notice)
      return
    }
    pauseAll()
    publish({
      status: 'paused',
      notice: { kind: 'streamFailed' },
    })
  }

  const listen = (deck: Deck): void => {
    const { audio } = deck
    audio.addEventListener('playing', () => {
      if (incoming?.deck === deck)
        return arrived(incoming)
      if (incoming || !isCurrent(deck))
        return
      stopSlow()
      publish({
        status: 'playing',
        notice: noticeAfterSounding(),
      })
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
      // 不是 App 暂停的（例如系统拿走音频焦点）；事件是排着的，送到时已经又放了就不算
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
      if (isCurrent(deck)) {
        publish({
          duration: durationOf(deck),
        })
      }
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
      // 缓冲着的下一首没加载出来：交接时不用它，快放完时重新取地址再准备
      if (deck.song)
        urls.delete(deck.song.id)
      deck.song = null
      deck.url = null
    })
  }

  const deck = (): Deck => {
    const created: Deck = {
      audio: context.audio(),
      song: null,
      url: null,
      buffered: false,
    }
    created.audio.volume = state.volume
    listen(created)
    return created
  }

  active = deck()
  spare = deck()

  /** 当前这首接着放；它现在放不了了（#38，比如刚删了下载）就放后面第一首能放的，一首都没有就说明 */
  const resume = (): void => {
    const index = state.current!
    const { song } = state.queue[index]
    if (!canPlay(song)) {
      const next = playableFrom(index, 1)
      if (next === null || next === index) {
        return publish({
          notice: { kind: 'nothingPlayable' },
        })
      }
      return void start(next, 0, 'skip')
    }
    if (holds(active, song) && !active.audio.ended) {
      // 暂停时下一首的地址可能过期了：出声后重新准备
      prepared = false
      publish({ status: 'buffering', notice: null })
      play(active)
      return
    }
    void start(index, state.position, null)
  }

  const seek = (position: number): void => {
    if (state.current === null)
      return
    const { song } = state.queue[state.current]
    // 时长还不知道（音频没加载出来、网易云也没给，#78）：只挡住跳到开头之前
    const duration = state.duration ?? (song.duration === null
      ? Number.POSITIVE_INFINITY
      : song.duration / 1000)
    const at = Math.min(Math.max(0, position), duration)
    if (incoming?.handover) {
      // 快放完时空闲的播放器已经开始放下一首：往回跳就不交接了，它停下等着，再放到结尾时重新交接
      incoming.deck.audio.pause()
      incoming.deck.audio.currentTime = 0
      incoming = null
    }
    // 正在换过去的（还没出声）、装着这首的当前播放器直接跳；都不是的放的时候从这里开始
    const deck = incoming?.deck ?? (holds(active, song)
      ? active
      : null)
    if (deck)
      deck.audio.currentTime = at
    startAt = at
    publish({ position: at })
  }

  const currentId = (): number | null => state.current === null
    ? null
    : state.queue[state.current].song.id

  /** 当前这首按编号找回位置；调用的地方都把当前这首留在队列里（正在放的那首移不掉、挪不走），找不到就是约定被打破了，明确报错 */
  const publishQueue = (queue: readonly QueueEntry[]): void => {
    const id = currentId()
    const current = queue.findIndex(entry => entry.song.id === id)
    if (current === -1)
      throw new Error(`播放队列变了，当前这首（${id}）不在新的播放队列里`)
    publish({ queue, current })
  }

  /** 队列空就只放这一首、直接开始（规则①）；本来就在队列里就从原位置挪过来、播放来源改成新的（规则②）。正在放的那首不从头放，放不了的不放进来 */
  const add = (source: PlaySource, song: Song, how: 'next' | 'end' | 'now'): void => {
    if (!canPlay(song))
      return
    const id = currentId()
    if (id === null) {
      if (order)
        order = [song.id]
      publish({
        queue: [
          { song, source },
        ],
      })
      void start(0, 0, 'pick')
      return
    }
    if (song.id === id) {
      if (how === 'now' && state.status === 'paused')
        resume()
      return
    }
    const rest = state.queue.filter(entry => entry.song.id !== song.id)
    const at = how === 'end'
      ? rest.length
      : rest.findIndex(entry => entry.song.id === id) + 1
    upNext = how === 'next'
      ? [
          song.id,
          ...upNext.filter(each => each !== song.id),
        ]
      : upNext.filter(each => each !== song.id)
    if (order) {
      const others = order.filter(each => each !== song.id)
      const after = how === 'end'
        ? others.length
        : others.indexOf(id) + 1
      order = [
        ...others.slice(0, after),
        song.id,
        ...others.slice(after),
      ]
    }
    publishQueue([
      ...rest.slice(0, at),
      { song, source },
      ...rest.slice(at),
    ])
    if (how === 'now')
      void start(at, 0, 'pick')
    else
      queueChanged()
  }

  /** 下一首可能变了，空闲的播放器重新准备（ADR-0010）；已经开始交接的若不再是下一首就停下它，快放完时重新交接。点的歌还没出声时，等出声后再准备 */
  const queueChanged = (): void => {
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

  /** 两个播放器都不出声；还在取的地址、在准备的下一首回来了也不放 */
  const clear = (): void => {
    attempt += 1
    preparing += 1
    handoverFailed = false
    upNext = []
    if (order)
      order = []
    filling = null
    pauseAll()
    unavailable.clear()
    endListen()
    publish({
      ...INITIAL_PLAYER,
      volume: state.volume,
      mode: state.mode,
      quality: state.quality,
    })
  }

  return {
    play(source, songs, songId, complete) {
      const index = songs.findIndex(song => song.id === songId)
      if (index === -1 || !canPlay(songs[index]))
        return
      unavailable.clear()
      upNext = []
      order = state.mode === 'shuffle'
        ? [
            songId,
            ...shuffled(songs.flatMap(song => song.id === songId
              ? []
              : [song.id])),
          ]
        : null
      filling = null
      if (!complete) {
        if (source.kind !== 'playlist')
          throw new Error(`只有歌单会没同步全，${source.kind} 的列表要一次拿全`)
        filling = {
          playlistId: source.id,
          have: new Set(songs.map(song => song.id)),
        }
      }
      // 换队列之前：正在听的那首是旧队列里的
      endListen()
      publish({
        queue: songs.map(song => ({ song, source })),
        current: index,
      })
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
        order = [
          ...order,
          ...shuffled(queue.flatMap(entry => known.has(entry.song.id)
            ? []
            : [entry.song.id])),
        ]
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
      const index = state.current === null
        ? null
        : playableFrom(state.current, 1)
      if (index !== null)
        void start(index, 0, 'next')
    },
    previous() {
      const index = state.current === null
        ? null
        : playableFrom(state.current, -1)
      if (index === null)
        return
      if (upNext.length > 0)
        upNext = []
      void start(index, 0, 'previous')
    },
    jump(index) {
      const entry = state.queue[index]
      if (!entry || index === state.current || !playable(entry))
        return
      if (upNext.length > 0)
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
        const first = id === null
          ? []
          : [id, ...upNext]
        order = [
          ...first,
          ...shuffled(state.queue.flatMap(entry => first.includes(entry.song.id)
            ? []
            : [entry.song.id])),
        ]
      }
      else {
        order = null
      }
      publish({ mode })
      queueChanged()
    },
    setQuality(quality) {
      if (quality === state.quality)
        return
      // 之前取的地址、在准备的下一首是原来的音质，不再用；正在放、正在换过去的那首照旧
      epoch += 1
      preparing += 1
      urls.clear()
      fetching.clear()
      if (incoming?.deck !== spare) {
        spare.song = null
        spare.url = null
      }
      publish({ quality })
      queueChanged()
    },
    dismissNotice() {
      publish({ notice: null })
    },
    adopt() {
      heard = 0
      soundingSince = state.status === 'playing'
        ? clock.now()
        : null
      savedQueue = null
      persist()
    },
    availabilityChanged() {
      if (state.current === null)
        return
      publish({})
      queueChanged()
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
    restore({ queue, progress }) {
      const current = queue.entries.findIndex(entry => entry.song.id === progress.songId)
      if (current === -1)
        throw new Error(`存着的当前这首（${progress.songId}）不在存着的播放队列里`)
      order = queue.order
      upNext = queue.upNext
      filling = queue.filling && {
        playlistId: queue.filling.playlistId,
        have: new Set(queue.filling.have),
      }
      heard = progress.listened
      soundingSince = null
      const restored = {
        position: progress.position,
        duration: progress.duration,
        trial: progress.trial,
        status: 'paused',
      } as const
      // 刚从本机读出来的，不用再存一遍
      savedQueue = {
        entries: queue.entries,
        mode: queue.mode,
        order,
        upNext,
        filling,
      }
      savedProgressKey = progressKey(progress.songId, restored)
      publish({
        queue: queue.entries,
        current,
        mode: queue.mode,
        ...restored,
        change: null,
        notice: null,
      })
    },
  }
}
