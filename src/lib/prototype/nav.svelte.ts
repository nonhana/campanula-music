// PROTOTYPE：变体之间共用的“当前在看哪个界面”。初始值来自 URL，变化后写回 URL，方便分享和截图。
//
// URL 参数：
//   variant  A | B | C
//   screen   library（默认）| playlist | artist | album | daily | downloads | search | player | welcome
//   tab      曲库标签：liked（默认）| playlists | albums | artists
//   pl       歌单 id（screen=playlist 时），默认 liked
//   id       歌手 / 专辑 id（screen=artist | album 时）
//   panel    播放页的面板：lyrics（默认）| queue
//   q        搜索词（screen=search；歌单页里是歌单内搜索）
//   stab     搜索结果的分类：songs | playlists | artists | albums；有它表示已经按了搜索，没有就是输入建议
//   auth     out = 未登录
//   login    sms | qr，覆盖登录方式的默认值（手机默认短信，桌面默认扫码）
//   net      off = 离线
//   demo     loading | empty | error，演示当前界面的状态
//   edit     new | info | public | delete，歌单编辑（歌单页上的弹层）
//   track    当前播放的歌曲 id（只在打开时读取）
//   t        当前播放位置（秒，只在打开时读取）
//   still=1  截图模式：冻结进度、关闭动画
//   shot=1   隐藏原型切换条

export type Screen = 'library' | 'playlist' | 'artist' | 'album' | 'daily' | 'downloads' | 'search' | 'player' | 'welcome'
export type PageScreen = Exclude<Screen, 'player'>
export type LibraryTab = 'liked' | 'playlists' | 'albums' | 'artists'
export type PlayerPanel = 'lyrics' | 'queue'
export type SearchTab = '' | 'songs' | 'playlists' | 'artists' | 'albums'
export type DemoState = '' | 'loading' | 'empty' | 'error'
export type EditMode = '' | 'new' | 'info' | 'public' | 'delete'
export type LoginMethod = '' | 'sms' | 'qr'

export const libraryTabs: { key: LibraryTab, label: string }[] = [
  { key: 'liked', label: '我喜欢' },
  { key: 'playlists', label: '歌单' },
  { key: 'albums', label: '专辑' },
  { key: 'artists', label: '歌手' },
]

export const searchTabs: { key: Exclude<SearchTab, ''>, label: string }[] = [
  { key: 'songs', label: '单曲' },
  { key: 'playlists', label: '歌单' },
  { key: 'artists', label: '歌手' },
  { key: 'albums', label: '专辑' },
]

const SCREENS: Screen[] = ['library', 'playlist', 'artist', 'album', 'daily', 'downloads', 'search', 'player', 'welcome']

interface Snap {
  screen: PageScreen
  tab: LibraryTab
  playlistId: string
  id: string
  /** 每一页自己的搜索词（搜索页、歌单内搜索、已下载里的搜索） */
  query: string
  stab: SearchTab
}

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback
}

class ProtoNav {
  screen = $state<Screen>('library')
  tab = $state<LibraryTab>('liked')
  playlistId = $state('liked')
  id = $state('')
  panel = $state<PlayerPanel>('lyrics')
  query = $state('')
  stab = $state<SearchTab>('')
  auth = $state<'in' | 'out'>('in')
  login = $state<LoginMethod>('')
  net = $state<'on' | 'off'>('on')
  demo = $state<DemoState>('')
  edit = $state<EditMode>('')

  /** 返回用的页面栈（不含播放页） */
  private stack = $state.raw<Snap[]>([])
  /** 播放页关闭后回到的界面 */
  private returnTo: Snap = { screen: 'library', tab: 'liked', playlistId: 'liked', id: '', query: '', stab: '' }

  get offline() {
    return this.net === 'off'
  }

  get loggedOut() {
    return this.auth === 'out'
  }

  /** 页面栈里还有可以返回的页面 */
  get canGoBack() {
    return this.stack.length > 0
  }

  init(params: URLSearchParams) {
    this.screen = pick(params.get('screen'), SCREENS, 'library')
    this.tab = pick(params.get('tab'), ['liked', 'playlists', 'albums', 'artists'], 'liked')
    this.playlistId = params.get('pl') ?? 'liked'
    this.id = params.get('id') ?? ''
    this.panel = params.get('panel') === 'queue' ? 'queue' : 'lyrics'
    this.query = params.get('q') ?? ''
    this.stab = pick(params.get('stab'), ['', 'songs', 'playlists', 'artists', 'albums'], '')
    this.auth = params.get('auth') === 'out' ? 'out' : 'in'
    this.login = pick(params.get('login'), ['', 'sms', 'qr'], '')
    this.net = params.get('net') === 'off' ? 'off' : 'on'
    this.demo = pick(params.get('demo'), ['', 'loading', 'empty', 'error'], '')
    this.edit = pick(params.get('edit'), ['', 'new', 'info', 'public', 'delete'], '')
    if (this.screen === 'player' && params.get('pl'))
      this.returnTo = { ...this.snap(), screen: 'playlist' }
  }

  /** 写回 URL 时只保留与默认值不同的参数 */
  apply(url: URL) {
    const set = (k: string, v: string, def: string) => {
      if (v === def)
        url.searchParams.delete(k)
      else url.searchParams.set(k, v)
    }
    set('screen', this.screen, 'library')
    set('tab', this.tab, 'liked')
    set('pl', this.playlistId, 'liked')
    set('id', this.id, '')
    set('panel', this.panel, 'lyrics')
    set('q', this.query, '')
    set('stab', this.stab, '')
    set('auth', this.auth, 'in')
    set('login', this.login, '')
    set('net', this.net, 'on')
    set('demo', this.demo, '')
    set('edit', this.edit, '')
    return url
  }

  private snap(): Snap {
    const screen = this.screen === 'player' ? this.returnTo.screen : this.screen
    return { screen, tab: this.tab, playlistId: this.playlistId, id: this.id, query: this.query, stab: this.stab }
  }

  private restore(s: Snap) {
    this.screen = s.screen
    this.tab = s.tab
    this.playlistId = s.playlistId
    this.id = s.id
    this.query = s.query
    this.stab = s.stab
  }

  /** 打开一个页面；当前页面进返回栈。播放页开着时先关掉它。新页面的搜索词从空开始 */
  go(screen: PageScreen, opts: { playlistId?: string, id?: string, tab?: LibraryTab } = {}) {
    if (this.screen !== 'player')
      this.stack = [...this.stack, this.snap()]
    this.screen = screen
    if (opts.playlistId !== undefined)
      this.playlistId = opts.playlistId
    if (opts.id !== undefined)
      this.id = opts.id
    if (opts.tab !== undefined)
      this.tab = opts.tab
    this.query = ''
    this.stab = ''
    this.demo = ''
    this.edit = ''
  }

  back() {
    if (this.screen === 'player') {
      this.closePlayer()
      return
    }
    const prev = this.stack.at(-1)
    this.stack = this.stack.slice(0, -1)
    if (prev)
      this.restore(prev)
    else this.goLibrary()
    this.edit = ''
  }

  openPlaylist(id: string) {
    this.go('playlist', { playlistId: id })
  }

  openArtist(id: string) {
    this.go('artist', { id })
  }

  openAlbum(id: string) {
    this.go('album', { id })
  }

  openDaily() {
    this.go('daily')
  }

  openDownloads() {
    this.go('downloads')
  }

  /** 打开搜索（桌面是居中弹窗，手机是整页）；q 为空时显示搜索历史 */
  openSearch(q = '') {
    if (this.screen !== 'search')
      this.go('search')
    this.query = q
    this.stab = ''
  }

  /** 按下搜索：显示四类结果 */
  submitSearch(q: string, stab: Exclude<SearchTab, ''> = 'songs') {
    if (this.screen !== 'search')
      this.go('search')
    this.query = q
    this.stab = stab
  }

  closeSearch() {
    if (this.screen === 'search')
      this.back()
  }

  openPlayer(panel: PlayerPanel = this.panel) {
    if (this.screen !== 'player')
      this.returnTo = this.snap()
    this.panel = panel
    this.screen = 'player'
  }

  closePlayer() {
    this.restore(this.returnTo)
  }

  goLibrary(tab: LibraryTab = this.tab) {
    this.stack = []
    this.tab = tab
    this.query = ''
    this.stab = ''
    this.screen = this.loggedOut ? 'welcome' : 'library'
    this.demo = ''
    this.edit = ''
  }

  openEdit(mode: Exclude<EditMode, ''>) {
    this.edit = mode
  }

  closeEdit() {
    this.edit = ''
  }
}

export const nav = new ProtoNav()
