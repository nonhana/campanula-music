// 本机数据库：这台浏览器里 Campanula 自己的数据，标签页共用。
// 之后的曲库副本（ADR-0007）、播放队列、下载也放在这里；结构变化时升版本号，在 upgradeneeded 里迁移。

const NAME = 'campanula'
const VERSION = 1
/** 登录会话的小事，按名字存 */
const SESSION = 'session'

export interface LocalDb {
  /** 退出时服务端还没回过期的登录 Cookie（断网、服务端出错）：要再发一次退出，在那之前 App 当作未登录 */
  pendingLogout: () => Promise<boolean>
  setPendingLogout: (pending: boolean) => Promise<void>
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

export function createLocalDb(indexedDB: IDBFactory): LocalDb {
  let opened: Promise<IDBDatabase> | undefined
  function database(): Promise<IDBDatabase> {
    opened ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(NAME, VERSION)
      request.onupgradeneeded = () => request.result.createObjectStore(SESSION)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return opened
  }

  return {
    async pendingLogout() {
      const store = (await database()).transaction(SESSION).objectStore(SESSION)
      return await settled(store.get('pendingLogout')) === true
    },
    async setPendingLogout(pending) {
      const transaction = (await database()).transaction(SESSION, 'readwrite')
      const store = transaction.objectStore(SESSION)
      if (pending)
        store.put(true, 'pendingLogout')
      else
        store.delete('pendingLogout')
      await committed(transaction)
    },
  }
}
