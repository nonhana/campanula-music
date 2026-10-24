import { endpoints } from '#lib/api/endpoints.js'
import type { Song } from '#lib/api/library.js'
import { thumbnailUrl } from '#lib/api/library.js'
import type { LyricsResponse } from '#lib/api/playback.js'
import { DOWNLOAD_QUALITY } from '#lib/api/playback.js'

import type { Api, Result } from './api-client'
import type { BrowserCapabilities, Clock } from './browser'
import type { LocalDb, StoredDownload } from './local'
import type { BackgroundFailure, BackgroundSessionResult, SessionRound } from './session-round'

// 下载（Spec #11“客户端：下载”、ADR-0006，#38 先做单曲）：向服务端要下载地址、要歌词（后台请求，走请求节奏），
// 浏览器直连网易云的音频服务器、图片服务器把完整音频和封面缩略图下下来，连同歌曲信息一次存进本机。
// 下载属于这台设备：和登录、登录的是哪个账号都无关；下载完不再复核会员权益，永久可播。
// 没下成的标成失败、写明原因，再下一次就是重试，从头下（断点续传是 #39）。

/** 封面缩略图按多大存（px）：和锁屏上的封面一样大，断网时播放页、锁屏也看得清 */
const DOWNLOAD_COVER_SIZE = 512

/** 没下成的原因 */
export type DownloadFailure
  /**
   * 没拿到下载地址、歌词：连不上、网易云出错；这一轮会话结束（退出、登录失效）时也用 needsLogin 说明这首没下成。
   * 它只给界面看，不再据此让 App 变成登录失效（那由会话一轮管）；断网、操作频繁由请求节奏等过，不会到这里
   */
  = | { kind: 'request', failure: BackgroundFailure | { kind: 'needsLogin' } }
  /** 网易云没给这首的下载地址：无版权，或者这个账号下不了完整的 */
    | { kind: 'unavailable' }
  /** 音频、封面没传完：断网、网易云的服务器断开或出错，或者收到的比该有的少 */
    | { kind: 'interrupted' }
  /** 这台设备的存储空间不够，存不下 */
    | { kind: 'storageFull' }

type DownloadTask
  /** 正在下：音频已经收到多少字节、一共多少字节（还没拿到下载地址时不知道，是 null） */
  = | { status: 'downloading', song: Song, received: number, total: number | null }
  /** 没下成：说明原因，再下一次就是重试 */
    | { status: 'failed', song: Song, failure: DownloadFailure }

/** 要告诉听众的事（App 的提示条，和改曲库共用一条） */
export interface DownloadNotice {
  kind: 'downloadFailed'
  song: Song
  failure: DownloadFailure
}

export interface DownloadsState {
  /** 这台设备上下载完的歌，最近下载完的在前；还没从本机读出来时是 null */
  songs: readonly Song[] | null
  /** 还没下完的，按歌曲编号 */
  tasks: ReadonlyMap<number, DownloadTask>
  /** 这首下载完了 */
  has: (songId: number) => boolean
  /**
   * 下载完的歌里这张封面（网易云的原图地址，同一张专辑的歌共用）的本机缩略图地址（blob:）：断网时封面、锁屏照样显示。
   * 没有下载完的歌用这张封面时是 null
   */
  coverOf: (coverUrl: string) => string | null
}

/**
 * 一首歌为什么现在不下：已经下载完、正在下；试听、无版权的不能下载（只下完整音频）；没登录（退出了、登录失效）时
 * 要不到下载地址；断网时下不了。能下（包括上次没下成、要重试的）是 null
 */
export type DownloadBlock = 'downloaded' | 'downloading' | 'trial' | 'noCopyright' | 'signedOut' | 'offline'

export const downloadBlock = (song: Song, downloads: DownloadsState, { signedIn, online }: { signedIn: boolean, online: boolean }): DownloadBlock | null => {
  if (downloads.has(song.id))
    return 'downloaded'
  if (downloads.tasks.get(song.id)?.status === 'downloading')
    return 'downloading'
  if (song.availability !== 'full')
    return song.availability
  if (!signedIn)
    return 'signedOut'
  return online ? null : 'offline'
}

export const INITIAL_DOWNLOADS: DownloadsState = {
  songs: null,
  tasks: new Map(),
  has: () => false,
  coverOf: () => null,
}

export interface DownloadsContext {
  api: Api
  session: SessionRound
  local: LocalDb
  clock: Clock
  browser: Pick<BrowserCapabilities, 'download' | 'objectUrl' | 'revokeObjectUrl'>
  online: () => boolean
  /** 登录着：要下载地址要用这个账号；退出、登录失效时不能下载 */
  signedIn: () => boolean
  write: (downloads: DownloadsState) => void
  notify: (notice: DownloadNotice) => void
  /** 下载完了一首、删了一首：哪些歌能离线放变了 */
  changed: () => void
}

export interface Downloads {
  /** 打开 App：从本机读出下载完的歌。没读成时再调一次就是重试 */
  load: () => Promise<void>
  /** 下载一首：完整音频、封面缩略图、歌词、歌曲信息一起存进这台设备。现在不下时返回原因，开始下了是 null */
  download: (song: Song) => DownloadBlock | null
  /** 删除一首下载（没登录时也能删）：从本机删掉，它的本机文件地址不再用 */
  remove: (songId: number) => Promise<void>
  /** 下载完的这首的本机音频地址（blob:）：播放器拿它放，用到时才建，删掉下载时收回 */
  audioUrl: (songId: number) => string
  /** 下载完的这首存着的歌词；没下载是 null */
  lyricsOf: (songId: number) => LyricsResponse | null
}

/** 存进本机时存储空间不够（IndexedDB 以 QuotaExceededError 失败）；别的错是 Campanula 自己的缺陷 */
const storageFull = (error: unknown): boolean => error instanceof DOMException && error.name === 'QuotaExceededError'

export const createDownloads = (context: DownloadsContext): Downloads => {
  const { api, session, local, clock, browser } = context
  /** 下载完的，按歌曲编号；还没从本机读出来时是 null */
  let records: Map<number, StoredDownload> | null = null
  /** 下载完的歌，最近下载完的在前（records 变了才重排）；还没从本机读出来时是 null */
  let songs: readonly Song[] | null = null
  /** 封面原图地址 → 用它的一首下载 */
  let covers = new Map<string, StoredDownload>()
  let tasks = new Map<number, DownloadTask>()
  let loading: Promise<void> | undefined
  /** 建过的本机音频地址，按歌曲编号 */
  const audioUrls = new Map<number, string>()
  /** 建过的本机封面地址，按封面原图地址 */
  const coverUrls = new Map<string, string>()

  /** 下载完的这一首；不在时是界面、播放器接错了 */
  const recordOf = (songId: number): StoredDownload => {
    const record = records?.get(songId)
    if (!record)
      throw new Error(`这台设备上没有下载 ${songId}`)
    return record
  }

  const setRecords = (next: Map<number, StoredDownload>): void => {
    records = next
    songs = [
      ...next.values(),
    ].sort((a, b) => b.downloadedAt - a.downloadedAt).map(record => record.song)
    covers = new Map([
      ...next.values(),
    ].map(record => [record.song.album.coverUrl, record]))
  }

  const coverOf = (coverUrl: string): string | null => {
    const record = covers.get(coverUrl)
    if (!record)
      return null
    let url = coverUrls.get(coverUrl)
    if (!url) {
      url = browser.objectUrl(record.cover)
      coverUrls.set(coverUrl, url)
    }
    return url
  }

  const current = (): DownloadsState => {
    const shown = records
    return {
      songs,
      tasks,
      has: songId => shown?.has(songId) ?? false,
      coverOf,
    }
  }

  const publish = (): void => {
    context.write(current())
  }

  const setTask = (task: DownloadTask): void => {
    tasks = new Map(tasks).set(task.song.id, task)
    publish()
  }

  const fail = (song: Song, failure: DownloadFailure): void => {
    setTask({ status: 'failed', song, failure })
    context.notify({ kind: 'downloadFailed', song, failure })
  }

  /** 后台请求（请求节奏）：断网、操作频繁由后台通道等过、重发过；退出、登录失效时这一轮结束，回 null */
  const background = <T>(send: () => Promise<Result<T>>): Promise<BackgroundSessionResult<T> | 'gaveUp'> => session.background(send, () => {})

  /** 没拿到下载地址、歌词：这一轮结束（退出、登录失效）或者网易云拒绝了，这首标成没下成 */
  const refused = (song: Song, failure: Extract<DownloadFailure, { kind: 'request' }>['failure']): void => {
    fail(song, { kind: 'request', failure })
  }

  /** 音频、封面：传到一半断开、服务器出错都算没传完 */
  const transfer = async (url: string, onProgress: (received: number) => void): Promise<Blob | null> => {
    try {
      return await browser.download(url, onProgress)
    }
    catch {
      return null
    }
  }

  const run = async (song: Song): Promise<void> => {
    const [url, lyrics] = await Promise.all([
      background(() => api.get(endpoints.downloadUrl, { id: song.id, quality: DOWNLOAD_QUALITY })),
      background(() => api.get(endpoints.lyrics, { id: song.id })),
    ])
    if (!url || !lyrics || url === 'gaveUp' || lyrics === 'gaveUp')
      return refused(song, { kind: 'needsLogin' })
    if (!url.ok)
      return refused(song, url.failure)
    if (!lyrics.ok)
      return refused(song, lyrics.failure)
    if (!url.value.downloadable)
      return fail(song, { kind: 'unavailable' })
    const { size } = url.value
    setTask({
      status: 'downloading',
      song,
      received: 0,
      total: size,
    })
    /** 上次发布时收到了多少字节 */
    let shown = 0
    const [audio, cover] = await Promise.all([
      transfer(url.value.url, (received) => {
        // 每多收到 1% 才更新一次：几十 MB 的音频一块一块地到，每块都发布一次界面跟不上
        if (Math.floor(received * 100 / size) !== Math.floor(shown * 100 / size) || received === size) {
          shown = received
          setTask({
            status: 'downloading',
            song,
            received,
            total: size,
          })
        }
      }),
      transfer(thumbnailUrl(song.album.coverUrl, DOWNLOAD_COVER_SIZE), () => {}),
    ])
    if (!audio || !cover || audio.size !== size)
      return fail(song, { kind: 'interrupted' })
    const record: StoredDownload = {
      song,
      audio,
      cover,
      lyrics: lyrics.value,
      downloadedAt: clock.now(),
    }
    try {
      await local.saveDownload(record)
    }
    catch (error) {
      if (!storageFull(error))
        throw error
      return fail(song, { kind: 'storageFull' })
    }
    setRecords(new Map(records).set(song.id, record))
    tasks = new Map(tasks)
    tasks.delete(song.id)
    publish()
    context.changed()
  }

  return {
    load() {
      loading ??= local.readDownloads().then((stored) => {
        setRecords(new Map(stored.map(record => [record.song.id, record])))
        publish()
      }, (error: unknown) => {
        loading = undefined
        throw error
      })
      return loading
    },
    download(song) {
      const blocked = downloadBlock(song, current(), {
        signedIn: context.signedIn(),
        online: context.online(),
      })
      if (blocked)
        return blocked
      setTask({
        status: 'downloading',
        song,
        received: 0,
        total: null,
      })
      void run(song)
      return null
    },
    async remove(songId) {
      const { song } = recordOf(songId)
      await local.deleteDownload(songId)
      const next = new Map(records)
      next.delete(songId)
      setRecords(next)
      // 不再用的本机地址收回：这首的音频；没有别的下载用这张封面时，封面也收回
      const audio = audioUrls.get(songId)
      if (audio)
        browser.revokeObjectUrl(audio)
      audioUrls.delete(songId)
      const cover = coverUrls.get(song.album.coverUrl)
      if (cover && !covers.has(song.album.coverUrl)) {
        browser.revokeObjectUrl(cover)
        coverUrls.delete(song.album.coverUrl)
      }
      publish()
      context.changed()
    },
    audioUrl(songId) {
      let url = audioUrls.get(songId)
      if (!url) {
        url = browser.objectUrl(recordOf(songId).audio)
        audioUrls.set(songId, url)
      }
      return url
    },
    lyricsOf: songId => records?.get(songId)?.lyrics ?? null,
  }
}
