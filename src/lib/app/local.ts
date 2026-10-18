import type { AlbumResponse, CollectedAlbum, CollectedArtist, Playlist, Song } from '#lib/api/library.js'
import type { Quality } from '#lib/api/playback.js'
import type { CheckIn, SavedPlayer, SavedProgress, SavedQueue } from './player'

// 本机数据库：这台浏览器里 Campanula 自己的数据，标签页共用。
// 之后的下载也放在这里；结构变化时升版本号，在 upgradeneeded 里迁移。

const NAME = 'campanula'
const VERSION = 8
/** 登录会话的小事，按名字存 */
const SESSION = 'session'
/** 曲库副本（ADR-0007）的小件，按名字存：owner（哪个网易云账号的）、hearts、playlists、collectedAlbums、collectedArtists */
const LIBRARY = 'library'
/** 每张歌单的曲目，按歌单编号存 */
const TRACKS = 'tracks'
/** 歌曲信息，按歌曲编号存；几张歌单里都有的歌只存一份 */
const SONGS = 'songs'
/** 打开过的收藏的专辑的专辑页，按专辑编号存（#23 留言：专辑页不在后台整批同步） */
const ALBUM_PAGES = 'albumPages'
const LIBRARY_STORES = [LIBRARY, TRACKS, SONGS, ALBUM_PAGES]
/** 播放队列和进度（#27），按名字存：queue（播放队列那一份，记着是哪个网易云账号的）、progress（当前这首放到哪了） */
const PLAYER = 'player'
/** 这台设备上的设置和搜索历史，按名字存：playQuality（在线播放音质）、searchHistory（#31）。不属于哪个网易云账号，退出、换账号都不删 */
const SETTINGS = 'settings'
/** 要发的听歌打卡（#28），按记下的先后自动编号：记着是哪个网易云账号的，发成了、丢弃时删掉 */
const CHECK_INS = 'checkIns'

/** 存着的播放队列那一份，加上它是哪个网易云账号的（换了别的账号登录就清空，规则⑩） */
export type StoredQueue = SavedQueue & { owner: number }

/** 要发的听歌打卡，加上它是哪个网易云账号的：只补发给这个账号 */
export type PendingCheckIn = CheckIn & { owner: number }

/** 存着的播放队列和进度 */
export interface StoredPlayer {
  /** 网易云账号的 uid */
  owner: number
  saved: SavedPlayer
}

/** 一张歌单在本机的曲目 */
export interface PlaylistTracks {
  /** 拉这份曲目编号时，歌单列表里这张歌单的 tracksUpdatedAt：网易云那边的变了才重拉 */
  version: number
  /** 按歌单里的顺序 */
  trackIds: number[]
  /** 这份编号的歌曲信息都取过一遍了（网易云没给的歌不再取） */
  complete: boolean
}

/**
 * 曲库副本：同一时间只存一个网易云账号的（主动退出时删除，换账号登录时清掉，ADR-0007）。
 * 还没同步到的部分是 null 或不在 Map 里
 */
export interface Replica {
  /** 网易云账号的 uid */
  owner: number
  /** 红心了的歌 */
  hearts: number[] | null
  playlists: Playlist[] | null
  /** 按歌单编号 */
  tracks: Map<number, PlaylistTracks>
  /** 按歌曲编号 */
  songs: Map<number, Song>
  /** 收藏的专辑，最近收藏的在前 */
  albums: CollectedAlbum[] | null
  /** 收藏的歌手，最近收藏的在前 */
  artists: CollectedArtist[] | null
  /** 打开过的收藏的专辑的专辑页，按专辑编号；不再收藏时删掉 */
  albumPages: Map<number, AlbumResponse>
}

/**
 * 改曲库副本的一步：给了的部分整个换掉，tracks、songs、albumPages 按编号换掉给了的那几项。
 * 换了歌单列表时，不在列表里的歌单的曲目一起删；换了收藏的专辑时，不再收藏的专辑存着的专辑页一起删；
 * 专辑页只存还在收藏的专辑里的（本机数据库里核对：别的标签页可能刚取消收藏）
 */
export interface LibraryPatch {
  hearts?: number[]
  playlists?: Playlist[]
  tracks?: ReadonlyMap<number, PlaylistTracks>
  songs?: readonly Song[]
  albums?: CollectedAlbum[]
  artists?: CollectedArtist[]
  albumPages?: ReadonlyMap<number, AlbumResponse>
}

/** 什么都不改 */
export function emptyPatch(patch: LibraryPatch): boolean {
  return Object.values(patch).every(part => part === undefined)
}

/** 副本改过以后的样子（和 LocalDb.saveLibrary 写进本机数据库的一样）：不改原来的，改到的部分换成新的 */
export function patched(replica: Replica, patch: LibraryPatch): Replica {
  let { tracks, songs, albumPages } = replica
  if (patch.tracks || patch.playlists) {
    tracks = new Map(tracks)
    for (const [id, playlistTracks] of patch.tracks ?? [])
      tracks.set(id, playlistTracks)
    if (patch.playlists) {
      const kept = new Set(patch.playlists.map(playlist => playlist.id))
      for (const id of tracks.keys()) {
        if (!kept.has(id))
          tracks.delete(id)
      }
    }
  }
  if (patch.songs?.length) {
    songs = new Map(songs)
    for (const song of patch.songs)
      songs.set(song.id, song)
  }
  if (patch.albums || patch.albumPages) {
    const collected = new Set((patch.albums ?? replica.albums ?? []).map(album => album.id))
    albumPages = new Map([...albumPages, ...patch.albumPages ?? []].filter(([id]) => collected.has(id)))
  }
  return {
    ...replica,
    hearts: patch.hearts ?? replica.hearts,
    playlists: patch.playlists ?? replica.playlists,
    tracks,
    songs,
    albums: patch.albums ?? replica.albums,
    artists: patch.artists ?? replica.artists,
    albumPages,
  }
}

export interface LocalDb {
  /** 退出时服务端还没回过期的登录 Cookie（断网、服务端出错）：要再发一次退出，在那之前 App 当作未登录 */
  pendingLogout: () => Promise<boolean>
  setPendingLogout: (pending: boolean) => Promise<void>
  /** 本机的曲库副本；从没同步过或已经删了时是 null */
  readLibrary: () => Promise<Replica | null>
  /** 换成 owner 的空副本：原来的（别的账号的）整个删掉 */
  resetLibrary: (owner: number) => Promise<void>
  deleteLibrary: () => Promise<void>
  /**
   * 改曲库副本（同步拿到的、听众改了并且网易云确认了的），见 LibraryPatch：同一个事务里先核对副本还是不是 owner 的，
   * 不是（别的标签页退出删了、换了账号）就什么都不写，返回 false
   */
  saveLibrary: (owner: number, patch: LibraryPatch) => Promise<boolean>
  /** 存着的播放队列和进度；没存过、已经删了，或者两份对不上（当前这首不在播放队列里）时是 null */
  readPlayer: () => Promise<StoredPlayer | null>
  /** 存进度；播放队列那一份也变了、有歌听完了时，在同一个事务里一起存播放队列、记下要发的打卡 */
  savePlayer: (progress: SavedProgress, queue: StoredQueue | undefined, checkIns: readonly PendingCheckIn[]) => Promise<void>
  /** 删掉存着的播放队列和进度；播放队列空之前有歌听完了，在同一个事务里记下要发的打卡 */
  deletePlayer: (checkIns?: readonly PendingCheckIn[]) => Promise<void>
  /** 要发的听歌打卡，按记下的先后；key 用来删 */
  pendingCheckIns: () => Promise<{ key: number, checkIn: PendingCheckIn }[]>
  deleteCheckIn: (key: number) => Promise<void>
  /** 要发的听歌打卡全部丢弃（退出登录） */
  clearCheckIns: () => Promise<void>
  /** 在线播放音质；没设过时是 null */
  playQuality: () => Promise<Quality | null>
  savePlayQuality: (quality: Quality) => Promise<void>
  /** 搜索历史，新的在前；没搜过时是空的 */
  searchHistory: () => Promise<string[]>
  /** 在一个事务里读出搜索历史、按 change 改好再存（别的标签页刚记下的不会被盖掉），返回存下的 */
  changeSearchHistory: (change: (history: string[]) => string[]) => Promise<string[]>
}

function settled<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

/** 写这一步要用到的存储区（LIBRARY 总要用：核对副本的主人） */
function storesFor(patch: LibraryPatch): string[] {
  return [
    ...(patch.tracks || patch.playlists ? [TRACKS] : []),
    ...(patch.songs ? [SONGS] : []),
    ...(patch.albums || patch.albumPages ? [ALBUM_PAGES] : []),
  ]
}

/** 按编号存的存储区里，只留 kept 里有的那几项 */
function dropAllBut(store: IDBObjectStore, kept: readonly { id: number }[]): void {
  const ids = new Set(kept.map(item => item.id))
  const keys = store.getAllKeys()
  keys.onsuccess = () => {
    for (const key of keys.result as number[]) {
      if (!ids.has(key))
        store.delete(key)
    }
  }
}

/** 存进本机以后才加的歌单字段：版本 3 加了创建者、是否隐私，版本 8 加了播放次数、简介、标签 */
type StoredLater = 'creator' | 'private' | 'playCount' | 'description' | 'tags'

function upgrade(database: IDBDatabase, transaction: IDBTransaction, from: number): void {
  if (from < 1)
    database.createObjectStore(SESSION)
  if (from < 2) {
    database.createObjectStore(LIBRARY)
    database.createObjectStore(TRACKS)
    database.createObjectStore(SONGS, { keyPath: 'id' })
  }
  // 3（#22）：歌单多了创建者和是否隐私；8（#56）：多了播放次数、简介和标签。存着的歌单列表补上空的值，
  // 曲库照样能先显示，下一次同步拿到真的值。两次一起补，免得前一次补的被后一次读到的旧列表盖掉
  if (from >= 2 && from < 8) {
    const library = transaction.objectStore(LIBRARY)
    const stored = library.get('playlists')
    stored.onsuccess = () => {
      const playlists = stored.result as (Omit<Playlist, StoredLater> & Partial<Pick<Playlist, StoredLater>>)[] | undefined
      if (playlists)
        library.put(playlists.map(playlist => ({ creator: '', private: false, playCount: 0, description: null, tags: [], ...playlist }) satisfies Playlist), 'playlists')
    }
  }
  // 4（#23）：收藏的专辑和歌手的列表存在 LIBRARY 里，打开过的专辑页另存一处
  if (from < 4)
    database.createObjectStore(ALBUM_PAGES)
  // 5（#24）：歌曲多了能不能放（availability）。存着的歌曲信息和专辑页里没有，删掉；每张歌单记成歌曲信息还没取全，
  // 下一次同步重新取（歌单列表、红心、收藏的专辑和歌手照样先显示）
  if (from >= 2 && from < 5) {
    transaction.objectStore(SONGS).clear()
    transaction.objectStore(ALBUM_PAGES).clear()
    const tracks = transaction.objectStore(TRACKS).openCursor()
    tracks.onsuccess = () => {
      const cursor = tracks.result
      if (!cursor)
        return
      cursor.update({ ...(cursor.value as PlaylistTracks), complete: false } satisfies PlaylistTracks)
      cursor.continue()
    }
  }
  // 6（#27）：播放队列和进度、设置
  if (from < 6) {
    database.createObjectStore(PLAYER)
    database.createObjectStore(SETTINGS)
  }
  // 7（#28）：要发的听歌打卡
  if (from < 7)
    database.createObjectStore(CHECK_INS, { autoIncrement: true })
}

export function createLocalDb(indexedDB: IDBFactory): LocalDb {
  /** 打开以后就留着：之后的读写在调用的同一步里开事务，调用方在这之前做的检查到开事务时还成立 */
  let open: IDBDatabase | undefined
  let opening: Promise<IDBDatabase> | undefined
  function database(): Promise<IDBDatabase> {
    opening ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(NAME, VERSION)
      request.onupgradeneeded = event => upgrade(request.result, request.transaction!, event.oldVersion)
      request.onsuccess = () => {
        open = request.result
        // 新版本的标签页要升级本机数据库时，这个（旧的）标签页让开，免得把升级卡住；它之后的读写会失败，刷新就好
        open.onversionchange = () => open?.close()
        resolve(open)
      }
      request.onerror = () => reject(request.error)
      // 升级被别的标签页开着的旧连接卡住（旧版本不会让开）：不干等着，说明原因；再打开时重新试
      request.onblocked = () => {
        opening = undefined
        reject(new Error('另一个标签页还开着旧版本的 Campanula，本机数据库没法升级：关掉或刷新那个标签页再试'))
      }
    })
    return opening
  }

  /** 在一个读写事务里改 stores，提交了才算完 */
  async function write(stores: string[], change: (transaction: IDBTransaction) => void): Promise<void> {
    const transaction = (open ?? await database()).transaction(stores, 'readwrite')
    change(transaction)
    await committed(transaction)
  }

  /** 副本还是 owner 的才在同一个事务里改 stores；返回改了没有 */
  async function writeLibrary(owner: number, stores: string[], change: (transaction: IDBTransaction) => void): Promise<boolean> {
    const transaction = (open ?? await database()).transaction([LIBRARY, ...stores], 'readwrite')
    const current = transaction.objectStore(LIBRARY).get('owner')
    let mine = false
    current.onsuccess = () => {
      mine = current.result === owner
      if (mine)
        change(transaction)
    }
    await committed(transaction)
    return mine
  }

  const clearLibrary = (transaction: IDBTransaction) => {
    for (const store of LIBRARY_STORES)
      transaction.objectStore(store).clear()
  }

  /** 有要记下的打卡时，播放器那一份的事务也要能写打卡 */
  const playerStores = (checkIns: readonly PendingCheckIn[]) => (checkIns.length > 0 ? [PLAYER, CHECK_INS] : [PLAYER])
  const addCheckIns = (transaction: IDBTransaction, checkIns: readonly PendingCheckIn[]) => {
    for (const checkIn of checkIns)
      transaction.objectStore(CHECK_INS).add(checkIn)
  }

  return {
    async pendingLogout() {
      const store = (await database()).transaction(SESSION).objectStore(SESSION)
      return await settled(store.get('pendingLogout')) === true
    },
    setPendingLogout: pending => write([SESSION], (transaction) => {
      const store = transaction.objectStore(SESSION)
      if (pending)
        store.put(true, 'pendingLogout')
      else
        store.delete('pendingLogout')
    }),
    async readLibrary() {
      const transaction = (await database()).transaction(LIBRARY_STORES)
      const library = transaction.objectStore(LIBRARY)
      const [owner, hearts, playlists, collectedAlbums, collectedArtists, trackKeys, trackValues, songs, albumKeys, albumValues] = await Promise.all([
        settled(library.get('owner')) as Promise<number | undefined>,
        settled(library.get('hearts')) as Promise<number[] | undefined>,
        settled(library.get('playlists')) as Promise<Playlist[] | undefined>,
        settled(library.get('collectedAlbums')) as Promise<CollectedAlbum[] | undefined>,
        settled(library.get('collectedArtists')) as Promise<CollectedArtist[] | undefined>,
        settled(transaction.objectStore(TRACKS).getAllKeys()) as Promise<number[]>,
        settled(transaction.objectStore(TRACKS).getAll()) as Promise<PlaylistTracks[]>,
        settled(transaction.objectStore(SONGS).getAll()) as Promise<Song[]>,
        settled(transaction.objectStore(ALBUM_PAGES).getAllKeys()) as Promise<number[]>,
        settled(transaction.objectStore(ALBUM_PAGES).getAll()) as Promise<AlbumResponse[]>,
      ])
      if (owner === undefined)
        return null
      return {
        owner,
        hearts: hearts ?? null,
        playlists: playlists ?? null,
        tracks: new Map(trackKeys.map((key, index) => [key, trackValues[index]])),
        songs: new Map(songs.map(song => [song.id, song])),
        albums: collectedAlbums ?? null,
        artists: collectedArtists ?? null,
        albumPages: new Map(albumKeys.map((key, index) => [key, albumValues[index]])),
      }
    },
    resetLibrary: owner => write(LIBRARY_STORES, (transaction) => {
      clearLibrary(transaction)
      transaction.objectStore(LIBRARY).put(owner, 'owner')
    }),
    deleteLibrary: () => write(LIBRARY_STORES, clearLibrary),
    saveLibrary: (owner, patch) => writeLibrary(owner, storesFor(patch), (transaction) => {
      const library = transaction.objectStore(LIBRARY)
      if (patch.hearts)
        library.put(patch.hearts, 'hearts')
      if (patch.artists)
        library.put(patch.artists, 'collectedArtists')
      if (patch.songs) {
        const songs = transaction.objectStore(SONGS)
        for (const song of patch.songs)
          songs.put(song)
      }
      if (patch.tracks || patch.playlists) {
        const tracks = transaction.objectStore(TRACKS)
        for (const [id, playlistTracks] of patch.tracks ?? [])
          tracks.put(playlistTracks, id)
        if (patch.playlists) {
          library.put(patch.playlists, 'playlists')
          dropAllBut(tracks, patch.playlists)
        }
      }
      if (patch.albums || patch.albumPages) {
        const pages = transaction.objectStore(ALBUM_PAGES)
        if (patch.albums)
          library.put(patch.albums, 'collectedAlbums')
        const collected = library.get('collectedAlbums')
        collected.onsuccess = () => {
          const albums = (collected.result as CollectedAlbum[] | undefined) ?? []
          for (const [id, page] of patch.albumPages ?? []) {
            if (albums.some(album => album.id === id))
              pages.put(page, id)
          }
          dropAllBut(pages, albums)
        }
      }
    }),
    async readPlayer() {
      const store = (await database()).transaction(PLAYER).objectStore(PLAYER)
      const [queue, progress] = await Promise.all([
        settled(store.get('queue')) as Promise<StoredQueue | undefined>,
        settled(store.get('progress')) as Promise<SavedProgress | undefined>,
      ])
      // 另一个标签页刚换了播放队列、这个标签页又存了一次自己的进度时，两份会对不上
      if (!queue || !progress || !queue.entries.some(entry => entry.song.id === progress.songId))
        return null
      const { owner, ...saved } = queue
      return { owner, saved: { queue: saved, progress } }
    },
    savePlayer: (progress, queue, checkIns) => write(playerStores(checkIns), (transaction) => {
      const store = transaction.objectStore(PLAYER)
      if (queue)
        store.put(queue, 'queue')
      store.put(progress, 'progress')
      addCheckIns(transaction, checkIns)
    }),
    deletePlayer: (checkIns = []) => write(playerStores(checkIns), (transaction) => {
      transaction.objectStore(PLAYER).clear()
      addCheckIns(transaction, checkIns)
    }),
    async pendingCheckIns() {
      const store = (await database()).transaction(CHECK_INS).objectStore(CHECK_INS)
      const [keys, values] = await Promise.all([
        settled(store.getAllKeys()) as Promise<number[]>,
        settled(store.getAll()) as Promise<PendingCheckIn[]>,
      ])
      return keys.map((key, index) => ({ key, checkIn: values[index] }))
    },
    deleteCheckIn: key => write([CHECK_INS], transaction => transaction.objectStore(CHECK_INS).delete(key)),
    clearCheckIns: () => write([CHECK_INS], transaction => transaction.objectStore(CHECK_INS).clear()),
    async playQuality() {
      const store = (await database()).transaction(SETTINGS).objectStore(SETTINGS)
      const quality = await settled(store.get('playQuality')) as Quality | undefined
      return quality ?? null
    },
    savePlayQuality: quality => write([SETTINGS], transaction => transaction.objectStore(SETTINGS).put(quality, 'playQuality')),
    async searchHistory() {
      const store = (await database()).transaction(SETTINGS).objectStore(SETTINGS)
      const history = await settled(store.get('searchHistory')) as string[] | undefined
      return history ?? []
    },
    async changeSearchHistory(change) {
      let changed: string[] = []
      await write([SETTINGS], (transaction) => {
        const store = transaction.objectStore(SETTINGS)
        const stored = store.get('searchHistory')
        stored.onsuccess = () => {
          changed = change((stored.result as string[] | undefined) ?? [])
          store.put(changed, 'searchHistory')
        }
      })
      return changed
    },
  }
}
