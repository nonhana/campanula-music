import type { AlbumResponse, CollectedAlbum, CollectedArtist, Playlist, Song } from '$lib/api/library'

// 本机数据库：这台浏览器里 Campanula 自己的数据，标签页共用。
// 之后的播放队列、下载也放在这里；结构变化时升版本号，在 upgradeneeded 里迁移。

const NAME = 'campanula'
const VERSION = 4
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

export interface LocalDb {
  /** 退出时服务端还没回过期的登录 Cookie（断网、服务端出错）：要再发一次退出，在那之前 App 当作未登录 */
  pendingLogout: () => Promise<boolean>
  setPendingLogout: (pending: boolean) => Promise<void>
  /** 本机的曲库副本；从没同步过或已经删了时是 null */
  readLibrary: () => Promise<Replica | null>
  /** 换成 owner 的空副本：原来的（别的账号的）整个删掉 */
  resetLibrary: (owner: number) => Promise<void>
  deleteLibrary: () => Promise<void>
  // 往副本里写同步拿到的东西：同一个事务里先核对副本还是不是 owner 的，不是（别的标签页退出删了、换了账号）就什么都不写，返回 false
  saveHearts: (owner: number, songIds: number[]) => Promise<boolean>
  /** 歌单列表：网易云那边删掉的歌单（不在列表里了），它的曲目在同一个事务里一起删 */
  savePlaylists: (owner: number, playlists: Playlist[]) => Promise<boolean>
  saveTracks: (owner: number, playlistId: number, tracks: PlaylistTracks) => Promise<boolean>
  saveSongs: (owner: number, songs: Song[]) => Promise<boolean>
  /** 收藏的专辑：不再收藏的专辑，存着的专辑页在同一个事务里一起删 */
  saveCollectedAlbums: (owner: number, albums: CollectedAlbum[]) => Promise<boolean>
  saveCollectedArtists: (owner: number, artists: CollectedArtist[]) => Promise<boolean>
  /** 专辑页：同一个事务里核对它还在收藏的专辑里，不在就不存 */
  saveAlbumPage: (owner: number, page: AlbumResponse) => Promise<boolean>
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

function upgrade(database: IDBDatabase, transaction: IDBTransaction, from: number): void {
  if (from < 1)
    database.createObjectStore(SESSION)
  if (from < 2) {
    database.createObjectStore(LIBRARY)
    database.createObjectStore(TRACKS)
    database.createObjectStore(SONGS, { keyPath: 'id' })
  }
  // 3（#22）：歌单多了创建者和是否隐私。存着的歌单列表补上空的值，曲库照样能先显示，下一次同步拿到真的值
  if (from === 2) {
    const library = transaction.objectStore(LIBRARY)
    const stored = library.get('playlists')
    stored.onsuccess = () => {
      const playlists = stored.result as Omit<Playlist, 'creator' | 'private'>[] | undefined
      if (playlists)
        library.put(playlists.map(playlist => ({ ...playlist, creator: '', private: false }) satisfies Playlist), 'playlists')
    }
  }
  // 4（#23）：收藏的专辑和歌手的列表存在 LIBRARY 里，打开过的专辑页另存一处
  if (from < 4)
    database.createObjectStore(ALBUM_PAGES)
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
    saveHearts: (owner, songIds) => writeLibrary(owner, [], transaction => transaction.objectStore(LIBRARY).put(songIds, 'hearts')),
    savePlaylists: (owner, playlists) => writeLibrary(owner, [TRACKS], (transaction) => {
      transaction.objectStore(LIBRARY).put(playlists, 'playlists')
      const tracks = transaction.objectStore(TRACKS)
      const kept = new Set(playlists.map(playlist => playlist.id))
      const keys = tracks.getAllKeys()
      keys.onsuccess = () => {
        for (const key of keys.result as number[]) {
          if (!kept.has(key))
            tracks.delete(key)
        }
      }
    }),
    saveTracks: (owner, playlistId, tracks) => writeLibrary(owner, [TRACKS], transaction => transaction.objectStore(TRACKS).put(tracks, playlistId)),
    saveSongs: (owner, songs) => writeLibrary(owner, [SONGS], (transaction) => {
      const store = transaction.objectStore(SONGS)
      for (const song of songs)
        store.put(song)
    }),
    saveCollectedAlbums: (owner, albums) => writeLibrary(owner, [ALBUM_PAGES], (transaction) => {
      transaction.objectStore(LIBRARY).put(albums, 'collectedAlbums')
      const pages = transaction.objectStore(ALBUM_PAGES)
      const kept = new Set(albums.map(album => album.id))
      const keys = pages.getAllKeys()
      keys.onsuccess = () => {
        for (const key of keys.result as number[]) {
          if (!kept.has(key))
            pages.delete(key)
        }
      }
    }),
    saveCollectedArtists: (owner, artists) => writeLibrary(owner, [], transaction => transaction.objectStore(LIBRARY).put(artists, 'collectedArtists')),
    async saveAlbumPage(owner, page) {
      let saved = false
      const mine = await writeLibrary(owner, [ALBUM_PAGES], (transaction) => {
        const collected = transaction.objectStore(LIBRARY).get('collectedAlbums')
        collected.onsuccess = () => {
          saved = (collected.result as CollectedAlbum[] | undefined)?.some(album => album.id === page.album.id) ?? false
          if (saved)
            transaction.objectStore(ALBUM_PAGES).put(page, page.album.id)
        }
      })
      return mine && saved
    },
  }
}
