import type { Account, AccountResponse } from '$lib/api/account'
import type { Song } from '$lib/api/library'
import type { LogoutResponse } from '$lib/api/login'
import type { RequestFailure } from './api'
import type { BrowserCapabilities } from './browser'
import type { LibraryState, PlaylistSearch } from './library'
import type { LoginState } from './login'
import type { PlayerState, PlaySource } from './player'
import { createApi } from './api'
import { createLibrary, searchPlaylist } from './library'
import { createLocalDb } from './local'
import { createLogin, INITIAL_LOGIN } from './login'
import { createBackgroundLane } from './pacing'
import { createPlayer, INITIAL_PLAYER } from './player'

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
   * 退出登录：App 马上当作未登录。服务端调网易云的退出、回过期的登录 Cookie；
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
   * 在列表里点一首歌：用整个列表（歌单、专辑的曲目、歌手的热门歌曲）替换播放队列，从这首开始放。
   * 歌单还没同步全时先用已经同步的部分，同步全了把后面的补上（规则⑫）。无版权的歌不能点
   */
  play: (source: PlaySource, songId: number) => void
  /** 在放就暂停，停着就接着放（出了问题停下时就是重试） */
  togglePlay: () => void
  next: () => void
  previous: () => void
  /** 音量，0 到 1 */
  setVolume: (volume: number) => void
  /** 关掉播放的提示 */
  dismissPlayerNotice: () => void
}

export function createApp(browser: BrowserCapabilities): App {
  const api = createApi(browser)
  const local = createLocalDb(browser.indexedDB)
  let state: AppState = { session: { status: 'checking' }, login: INITIAL_LOGIN, library: null, player: INITIAL_PLAYER }
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

  const player = createPlayer({
    api,
    clock: browser.clock,
    audio: browser.audio,
    write: next => update({ player: next }),
    loginExpired,
  })

  const lane = createBackgroundLane(browser)
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
    player.stop()
    update({ session: { status: 'signedOut' }, login: INITIAL_LOGIN, library: null })
  }

  /** 点歌时的整个列表；还没打开、没显示出来时是 null */
  function listOf(source: PlaySource): { songs: readonly Song[], complete: boolean } | null {
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
      default: {
        const unhandled: never = source.kind
        throw new Error(`不认识的播放来源：${JSON.stringify(unhandled)}`)
      }
    }
  }

  /** 网易云说需要登录、续期也没成功：停下同步，曲库副本留在本机，同一个账号重新登录后接着用 */
  function loginExpired(): void {
    sessions += 1
    library.leave()
    update({ session: { status: 'loginExpired' }, library: null })
  }

  /** 登录了：先拿出这个账号的曲库副本，和登录状态一起显示，再在后台同步 */
  async function signedIn(account: Account): Promise<void> {
    sessions += 1
    const mine = sessions
    const shown = await library.enter(account)
    if (mine !== sessions)
      return
    update({ session: { status: 'signedIn', account }, login: INITIAL_LOGIN, library: shown })
    library.sync()
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
      signedOut()
      await local.deleteLibrary()
      sessionChannel.postMessage({ type: 'signedOut' } satisfies SessionMessage)
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
    play(source, songId) {
      const list = listOf(source)
      if (list)
        player.play(source, list.songs, songId, list.complete)
    },
    togglePlay: player.toggle,
    next: player.next,
    previous: player.previous,
    setVolume: player.setVolume,
    dismissPlayerNotice: player.dismissNotice,
  }
}
