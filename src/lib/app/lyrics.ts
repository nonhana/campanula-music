import type { LyricsResponse } from '#lib/api/playback.js'
import type { Api, RequestFailure } from './api'

// 播放页的歌词（#25）：听众看歌词时才取（前台请求，不排队），只记着最近打开的那首。

/** 歌词没取到的原因（需要登录另外处理：整个 App 变成登录失效） */
export type LyricsFailure = Exclude<RequestFailure, { kind: 'needsLogin' }>

/** 打开的那首歌的歌词取到哪了 */
export type LyricsState
  = | { songId: number, status: 'loading' }
  /** 没取到：说明原因，再打开一次就是重试 */
    | { songId: number, status: 'failed', failure: LyricsFailure }
    | { songId: number, status: 'shown', lyrics: LyricsResponse }

export interface LyricsContext {
  api: Api
  read: () => LyricsState | null
  write: (lyrics: LyricsState | null) => void
  /** 网易云说需要登录，续期也没成功 */
  loginExpired: () => void
}

export interface Lyrics {
  /** 看这首歌的歌词：已经取到、正在取就不再取；没取到过、上次没取成就取 */
  open: (songId: number) => Promise<void>
  /** 退出登录、登录失效：不再显示，在路上的请求回来也不要了 */
  clear: () => void
}

export function createLyrics(context: LyricsContext): Lyrics {
  const { api } = context
  /** 每打开一次、清掉一次就加一：回来的不是最近一次打开的就不要了 */
  let attempt = 0

  return {
    async open(songId) {
      const shown = context.read()
      if (shown?.songId === songId && shown.status !== 'failed')
        return
      const mine = ++attempt
      context.write({ songId, status: 'loading' })
      const result = await api.get<LyricsResponse>(`/api/songs/${songId}/lyrics`)
      if (mine !== attempt)
        return
      if (result.ok)
        return context.write({ songId, status: 'shown', lyrics: result.value })
      // 登录失效时 App 会清掉歌词（clear）
      if (result.failure.kind === 'needsLogin')
        return context.loginExpired()
      context.write({ songId, status: 'failed', failure: result.failure })
    },
    clear() {
      attempt += 1
      context.write(null)
    },
  }
}
