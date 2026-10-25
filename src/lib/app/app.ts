import type { Account } from '#lib/api/account.js'
import type { CoverCrop } from '#lib/api/cover.js'
import { endpoints } from '#lib/api/endpoints.js'
import type { CollectedAlbum, CollectedArtist, CreatePlaylistRequest, Playlist, Song } from '#lib/api/library.js'
import type { PlaySource, Quality } from '#lib/api/playback.js'
import type { SearchedItems, SearchKind } from '#lib/api/search.js'

import type { RequestFailure, Result } from './api-client'
import { createApi } from './api-client'
import type { BrowserCapabilities } from './browser'
import type { PlaylistEdit, PlaylistSeed } from './changes'
import { changeProblem, playlistEdits } from './changes'
import type { CheckIns } from './check-ins'
import { createCheckIns } from './check-ins'
import type { CoverOutcome, CoverState } from './cover'
import { createCover } from './cover'
import type { DailyState } from './daily'
import { createDaily } from './daily'
import type { DownloadBlock, DownloadsState } from './downloads'
import { createDownloads, downloadBlock as downloadBlockFor, INITIAL_DOWNLOADS } from './downloads'
import type { ExportState } from './export'
import { createExports } from './export'
import type { AddSongsOutcome, AddTarget, AddTargetsRequest, CreateOutcome, Library, LibraryState, PlaylistSearch } from './library'
import { createLibrary, filterSongs, searchPlaylist } from './library'
import { createLocalDatabase, createLocalDb } from './local'
import type { LoginState } from './login'
import { createLogin, INITIAL_LOGIN } from './login'
import type { LyricsState } from './lyrics'
import { createLyrics } from './lyrics'
import { connectMediaSession } from './media-session'
import type { NoticeAction } from './notice'
import { createNotices, noticeActions } from './notice'
import { createBackgroundLane } from './pacing'
import type { Player, PlayerState, PlayMode } from './player'
import { createPlayer, INITIAL_PLAYER } from './player'
import { createSavedQueue } from './saved-queue'
import type { SearchState } from './search'
import { createSearch, INITIAL_SEARCH } from './search'
import type { Session } from './session-round'
import { createSessionRound } from './session-round'

/** 会改登录 Cookie 的请求排队用的跨标签页锁：不排队的话，退出先回、续期后回，续期写回的 Cookie 会把刚退出的登录又带回来 */
const LOGIN_COOKIE_LOCK = 'campanula:login-cookie'
const SESSION_CHANNEL = 'campanula:session'

/** 只有同源的 Campanula 页面能发进这个频道 */
type SessionMessage
  = | { type: 'signedOut' }

/** 点一首歌时用整个列表替换播放队列；一次搜索不是列表，点歌是插播 */
type ListSource = Exclude<PlaySource, { kind: 'search' }>

export interface CollectTarget {
  kind: 'playlist' | 'album' | 'artist'
  id: number
}

/** App 自己决定什么时候去拉、副本到了要不要重拉、歌单进出曲库时怎么切换；页面只报告在看什么 */
type ViewedPage
  = | { kind: 'playlist', id: number }
    | { kind: 'album', id: number }
    | { kind: 'artist', id: number }
    | { kind: 'daily' }
    | { kind: 'search', keyword: string }

export interface AppState {
  session: Session
  login: LoginState
  /** 曲库副本（ADR-0007）：登录了才有，先显示本机副本，再在后台同步 */
  library: LibraryState | null
  player: PlayerState
  lyrics: LyricsState | null
  /** 只在这次登录期间记着 */
  daily: DailyState | null
  /** 搜索历史存在这台设备上，退出、换账号都不删 */
  search: SearchState
  /** 属于设备，没登录时也有（#38） */
  downloads: DownloadsState
  /** 浏览器能选文件夹（ADR-0014）：不能时不显示“导出” */
  readonly exportable: boolean
  /** 这一次导出（#79）：选好文件夹以后到听众看完结果；没在导出是 null */
  exporting: ExportState | null
  cover: CoverState | null
  /** 联网着（navigator.onLine）：断网时没下载的歌放不了（#38） */
  online: boolean
  /** 这首歌现在能不能放：下载了的永远能放（ADR-0006）；没下载的要能在线放（联网、登录着），无版权不能放 */
  readonly playable: (song: Song) => boolean
  /** 这首歌现在能不能下载、为什么不能：和 App.download 用同一份规则，界面照着写“下载”那一项 */
  readonly downloadBlock: (song: Song) => DownloadBlock | null
}

/** 去掉界面的整个 App：界面读它的状态、把听众的操作交给它 */
export interface App {
  readonly state: AppState
  subscribe: (listener: () => void) => () => void
  /** 问服务端当前账号是谁；没问到时可以再调一次重试 */
  open: () => Promise<void>
  /** 显示一张新的二维码并查询扫码状态直到登录成功、过期或出错；也用来刷新、重试 */
  startQrLogin: () => Promise<void>
  /** 换成短信验证码、离开登录页时停止查询 */
  stopQrLogin: () => void
  /** 听众在手机上验证完了：再查一次扫码状态 */
  continueQrLogin: () => Promise<void>
  sendCaptcha: (phone: string) => Promise<void>
  loginWithCaptcha: (phone: string, captcha: string) => Promise<void>
  /** App 马上当作未登录，删除本机的曲库副本和播放队列（设置留着）；断网或服务端出错时 Cookie 删不掉，记下来，联网后、下次打开时再发（ADR-0003） */
  logout: () => Promise<void>
  /** 从停下的地方接着同步 */
  retrySync: () => void
  /** 返回的函数在离开时调用（页面里写 `$effect(() => view.app.viewing(...))`）；离开歌单时提交还没提交的移除和排序（页面隐藏时 deferred 自己也会提交） */
  viewing: (page: ViewedPage) => () => void
  /** 本机还没有它最新、完整的曲目就用前台请求拉，不等后台同步；不在曲库里的歌单每次打开都联网取，不存本机（ADR-0007） */
  openPlaylist: (playlistId: number) => Promise<void>
  /** 在本机副本（不在曲库里的歌单是打开时取到的歌）里即时完成；还没同步全时结果标“可能不全”，不认识这张歌单时是 null */
  searchPlaylist: (playlistId: number, query: string) => PlaylistSearch | null
  /** 这次登录还没拉过就用前台请求拉；收藏的专辑打开过就存在本机，再打开先显示存着的、断网也能看 */
  openAlbum: (albumId: number) => Promise<void>
  /** 这次登录还没拉过就用前台请求拉 */
  openArtist: (artistId: number) => Promise<void>
  moreArtistAlbums: (artistId: number) => Promise<void>
  /** 今天这份（网易云北京时间 6:00 换）还没拉过就用前台请求拉；只在这次登录期间记着、不存本机 */
  openDaily: () => Promise<void>
  /** 停手一会儿才问网易云，只要最后打的词的建议；空的就收起 */
  suggest: (keyword: string) => void
  /** 把词记进搜索历史（存在这台设备上），打开这个词的结果 */
  search: (keyword: string) => Promise<void>
  /** 四类的第一页一起用前台请求拉；只记着最后一次搜的词的，结果记着时只重拉第一页没拉成的那几类 */
  openSearch: (keyword: string) => Promise<void>
  moreSearchResults: (keyword: string, kind: SearchKind) => Promise<void>
  /** 这台设备上存的也删 */
  clearSearchHistory: () => Promise<void>
  /**
   * 点歌规则（Spec #11）：列表里点用整个列表替换播放队列，还没同步全的先放已有的、有全了补上（规则⑫）；
   * 搜索结果里点是插播，排在当前这首后面并立即播放（规则④）。现在放不了的歌不能点（无版权；断网、没登录时没下载的，#38）
   */
  play: (source: PlaySource, songId: number) => void
  /** 和点列表里第一首现在能放的歌一样；一首能放的都没有就什么都不做。搜索结果没有播放全部 */
  playAll: (source: PlaySource) => void
  /** 出了问题停下时就是重试 */
  togglePlay: () => void
  next: () => void
  previous: () => void
  /** 播放队列不变；正在放的那首、现在放不了的不动 */
  playFromQueue: (index: number) => void
  /** 排在当前这首后面，连续几次时后加的先放（规则⑤），随机模式下也是下一首（规则③）；队列空就直接开始放（规则①） */
  playNext: (source: PlaySource, song: Song) => void
  /** 排到最后，随机模式下也最后放（规则③）；队列空就直接开始放（规则①） */
  addToQueue: (source: PlaySource, song: Song) => void
  /** 正在放的那首移不掉 */
  removeFromQueue: (index: number) => void
  /** 停下，播放条收起 */
  clearQueue: () => void
  /** 单曲循环放完从头再放这首、按下一首照样换歌；随机播放另排一份顺序、播放队列的先后不变，当前这首和“下一首播放”留在最前 */
  setPlayMode: (mode: PlayMode) => void
  /** 在放就从那里接着放，停着就等按播放；超出的算开头、结尾 */
  seek: (position: number) => void
  /** 点歌词的一行：停着的也接着放 */
  playFrom: (position: number) => void
  setVolume: (volume: number) => void
  /** 存在这台设备上，退出、换账号都不变；从下一首起生效，正在放的那首照旧放完 */
  setPlayQuality: (quality: Quality) => void
  dismissPlayerNotice: () => void
  /** 已经取到、正在取就不再取 */
  openLyrics: (songId: number) => Promise<void>
  /** 先改本地、立即生效，再提交；没改成时改回原样。断网时不改，直接说没改成（规则⑨） */
  heart: (song: Song, hearted: boolean) => Promise<void>
  /** 自建歌单，或我喜欢的音乐（等于红心）；先改本地，成了提示“已加入”，歌单已经不在了就改回原样并马上同步 */
  addToPlaylist: (playlistId: number, song: Song) => Promise<void>
  /** 一个请求带上全部编号；已经在歌单里的不再提交，全都已经在里面时什么都不发 */
  addSongsToPlaylist: (playlistId: number, songs: readonly Song[]) => Promise<AddSongsOutcome>
  /** 单曲从我喜欢的音乐（在最前）和自建歌单里选；多选只有当前歌单以外的自建歌单（Spec #11 #98）。界面照着画，歌单列表还没拿到时是 null */
  addTargets: (request: AddTargetsRequest) => AddTarget[] | null
  /** 先从本地拿掉，提示条留 5 秒撤销，没撤销才提交；失败放回原位、可以重试。不是自建歌单时抛错，断网时不改本地 */
  removeFromPlaylist: (playlistId: number, songIds: readonly number[]) => void
  /** 把勾选的几首挪到 before 前（null 是最后），停手 2 秒才把整张歌单的新顺序一次提交，页面隐藏、离开时立即提交；只有自建歌单和我喜欢的音乐能排（#36） */
  moveSongs: (playlistId: number, songIds: readonly number[], before: number | null) => boolean
  /** 只收全部自建歌单的新先后，我喜欢的音乐由 App 放在最前、收藏的不传（#37）；停手 2 秒才提交，页面隐藏时立即提交 */
  orderPlaylists: (playlistIds: readonly number[]) => boolean
  /** 还没提交的移除和排序立即提交（页面隐藏时 App 自己会做） */
  flushPlaylist: (playlistId: number) => Promise<void>
  /** 只要网易云的第一页，不记搜索历史、不动搜索结果页 */
  searchSongs: (keyword: string) => Promise<Result<readonly Song[]>>
  /** 曲库里的、打开着的页和搜索结果里的都行；先改本地，收藏歌单时先现取反作弊令牌。收藏了打开着的不在曲库里的歌单，它连同取到的曲目进曲库 */
  collect: (target: CollectTarget, collected: boolean) => Promise<void>
  /** 不先改本地：等网易云建好（给了编号）才进曲库，排在我喜欢的音乐后面；带着 songs 时建好接着一次加进去。退出、登录失效时是 null */
  createPlaylist: (draft: CreatePlaylistRequest, songs?: readonly Song[]) => Promise<CreateOutcome | null>
  /** 和现在一样的不提交；有一样不合规就整次都不提交。三样各提交各的，哪样没成哪样改回原样；只有自建歌单能编辑 */
  editPlaylist: (playlistId: number, edit: PlaylistEdit) => Promise<void>
  /** 改了就改不回去（界面先说清楚）；只有自建歌单能改，已经公开的什么都不做 */
  publishPlaylist: (playlistId: number) => Promise<void>
  /** 先从曲库里拿掉、立即生效，没删成就放回原处。我喜欢的音乐不能删；收藏的歌单是取消收藏（collect） */
  deletePlaylist: (playlistId: number) => Promise<void>
  /** 这次登录还没取到过就用前台请求取 */
  openPlaylistTags: () => Promise<void>
  /** 读选好的图片给裁剪页预览；不是图片、超过 20 MB、HEIC 解不开、读不出来时说明原因。长边超过 3200 的先缩小再裁 */
  prepareCover: (playlistId: number, file: File) => Promise<void>
  /** 裁成 800×800 JPEG，三步上传：申请凭证 → 浏览器直传图片存储 → 设为封面；前两步可取消，第三步发出后不能取消 */
  uploadCover: (crop: CoverCrop) => Promise<CoverOutcome | null>
  /** 申请凭证、直传：回到裁剪 */
  cancelCover: () => void
  /** 第三步失败只再设一次；别的失败从没成的那一步重来 */
  retryCover: () => Promise<CoverOutcome | null>
  /** 释放图片；正在设为封面时关不掉 */
  closeCover: () => void
  /** 按 noticeActions(notices.current()) 判断支持不支持，重试和撤销的数据来自提示条自己的载荷；没有提示条、不支持时什么都不做 */
  noticeAction: (action: NoticeAction) => Promise<void>
  /** 完整音频、封面缩略图、歌词、歌曲信息一起存进这台设备（ADR-0006）；下载地址按下载音质后台请求。现在不下时返回原因（界面事先用 downloadBlock 标出来） */
  download: (song: Song) => DownloadBlock | null
  /** 没登录时也能删 */
  deleteDownloads: (songIds: readonly number[]) => Promise<void>
  /**
   * 把这几首下载另存进听众选的文件夹，连同歌曲信息（#79，ADR-0014）。必须在听众点按的那一下里调用：先弹出文件夹选择器，听众取消就什么都不做；
   * 返回的 Promise 在写完、取消时了结。浏览器不能选文件夹（exportable 是 false）时不要调用；正在导出时什么都不做
   */
  exportDownloads: (songIds: readonly number[]) => Promise<void>
  /** 正在写的这首丢弃，已经写完的留着 */
  cancelExport: () => void
  /** 看完结果收起；正在写时什么都不做 */
  closeExport: () => void
  /** 在这台设备上的下载里即时完成；还没从本机读出来时是空的 */
  searchDownloads: (query: string) => readonly Song[]
}

export const createApp = (browser: BrowserCapabilities): App => {
  const api = createApi(browser)
  const db = createLocalDatabase(browser.indexedDB)
  const local = createLocalDb(db)
  /** 联网着、登录着；不能时只有下载了的歌能放（#38） */
  const streamable = (): boolean => state.online && state.session.status === 'signedIn'

  /** 下载了的永远能放；没下载的要能在线放，无版权的不能放（界面只读这一条规则） */
  const playable = (song: Song): boolean => state.downloads.has(song.id) || (song.availability !== 'noCopyright' && streamable())

  /** 和 App.download 的判断是同一份输入 */
  const downloadBlockForApp = (song: Song): DownloadBlock | null => downloadBlockFor(song, state.downloads, { signedIn: state.session.status === 'signedIn', online: state.online })

  let state: AppState = {
    session: { status: 'checking' },
    login: INITIAL_LOGIN,
    library: null,
    player: INITIAL_PLAYER,
    lyrics: null,
    daily: null,
    search: INITIAL_SEARCH,
    cover: null,
    downloads: INITIAL_DOWNLOADS,
    exportable: browser.pickFolder !== null,
    exporting: null,
    online: browser.network.onLine,
    playable,
    downloadBlock: downloadBlockForApp,
  }
  const listeners = new Set<() => void>()
  let viewing: { page: ViewedPage, token: number, applied: string } | null = null
  let viewingToken = 0
  /** 已经排了这一次发布之后的派发：同一轮里连着变只派发一次 */
  let viewingQueued = false

  const update = (next: Partial<AppState>) => {
    state = {
      ...state,
      ...next,
    }
    for (const listener of listeners)
      listener()
    // 这一页要不要打开只看曲库和会话；播放进度之类的发布不重新算
    if (next.library !== undefined || next.session !== undefined)
      applyViewing()
  }

  /** 这一页要“打开”的条件：只有它变了才去拉，失败不会因为别的状态发布而自动重试 */
  const viewingKey = (page: ViewedPage): string => {
    const signedIn = state.session.status === 'signedIn'
    const shown = state.library
    switch (page.kind) {
      case 'playlist': {
        const ready = shown?.playlists != null
        const outside = shown != null && shown.playlists != null && shown.songsOf(page.id) === null
        return `playlist:${page.id}:${ready}:${outside}`
      }
      case 'album':
        return `album:${page.id}:${shown !== null}:${(shown?.albumPage(page.id) ?? null) === null}`
      case 'artist':
        return `artist:${page.id}:${shown !== null && shown.artistPage(page.id) === null}`
      case 'daily':
        return `daily:${signedIn}`
      case 'search':
        return `search:${page.keyword}:${signedIn}`
      default: {
        const unhandled: never = page
        throw new Error(`不认识的页面：${JSON.stringify(unhandled)}`)
      }
    }
  }

  /** 会话一轮发现网易云说需要登录、续期也没成功：各模块自己收起，曲库副本留在本机，同一个账号重新登录后接着用 */
  const loginExpired = (): void => {
    void round.change({ kind: 'loginExpired' })
    update({
      session: { status: 'loginExpired' },
      library: null,
    })
    player.availabilityChanged()
  }

  const lane = createBackgroundLane(browser)
  const round = createSessionRound({ api, lane, expired: loginExpired })
  /** 曲库：提示条换内容时要让它重发一次；下面建好再赋值 */
  let library: Library
  /**
   * 提示条（改曲库和下载共用）：App 拥有它，自动消失走 App 的时钟。
   * 换了就放进曲库快照：这一条提示和它支持的动作；没登录时没有曲库，不显示
   */
  const notices = createNotices({
    clock: browser.clock,
    // 提示条换了让曲库重发一次：这一条提示和它支持的动作都从当前这一份副本算出来
    changed: () => library.publish(),
  })
  // 会话换了（登录、退出、登录失效、换账号）：上一条提示条不算了
  round.onChange(() => notices.show(null))
  // 三个东西互相要用：播放器保存队列、队列发打卡、打卡读队列。先声明，建好以后才用到
  let player: Player
  let checkIns: CheckIns

  /** 保存的播放队列：归属、持久化、打卡归属、规则⑩都在这个模块里；App 只发出“会话换了” */
  const savedQueue = createSavedQueue({
    db,
    session: round,
    player: () => player,
    read: () => state.player,
    send: () => checkIns.send(),
    sendBeforeLogout: owner => checkIns.sendBeforeLogout(owner),
  })

  checkIns = createCheckIns({
    api,
    session: round,
    store: savedQueue.pending,
    locks: browser.locks,
    account: () => (state.session.status === 'signedIn'
      ? state.session.account.id
      : null),
  })

  /**
   * 还没发出去的退出：发出去，服务端回了过期的登录 Cookie 才算完。没发成时返回原因：
   * 这时浏览器里还留着上一个登录 Cookie，不能接着登录，否则之后补发的退出会把新的登录也退掉
   */
  let finishingLogout: Promise<RequestFailure | null> | undefined
  const finishLogout = (): Promise<RequestFailure | null> => {
    finishingLogout ??= browser.locks.request(LOGIN_COOKIE_LOCK, async () => {
      if (!await local.pendingLogout())
        return null
      // 退出了：还没发出去的打卡都丢弃，之后同一个账号再登录也不补发
      await savedQueue.pending.clear()
      const result = await api.post(endpoints.logout)
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

  /** 下载完了一首、删了一首（#38）：哪些歌能离线放变了。下载建好时要用到，所以放在它前面 */
  const downloadsChanged = (): void => {
    player.availabilityChanged()
  }

  const downloads = createDownloads({
    api,
    session: round,
    local,
    clock: browser.clock,
    browser,
    albumPage: (albumId) => {
      const page = state.library?.albumPage(albumId)
      return page?.status === 'shown'
        ? page.content
        : null
    },
    online: () => browser.network.onLine,
    signedIn: () => state.session.status === 'signedIn',
    write: next => update({ downloads: next }),
    notify: notices.show,
    changed: downloadsChanged,
  })

  const { pickFolder } = browser
  const exports = createExports({
    // 浏览器不能选文件夹时界面不显示“导出”（exportable），调到这里是 Campanula 的缺陷
    pickFolder: () => {
      if (!pickFolder)
        throw new Error('这个浏览器不能选文件夹，不该导出')
      return pickFolder()
    },
    stored: downloads.stored,
    sizeOf: songId => state.downloads.sizeOf(songId),
    write: next => update({ exporting: next }),
  })

  player = createPlayer({
    api: round.api,
    clock: browser.clock,
    audio: browser.audio,
    write: (next) => {
      update({ player: next })
      showOnLockScreen(next)
    },
    save: savedQueue.save,
    forget: savedQueue.forget,
    downloaded: songId => state.downloads.has(songId),
    localFile: songId => downloads.audioUrl(songId),
    playable,
  })
  const lockScreen = connectMediaSession({
    session: browser.mediaSession,
    MediaMetadata: browser.MediaMetadata,
    clock: browser.clock,
    player,
    read: () => state.player,
    localCover: coverUrl => state.downloads.coverOf(coverUrl),
  })
  /** 锁屏和通知栏上显示的跟着播放状态变。写成函数声明：锁屏的按钮要用播放器，播放器发布时又要用锁屏，两边互相引用 */
  const showOnLockScreen = (next: PlayerState): void => {
    lockScreen(next)
  }

  // 断网、联网（#38）：没下载的歌能不能放跟着变
  for (const type of ['online', 'offline'] as const) {
    browser.network.addEventListener(type, () => {
      update({ online: browser.network.onLine })
      player.availabilityChanged()
    })
  }

  library = createLibrary({
    api,
    session: round,
    local,
    clock: browser.clock,
    page: browser.page,
    write: (next) => {
      update({ library: next })
      player.libraryChanged(playlistId => next.playlistPage(playlistId).content)
    },
    online: () => browser.network.onLine,
    checkToken: browser.checkToken,
    notices,
  })

  const cover = createCover({
    api: round.api,
    session: round,
    images: browser.images,
    upload: browser.uploadCoverImage,
    write: next => update({ cover: next }),
    changed: (playlistId, coverUrl) => library.setCover(playlistId, coverUrl),
  })

  const lyrics = createLyrics({
    api: round.api,
    session: round,
    read: () => state.lyrics,
    write: next => update({ lyrics: next }),
    stored: songId => downloads.lyricsOf(songId),
  })

  const daily = createDaily({
    api: round.api,
    session: round,
    clock: browser.clock,
    read: () => state.daily,
    write: next => update({ daily: next }),
  })

  const search = createSearch({
    api: round.api,
    session: round,
    clock: browser.clock,
    local,
    read: () => state.search,
    write: next => update({ search: next }),
  })

  /** 只在条件真的变了时交给对应的模块；和页面原来的 $effect 一样，等这一次状态发布会话走完再动手（open 会等收藏、取消收藏的排队） */
  const applyViewing = (): void => {
    const current = viewing
    if (!current)
      return
    const key = viewingKey(current.page)
    if (key === current.applied)
      return
    current.applied = key
    if (viewingQueued)
      return
    viewingQueued = true
    queueMicrotask(() => {
      viewingQueued = false
      openViewingPage()
    })
  }

  /** 状态在排队期间又变了也照现在的来（open* 自己幂等） */
  const openViewingPage = (): void => {
    const current = viewing
    if (!current)
      return
    const { page } = current
    const shown = state.library
    switch (page.kind) {
      case 'playlist':
        if (shown?.playlists)
          void library.open(page.id)
        return
      case 'album':
        if (shown)
          void library.openAlbum(page.id)
        return
      case 'artist':
        if (shown && shown.artistPage(page.id) === null)
          void library.openArtist(page.id)
        return
      case 'daily':
        if (state.session.status === 'signedIn')
          void daily.open()
        return
      case 'search':
        if (state.session.status === 'signedIn' && page.keyword.trim())
          void search.open(page.keyword)
        return
      default: {
        const unhandled: never = page
        throw new Error(`不认识的页面：${JSON.stringify(unhandled)}`)
      }
    }
  }

  const view = (page: ViewedPage): () => void => {
    const token = ++viewingToken
    viewing = { page, token, applied: '' }
    applyViewing()
    let left = false
    return () => {
      if (left)
        return
      left = true
      if (page.kind === 'playlist')
        void library.flush(page.id)
      if (viewing?.token === token)
        viewing = null
    }
  }

  /** 先拿出这个账号的曲库副本，和登录状态一起显示，再在后台同步；播放队列的归属、恢复和规则⑩在 saved-queue 里 */
  const signedIn = async (account: Account): Promise<void> => {
    const entered = round.change({ kind: 'signedIn', account })
    const mine = round.current
    const [shown, quality, history] = await Promise.all([
      library.enter(account),
      local.playQuality(),
      local.searchHistory(),
    ])
    await entered
    if (!round.isCurrent(mine) || !shown)
      return
    if (quality)
      player.setQuality(quality)
    update({
      session: { status: 'signedIn', account },
      login: INITIAL_LOGIN,
      library: shown,
      search: { ...state.search, history },
    })
    player.availabilityChanged()
    library.sync()
    // 登录失效期间、断网时记下的打卡补发给这个账号；别的账号的丢弃
    checkIns.send()
  }

  const login = createLogin({
    api,
    session: round,
    clock: browser.clock,
    page: browser.page,
    beforeLogin: finishLogout,
    read: () => state.login,
    write: next => update({ login: next }),
    signedIn,
  })

  /** 各模块在会话一轮里登记了自己的清理，播放队列由 saved-queue 停下并删掉 */
  const signedOut = (by: 'this-tab' | 'other-tab'): Promise<void> => {
    const changed = round.change({ kind: 'signedOut', by })
    update({
      session: { status: 'signedOut' },
      login: INITIAL_LOGIN,
      library: null,
    })
    player.availabilityChanged()
    return changed
  }

  /** 还没打开、没显示出来时是 null；已下载属于这台设备，没登录时也有 */
  const listOf = (source: ListSource): { songs: readonly Song[], complete: boolean } | null => {
    if (source.kind === 'downloads')
      return state.downloads.songs && { songs: state.downloads.songs, complete: true }
    const shown = state.library
    if (!shown)
      return null
    switch (source.kind) {
      case 'playlist': {
        const page = shown.playlistPage(source.id)
        return page.content && { songs: page.content.songs, complete: page.content.complete }
      }
      case 'album': {
        const page = shown.albumPage(source.id)
        return page?.status === 'shown'
          ? { songs: page.content.songs, complete: true }
          : null
      }
      case 'artist': {
        const page = shown.artistPage(source.id)
        return page?.status === 'shown'
          ? { songs: page.content.hotSongs, complete: true }
          : null
      }
      case 'daily':
        return state.daily?.status === 'shown'
          ? { songs: state.daily.songs, complete: true }
          : null
      default: {
        const unhandled: never = source
        throw new Error(`不认识的播放来源：${JSON.stringify(unhandled)}`)
      }
    }
  }

  const searchedSong = (keyword: string, songId: number): Song | undefined => {
    const results = state.search.results
    const songs = results?.keyword === keyword
      ? results.songs
      : null
    return songs?.status === 'shown'
      ? songs.items.find(song => song.id === songId)
      : undefined
  }

  const searchedItem = <K extends Exclude<SearchKind, 'songs'>>(kind: K, id: number): SearchedItems[K] | undefined => {
    const list = state.search.results?.[kind]
    return list?.status === 'shown'
      ? (list.items as SearchedItems[K][]).find(item => item.id === id)
      : undefined
  }

  /** 曲库里的照旧；打开着的不在曲库里的歌单连同取到的曲目；搜索结果里的只有头部。都不是时是 null */
  const playlistToCollect = (shown: LibraryState, id: number): { playlist: Playlist, seed: PlaylistSeed | null } | null => {
    const listed = shown.playlists?.find(playlist => playlist.id === id)
    if (listed)
      return { playlist: listed, seed: null }
    const page = shown.neteasePlaylist(id)
    if (page?.status === 'shown') {
      const { playlist, trackIds, tracksUpdatedAt, songs, complete } = page.content
      return {
        playlist: {
          ...playlist,
          kind: 'collected',
          private: false,
          trackCount: trackIds.length,
          tracksUpdatedAt,
        },
        seed: {
          tracks: {
            version: tracksUpdatedAt,
            trackIds: [...trackIds],
            complete,
          },
          songs,
        },
      }
    }
    const searched = searchedItem('playlists', id)
    // 搜索结果里没有简介、标签和曲目最后变动的时间（SDK 没声明）：先空着、记成 0，打开它时、下一次同步时拿到真的
    return searched
      ? {
          playlist: {
            ...searched,
            description: null,
            tags: [],
            kind: 'collected',
            private: false,
            tracksUpdatedAt: 0,
          },
          seed: null,
        }
      : null
  }

  const albumToCollect = (shown: LibraryState, id: number): CollectedAlbum | null => {
    const listed = shown.albums?.find(album => album.id === id)
    if (listed)
      return listed
    const page = shown.albumPage(id)
    if (page?.status === 'shown') {
      const { name, coverUrl, artist, songCount } = page.content.album
      return {
        id,
        name,
        coverUrl,
        artists: [artist],
        songCount,
      }
    }
    const searched = searchedItem('albums', id)
    // 搜索结果里没有歌曲数（SDK 没声明）：记成 0，下一次同步收藏的专辑时拿到真的
    return searched
      ? {
          id,
          name: searched.name,
          coverUrl: searched.coverUrl,
          artists: searched.artists,
          songCount: 0,
        }
      : null
  }

  const artistToCollect = (shown: LibraryState, id: number): CollectedArtist | null => {
    const listed = shown.artists?.find(artist => artist.id === id)
    if (listed)
      return listed
    const page = shown.artistPage(id)
    if (page?.status === 'shown')
      return { id, name: page.content.artist.name, avatarUrl: page.content.artist.avatarUrl }
    const searched = searchedItem('artists', id)
    return searched
      ? { id, name: searched.name, avatarUrl: searched.avatarUrl }
      : null
  }

  /** 要改的这张自建歌单；不是自建歌单（我喜欢的音乐、收藏的、不在曲库里的）就是界面接错了 */
  const ownPlaylist = (playlistId: number): Playlist => {
    const playlist = state.library?.playlists?.find(item => item.id === playlistId)
    if (playlist?.kind !== 'own')
      throw new Error(`只有自建歌单能改、能删：${playlistId}`)
    return playlist
  }

  // 一个标签页退出，同一浏览器里开着的其他标签页跟着变成未登录（退出请求由退出的那个标签页发）
  const sessionChannel = browser.broadcastChannel(SESSION_CHANNEL)
  sessionChannel.addEventListener('message', (event) => {
    const message = event.data as SessionMessage
    switch (message.type) {
      case 'signedOut':
        void signedOut('other-tab')
        return
      default: {
        const unhandled: never = message.type
        throw new Error(`不认识的广播消息：${JSON.stringify(unhandled)}`)
      }
    }
  })

  return {
    get state() {
      return state
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async open() {
      update({
        session: { status: 'checking' },
      })
      // 下载属于这台设备：和问当前账号同时读出来，没登录时也要用
      const loaded = downloads.load()
      // 服务端在这一步里续期。同一浏览器的标签页排队问：前一个拿到的新 Cookie，后一个直接带上，不会再续一次
      const asked = round.current
      if (await local.pendingLogout()) {
        await Promise.all([
          finishLogout(),
          loaded,
        ])
        if (!round.isCurrent(asked))
          return
        await round.change({ kind: 'anonymous' })
        update({
          session: { status: 'signedOut' },
        })
        return
      }
      const [session] = await Promise.all([
        browser.locks.request(LOGIN_COOKIE_LOCK, round.checkAccount),
        loaded,
      ])
      if (!round.isCurrent(asked) || !session)
        return
      if (session.status === 'signedIn')
        return signedIn(session.account)
      if (session.status === 'signedOut')
        await round.change({ kind: 'anonymous' })
      else if (session.status === 'loginExpired')
        void round.change({ kind: 'loginExpired' })
      update({ session })
    },
    startQrLogin: login.startQr,
    stopQrLogin: login.stopQr,
    continueQrLogin: login.continueQr,
    sendCaptcha: login.sendCaptcha,
    loginWithCaptcha: login.loginWithCaptcha,
    async logout() {
      await local.setPendingLogout(true)
      // 先让其他标签页收到退出、停掉后台通道，再等本标签页的最后打卡和清理；反过来会等跨标签页的打卡锁，而对方正等这条广播（断网/限流时卡住）
      const changed = signedOut('this-tab')
      sessionChannel.postMessage({ type: 'signedOut' } satisfies SessionMessage)
      await changed
      await local.deleteLibrary()
      await finishLogout()
    },
    retrySync: library.retry,
    viewing: view,
    openPlaylist: library.open,
    searchPlaylist(playlistId, query) {
      const playlist = state.library?.playlistPage(playlistId).content
      return playlist
        ? searchPlaylist(playlist, query)
        : null
    },
    openAlbum: library.openAlbum,
    openArtist: library.openArtist,
    moreArtistAlbums: library.moreArtistAlbums,
    openPlaylistTags: library.openPlaylistTags,
    prepareCover: cover.prepare,
    uploadCover: cover.upload,
    cancelCover: cover.cancel,
    retryCover: cover.retry,
    closeCover: cover.close,
    createPlaylist: library.create,
    async editPlaylist(playlistId, edit) {
      const changes = playlistEdits(ownPlaylist(playlistId), edit)
      // 有一样不合规、断网时整次都不提交：只说一次原因，不让后一样的提示盖掉前一样的
      const refused = changes.find(change => changeProblem(change)) ?? (browser.network.onLine ? undefined : changes[0])
      if (refused)
        return library.change(refused)
      await Promise.all(changes.map(change => library.change(change)))
    },
    async publishPlaylist(playlistId) {
      const playlist = ownPlaylist(playlistId)
      if (playlist.private)
        await library.change({ kind: 'publish', playlist })
    },
    deletePlaylist: async playlistId => library.change({
      kind: 'delete',
      playlist: ownPlaylist(playlistId),
    }),
    openDaily: daily.open,
    suggest: search.suggest,
    search: search.search,
    openSearch: search.open,
    moreSearchResults: search.more,
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
      const first = list?.songs.find(song => state.playable(song))
      if (list && first)
        player.play(source, list.songs, first.id, list.complete)
    },
    togglePlay: player.toggle,
    next: player.next,
    previous: player.previous,
    playFromQueue: player.jump,
    playNext: player.playNext,
    addToQueue: player.addToQueue,
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
    heart: (song, hearted) => library.change({ kind: 'heart', song, hearted }),
    async addToPlaylist(playlistId, song) {
      const playlist = state.library?.playlists?.find(item => item.id === playlistId)
      if (!playlist || playlist.kind === 'collected')
        throw new Error(`只能加入自建歌单和我喜欢的音乐：${playlistId}`)
      return library.change({ kind: 'add', playlist, song })
    },
    addSongsToPlaylist: async (playlistId, songs) => library.addSongs(ownPlaylist(playlistId), songs),
    addTargets: library.addTargets,
    removeFromPlaylist(playlistId, songIds) {
      library.removeSongs(ownPlaylist(playlistId), songIds)
    },
    moveSongs: library.moveSongs,
    orderPlaylists: library.orderPlaylists,
    flushPlaylist: playlistId => library.flush(playlistId),
    async searchSongs(keyword) {
      const result = await search.searchSongs(keyword)
      // 这一轮结束了：选择器只需要知道没搜成的原因
      return result ?? {
        ok: false,
        failure: { kind: 'needsLogin' },
      }
    },
    async collect(target, collected) {
      const shown = state.library
      if (!shown)
        return
      switch (target.kind) {
        case 'playlist': {
          const found = playlistToCollect(shown, target.id)
          if (found?.playlist.kind === 'collected') {
            return library.change({
              kind: 'collectPlaylist',
              playlist: found.playlist,
              collected,
              seed: found.seed,
            })
          }
          break
        }
        case 'album': {
          const album = albumToCollect(shown, target.id)
          if (album)
            return library.change({ kind: 'collectAlbum', album, collected })
          break
        }
        case 'artist': {
          const artist = artistToCollect(shown, target.id)
          if (artist)
            return library.change({ kind: 'collectArtist', artist, collected })
          break
        }
        default: {
          const unhandled: never = target.kind
          throw new Error(`不认识要收藏的东西：${JSON.stringify(unhandled)}`)
        }
      }
      throw new Error(`界面上没有这样东西，收藏不了：${JSON.stringify(target)}`)
    },
    async noticeAction(action) {
      const notice = notices.current()
      if (!notice || !noticeActions(notice).includes(action))
        return
      switch (action) {
        case 'undo':
          if (notice.kind === 'removed')
            library.undoRemove(notice.removalId)
          return
        case 'dismiss':
          library.dismissNotice()
          notices.show(null)
          return
        case 'retry':
          switch (notice.kind) {
            case 'removeFailed':
              return library.retryRemove(notice.playlist, notice.songIds)
            case 'orderFailed':
              return library.retryOrder(notice.playlist, notice.songIds)
            case 'playlistOrderFailed':
              return library.retryPlaylistOrder(notice.playlistIds)
            case 'downloadFailed':
              // 开始重下了才关掉；断网、没登录时下不了，提示条留着
              if (downloads.download(notice.song) === null)
                notices.show(null)
              return
            default:
              return
          }
        default: {
          const unhandled: never = action
          throw new Error(`不认识的提示条动作：${JSON.stringify(unhandled)}`)
        }
      }
    },
    download: downloads.download,
    deleteDownloads: downloads.remove,
    exportDownloads: exports.start,
    cancelExport: exports.cancel,
    closeExport: exports.close,
    searchDownloads: query => filterSongs(state.downloads.songs ?? [], query),
  }
}
