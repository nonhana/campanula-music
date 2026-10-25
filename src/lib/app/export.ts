import type { Song } from '#lib/api/library.js'
import { songTitle } from '#lib/api/library.js'

import type { FolderCapability, WritableCapability } from './browser'
import type { StoredDownload } from './local'
import type { AudioFormat } from './song-info-core'
import { writeSongInfo } from './song-info-core'

// 导出（#79，ADR-0014）：把这台设备上的下载另存一份，写进听众这次选的文件夹，并把歌曲信息写进文件；下载本身照旧留在 Campanula 里。
// 每次都重新选文件夹，不记住；已有同名文件时不覆盖，依次加“ (2)”“ (3)”。逐首写，可以取消：正在写的这首丢弃，已经写完的留着；
// 一首没写成，其余照常导出。

export type ExportFailure
  /** 文件夹所在的地方空间不够 */
  = | { kind: 'storageFull' }
  /** 文件夹不让写：没给写的权限，或者文件被别的程序占着 */
    | { kind: 'notAllowed' }
  /** 别的原因：文件夹被删了、移走了，文件名这台设备不能用 */
    | { kind: 'failed' }

export interface ExportFailed {
  song: Song
  failure: ExportFailure
}

export type ExportState
  /** 正在写第 done + 1 首（共 total 首）；written 是已经写成的那几首有多大，bytes 是全部有多大（字节），没写成的不算进 written */
  = | { status: 'writing', folder: string, total: number, done: number, written: number, bytes: number }
  /** 写完了，或者取消了（取消时正在写的那首不算导出了，也不算没写成） */
    | { status: 'finished', folder: string, exported: readonly Song[], failed: readonly ExportFailed[] }

export interface ExportContext {
  pickFolder: () => Promise<FolderCapability>
  /** 这首下载的整条记录 */
  stored: (songId: number) => StoredDownload
  sizeOf: (songId: number) => number
  write: (state: ExportState | null) => void
}

export interface Exports {
  start: (songIds: readonly number[]) => Promise<void>
  cancel: () => void
  close: () => void
}

/** 文件名里不能用的字符：Windows 不让用的 \ / : * ? " < > |，和控制字符 */
const UNSAFE = /[\\/:*?"<>|\p{Cc}]/gu
/** 常见的文件系统一个名字最多 255 字节（UTF-8）：“歌手 - 歌名”最多这么长，留出“ (999)”和扩展名 */
const BASE_BYTES = 255 - new TextEncoder().encode(' (999).flac').length

/** “歌手 - 歌名”：多位歌手用“、”连起来；去掉不能用的字符，太长时截短（不切开一个字） */
const baseNameOf = (song: Song): string => {
  const artists = song.artists.flatMap(artist => artist.name ?? [])
  const name = `${artists.length > 0
    ? artists.join('、')
    : '未知歌手'} - ${songTitle(song)}`.replace(UNSAFE, '').trim()
  const encoder = new TextEncoder()
  let bytes = 0
  let base = ''
  for (const char of name) {
    bytes += encoder.encode(char).length
    if (bytes > BASE_BYTES)
      break
    base += char
  }
  return base.trim()
}

/** 文件夹里还没有的名字：已有同名文件时不覆盖，依次加“ (2)”“ (3)” */
const freeName = async (folder: FolderCapability, base: string, format: AudioFormat): Promise<string> => {
  for (let n = 1; ; n += 1) {
    const name = n === 1
      ? `${base}.${format}`
      : `${base} (${n}).${format}`
    try {
      await folder.getFileHandle(name)
    }
    catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError')
        return name
      throw error
    }
  }
}

/** 文件系统的错是 DOMException，名字这台设备不能用是 TypeError（File System 标准）；别的是 Campanula 自己的缺陷，照样算这首没写成，另外报出来 */
const failureOf = (error: unknown): ExportFailure => {
  if (error instanceof DOMException && error.name === 'QuotaExceededError')
    return { kind: 'storageFull' }
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'NoModificationAllowedError'))
    return { kind: 'notAllowed' }
  if (!(error instanceof DOMException || error instanceof TypeError))
    console.error('导出一首时出错', error)
  return { kind: 'failed' }
}

export const createExports = (context: ExportContext): Exports => {
  let writing = false
  let cancelled = false
  /** 正在写的那首：取消时丢弃 */
  let current: WritableCapability | null = null

  /** getFileHandle 带 create 时先建了一个空文件：没写成（失败、取消）就删掉，不留下空文件 */
  const save = async (folder: FolderCapability, name: string, file: Blob): Promise<void> => {
    const handle = await folder.getFileHandle(name, { create: true })
    try {
      const writable = await handle.createWritable()
      current = writable
      try {
        await writable.write(file)
        await writable.close()
      }
      catch (error) {
        await writable.abort()
        throw error
      }
      finally {
        current = null
      }
    }
    catch (error) {
      // 文件夹已经不在了时删不掉，不影响报的原因
      await folder.removeEntry(name).catch(() => {})
      throw error
    }
  }

  return {
    async start(songIds) {
      if (writing)
        return
      const records = songIds.map(context.stored)
      // 文件夹选择器必须在听众点按的那一下里弹出（ADR-0014）：在这之前不能 await
      const picking = context.pickFolder()
      writing = true
      cancelled = false
      try {
        let folder: FolderCapability
        try {
          folder = await picking
        }
        catch (error) {
          // 听众取消了、不给写的权限：什么都不做
          if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError'))
            return
          throw error
        }
        const bytes = records.reduce((sum, record) => sum + context.sizeOf(record.song.id), 0)
        const exported: Song[] = []
        const failed: ExportFailed[] = []
        let written = 0
        for (const [done, record] of records.entries()) {
          if (cancelled)
            break
          context.write({
            status: 'writing',
            folder: folder.name,
            total: records.length,
            done,
            written,
            bytes,
          })
          try {
            const { format, file } = await writeSongInfo(record.audio, record)
            const name = await freeName(folder, baseNameOf(record.song), format)
            if (cancelled)
              break
            await save(folder, name, file)
            exported.push(record.song)
            written += context.sizeOf(record.song.id)
          }
          catch (error) {
            if (cancelled)
              break
            failed.push({
              song: record.song,
              failure: failureOf(error),
            })
          }
        }
        // 一首都还没写完就取消了：和没导出一样
        context.write(exported.length === 0 && failed.length === 0
          ? null
          : {
              status: 'finished',
              folder: folder.name,
              exported,
              failed,
            })
      }
      finally {
        writing = false
      }
    },
    cancel() {
      if (!writing)
        return
      cancelled = true
      void current?.abort()
    },
    close() {
      if (!writing)
        context.write(null)
    },
  }
}
