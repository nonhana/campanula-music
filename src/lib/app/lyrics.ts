import type { LyricsResponse } from '#lib/api/playback.js'
import type { SessionApi, SessionFailure, SessionRound } from './session-round'
import { endpoints } from '#lib/api/endpoints.js'

// 播放页的歌词（#25）：听众看歌词时才取（前台请求，不排队），只记着最近打开的那首。
// 下载了的歌（#38）用存在这台设备上的歌词，断网、没登录时也有。
// 会话一轮结束时 App 会清掉它；换了一首歌、旧一轮的回复不写进现在这首。

/** 歌词没取到的原因 */
export type LyricsFailure = SessionFailure

/** 打开的那首歌的歌词取到哪了 */
export type LyricsState
  = | { songId: number, status: 'loading' }
  /** 没取到：说明原因，再打开一次就是重试 */
    | { songId: number, status: 'failed', failure: LyricsFailure }
    | { songId: number, status: 'shown', lyrics: LyricsResponse }

export interface LyricsContext {
  api: SessionApi
  session: SessionRound
  read: () => LyricsState | null
  write: (lyrics: LyricsState | null) => void
  /** 下载了的这首存着的歌词；没下载是 null */
  stored: (songId: number) => LyricsResponse | null
}

export interface Lyrics {
  /** 看这首歌的歌词：已经取到、正在取就不再取；没取到过、上次没取成就取 */
  open: (songId: number) => Promise<void>
}

export function createLyrics(context: LyricsContext): Lyrics {
  const { api } = context

  function clear(): void {
    context.write(null)
  }

  context.session.onChange((change) => {
    if (change.kind !== 'signedIn')
      clear()
  })

  return {
    async open(songId) {
      const shown = context.read()
      if (shown?.songId === songId && shown.status !== 'failed')
        return
      const stored = context.stored(songId)
      if (stored)
        return context.write({ songId, status: 'shown', lyrics: stored })
      context.write({ songId, status: 'loading' })
      const result = await api.get(endpoints.lyrics, { id: songId })
      // 这一轮结束了：回复丢掉（App 已经清掉歌词）
      if (!result)
        return
      // 又打开了别的歌、已经清掉：回来的不是现在这首
      if (context.read()?.songId !== songId)
        return
      if (result.ok)
        return context.write({ songId, status: 'shown', lyrics: result.value })
      context.write({ songId, status: 'failed', failure: result.failure })
    },
  }
}
