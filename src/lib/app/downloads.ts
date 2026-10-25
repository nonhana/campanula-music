import { endpoints } from '#lib/api/endpoints.js'
import type { AlbumResponse, Song } from '#lib/api/library.js'
import { thumbnailUrl } from '#lib/api/library.js'
import type { LyricsResponse } from '#lib/api/playback.js'
import { DOWNLOAD_QUALITY } from '#lib/api/playback.js'

import type { Api, Result } from './api-client'
import type { BrowserCapabilities, Clock } from './browser'
import type { LocalDb, StoredDownload } from './local'
import type { BackgroundFailure, BackgroundSessionResult, SessionRound } from './session-round'

// 下载（Spec #11“客户端：下载”、ADR-0006，#38 先做单曲）：向服务端要下载地址、歌词（后台请求），浏览器直连网易云的音频、图片服务器
// 把完整音频和封面缩略图下下来，连同歌曲信息一次存进本机。下载属于这台设备，和登录的是哪个账号无关；下载完永久可播。
// 没下成的标成失败、写明原因，再下一次就是重试，从头下（断点续传是 #39）。顺手取专辑信息存在一起，导出时写进文件（#79）。

/** 封面缩略图按多大存（px）：和锁屏上的封面一样大，断网时播放页、锁屏也看得清 */
const DOWNLOAD_COVER_SIZE = 512

export type DownloadFailure
  /** 没拿到下载地址、歌词；这一轮会话结束时也用 needsLogin 说明这首没下成。它只给界面看，不再让 App 变成登录失效；断网、操作频繁由请求节奏等过 */
  = | { kind: 'request', failure: BackgroundFailure | { kind: 'needsLogin' } }
    /** 无版权，或者这个账号下不了完整的 */
    | { kind: 'unavailable' }
    /** 断网、网易云的服务器断开或出错，或者收到的比该有的少 */
    | { kind: 'interrupted' }
    /** 这台设备的存储空间不够 */
    | { kind: 'storageFull' }

type DownloadTask
  /** 正在下：音频已经收到多少字节、一共多少字节（还没拿到下载地址、网易云没给大小时不知道，是 null） */
  = | { status: 'downloading', song: Song, received: number, total: number | null }
    /** 没下成：说明原因，再下一次就是重试 */
    | { status: 'failed', song: Song, failure: DownloadFailure }

/** App 的提示条，和改曲库共用一条 */
export interface DownloadNotice {
  kind: 'downloadFailed'
  song: Song
  failure: DownloadFailure
}

export interface DownloadsState {
  /** 最近下载完的在前；还没从本机读出来时是 null */
  songs: readonly Song[] | null
  tasks: ReadonlyMap<number, DownloadTask>
  has: (songId: number) => boolean
  /** 这张封面（网易云原图地址，同一张专辑共用）的本机缩略图地址：断网时封面、锁屏照样显示；没有下载完的歌用它时是 null */
  coverOf: (coverUrl: string) => string | null
  /** 这首下载占多少字节（音频加封面缩略图）：导出前写明会再占多少（#79） */
  sizeOf: (songId: number) => number
}

/** 已经下载完、正在下；试听、无版权的不能下载（只下完整音频）；没登录时要不到下载地址，断网时下不了。能下（包括重试）是 null */
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
  sizeOf: () => 0,
}

export interface DownloadsContext {
  api: Api
  session: SessionRound
  local: LocalDb
  clock: Clock
  browser: Pick<BrowserCapabilities, 'download' | 'objectUrl' | 'revokeObjectUrl'>
  /** 这台设备上有没有这张专辑的专辑页（曲库副本里的、这次登录打开过的）；没有是 null */
  albumPage: (albumId: number) => AlbumResponse | null
  online: () => boolean
  /** 要下载地址要用这个账号；退出、登录失效时不能下载 */
  signedIn: () => boolean
  write: (downloads: DownloadsState) => void
  notify: (notice: DownloadNotice) => void
  /** 哪些歌能离线放变了 */
  changed: () => void
}

export interface Downloads {
  load: () => Promise<void>
  /** 现在不下时返回原因，开始下了是 null */
  download: (song: Song) => DownloadBlock | null
  /** 没登录时也能删；它们的本机文件地址不再用 */
  remove: (songIds: readonly number[]) => Promise<void>
  /** 整条下载：导出时把音频、封面、歌词和歌曲信息写进文件（#79） */
  stored: (songId: number) => StoredDownload
  /** 用到时才建，删掉下载时收回 */
  audioUrl: (songId: number) => string
  lyricsOf: (songId: number) => LyricsResponse | null
}

/** IndexedDB 以 QuotaExceededError 失败；别的错是 Campanula 自己的缺陷 */
const storageFull = (error: unknown): boolean => error instanceof DOMException && error.name === 'QuotaExceededError'

export const createDownloads = (context: DownloadsContext): Downloads => {
  const { api, session, local, clock, browser } = context
  let records: Map<number, StoredDownload> | null = null
  /** records 变了才重排 */
  let songs: readonly Song[] | null = null
  /** 下载里存着的封面缩略图，按封面地址；没有封面的下载不在里面 */
  let covers = new Map<string, Blob>()
  let tasks = new Map<number, DownloadTask>()
  let loading: Promise<void> | undefined
  const audioUrls = new Map<number, string>()
  const coverUrls = new Map<string, string>()
  /** 同一批下载里同一张专辑只取一次（#79）：取到、正在取的按专辑编号记着，这次打开期间不再取；没取到的不记，下一首再取 */
  const albums = new Map<number, Promise<AlbumResponse['album'] | null>>()

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
    ].flatMap(({ song, cover }) => song.album.coverUrl !== null && cover !== null
      ? [
          [song.album.coverUrl, cover] as const,
        ]
      : []))
  }

  const coverOf = (coverUrl: string): string | null => {
    const cover = covers.get(coverUrl)
    if (!cover)
      return null
    let url = coverUrls.get(coverUrl)
    if (!url) {
      url = browser.objectUrl(cover)
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
      sizeOf: (songId) => {
        const { audio, cover } = recordOf(songId)
        return audio.size + (cover?.size ?? 0)
      },
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

  /** 断网、操作频繁由后台通道等过、重发过；这一轮结束时回 null */
  const background = <T>(send: () => Promise<Result<T>>): Promise<BackgroundSessionResult<T> | 'gaveUp'> => session.background(send, () => {})

  /** 这一轮结束（退出、登录失效）或者网易云拒绝了，这首标成没下成 */
  const refused = (song: Song, failure: Extract<DownloadFailure, { kind: 'request' }>['failure']): void => {
    fail(song, { kind: 'request', failure })
  }

  /** 传到一半断开、服务器出错都算没传完 */
  const transfer = async (url: string, onProgress: (received: number) => void): Promise<Blob | null> => {
    try {
      return await browser.download(url, onProgress)
    }
    catch {
      return null
    }
  }

  /** 专辑信息（#79）：先用这台设备上的专辑页，没有再后台请求。专辑编号是 0（云盘上传、没匹配上曲库的歌）的不取；取不到也照常下载，只是少这几项 */
  const albumOf = (song: Song): Promise<AlbumResponse['album'] | null> => {
    const id = song.album.id
    if (!id)
      return Promise.resolve(null)
    const page = context.albumPage(id)
    if (page)
      return Promise.resolve(page.album)
    let album = albums.get(id)
    if (!album) {
      album = background(() => api.get(endpoints.album, { id })).then(result => result && result !== 'gaveUp' && result.ok
        ? result.value.album
        : null)
      albums.set(id, album)
      void album.then((got) => {
        if (!got)
          albums.delete(id)
      })
    }
    return album
  }

  const run = async (song: Song): Promise<void> => {
    const [url, lyrics, album] = await Promise.all([
      background(() => api.get(endpoints.downloadUrl, { id: song.id, quality: DOWNLOAD_QUALITY })),
      background(() => api.get(endpoints.lyrics, { id: song.id })),
      albumOf(song),
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
    let shown = 0
    const coverUrl = song.album.coverUrl
    const [audio, cover] = await Promise.all([
      transfer(url.value.url, (received) => {
        // 网易云没给大小：算不出百分比，不跟着更新（#78）
        if (size === null)
          return
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
      // 网易云没给封面就不存封面，显示默认的（#78）
      coverUrl === null
        ? null
        : transfer(thumbnailUrl(coverUrl, DOWNLOAD_COVER_SIZE), () => {}),
    ])
    // 没给大小时不核对，传输没出错就算下全了（#78 作者定）
    if (!audio || (coverUrl !== null && !cover) || (size !== null && audio.size !== size))
      return fail(song, { kind: 'interrupted' })
    const record: StoredDownload = {
      song,
      audio,
      cover,
      lyrics: lyrics.value,
      album,
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
    async remove(songIds) {
      const removed = songIds.map(recordOf)
      await local.deleteDownloads(songIds)
      const next = new Map(records)
      for (const songId of songIds)
        next.delete(songId)
      setRecords(next)
      // 不再用的本机地址收回：这几首的音频；没有别的下载用这张封面时，封面也收回
      for (const { song } of removed) {
        const audio = audioUrls.get(song.id)
        if (audio)
          browser.revokeObjectUrl(audio)
        audioUrls.delete(song.id)
        const { coverUrl } = song.album
        const cover = coverUrl === null
          ? undefined
          : coverUrls.get(coverUrl)
        if (coverUrl !== null && cover && !covers.has(coverUrl)) {
          browser.revokeObjectUrl(cover)
          coverUrls.delete(coverUrl)
        }
      }
      publish()
      context.changed()
    },
    stored: recordOf,
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
