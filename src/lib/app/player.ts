import type { Song } from '$lib/api/library'
import type { PlayUrlResponse, Quality } from '$lib/api/playback'
import type { Api, RequestFailure } from './api'
import type { AudioCapability, Clock } from './browser'
import type { PlaylistSongs } from './library'

// 播放队列与播放（Spec #11“客户端：播放队列与播放”）。
// 两个播放器轮流放（ADR-0010）：换歌时在空闲的那个上放，它出声了再停旧的，换歌的过程中一直有一个在放。
// 当前这首出声后，空闲的那个先取好下一首的播放地址、缓冲着；当前这首快放完时它开始放（交接）。
// 播放地址约 20 分钟过期：暂停很久后再放、或者放着放着过期了，重新取地址，从原来的位置接着放。
// 播放模式（#26）之前只有列表循环。

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
}

export const INITIAL_PLAYER: PlayerState = { queue: [], current: null, status: 'paused', position: 0, duration: null, trial: false, volume: 1, notice: null, change: null }

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
  /** 曲库变了：点歌时还没同步全的歌单同步全了，就把还没进播放队列的歌补到最后（规则⑫） */
  libraryChanged: (songsOf: (playlistId: number) => PlaylistSongs | null) => void
  /** 在放就暂停，停着就接着放 */
  toggle: () => void
  next: () => void
  previous: () => void
  /** 放播放队列里的第 index 首，播放队列不变。正在放的那首、无版权的不动 */
  jump: (index: number) => void
  /** 当前这首跳到第 position 秒（超出的算开头、结尾）：在放就从那里接着放，停着就等按播放 */
  seek: (position: number) => void
  /** 当前这首从第 position 秒开始放：跳过去，停着的也接着放（点歌词的一行） */
  playFrom: (position: number) => void
  setVolume: (volume: number) => void
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

/** 正在换过去的播放器：放的是播放队列里的第 index 首，出声了就停掉旧的。handover：当前这首快放完了自动换（当前这首还没换过去） */
interface Incoming {
  deck: Deck
  index: number
  handover: boolean
}

function durationOf(deck: Deck): number | null {
  return Number.isFinite(deck.audio.duration) ? deck.audio.duration : null
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
  /** 点歌时这张歌单还没同步全：同步全了把后面的补上（规则⑫） */
  let filling: number | null = null
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

  function publish(next: Partial<PlayerState>): void {
    state = { ...state, ...next }
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

  /** 从第 from 首往后（step 1）或往前（-1）数，第一首能放的；列表循环，转一圈回到 from 自己也算。一首能放的都没有是 null */
  function playableFrom(from: number, step: 1 | -1): number | null {
    const { queue } = state
    for (let offset = 1; offset <= queue.length; offset += 1) {
      const index = ((from + step * offset) % queue.length + queue.length) % queue.length
      if (playable(queue[index]))
        return index
    }
    return null
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
          return skip(index)
        url = fetched.url
      }
      load(spare, song, url)
    }
    // 不读 state.position：单曲的播放队列换到自己时，旧的播放器放的是同一首，取地址期间它还在报进度
    spare.audio.currentTime = startAt
    incoming = { deck: spare, index, handover: false }
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

  /** 网易云没给第 index 首的播放地址：跳过它放下一首能放的 */
  function skip(index: number): void {
    const { song } = state.queue[index]
    unavailable.add(song.id)
    const next = playableFrom(index, 1)
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
    const index = playableFrom(state.current, 1)
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
    const next = playableFrom(state.current, 1)
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
    incoming = { deck: spare, index: next, handover: true }
    play(spare)
  }

  /** 正在换过去的播放器出声了：停掉旧的，它就是当前的。快放完时交接的，这时才换成下一首 */
  function arrived({ deck, index, handover }: Incoming): void {
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
    publish({ current: index, status: 'playing', position: deck.audio.currentTime, duration: durationOf(deck), trial: deck.url!.trial, notice: noticeAfterSounding(), change: handover ? 'continue' : state.change })
    void prepareNext()
  }

  /** 当前这首放完了 */
  function ended(): void {
    if (state.current === null)
      return
    if (incoming?.handover) {
      // 交接中、下一首还没出声：它就是当前这首了，等它出声
      incoming = { ...incoming, handover: false }
      publish({ current: incoming.index, status: 'buffering', position: 0, duration: durationOf(incoming.deck), trial: incoming.deck.url!.trial, change: 'continue' })
      startSlow()
      return
    }
    if (incoming)
      return
    const next = playableFrom(state.current, 1)
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

  return {
    play(source, songs, songId, complete) {
      const index = songs.findIndex(song => song.id === songId)
      if (index === -1 || songs[index].availability === 'noCopyright')
        return
      unavailable.clear()
      filling = complete ? null : source.id
      publish({ queue: songs.map(song => ({ song, source })) })
      void start(index, 0, 'pick')
    },
    libraryChanged(songsOf) {
      if (filling === null)
        return
      const playlist = songsOf(filling)
      if (playlist && !playlist.complete)
        return
      filling = null
      if (!playlist || state.current === null)
        return
      // 按歌单的顺序重排：已经同步的部分不一定在歌单最前面（别的歌单里同步过的歌也有歌曲信息）。
      // 播放队列现在只能由点歌整个替换，里面都是这张歌单的歌；当前这首、正在换过去的那首按编号找回位置
      const indexOf = (index: number) => playlist.songs.findIndex(song => song.id === state.queue[index].song.id)
      const current = indexOf(state.current)
      const handingTo = incoming && indexOf(incoming.index)
      // 它们同步时在网易云里从歌单删掉了：播放队列不动
      if (current === -1 || handingTo === -1)
        return
      if (incoming && handingTo !== null)
        incoming = { ...incoming, index: handingTo }
      const source: PlaySource = { kind: 'playlist', id: playlist.playlist.id }
      publish({ queue: playlist.songs.map(song => ({ song, source })), current })
      // 下一首可能变了；正在换歌时等新的出声后再准备（不能在正要出声的播放器上换地址）
      prepared = false
      if (!incoming && state.status === 'playing')
        void prepareNext()
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
      if (index !== null)
        void start(index, 0, 'previous')
    },
    jump(index) {
      const entry = state.queue[index]
      if (entry && index !== state.current && entry.song.availability !== 'noCopyright')
        void start(index, 0, 'pick')
    },
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
    dismissNotice() {
      publish({ notice: null })
    },
    stop() {
      attempt += 1
      preparing += 1
      epoch += 1
      handoverFailed = false
      filling = null
      pauseAll()
      for (const each of [active, spare]) {
        each.song = null
        each.url = null
      }
      unavailable.clear()
      urls.clear()
      fetching.clear()
      publish({ ...INITIAL_PLAYER, volume: state.volume })
    },
  }
}
