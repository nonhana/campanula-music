import { endpoints } from '#lib/api/endpoints.js'
import type { AlbumResponse, Song } from '#lib/api/library.js'
import { thumbnailUrl } from '#lib/api/library.js'
import type { LyricsResponse } from '#lib/api/playback.js'
import { DOWNLOAD_QUALITY } from '#lib/api/playback.js'

import type { Api, Result } from './api-client'
import type { BrowserCapabilities, Clock } from './browser'
import type { DownloadSource, LocalDb, StoredDownload } from './local'
import { mergeDownloadSources } from './local'
import { plainSong } from './plain'
import type { BackgroundFailure, BackgroundSessionResult, SessionRound } from './session-round'

// 下载（Spec #11“客户端：下载”、ADR-0006）：向服务端要下载地址、歌词（后台请求），浏览器直连网易云的音频、图片服务器
// 把完整音频和封面缩略图下下来，连同歌曲信息一次存进本机。下载属于这台设备，和登录的是哪个账号无关；下载完永久可播。
// #39 起是一支队列：整张歌单、专辑、多选都进同一个队列，排队 / 下载中 / 完成 / 失败各首各自记着；
// 断网中断先留在内存里，联网后带着 Range 从断点接着下；存储不够时整队暂停（规则⑪）。
// 退出、换账号时排队中的留着，谁登录就用谁的账号取下载地址（规则⑧）；正在下的那首已经拿到地址，继续下完。
// 每首记着从哪儿下载的（规则⑦），给 #40 按歌单删除用。

export type { DownloadSource }

/** 封面缩略图按多大存（px）：和锁屏上的封面一样大，断网时播放页、锁屏也看得清 */
const DOWNLOAD_COVER_SIZE = 512

export type DownloadFailure
  /** 没拿到下载地址、歌词（这一轮会话结束时不算失败，任务留在队列里等重新登录，规则⑧）；断网、操作频繁由请求节奏等过 */
  = | { kind: 'request', failure: BackgroundFailure }
    /** 无版权，或者这个账号下不了完整的 */
    | { kind: 'unavailable' }
    /** 断网、网易云的服务器断开或出错，或者收到的比该有的少 */
    | { kind: 'interrupted' }
    /** 存进本机时出了别的错（代理、数据库被别的标签页卡住等）；重试可能好 */
    | { kind: 'saveFailed' }
    /** Campanula 自己的缺陷：不让任务一直停在“下载中” */
    | { kind: 'appError' }

export type DownloadTask
  /** 排着，还没开始：received 是之前断点已经收到的字节（重试、断网从断点接着下用） */
  = | { status: 'queued', song: Song, sources: readonly DownloadSource[], received: number, total: number | null }
    /** 正在下：音频已经收到多少字节、一共多少字节（还没拿到下载地址、网易云没给大小时不知道，是 null） */
    | { status: 'downloading', song: Song, sources: readonly DownloadSource[], received: number, total: number | null }
    /** 没下成：说明原因，再下一次就是重试 */
    | { status: 'failed', song: Song, sources: readonly DownloadSource[], received: number, total: number | null, failure: DownloadFailure }

/** App 的提示条，和改曲库共用一条 */
export type DownloadNotice
  = | { kind: 'downloadFailed', song: Song, failure: DownloadFailure }
    /** 整张歌单、专辑、多选里的下载：加进了多少、跳过了多少（逐项说明）；filling 是歌单还没同步完，后面的会补上（规则⑫） */
    | { kind: 'downloadsAdded', queued: number, downloaded: number, trial: number, noCopyright: number, filling?: true }
    /** 存储空间不够，整队暂停（规则⑪）；腾出空间后点“继续下载” */
    | { kind: 'downloadsPaused' }

export interface DownloadsState {
  /** 最近下载完的在前；还没从本机读出来时是 null */
  songs: readonly Song[] | null
  /** 排队、下载中、失败的，按排队的先后 */
  tasks: ReadonlyMap<number, DownloadTask>
  /** 存储空间不够，整队暂停（规则⑪）；腾出空间后 resume */
  paused: 'storageFull' | null
  has: (songId: number) => boolean
  /** 这张封面（网易云原图地址，同一张专辑共用）的本机缩略图地址：断网时封面、锁屏照样显示；没有下载完的歌用它时是 null */
  coverOf: (coverUrl: string) => string | null
  /** 这首下载是哪几处下载的（规则⑦）：单独、几张歌单 / 专辑；#40 按歌单删除下载用它 */
  sourcesOf: (songId: number) => readonly DownloadSource[]
  /** 这首下载占多少字节（音频加封面缩略图）：导出前写明会再占多少（#79） */
  sizeOf: (songId: number) => number
}

/** 已经下载完、排队 / 正在下；试听、无版权的不能下载（只下完整音频）；没登录时要不到下载地址，断网时下不了。能下（包括重试）是 null */
export type DownloadBlock = 'downloaded' | 'queued' | 'downloading' | 'trial' | 'noCopyright' | 'signedOut' | 'offline'

/** 整批下载现在开不了：没登录，或者断网 */
export type DownloadStartBlock = Extract<DownloadBlock, 'signedOut' | 'offline'>

/** 一次整批下载的结果：自动跳过的不下，逐项数出来 */
export interface DownloadBatchOutcome {
  /** 这一批里现在排在队列里的（包括之前就排着的） */
  queued: number
  /** 已经下载过、这次只把来源补上的 */
  downloaded: number
  trial: number
  noCopyright: number
}

export const downloadBlock = (song: Song, downloads: DownloadsState, { signedIn, online }: { signedIn: boolean, online: boolean }): DownloadBlock | null => {
  if (downloads.has(song.id))
    return 'downloaded'
  const task = downloads.tasks.get(song.id)
  if (task?.status === 'downloading')
    return 'downloading'
  if (task?.status === 'queued')
    return 'queued'
  if (song.availability !== 'full')
    return song.availability
  if (!signedIn)
    return 'signedOut'
  return online ? null : 'offline'
}

export const INITIAL_DOWNLOADS: DownloadsState = {
  songs: null,
  tasks: new Map(),
  paused: null,
  has: () => false,
  coverOf: () => null,
  sourcesOf: () => [],
  sizeOf: () => 0,
}

export interface DownloadsContext {
  api: Api
  session: SessionRound
  local: LocalDb
  clock: Clock
  browser: Pick<BrowserCapabilities, 'download' | 'objectUrl' | 'revokeObjectUrl'>
  storage: Pick<BrowserCapabilities['storage'], 'estimate'>
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
  /** 整批：跳过已下载、试听、无版权的歌，逐项说明；source 记进每首下载的来源（规则⑦） */
  add: (songs: readonly Song[], source: DownloadSource, options?: { quiet?: boolean, filling?: boolean }) => Promise<DownloadBatchOutcome | DownloadStartBlock>
  /** 重新排队一首失败的；没这首、不是失败时什么都不做，返回有没有排上 */
  retry: (songId: number) => boolean
  /** 登录、联网之类让队列能动了：再试着走一步（不改变暂停） */
  wake: () => void
  /** 腾出空间后点“继续下载”（规则⑪） */
  resume: () => void
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

interface Prepared {
  url: string
  lyrics: LyricsResponse
  album: AlbumResponse['album'] | null
  size: number | null
}

type PreparedResult
  = | { kind: 'ready', value: Prepared }
    /** 这一轮会话结束了、要等联网：任务留在队列里 */
    | { kind: 'wait' }
    | { kind: 'failed', failure: DownloadFailure }

/** 一次下载要走到哪一步就停（换下一首 / 整队停） */
type StepResult = 'next' | 'wait'

export const createDownloads = (context: DownloadsContext): Downloads => {
  const { api, session, local, clock, browser } = context
  let records: Map<number, StoredDownload> | null = null
  /** records 变了才重排 */
  let songs: readonly Song[] | null = null
  /** 下载里存着的封面缩略图，按封面地址；没有封面的下载不在里面 */
  let covers = new Map<string, Blob>()
  /** 排队、下载中、失败：Map 的先后就是排队的先后 */
  const tasks = new Map<number, DownloadTask>()
  let paused: 'storageFull' | null = null
  /** 断点已经收到的字节：只在这次打开期间留着，下完、放弃时删掉 */
  const parts = new Map<number, Uint8Array<ArrayBuffer>[]>()
  const partBytes = new Map<number, number>()
  /** 音频已经完整收到（封面、保存还没成）：重试时不再重下音频 */
  const audioDone = new Set<number>()
  const audioTypes = new Map<number, string>()
  /** 已经下完、等着存进本机（存储空间不够时，腾出空间后直接存，不再下） */
  const ready = new Map<number, StoredDownload>()
  let running = false
  let again = false
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
      paused,
      has: songId => shown?.has(songId) ?? false,
      coverOf,
      sourcesOf: songId => shown?.get(songId)?.sources ?? [],
      sizeOf: (songId) => {
        const { audio, cover } = recordOf(songId)
        return audio.size + (cover?.size ?? 0)
      },
    }
  }

  const publish = (): void => {
    context.write(current())
  }

  const setTask = (songId: number, task: DownloadTask): void => {
    tasks.set(songId, task)
    publish()
  }

  const clearParts = (songId: number): void => {
    parts.delete(songId)
    partBytes.delete(songId)
    audioTypes.delete(songId)
    audioDone.delete(songId)
  }

  const chunksOf = (songId: number): Uint8Array<ArrayBuffer>[] => {
    let chunks = parts.get(songId)
    if (!chunks) {
      chunks = []
      parts.set(songId, chunks)
    }
    return chunks
  }

  const receivedOf = (songId: number): number => partBytes.get(songId) ?? 0

  const append = (songId: number, chunk: Uint8Array<ArrayBuffer>): void => {
    chunksOf(songId).push(chunk)
    partBytes.set(songId, receivedOf(songId) + chunk.byteLength)
  }

  const liveSources = (songId: number, fallback: readonly DownloadSource[]): readonly DownloadSource[] => tasks.get(songId)?.sources ?? fallback

  const queuedTask = (song: Song, sources: readonly DownloadSource[], received = 0, total: number | null = null): DownloadTask => ({
    status: 'queued',
    song,
    sources,
    received,
    total,
  })
  const downloadingTask = (song: Song, sources: readonly DownloadSource[], received: number, total: number | null): DownloadTask => ({
    status: 'downloading',
    song,
    sources,
    received,
    total,
  })
  const failedTask = (song: Song, sources: readonly DownloadSource[], received: number, total: number | null, failure: DownloadFailure): DownloadTask => ({
    status: 'failed',
    song,
    sources,
    received,
    total,
    failure,
  })

  const fail = (song: Song, sources: readonly DownloadSource[], failure: DownloadFailure, { keepParts = false } = {}): StepResult => {
    const received = keepParts
      ? receivedOf(song.id)
      : 0
    if (!keepParts)
      clearParts(song.id)
    const task = failedTask(song, tasks.get(song.id)?.sources ?? sources, received, tasks.get(song.id)?.total ?? null, failure)
    tasks.set(song.id, task)
    publish()
    context.notify({
      kind: 'downloadFailed',
      song,
      failure,
    })
    return 'next'
  }

  const pause = (): void => {
    if (paused)
      return
    paused = 'storageFull'
    publish()
    context.notify({ kind: 'downloadsPaused' })
  }

  /** 断网、操作频繁由后台通道等过、重发过；这一轮结束时回 null */
  const background = <T>(send: () => Promise<Result<T>>): Promise<BackgroundSessionResult<T> | 'gaveUp'> => session.background(send, () => {})

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

  /** 要下载地址、歌词、专辑信息；这一轮结束了（退出、登录失效、断网等）回 wait，任务留在队列里，下一次登录 / 联网接着来 */
  const prepare = async (song: Song): Promise<PreparedResult> => {
    const [url, lyrics, album] = await Promise.all([
      background(() => api.get(endpoints.downloadUrl, { id: song.id, quality: DOWNLOAD_QUALITY })),
      background(() => api.get(endpoints.lyrics, { id: song.id })),
      albumOf(song),
    ])
    if (!url || !lyrics || url === 'gaveUp' || lyrics === 'gaveUp')
      return { kind: 'wait' }
    if (!url.ok) {
      return {
        kind: 'failed',
        failure: { kind: 'request', failure: url.failure },
      }
    }
    if (!lyrics.ok) {
      return {
        kind: 'failed',
        failure: { kind: 'request', failure: lyrics.failure },
      }
    }
    if (!url.value.downloadable) {
      return {
        kind: 'failed',
        failure: { kind: 'unavailable' },
      }
    }
    return {
      kind: 'ready',
      value: {
        url: url.value.url,
        lyrics: lyrics.value,
        album,
        size: url.value.size,
      },
    }
  }

  /** 浏览器没给 usage / quota 时当作够；估不出来不能挡着下载 */
  const enoughSpace = async (bytes: number): Promise<boolean> => {
    let estimate
    try {
      estimate = await context.storage.estimate()
    }
    catch {
      return true
    }
    if (estimate.usage === null || estimate.quota === null)
      return true
    return estimate.quota - estimate.usage >= bytes
  }

  /** 存进本机。空间不够就整队暂停（规则⑪），音频留在内存里，腾出空间后直接存，不再下 */
  const save = async (songId: number, record: StoredDownload): Promise<StepResult> => {
    const size = record.audio.size + (record.cover?.size ?? 0)
    if (!await enoughSpace(size)) {
      ready.set(songId, record)
      clearParts(songId)
      const task = tasks.get(songId)
      if (task)
        setTask(songId, queuedTask(task.song, task.sources, record.audio.size, record.audio.size))
      pause()
      return 'wait'
    }
    try {
      await local.saveDownload(record)
    }
    catch (error) {
      if (storageFull(error)) {
        ready.set(songId, record)
        clearParts(songId)
        const task = tasks.get(songId)
        if (task) {
          setTask(songId, queuedTask(task.song, task.sources, record.audio.size, record.audio.size))
        }
        pause()
        return 'wait'
      }
      console.error('下载没能存进这台设备', error)
      // 音频已经收全了：重试时先再存一次，不必重下
      ready.set(songId, record)
      return fail(record.song, record.sources, { kind: 'saveFailed' })
    }
    const sources = liveSources(songId, record.sources)
    const saved = {
      ...record,
      sources: [...sources],
    }
    setRecords(new Map(records).set(songId, saved))
    tasks.delete(songId)
    ready.delete(songId)
    clearParts(songId)
    publish()
    context.changed()
    return 'next'
  }

  /** 下载这一首：准备地址（排队时不算下载中）、核对空间、从断点传，最后存进本机 */
  const step = async (songId: number): Promise<StepResult> => {
    const task = tasks.get(songId)
    if (!task || task.status !== 'queued')
      return 'next'
    const { song } = task
    const sources = task.sources
    const waiting = ready.get(songId)
    if (waiting)
      return await save(songId, waiting)
    if (!context.signedIn() || !context.online())
      return 'wait'
    // 一点空间都没有时不用先要地址：整队暂停，腾出空间再继续（规则⑪）
    if (!await enoughSpace(1)) {
      pause()
      return 'wait'
    }

    const prepared = await prepare(song)
    if (prepared.kind === 'wait')
      return 'wait'
    if (prepared.kind === 'failed')
      return fail(song, sources, prepared.failure, { keepParts: prepared.failure.kind === 'request' })
    const { url, lyrics, album, size } = prepared.value

    let audioComplete = audioDone.has(songId)
    let received = receivedOf(songId)
    const total = size ?? task.total
    // 这次拿到的地址指向另一个大小（例如换了下载音质）、或者之前收到的已经够整个文件却没有完整收尾：之前收到的不能再拼
    if (size !== null && ((task.total !== null && task.total !== size) || (!audioComplete && received >= size))) {
      clearParts(songId)
      audioComplete = false
      received = 0
    }
    tasks.set(songId, queuedTask(song, liveSources(songId, sources), received, total))
    publish()

    if (total !== null && !await enoughSpace(total)) {
      pause()
      return 'wait'
    }

    const coverUrl = song.album.coverUrl
    const coverChunks: Uint8Array<ArrayBuffer>[] = []
    let shown = received
    let downloadedType = audioTypes.get(songId) ?? ''

    const show = (next: number): void => {
      if (total === null)
        return
      const percent = Math.floor(next * 100 / total)
      if (percent === Math.floor(shown * 100 / total) && next !== total)
        return
      shown = next
      const live = tasks.get(songId)
      if (!live)
        return
      setTask(songId, downloadingTask(song, live.sources, next, total))
    }

    const live = tasks.get(songId)
    setTask(songId, downloadingTask(song, live?.sources ?? sources, received, total))

    const transferAudio = audioComplete
      ? Promise.resolve()
      : browser.download(url, (chunk) => {
          append(songId, chunk)
          show(receivedOf(songId))
        }, {
          from: received,
          restart: () => {
            clearParts(songId)
            shown = 0
            const restarted = tasks.get(songId)
            if (restarted)
              setTask(songId, downloadingTask(song, restarted.sources, 0, total))
          },
        }).then(({ type }) => {
          downloadedType = type
          audioTypes.set(songId, type)
          audioDone.add(songId)
        })
    const transferCover = coverUrl === null
      ? Promise.resolve({ type: '' })
      : browser.download(thumbnailUrl(coverUrl, DOWNLOAD_COVER_SIZE), chunk => coverChunks.push(chunk))
    const [audioResult, coverResult] = await Promise.allSettled([transferAudio, transferCover])

    if (audioResult.status === 'rejected') {
      // 断网、断流：音频留着，联网后从断点接着下
      if (!context.online()) {
        setTask(songId, queuedTask(song, liveSources(songId, sources), receivedOf(songId), tasks.get(songId)?.total ?? total))
        return 'wait'
      }
      return fail(song, sources, { kind: 'interrupted' }, { keepParts: true })
    }
    if (coverResult.status === 'rejected')
      return fail(song, sources, { kind: 'interrupted' }, { keepParts: true })

    const audio = new Blob(chunksOf(songId), {
      type: downloadedType,
    })
    // 没给大小时不核对，传输没出错就算下全了（#78 作者定）
    if (total !== null && audio.size !== total) {
      clearParts(songId)
      return fail(song, sources, { kind: 'interrupted' })
    }
    const cover = coverUrl === null
      ? null
      : new Blob(coverChunks, {
          type: coverResult.value.type,
        })
    const record: StoredDownload = {
      song,
      audio,
      cover,
      lyrics,
      album,
      sources: [...sources],
      downloadedAt: clock.now(),
    }
    return await save(songId, record)
  }

  const pump = (): void => {
    if (running) {
      again = true
      return
    }
    running = true
    void (async () => {
      try {
        for (;;) {
          again = false
          if (paused || !context.signedIn() || !context.online())
            break
          let next: [number, DownloadTask] | undefined
          for (const entry of tasks) {
            if (entry[1].status === 'queued') {
              next = entry
              break
            }
          }
          if (!next)
            break
          const [songId] = next
          let result: StepResult
          try {
            result = await step(songId)
          }
          catch (error) {
            console.error('下载出错', error)
            const task = tasks.get(songId)
            result = task
              ? fail(task.song, task.sources, { kind: 'appError' })
              : 'next'
          }
          if (result === 'wait')
            break
        }
      }
      finally {
        running = false
        if (again) {
          again = false
          pump()
        }
      }
    })()
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
      const plain = plainSong(song)
      const blocked = downloadBlock(plain, current(), {
        signedIn: context.signedIn(),
        online: context.online(),
      })
      if (blocked)
        return blocked
      const existing = tasks.get(plain.id)
      if (existing) {
        // 失败的重试：保留原来的来源，再加“单独下载”
        tasks.delete(plain.id)
        tasks.set(plain.id, queuedTask(plain, mergeDownloadSources(existing.sources, [
          { kind: 'single' },
        ]), receivedOf(plain.id), existing.total))
      }
      else {
        tasks.set(plain.id, queuedTask(plain, [
          { kind: 'single' },
        ]))
      }
      publish()
      pump()
      return null
    },
    async add(batch, source, { quiet = false, filling = false } = {}) {
      if (!context.signedIn())
        return 'signedOut'
      if (!context.online())
        return 'offline'
      const outcome: DownloadBatchOutcome = {
        queued: 0,
        downloaded: 0,
        trial: 0,
        noCopyright: 0,
      }
      const downloadedIds: number[] = []
      for (const song of new Map(batch.map(each => [
        each.id,
        plainSong(each),
      ])).values()) {
        if (records?.has(song.id)) {
          outcome.downloaded += 1
          downloadedIds.push(song.id)
          continue
        }
        const task = tasks.get(song.id)
        if (task) {
          const sources = mergeDownloadSources(task.sources, [source])
          if (task.status === 'failed') {
            tasks.delete(song.id)
            tasks.set(song.id, queuedTask(song, sources, receivedOf(song.id), task.total))
          }
          else {
            tasks.set(song.id, {
              ...task,
              sources,
            })
          }
          outcome.queued += 1
          continue
        }
        switch (song.availability) {
          case 'trial':
            outcome.trial += 1
            continue
          case 'noCopyright':
            outcome.noCopyright += 1
            continue
          case 'full':
            break
          default: {
            const unhandled: never = song.availability
            throw new Error(`不认识的歌曲状态：${JSON.stringify(unhandled)}`)
          }
        }
        tasks.set(song.id, queuedTask(song, [source]))
        outcome.queued += 1
      }
      // 已经下载过的：把这次点的歌单 / 专辑补进来源（规则⑦），下载本身不动；一个事务里全部补完
      if (downloadedIds.length > 0) {
        try {
          const updated = await local.addDownloadSources(downloadedIds, [source])
          const next = new Map(records)
          let changed = false
          for (const [songId, sources] of updated) {
            const record = next.get(songId)
            if (record) {
              next.set(songId, {
                ...record,
                sources,
              })
              changed = true
            }
          }
          if (changed)
            records = next
        }
        catch (error) {
          console.error('没能记下这些下载是从哪儿来的', error)
        }
      }
      const processed = outcome.queued > 0 || outcome.downloaded > 0 || outcome.trial > 0 || outcome.noCopyright > 0
      if (processed)
        publish()
      if (!quiet && processed) {
        context.notify({
          kind: 'downloadsAdded',
          ...outcome,
          ...(filling
            ? { filling: true as const }
            : {}),
        })
      }
      pump()
      return outcome
    },
    retry(songId) {
      const task = tasks.get(songId)
      if (!task || task.status !== 'failed')
        return false
      tasks.delete(songId)
      tasks.set(songId, queuedTask(task.song, task.sources, receivedOf(songId), task.total))
      publish()
      pump()
      return true
    },
    wake() {
      pump()
    },
    resume() {
      paused = null
      publish()
      pump()
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
