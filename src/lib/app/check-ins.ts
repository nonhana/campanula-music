import { endpoints } from '#lib/api/endpoints.js'
import type { WriteResponse } from '#lib/api/write.js'

import type { Api, Result } from './api-client'
import type { LocksCapability } from './browser'
import type { PendingCheckIn, PendingCheckIns } from './saved-queue'
import type { SessionRound } from './session-round'

// 听歌打卡（Spec #11“客户端：听歌打卡”）：一首歌听完了，播放器交出的打卡和进度存在同一个事务里，记着是哪个网易云账号的；
// 再经后台通道发给同一个账号（请求节奏：断网时等联网，网易云说操作频繁时等到它给的时间），发成了再删。
// 补发前换了账号就丢弃；登录失效时停下，同一个账号重新登录后接着发。主动退出时先把这个账号的直接发一次，之后全部丢弃（App 的 finishLogout）。
// 哪一轮会话有效由会话一轮判断：这一轮结束时后台请求回 null，打卡留着等同一个账号下次登录。

/** 补发打卡用的跨标签页的锁：同一浏览器的标签页共用本机记着的打卡，同时只让一个标签页发，免得一条发两次 */
const CHECK_IN_LOCK = 'campanula:check-ins'

export interface CheckInsContext {
  api: Api
  session: SessionRound
  store: PendingCheckIns
  locks: LocksCapability
  /** 现在登录着的网易云账号；没登录、登录失效时是 null */
  account: () => number | null
}

export interface CheckIns {
  /** 有新记下的打卡、登录了：把本机记着的、现在登录的这个账号的打卡发出去，别的账号的丢弃。没登录时什么都不做 */
  send: () => void
  /** 主动退出、登录 Cookie 还没删时：owner 的打卡直接发一次（后台通道已经停了），发没发成都不再管 */
  sendBeforeLogout: (owner: number) => Promise<void>
}

const postCheckIn = (api: Api, { songId, source, seconds }: PendingCheckIn): Promise<Result<WriteResponse>> => api.post(endpoints.checkIn, { id: songId }, { source, seconds })

export const createCheckIns = (context: CheckInsContext): CheckIns => {
  const { api, session, store, locks, account } = context
  /** 这个标签页正在发 */
  let sending: Promise<void> | null = null
  /** 发的时候又有人要发（新记下了一条、换了账号登录）：这一轮完了再来一轮 */
  let again = false

  /**
   * 按记下的先后一条一条发 owner 的一轮（网易云的最近播放按收到的先后排），别的账号的删掉。换了账号、登录失效时停下；
   * 连不上（Campanula 的服务端、网易云）时这一条留着，这一轮停下，下次（再有歌听完、再登录、再打开 App）再发
   */
  const sendAll = async (owner: number): Promise<void> => {
    for (const { key, checkIn } of await store.all()) {
      if (account() !== owner)
        return
      if (checkIn.owner !== owner) {
        await store.remove(key)
        continue
      }
      // 不中途放弃：session.background 只在 giveUp 时回 'gaveUp'
      const result = await session.background(() => postCheckIn(api, checkIn), () => {})
      if (result === null || result === 'gaveUp')
        return
      if (result.ok) {
        await store.remove(key)
        continue
      }
      switch (result.failure.kind) {
        case 'unreachable':
        case 'serverError':
        case 'neteaseUnavailable':
          return
        case 'upstreamChanged':
        case 'rejected':
        case 'cookieSecretMissing':
          // 返回的结构变了、网易云拒绝、站长没配密钥：再发也一样，丢弃
          await store.remove(key)
          break
        default: {
          const unhandled: never = result.failure
          throw new Error(`不认识的失败：${JSON.stringify(unhandled)}`)
        }
      }
    }
  }

  const send = (): void => {
    if (sending) {
      again = true
      return
    }
    const owner = account()
    if (owner === null)
      return
    again = false
    sending = locks.request(CHECK_IN_LOCK, () => sendAll(owner)).finally(() => {
      sending = null
      if (again)
        send()
    })
  }

  return {
    send,
    sendBeforeLogout: owner => locks.request(CHECK_IN_LOCK, async () => {
      for (const { checkIn } of await store.all()) {
        if (checkIn.owner === owner)
          await postCheckIn(api, checkIn)
      }
    }),
  }
}
