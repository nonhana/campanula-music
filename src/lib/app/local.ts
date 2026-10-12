import type { Playlist, Song } from '$lib/api/library'

// 本机数据库：这台浏览器里 Campanula 自己的数据，标签页共用。
// 之后的播放队列、下载也放在这里；结构变化时升版本号，在 upgradeneeded 里迁移。

const NAME = 'campanula'
const VERSION = 2
/** 登录会话的小事，按名字存 */
const SESSION = 'session'
/** 曲库副本（ADR-0007）的小件，按名字存：owner（哪个网易云账号的）、hearts、playlists */
const LIBRARY = 'library'
/** 每张歌单的曲目，按歌单编号存 */
const TRACKS = 'tracks'
/** 歌曲信息，按歌曲编号存；几张歌单里都有的歌只存一份 */
const SONGS = 'songs'
const LIBRARY_STORES = [LIBRARY, TRACKS, SONGS]

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
  saveHearts: (songIds: number[]) => Promise<void>
  savePlaylists: (playlists: Playlist[]) => Promise<void>
  saveTracks: (playlistId: number, tracks: PlaylistTracks) => Promise<void>
  saveSongs: (songs: Song[]) => Promise<void>
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

function upgrade(database: IDBDatabase, from: number): void {
  if (from < 1)
    database.createObjectStore(SESSION)
  if (from < 2) {
    database.createObjectStore(LIBRARY)
    database.createObjectStore(TRACKS)
    database.createObjectStore(SONGS, { keyPath: 'id' })
  }
}

export function createLocalDb(indexedDB: IDBFactory): LocalDb {
  /** 打开以后就留着：之后的读写在调用的同一步里开事务，调用方在这之前做的检查到开事务时还成立 */
  let open: IDBDatabase | undefined
  let opening: Promise<IDBDatabase> | undefined
  function database(): Promise<IDBDatabase> {
    opening ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(NAME, VERSION)
      request.onupgradeneeded = event => upgrade(request.result, event.oldVersion)
      request.onsuccess = () => {
        open = request.result
        resolve(open)
      }
      request.onerror = () => reject(request.error)
    })
    return opening
  }

  /** 在一个读写事务里改 stores，提交了才算完 */
  async function write(stores: string[], change: (transaction: IDBTransaction) => void): Promise<void> {
    const transaction = (open ?? await database()).transaction(stores, 'readwrite')
    change(transaction)
    await committed(transaction)
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
      const [owner, hearts, playlists, trackKeys, trackValues, songs] = await Promise.all([
        settled(library.get('owner')) as Promise<number | undefined>,
        settled(library.get('hearts')) as Promise<number[] | undefined>,
        settled(library.get('playlists')) as Promise<Playlist[] | undefined>,
        settled(transaction.objectStore(TRACKS).getAllKeys()) as Promise<number[]>,
        settled(transaction.objectStore(TRACKS).getAll()) as Promise<PlaylistTracks[]>,
        settled(transaction.objectStore(SONGS).getAll()) as Promise<Song[]>,
      ])
      if (owner === undefined)
        return null
      return {
        owner,
        hearts: hearts ?? null,
        playlists: playlists ?? null,
        tracks: new Map(trackKeys.map((key, index) => [key, trackValues[index]])),
        songs: new Map(songs.map(song => [song.id, song])),
      }
    },
    resetLibrary: owner => write(LIBRARY_STORES, (transaction) => {
      clearLibrary(transaction)
      transaction.objectStore(LIBRARY).put(owner, 'owner')
    }),
    deleteLibrary: () => write(LIBRARY_STORES, clearLibrary),
    saveHearts: songIds => write([LIBRARY], transaction => transaction.objectStore(LIBRARY).put(songIds, 'hearts')),
    savePlaylists: playlists => write([LIBRARY], transaction => transaction.objectStore(LIBRARY).put(playlists, 'playlists')),
    saveTracks: (playlistId, tracks) => write([TRACKS], transaction => transaction.objectStore(TRACKS).put(tracks, playlistId)),
    saveSongs: songs => write([SONGS], (transaction) => {
      const store = transaction.objectStore(SONGS)
      for (const song of songs)
        store.put(song)
    }),
  }
}
