import type { Song } from '#lib/api/library.js';
import { songTitle } from '#lib/api/library.js';

import type { FolderCapability, WritableCapability } from './browser';
import type { StoredDownload } from './local';
import type { AudioFormat } from './song-info-core';
import { writeSongInfo } from './song-info-core';

export type ExportFailure =
  | { kind: 'storageFull' }
  | { kind: 'notAllowed' }
  | { kind: 'failed' };

export interface ExportFailed {
  song: Song;
  failure: ExportFailure;
}

export type ExportState =
  | {
      status: 'writing';
      folder: string;
      total: number;
      done: number;
      written: number;
      bytes: number;
    }
  | {
      status: 'finished';
      folder: string;
      exported: readonly Song[];
      failed: readonly ExportFailed[];
    };

export interface ExportContext {
  pickFolder: () => Promise<FolderCapability>;
  stored: (songId: number) => StoredDownload;
  sizeOf: (songId: number) => number;
  write: (state: ExportState | null) => void;
}

export interface Exports {
  start: (songIds: readonly number[]) => Promise<void>;
  cancel: () => void;
  close: () => void;
}

const UNSAFE = /[\\/:*?"<>|\p{Cc}]/gu;
const BASE_BYTES = 255 - new TextEncoder().encode(' (999).flac').length;

const baseNameOf = (song: Song): string => {
  const artists = song.artists.flatMap((artist) => artist.name ?? []);
  const name = `${
    artists.length > 0 ? artists.join('、') : '未知歌手'
  } - ${songTitle(song)}`
    .replace(UNSAFE, '')
    .trim();
  const encoder = new TextEncoder();
  let bytes = 0;
  let base = '';
  for (const char of name) {
    bytes += encoder.encode(char).length;
    if (bytes > BASE_BYTES) break;
    base += char;
  }
  return base.trim();
};

const freeName = async (
  folder: FolderCapability,
  base: string,
  format: AudioFormat,
): Promise<string> => {
  for (let n = 1; ; n += 1) {
    const name = n === 1 ? `${base}.${format}` : `${base} (${n}).${format}`;
    try {
      await folder.getFileHandle(name);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError')
        return name;
      throw error;
    }
  }
};

const failureOf = (error: unknown): ExportFailure => {
  if (error instanceof DOMException && error.name === 'QuotaExceededError')
    return { kind: 'storageFull' };
  if (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' ||
      error.name === 'NoModificationAllowedError')
  )
    return { kind: 'notAllowed' };
  if (!(error instanceof DOMException || error instanceof TypeError))
    console.error('导出一首时出错', error);
  return { kind: 'failed' };
};

export const createExports = (context: ExportContext): Exports => {
  let writing = false;
  let cancelled = false;
  let current: WritableCapability | null = null;

  // 带 create 会先建空文件，没写成时要删掉
  const save = async (
    folder: FolderCapability,
    name: string,
    file: Blob,
  ): Promise<void> => {
    const handle = await folder.getFileHandle(name, { create: true });
    try {
      const writable = await handle.createWritable();
      current = writable;
      try {
        await writable.write(file);
        await writable.close();
      } catch (error) {
        await writable.abort();
        throw error;
      } finally {
        current = null;
      }
    } catch (error) {
      await folder.removeEntry(name).catch(() => {});
      throw error;
    }
  };

  return {
    async start(songIds) {
      if (writing) return;
      const records = songIds.map(context.stored);
      // 选择器必须在听众点按的那一下里弹出，在这之前不能 await
      const picking = context.pickFolder();
      writing = true;
      cancelled = false;
      try {
        let folder: FolderCapability;
        try {
          folder = await picking;
        } catch (error) {
          if (
            error instanceof DOMException &&
            (error.name === 'AbortError' || error.name === 'NotAllowedError')
          )
            return;
          throw error;
        }
        const bytes = records.reduce(
          (sum, record) => sum + context.sizeOf(record.song.id),
          0,
        );
        const exported: Song[] = [];
        const failed: ExportFailed[] = [];
        let written = 0;
        for (const [done, record] of records.entries()) {
          if (cancelled) break;
          context.write({
            status: 'writing',
            folder: folder.name,
            total: records.length,
            done,
            written,
            bytes,
          });
          try {
            const { format, file } = await writeSongInfo(record.audio, record);
            const name = await freeName(
              folder,
              baseNameOf(record.song),
              format,
            );
            if (cancelled) break;
            await save(folder, name, file);
            exported.push(record.song);
            written += context.sizeOf(record.song.id);
          } catch (error) {
            if (cancelled) break;
            failed.push({
              song: record.song,
              failure: failureOf(error),
            });
          }
        }
        context.write(
          exported.length === 0 && failed.length === 0
            ? null
            : {
                status: 'finished',
                folder: folder.name,
                exported,
                failed,
              },
        );
      } finally {
        writing = false;
      }
    },
    cancel() {
      if (!writing) return;
      cancelled = true;
      void current?.abort();
    },
    close() {
      if (!writing) context.write(null);
    },
  };
};
