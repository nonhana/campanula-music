import type { Account } from '#lib/api/account.js'
import type { LocalDatabase } from './local'
import type { CheckIn, Player, PlayerState, SavedPlayer, SavedProgress, SavedQueue } from './player'
import type { SessionRound } from './session-round'
import { CHECK_INS, PLAYER, settled as requestResult } from './local'

// 保存的播放队列（Spec #11“客户端：播放队列与播放”、规则⑩，#69）：播放队列和进度存在这台设备上，
// 记着它是哪个网易云账号的。归属、持久化、打卡归属和换账号的规则⑩都在这里，App 只发出“会话换了”。
// - 登录失效时队列还在（同一个账号重新登录接着放）；换了别的账号登录才清空；
// - 没登录时放的已下载的歌（#38）不属于任何账号，登录了就交给这个账号，登录前听的秒数不补记；
// - 主动退出：停下、把最后一首的打卡记进本机并直接发一次，再删掉本机这一份；别的标签页退出不重复发；
// - 每一份写进本机的播放队列、进度和打卡都带着同一个账号，打卡不会记到别人头上。

/** 存着的播放队列那一份，加上它是哪个网易云账号的（换了别的账号登录就清空，规则⑩） */
interface StoredQueue extends SavedQueue { owner: number | null }

/** 存着的播放队列和进度 */
interface StoredPlayer {
  /** 网易云账号的 uid；没登录时放的是 null */
  owner: number | null
  saved: SavedPlayer
}

/** 要发的听歌打卡，加上它是哪个网易云账号的：只补发给这个账号 */
export type PendingCheckIn = CheckIn & { owner: number }

export interface PendingCheckIns {
  /** 按记下的先后；key 用来删 */
  all: () => Promise<{ key: number, checkIn: PendingCheckIn }[]>
  remove: (key: number) => Promise<void>
  /** 全部丢弃（退出登录） */
  clear: () => Promise<void>
}

/** 播放器要的本机保存：给播放器的 save / forget 回调 */
export interface SavedPlayerStore {
  /** 进度变了：存进度；播放队列那一份也变了、有歌听完了时，在同一个事务里一起存 */
  save: (progress: SavedProgress, queue: SavedQueue | undefined, checkIns: readonly CheckIn[]) => void
  /** 播放队列空了：本机存着的删掉；空之前听完的那首的打卡和删在同一个事务里存下 */
  forget: (checkIns: readonly CheckIn[]) => void
  /** 要发的打卡（补发、丢弃） */
  pending: PendingCheckIns
}

/** 播放队列、进度和听歌打卡的存储区：本机数据库只管存，内容由这里定义 */
interface PlayerStore {
  read: () => Promise<StoredPlayer | null>
  save: (progress: SavedProgress, queue: StoredQueue | undefined, checkIns: readonly PendingCheckIn[]) => Promise<void>
  delete: (checkIns?: readonly PendingCheckIn[]) => Promise<void>
  pending: () => Promise<{ key: number, checkIn: PendingCheckIn }[]>
  deleteCheckIn: (key: number) => Promise<void>
  clearCheckIns: () => Promise<void>
}

export interface SavedQueueContext {
  db: LocalDatabase
  session: SessionRound
  /** 播放器在这里；保存的播放队列要让它停下、恢复、交接归属 */
  player: () => Player
  /** App 显示的播放状态：有没有正在放的那首（要不要把没登录时放的交给刚登录的账号） */
  read: () => PlayerState
  /** 有新的打卡记进本机了：发出去 */
  send: () => void
  /** 主动退出、登录 Cookie 还没删时：这个账号的打卡直接发一次，发没发成都不再管 */
  sendBeforeLogout: (owner: number) => Promise<void>
}

function createPlayerStore(db: LocalDatabase): PlayerStore {
  return {
    async read() {
      const store = (await db.open()).transaction(PLAYER).objectStore(PLAYER)
      const [queue, progress] = await Promise.all([
        requestResult(store.get('queue')) as Promise<StoredQueue | undefined>,
        requestResult(store.get('progress')) as Promise<SavedProgress | undefined>,
      ])
      // 另一个标签页刚换了播放队列、这个标签页又存了一次自己的进度时，两份会对不上
      if (!queue || !progress || !queue.entries.some(entry => entry.song.id === progress.songId))
        return null
      const { owner, ...saved } = queue
      return {
        owner,
        saved: { queue: saved, progress },
      }
    },
    save: (progress, queue, checkIns) => db.write(checkIns.length > 0
      ? [PLAYER, CHECK_INS]
      : [PLAYER], (transaction) => {
      const store = transaction.objectStore(PLAYER)
      if (queue)
        store.put(queue, 'queue')
      store.put(progress, 'progress')
      for (const checkIn of checkIns)
        transaction.objectStore(CHECK_INS).add(checkIn)
    }),
    delete: (checkIns = []) => db.write(checkIns.length > 0
      ? [PLAYER, CHECK_INS]
      : [PLAYER], (transaction) => {
      transaction.objectStore(PLAYER).clear()
      for (const checkIn of checkIns)
        transaction.objectStore(CHECK_INS).add(checkIn)
    }),
    async pending() {
      const store = (await db.open()).transaction(CHECK_INS).objectStore(CHECK_INS)
      const [keys, values] = await Promise.all([
        requestResult(store.getAllKeys()) as Promise<number[]>,
        requestResult(store.getAll()) as Promise<PendingCheckIn[]>,
      ])
      return keys.map((key, index) => ({ key, checkIn: values[index] }))
    },
    deleteCheckIn: key => db.write([CHECK_INS], transaction => transaction.objectStore(CHECK_INS).delete(key)),
    clearCheckIns: () => db.write([CHECK_INS], transaction => transaction.objectStore(CHECK_INS).clear()),
  }
}

export function createSavedQueue(context: SavedQueueContext): SavedPlayerStore {
  const store = createPlayerStore(context.db)
  /** 这一份播放队列属于哪个网易云账号；没登录、放的是已下载的歌时是 null */
  let owner: number | null = null
  /** 正在退出：播放器停下来的那次保存会记下最后一首的打卡，但不在这里发，退出时统一发一次 */
  let leaving = false
  /** 本机写盘按先后一步一步做 */
  let writes: Promise<unknown> = Promise.resolve()

  /** 排进本机写盘的先后里；返回这一份做完 */
  function chain(action: () => Promise<void>): Promise<void> {
    const next = writes.then(action)
    writes = next.catch(() => {})
    return next
  }

  /** 记下这一轮的所有者：打卡只记给这个账号 */
  function tagged(checkIns: readonly CheckIn[]): PendingCheckIn[] {
    const current = owner
    return current === null
      ? []
      : checkIns.map(checkIn => ({ ...checkIn, owner: current }))
  }

  /** 保存的队列带着这一刻的归属；没登录时是 null（之后登录了就交给那个账号） */
  function stored(queue: SavedQueue | undefined): StoredQueue | undefined {
    return queue && { ...queue, owner }
  }

  function save(progress: SavedProgress, queue: SavedQueue | undefined, checkIns: readonly CheckIn[]): void {
    const pending = tagged(checkIns)
    const taggedQueue = stored(queue)
    const work = chain(() => store.save(progress, taggedQueue, pending))
    if (!leaving && pending.length > 0)
      void work.then(() => context.send(), () => {})
    else
      void work.catch(() => {})
  }

  function forget(checkIns: readonly CheckIn[]): void {
    const pending = tagged(checkIns)
    const work = chain(() => store.delete(pending))
    if (!leaving && pending.length > 0)
      void work.then(() => context.send(), () => {})
    else
      void work.catch(() => {})
  }

  /** 登录了：同一账号接着用；没登录时放的已下载的歌交给这个账号；换了别的账号清空（规则⑩） */
  async function enter(account: Account): Promise<void> {
    const mine = context.session.current
    leaving = false
    const player = context.player()
    if (owner === null && context.read().current !== null) {
      owner = account.id
      player.adopt()
      return
    }
    if (owner === account.id)
      return
    if (owner !== null)
      player.stop()
    owner = account.id
    await writes
    if (!context.session.isCurrent(mine))
      return
    const storedPlayer = await store.read()
    if (!context.session.isCurrent(mine))
      return
    if (storedPlayer?.owner === account.id)
      player.restore(storedPlayer.saved)
    else if (storedPlayer)
      await store.delete()
  }

  /** 没登录时打开 App：恢复只有已下载的歌的那一份；存着的是别的账号的就留着，等它登录 */
  async function restoreAnonymous(): Promise<void> {
    const mine = context.session.current
    leaving = false
    await writes
    if (!context.session.isCurrent(mine))
      return
    const storedPlayer = await store.read()
    if (!context.session.isCurrent(mine))
      return
    const player = context.player()
    if (storedPlayer?.owner === null && context.read().current === null)
      player.restore(storedPlayer.saved)
  }

  /** 退出登录：停播放器、记下最后一首的打卡、删掉本机这一份；主动退出的标签页再把它直接发一次 */
  async function leave(notify: boolean): Promise<void> {
    const mine = context.session.current
    leaving = true
    const departed = owner
    // 别的标签页退出（notify=false）：停播不算这一首结束，和基线“先放下账号再停”一致；主动退出才记最后一首
    if (!notify)
      owner = null
    context.player().stop()
    owner = null
    await writes
    // 退出还没做完就换了新一轮（别的标签页、重新登录）：新的会话接手，不再删它刚存下的队列
    if (!context.session.isCurrent(mine))
      return
    if (notify && departed !== null)
      await context.sendBeforeLogout(departed)
    if (!context.session.isCurrent(mine))
      return
    await chain(() => store.delete())
    leaving = false
  }

  context.session.onChange((change) => {
    switch (change.kind) {
      case 'signedIn':
        return enter(change.account)
      case 'anonymous':
        return restoreAnonymous()
      case 'signedOut':
        return leave(change.by === 'this-tab')
      case 'loginExpired':
        // 队列和归属都留着：同一个账号重新登录后接着放，打卡也留着
        leaving = false
        break
      default: {
        const unhandled: never = change
        throw new Error(`不认识的会话变化：${JSON.stringify(unhandled)}`)
      }
    }
  })

  return {
    save,
    forget,
    pending: {
      async all() {
        await writes.catch(() => {})
        return store.pending()
      },
      remove: key => chain(() => store.deleteCheckIn(key)),
      clear: () => chain(() => store.clearCheckIns()),
    },
  }
}
