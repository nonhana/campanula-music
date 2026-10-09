// 验证关卡③的本机记录：页面和 Service Worker 共用一个 IndexedDB。
// 锁屏、切到后台、App 关掉期间发生的事都记在这里，重新打开探针页时能看到。

export type Topic = 'install' | 'play' | 'download' | 'photo' | 'select'

export interface LogEntry {
  seq?: number
  at: number
  source: 'page' | 'sw'
  topic: Topic
  kind: string
  detail?: unknown
  /** 页面：当时的 document.visibilityState；Service Worker：当时开着几个窗口 */
  where: string
}

let opening: Promise<IDBDatabase> | undefined

function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('campanula-probe', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('log', { keyPath: 'seq', autoIncrement: true })
      request.result.createObjectStore('kv')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      // 打不开就别缓存失败结果，下次调用重新打开
      opening = undefined
      reject(request.error)
    }
  })
  return opening
}

async function run<T>(name: 'log' | 'kv', mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode)
    const request = body(tx.objectStore(name))
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function addLog(entry: Omit<LogEntry, 'seq'>): Promise<void> {
  await run('log', 'readwrite', store => store.add(entry))
}

/** 页面里记一笔，顺带记下页面当时是否可见；记完通知页面上的记录列表刷新。 */
export async function logPage(topic: Topic, kind: string, detail?: unknown): Promise<void> {
  await addLog({ at: Date.now(), source: 'page', topic, kind, detail, where: document.visibilityState })
  window.dispatchEvent(new CustomEvent('probe-log', { detail: topic }))
}

/** 不传 topic 就是全部记录（导出用）。 */
export async function listLog(topic?: Topic): Promise<LogEntry[]> {
  const all = await run('log', 'readonly', store => store.getAll() as IDBRequest<LogEntry[]>)
  return topic ? all.filter(entry => entry.topic === topic) : all
}

export async function clearLog(topic: Topic): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('log', 'readwrite')
    const cursor = tx.objectStore('log').openCursor()
    cursor.onsuccess = () => {
      const current = cursor.result
      if (!current)
        return
      if ((current.value as LogEntry).topic === topic)
        current.delete()
      current.continue()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function kvGet<T>(key: string): Promise<T | undefined> {
  return run('kv', 'readonly', store => store.get(key) as IDBRequest<T | undefined>)
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await run('kv', 'readwrite', store => store.put(value, key))
}

export function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}
