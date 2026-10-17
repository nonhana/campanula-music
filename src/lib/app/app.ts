import type { Account, AccountResponse } from '#lib/api/account.js'
import type { Song } from '#lib/api/library.js'
import type { LogoutResponse } from '#lib/api/login.js'
import type { PlaySource, Quality } from '#lib/api/playback.js'
import type { RequestFailure } from './api'
import type { BrowserCapabilities } from './browser'
import type { DailyState } from './daily'
import type { LibraryState, PlaylistSearch } from './library'
import type { PendingCheckIn } from './local'
import type { LoginState } from './login'
import type { LyricsState } from './lyrics'
import type { CheckIn, PlayerState, PlayMode } from './player'
import type { SearchState } from './search'
import { playable } from '#lib/api/library.js'
import { createApi } from './api'
import { createCheckIns } from './check-ins'
import { createDaily } from './daily'
import { createLibrary, searchPlaylist } from './library'
import { createLocalDb } from './local'
import { createLogin, INITIAL_LOGIN } from './login'
import { createLyrics } from './lyrics'
import { connectMediaSession } from './media-session'
import { createBackgroundLane } from './pacing'
import { createPlayer, INITIAL_PLAYER } from './player'
import { createSearch, INITIAL_SEARCH } from './search'

/**
 * 会改登录 Cookie 的请求排队用的跨标签页的锁：问当前账号（服务端可能在这一步续期、写回新的登录 Cookie）和退出。
 * 不排队的话，退出先回、续期后回，续期写回的登录 Cookie 会把刚退出的登录又带回来
 */
const LOGIN_COOKIE_LOCK = 'campanula:login-cookie'
/** 标签页之间同步登录会话的广播频道 */
const SESSION_CHANNEL = 'campanula:session'

/** 标签页之间广播的消息。只有同源的 Campanula 页面能发进这个频道 */
type SessionMessage
  /** 这个浏览器退出登录了 */
  = | { type: 'signedOut' }

/** 列表的播放来源：点一首歌时用整个列表替换播放队列（一次搜索不是列表，点歌是插播） */
type ListSource = Exclude<PlaySource, { kind: 'search' }>

/** 登录会话。刚打开时要先问服务端，才知道有没有当前账号 */
export type Session
  = | { status: 'checking' }
  /** 没问到当前账号，不知道有没有登录（网易云说需要登录时是 loginExpired，不在这里） */
    | { status: 'checkFailed', failure: Exclude<RequestFailure, { kind: 'needsLogin' }> }
    | { status: 'signedOut' }
  /** 浏览器里还有登录 Cookie，但网易云说登录已经失效 */
    | { status: 'loginExpired' }
    | { status: 'signedIn', account: Account }

export interface AppState {
  session: Session
  /** 登录页：扫码和短信验证码两种方式走到哪一步 */
  login: LoginState
  /** 曲库副本（ADR-0007）：登录了才有，先显示本机副本，再在后台同步 */
  library: LibraryState | null
  /** 播放队列和正在放的歌 */
  player: PlayerState
  /** 最近打开的那首歌的歌词：听众看歌词时才取 */
  lyrics: LyricsState | null
  /** 每日推荐：听众打开过才有，只在这次登录期间记着 */
  daily: DailyState | null
  /** 搜索：搜索历史（存在这台设备上）、建议、最后一次搜的词的单曲结果 */
  search: SearchState
}

/** 去掉界面的整个 App：界面读它的状态、把听众的操作交给它 */
export interface App {
  readonly state: AppState
  /** 状态变了就调 listener；返回取消订阅的函数 */
  subscribe: (listener: () => void) => () => void
  /** 打开 App：问服务端当前账号是谁。没问到时可以再调一次重试 */
  open: () => Promise<void>
  /** 显示一张新的登录二维码，查询扫码状态直到登录成功、过期或出错；也用来刷新、重试 */
  startQrLogin: () => Promise<void>
  /** 不再显示二维码（换成短信验证码、离开登录页）：停止查询 */
  stopQrLogin: () => void
  /** 网易云要求行为验证时，听众在手机上验证完了：再查一次扫码状态 */
  continueQrLogin: () => Promise<void>
  /** 给中国大陆手机号（+86）发短信验证码 */
  sendCaptcha: (phone: string) => Promise<void>
  loginWithCaptcha: (phone: string, captcha: string) => Promise<void>
  /**
   * 退出登录：App 马上当作未登录，删除本机的曲库副本和播放队列（设置留着）。服务端调网易云的退出、回过期的登录 Cookie；
   * 断网或服务端出错时 Cookie 删不掉，记下来，联网后、下次打开时再发（ADR-0003）
   */
  logout: () => Promise<void>
  /** 曲库同步没成功（连不上、网易云出错）时重试：从停下的地方接着同步 */
  retrySync: () => void
  /**
   * 打开一张歌单：本机还没有它最新、完整的曲目（没同步到、只同步了一部分），就马上用前台请求拉，不等后台同步。
   * 拉到哪了看 state.library.opening；没拉成时再调一次就是重试
   */
  openPlaylist: (playlistId: number) => Promise<void>
  /**
   * 歌单内搜索：在本机副本里即时完成。歌名、歌手、专辑都搜，不分大小写和全角半角；
   * 歌单还没同步全时结果标“可能不全”。不在歌单列表里的歌单是 null
   */
  searchPlaylist: (playlistId: number, query: string) => PlaylistSearch | null
  /**
   * 打开一张专辑：这次登录还没拉过就用前台请求拉曲目和简介，拉到哪了看 state.library.albumPage。
   * 收藏的专辑打开过就存在本机，再打开时先显示存着的、断网也能看；没拉成时再调一次就是重试
   */
  openAlbum: (albumId: number) => Promise<void>
  /** 打开一位歌手：这次登录还没拉过就用前台请求拉，拉到哪了看 state.library.artistPage；没拉成时再调一次就是重试 */
  openArtist: (artistId: number) => Promise<void>
  /** 歌手页取后面的一页专辑；没取成时再调一次就是重试 */
  moreArtistAlbums: (artistId: number) => Promise<void>
  /**
   * 打开每日推荐：今天这份（网易云北京时间 6:00 换）还没拉过就用前台请求拉，拉到哪了看 state.daily。
   * 只在这次登录期间记着、不存本机，断网时没拉成；没拉成时再调一次就是重试
   */
  openDaily: () => Promise<void>
  /** 搜索框里的字变了（边输入边给建议）：停手一会儿才问网易云，只要最后打的词的建议，看 state.search.suggestions；空的就收起 */
  suggest: (keyword: string) => void
  /** 按搜索（回车、点“搜索”、点建议或搜索历史里的词）：把词记进搜索历史（存在这台设备上），打开这个词的单曲结果 */
  search: (keyword: string) => Promise<void>
  /**
   * 打开一个词的单曲结果（结果页）：这个词的结果显示着、正在拉就不再拉，否则用前台请求拉，拉到哪了看 state.search.results。
   * 只记着最后一次搜的词的；没拉成时再调一次就是重试
   */
  openSearch: (keyword: string) => Promise<void>
  /** 清空搜索历史，这台设备上存的也删 */
  clearSearchHistory: () => Promise<void>
  /**
   * 点一首歌（点歌规则，Spec #11）：
   * - 在列表里点：用整个列表（歌单、专辑的曲目、歌手的热门歌曲、每日推荐）替换播放队列，从这首开始放。
   *   歌单还没同步全时先用已经同步的部分，同步全了把后面的补上（规则⑫）；
   * - 在搜索结果里点：插播这一首（见 interject），播放队列其余的不变，播放来源是这次搜索。
   * 无版权的歌不能点
   */
  play: (source: PlaySource, songId: number) => void
  /** 播放全部：和点列表里第一首能放的歌（不是无版权的）一样。一首能放的都没有就什么都不做。搜索结果没有播放全部 */
  playAll: (source: PlaySource) => void
  /** 在放就暂停，停着就接着放（出了问题停下时就是重试） */
  togglePlay: () => void
  next: () => void
  previous: () => void
  /** 在播放队列里点一首：放这一首，播放队列不变。正在放的那首、无版权的不动 */
  playFromQueue: (index: number) => void
  /**
   * 下一首播放（GLOSSARY）：排在当前这首后面，等它放完再放；连续几次时后加的先放（规则⑤），随机模式下也是下一首（规则③）。
   * source 是这首歌的播放来源。播放队列是空的就直接开始放（规则①）
   */
  playNext: (source: PlaySource, song: Song) => void
  /** 加入播放队列：排到最后，随机模式下也最后放（规则③）。播放队列是空的就直接开始放（规则①） */
  addToQueue: (source: PlaySource, song: Song) => void
  /** 插播（GLOSSARY，入口在搜索里）：排在当前这首后面并立即播放；被打断的那首不续播（规则④） */
  interject: (source: PlaySource, song: Song) => void
  /** 从播放队列移出第 index 首（播放队列面板）。正在放的那首移不掉 */
  removeFromQueue: (index: number) => void
  /** 清空播放队列（播放队列面板）：停下，播放条收起 */
  clearQueue: () => void
  /**
   * 换播放模式：列表循环、单曲循环（放完从头再放这首，按下一首照样换歌）、随机播放（另排一份播放顺序，播放队列的先后不变）。
   * 换成随机播放时当前这首和还没放到的“下一首播放”留在最前
   */
  setPlayMode: (mode: PlayMode) => void
  /** 当前这首跳到第 position 秒（波浪进度条）：在放就从那里接着放，停着就等按播放；超出的算开头、结尾 */
  seek: (position: number) => void
  /** 当前这首从第 position 秒开始放（点歌词的一行）：停着的也接着放 */
  playFrom: (position: number) => void
  /** 音量，0 到 1 */
  setVolume: (volume: number) => void
  /** 换在线播放音质（设置页）：存在这台设备上，退出、换账号都不变。从下一首起生效，正在放的那首照旧放完 */
  setPlayQuality: (quality: Quality) => void
  /** 关掉播放的提示 */
  dismissPlayerNotice: () => void
  /** 看这首歌的歌词（播放页上显示歌词时）：已经取到、正在取就不再取，拉到哪了看 state.lyrics；没取成时再调一次就是重试 */
  openLyrics: (songId: number) => Promise<void>
}

export function createApp(browser: BrowserCapabilities): App {
  const api = createApi(browser)
  const local = createLocalDb(browser.indexedDB)
  let state: AppState = { session: { status: 'checking' }, login: INITIAL_LOGIN, library: null, player: INITIAL_PLAYER, lyrics: null, daily: null, search: INITIAL_SEARCH }
  const listeners = new Set<() => void>()

  function update(next: Partial<AppState>) {
    state = { ...state, ...next }
    for (const listener of listeners)
      listener()
  }

  /**
   * 还没发出去的退出：发出去，服务端回了过期的登录 Cookie 才算完。没发成时返回原因：
   * 这时浏览器里还留着上一个登录 Cookie，不能接着登录，否则之后补发的退出会把新的登录也退掉
   */
  let finishingLogout: Promise<RequestFailure | null> | undefined
  function finishLogout(): Promise<RequestFailure | null> {
    finishingLogout ??= browser.locks.request(LOGIN_COOKIE_LOCK, async () => {
      if (!await local.pendingLogout())
        return null
      // 退出了：还没发出去的打卡都丢弃，之后同一个账号再登录也不补发
      await local.clearCheckIns()
      const result = await api.post<LogoutResponse>('/api/logout')
      if (!result.ok)
        return result.failure
      await local.setPendingLogout(false)
      return null
    }).finally(() => {
      finishingLogout = undefined
    })
    return finishingLogout
  }
  browser.network.addEventListener('online', () => void finishLogout())

  /**
   * 播放队列是哪个网易云账号的：登录时定下，登录失效时不变，退出时清掉。
   * 登录失效后换了别的账号登录就清空播放队列（规则⑩）；只有登录了才能放歌，所以播放队列不空时它一定不是 null
   */
  let queueOwner: number | null = null

  const lane = createBackgroundLane(browser)
  const checkIns = createCheckIns({
    api,
    lane,
    local,
    locks: browser.locks,
    account: () => (state.session.status === 'signedIn' ? state.session.account.id : null),
    loginExpired,
  })
  /** 听完的歌记成播放队列的账号的打卡；没登录（退出了）时不打卡 */
  function withOwner(finished: readonly CheckIn[]): PendingCheckIn[] {
    const owner = queueOwner
    return owner === null ? [] : finished.map(checkIn => ({ ...checkIn, owner }))
  }
  /** 有新的打卡记进本机了：发出去 */
  function sendRecorded(pending: readonly PendingCheckIn[]): void {
    if (pending.length > 0)
      checkIns.send()
  }

  const player = createPlayer({
    api,
    clock: browser.clock,
    audio: browser.audio,
    write: (next) => {
      update({ player: next })
      showOnLockScreen(next)
    },
    save(progress, queue, finished) {
      if (queue && queueOwner === null)
        throw new Error('播放队列不属于任何网易云账号：只有登录了才能放歌')
      const pending = withOwner(finished)
      void local.savePlayer(progress, queue && { ...queue, owner: queueOwner! }, pending).then(() => sendRecorded(pending))
    },
    forget(finished) {
      const pending = withOwner(finished)
      void local.deletePlayer(pending).then(() => sendRecorded(pending))
    },
    loginExpired,
  })
  const lockScreen = connectMediaSession({ session: browser.mediaSession, MediaMetadata: browser.MediaMetadata, clock: browser.clock, player, read: () => state.player })
  /** 锁屏和通知栏上显示的跟着播放状态变。写成函数声明：锁屏的按钮要用播放器，播放器发布时又要用锁屏，两边互相引用 */
  function showOnLockScreen(next: PlayerState): void {
    lockScreen(next)
  }

  const library = createLibrary({
    api,
    lane,
    local,
    write: (next) => {
      update({ library: next })
      player.libraryChanged(next.songsOf)
    },
    loginExpired,
  })

  const lyrics = createLyrics({
    api,
    read: () => state.lyrics,
    write: next => update({ lyrics: next }),
    loginExpired,
  })

  const daily = createDaily({
    api,
    clock: browser.clock,
    read: () => state.daily,
    write: next => update({ daily: next }),
    loginExpired,
  })

  const search = createSearch({
    api,
    clock: browser.clock,
    local,
    read: () => state.search,
    write: next => update({ search: next }),
    loginExpired,
  })

  const login = createLogin({
    api,
    clock: browser.clock,
    page: browser.page,
    beforeLogin: finishLogout,
    read: () => state.login,
    write: next => update({ login: next }),
    signedIn,
  })

  /** 每换一次登录状态（登录、退出、登录失效）就加一：之前发出去的问账号、拿曲库副本回来时，结果就不要了 */
  let sessions = 0
  function signedOut(): void {
    sessions += 1
    login.stopQr()
    library.leave()
    // 先放下账号再停：没登录时听完的歌不打卡（主动退出的那个标签页在这之前已经把最后一首记下了）
    queueOwner = null
    player.stop()
    lyrics.clear()
    daily.clear()
    search.clear()
    update({ session: { status: 'signedOut' }, login: INITIAL_LOGIN, library: null })
  }

  /** 点歌时的整个列表；还没打开、没显示出来时是 null */
  function listOf(source: ListSource): { songs: readonly Song[], complete: boolean } | null {
    const shown = state.library
    if (!shown)
      return null
    switch (source.kind) {
      case 'playlist':
        return shown.songsOf(source.id)
      case 'album': {
        const page = shown.albumPage(source.id)
        return page?.status === 'shown' ? { songs: page.content.songs, complete: true } : null
      }
      case 'artist': {
        const page = shown.artistPage(source.id)
        return page?.status === 'shown' ? { songs: page.content.hotSongs, complete: true } : null
      }
      case 'daily':
        return state.daily?.status === 'shown' ? { songs: state.daily.songs, complete: true } : null
      default: {
        const unhandled: never = source
        throw new Error(`不认识的播放来源：${JSON.stringify(unhandled)}`)
      }
    }
  }

  /** 这次搜索的单曲结果里的这一首；结果不是这个词的、还没显示出来时是 undefined */
  function searchedSong(keyword: string, songId: number): Song | undefined {
    const results = state.search.results
    return results?.status === 'shown' && results.keyword === keyword ? results.songs.find(song => song.id === songId) : undefined
  }

  /** 网易云说需要登录、续期也没成功：停下同步，曲库副本留在本机，同一个账号重新登录后接着用 */
  function loginExpired(): void {
    sessions += 1
    library.leave()
    lyrics.clear()
    daily.clear()
    search.clear()
    update({ session: { status: 'loginExpired' }, library: null })
  }

  /**
   * 登录了：先拿出这个账号的曲库副本，和登录状态一起显示，再在后台同步。
   * 播放队列：同一个账号接着用；这次打开后第一次登录时恢复本机存着的；别的账号的清空（规则⑩）
   */
  async function signedIn(account: Account): Promise<void> {
    sessions += 1
    const mine = sessions
    const [shown, stored, quality, history] = await Promise.all([library.enter(account), local.readPlayer(), local.playQuality(), local.searchHistory()])
    if (mine !== sessions)
      return
    if (quality)
      player.setQuality(quality)
    if (queueOwner !== account.id) {
      // 播放地址按账号给（会员和非会员不一样）：上一个账号取的不能接着用，所以不只是清空播放队列
      if (queueOwner !== null)
        player.stop()
      queueOwner = account.id
      if (stored?.owner === account.id)
        player.restore(stored.saved)
      else if (stored)
        void local.deletePlayer()
    }
    update({ session: { status: 'signedIn', account }, login: INITIAL_LOGIN, library: shown, search: { ...state.search, history } })
    library.sync()
    // 登录失效期间、断网时记下的打卡补发给这个账号；别的账号的丢弃
    checkIns.send()
  }

  // 一个标签页退出，同一浏览器里开着的其他标签页跟着变成未登录（退出请求由退出的那个标签页发）
  const sessionChannel = browser.broadcastChannel(SESSION_CHANNEL)
  sessionChannel.addEventListener('message', (event) => {
    const message = event.data as SessionMessage
    switch (message.type) {
      case 'signedOut':
        return signedOut()
      default: {
        const unhandled: never = message.type
        throw new Error(`不认识的广播消息：${JSON.stringify(unhandled)}`)
      }
    }
  })

  /** 问服务端当前账号是谁；没问到时说明原因 */
  async function checkAccount(): Promise<Session> {
    const result = await api.get<AccountResponse>('/api/account')
    if (result.ok)
      return result.value.account ? { status: 'signedIn', account: result.value.account } : { status: 'signedOut' }
    if (result.failure.kind === 'needsLogin')
      return { status: 'loginExpired' }
    return { status: 'checkFailed', failure: result.failure }
  }

  return {
    get state() {
      return state
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async open() {
      update({ session: { status: 'checking' } })
      if (await local.pendingLogout()) {
        await finishLogout()
        update({ session: { status: 'signedOut' } })
        return
      }
      // 服务端在这一步里续期（满 24 小时、或网易云说需要登录时）。同一浏览器的标签页排队问：
      // 前一个续期拿到的新登录 Cookie，后一个直接带上，不会再续一次
      const asked = sessions
      const session = await browser.locks.request(LOGIN_COOKIE_LOCK, checkAccount)
      if (sessions !== asked)
        return
      if (session.status === 'signedIn')
        return signedIn(session.account)
      update({ session })
    },
    startQrLogin: login.startQr,
    stopQrLogin: login.stopQr,
    continueQrLogin: login.continueQr,
    sendCaptcha: login.sendCaptcha,
    loginWithCaptcha: login.loginWithCaptcha,
    async logout() {
      await local.setPendingLogout(true)
      // 正在放的那首算结束：播放队列还是这个账号的时候停下，它的打卡记下来，删曲库副本和播放队列之前先发出去
      const owner = queueOwner
      player.stop()
      signedOut()
      sessionChannel.postMessage({ type: 'signedOut' } satisfies SessionMessage)
      if (owner !== null)
        await checkIns.sendBeforeLogout(owner)
      await Promise.all([local.deleteLibrary(), local.deletePlayer()])
      await finishLogout()
    },
    retrySync: library.retry,
    openPlaylist: library.open,
    searchPlaylist(playlistId, query) {
      const playlist = state.library?.songsOf(playlistId)
      return playlist ? searchPlaylist(playlist, query) : null
    },
    openAlbum: library.openAlbum,
    openArtist: library.openArtist,
    moreArtistAlbums: library.moreArtistAlbums,
    openDaily: daily.open,
    suggest: search.suggest,
    search: search.search,
    openSearch: search.open,
    clearSearchHistory: search.clearHistory,
    play(source, songId) {
      if (source.kind === 'search') {
        const song = searchedSong(source.keyword, songId)
        if (song)
          player.interject(source, song)
        return
      }
      const list = listOf(source)
      if (list)
        player.play(source, list.songs, songId, list.complete)
    },
    playAll(source) {
      if (source.kind === 'search')
        throw new Error('搜索结果没有播放全部：在搜索里点歌是插播')
      const list = listOf(source)
      const first = list?.songs.find(playable)
      if (list && first)
        player.play(source, list.songs, first.id, list.complete)
    },
    togglePlay: player.toggle,
    next: player.next,
    previous: player.previous,
    playFromQueue: player.jump,
    playNext: player.playNext,
    addToQueue: player.addToQueue,
    interject: player.interject,
    removeFromQueue: player.removeFromQueue,
    clearQueue: player.clearQueue,
    setPlayMode: player.setMode,
    seek: player.seek,
    playFrom: player.playFrom,
    setVolume: player.setVolume,
    setPlayQuality(quality) {
      player.setQuality(quality)
      void local.savePlayQuality(quality)
    },
    dismissPlayerNotice: player.dismissNotice,
    openLyrics: lyrics.open,
  }
}
