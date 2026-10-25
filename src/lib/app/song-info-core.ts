import { ID3Writer } from 'browser-id3-writer'

import type { AlbumResponse, Song } from '#lib/api/library.js'
import type { LyricsResponse } from '#lib/api/playback.js'

// 写歌曲信息的纯核心（#79）：输入原文件和下载里存着的歌曲信息，输出写好歌曲信息的新文件，别的播放器也能显示歌名、歌手、专辑、
// 第几首、封面和歌词。格式看文件开头的字节：fLaC 是 flac，其余按 mp3（存进本机的类型不可靠，无损的也是 audio/mpeg，#40）。
// 只写网易云给了的，拿不到的不写、不编造（ADR-0014）。原文件只读开头和结尾几块，音频部分用 Blob 切片接上，不整首读进内存。

export interface SongInfo {
  song: Song
  /** 下载时顺手取的专辑信息；取不到、#79 以前下载的是 null */
  album: AlbumResponse['album'] | null
  /** 下载时存的 512px 封面缩略图 */
  cover: Blob | null
  lyrics: LyricsResponse
}

export type AudioFormat = 'mp3' | 'flac'

/** 署名行（“作词 : …”）里认得的几种：写进作词、作曲、编曲、制作人；名字之间用 / 或、隔开 */
const CREDIT_LINE = /^(作词|作曲|编曲|制作人)\s*[:：]\s*(\S.*)$/
const CREDIT_ROLES = {
  作词: 'lyricist',
  作曲: 'composer',
  编曲: 'arranger',
  制作人: 'producer',
} as const

type Role = typeof CREDIT_ROLES[keyof typeof CREDIT_ROLES]

/** 网易云的时间按北京时间换算成日期 */
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

/** 写进文件的各项，拿不到的是 null 或空的 */
interface Tags {
  title: string | null
  artists: string[]
  album: string | null
  albumArtist: string | null
  track: { no: number, of: number | null } | null
  /** “1”或“1/2” */
  disc: string | null
  released: { year: number, date: string } | null
  subtitle: string | null
  translatedTitle: string | null
  label: string | null
  credits: Record<Role, string[]>
  cover: { mime: string, data: Uint8Array<ArrayBuffer> } | null
  lyrics: { synced: string, plain: string } | null
  yrc: string | null
  romalrc: string | null
  songId: number
  url: string
  duration: number | null
}

const present = (text: string | null | undefined): string | null => text?.trim()
  ? text
  : null

const joined = (texts: readonly string[], separator: string): string | null => present(texts.filter(text => text.trim()).join(separator))

/** 碟号是自由文本，只认能读出的正整数：“01”是 1，“1/2”是 1/2，“CD 01 …”是 1；“A”“无”“0”不写 */
const discOf = (disc: string | null): string | null => {
  const match = disc === null
    ? null
    : /(\d+)(?:\s*\/\s*(\d+))?/.exec(disc)
  if (!match)
    return null
  const no = Number(match[1])
  const of = Number(match[2] ?? 0)
  if (no <= 0)
    return null
  return of > 0
    ? `${no}/${of}`
    : `${no}`
}

/** 歌曲的发行时间；网易云写 0、专辑页里的歌不给时用专辑的 */
const releasedOf = (song: Song, album: SongInfo['album']): Tags['released'] => {
  const at = [song.publishedAt, album?.publishedAt].find(time => time != null && time > 0)
  if (at == null)
    return null
  const day = new Date(at + BEIJING_OFFSET_MS)
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    year: day.getUTCFullYear(),
    date: `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`,
  }
}

/** [分:秒.毫秒] */
const timestamp = (seconds: number): string => {
  const ms = Math.round(seconds * 1000)
  const pad = (value: number, width: number) => String(value).padStart(width, '0')
  return `[${pad(Math.floor(ms / 60_000), 2)}:${pad(Math.floor(ms % 60_000 / 1000), 2)}.${pad(ms % 1000, 3)}]`
}

/** 主歌词按椒盐音乐 SPL 的写法：每行带时间的原文，下一行是同一时间戳的翻译；署名行留在开头。另给一份不带时间的纯文本 */
const lyricsOf = (lyrics: LyricsResponse): Tags['lyrics'] => {
  if (lyrics.kind === 'pureMusic' || lyrics.kind === 'none')
    return null
  const rows = lyrics.lines.flatMap(line => [line.text, line.translation ?? []].flat().map(text => ({ start: line.start, text })))
  return {
    synced: rows.map(row => `${timestamp(row.start)}${row.text}`).join('\n'),
    plain: rows.map(row => row.text).join('\n'),
  }
}

const creditsOf = (lyrics: LyricsResponse): Tags['credits'] => {
  const credits: Tags['credits'] = {
    lyricist: [],
    composer: [],
    arranger: [],
    producer: [],
  }
  if (lyrics.kind === 'pureMusic' || lyrics.kind === 'none')
    return credits
  for (const line of lyrics.lines) {
    const match = CREDIT_LINE.exec(line.text.trim())
    if (!match)
      continue
    const names = credits[CREDIT_ROLES[match[1] as keyof typeof CREDIT_ROLES]]
    for (const name of match[2].split(/[/／、]/).map(part => part.trim())) {
      if (name && !names.includes(name))
        names.push(name)
    }
  }
  return credits
}

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean => signature.every((byte, index) => bytes[index] === byte)

/** 封面只写 JPEG、PNG（ID3v2.3 和 FLAC 都通用的两种）；认不出的不写 */
const coverOf = async (cover: Blob | null): Promise<Tags['cover']> => {
  if (!cover)
    return null
  const data = new Uint8Array(await cover.arrayBuffer())
  if (startsWith(data, [0xFF, 0xD8, 0xFF]))
    return { mime: 'image/jpeg', data }
  if (startsWith(data, [
    0x89,
    0x50,
    0x4E,
    0x47,
    0x0D,
    0x0A,
    0x1A,
    0x0A,
  ])) {
    return { mime: 'image/png', data }
  }
  return null
}

const tagsOf = async ({ song, album, cover, lyrics }: SongInfo): Promise<Tags> => ({
  title: present(song.name),
  artists: song.artists.flatMap(artist => present(artist.name) ?? []),
  album: present(song.album.name),
  albumArtist: present(album?.artist.name),
  track: song.trackNumber !== null && song.trackNumber > 0
    ? {
        no: song.trackNumber,
        of: album?.songCount != null && album.songCount > 0
          ? album.songCount
          : null,
      }
    : null,
  disc: discOf(song.disc),
  released: releasedOf(song, album),
  subtitle: joined(song.aliases, ' / '),
  translatedTitle: joined(song.translations, ' / '),
  label: present(album?.company),
  credits: creditsOf(lyrics),
  cover: await coverOf(cover),
  lyrics: lyricsOf(lyrics),
  yrc: lyrics.kind === 'word' || lyrics.kind === 'line'
    ? present(lyrics.yrc)
    : null,
  romalrc: lyrics.kind === 'word' || lyrics.kind === 'line'
    ? present(lyrics.romalrc)
    : null,
  songId: song.id,
  url: `https://music.163.com/song?id=${song.id}`,
  duration: song.duration !== null && song.duration > 0
    ? song.duration
    : null,
})

const bytesAt = async (file: Blob, start: number, end: number): Promise<Uint8Array> => new Uint8Array(await file.slice(start, end).arrayBuffer())

const ascii = (text: string): number[] => [...text].map(char => char.charCodeAt(0))

/** ID3v2 标签的长度：头 10 字节加尺寸（4 个 7 位字节），v2.4 带尾的再加 10（ID3v2.4 §3.1、§3.4） */
const id3v2Length = (head: Uint8Array): number => startsWith(head, ascii('ID3'))
  ? 10 + ((head[6] << 21) | (head[7] << 14) | (head[8] << 7) | head[9]) + ((head[5] & 0x10)
    ? 10
    : 0)
  : 0

/** ID3v2.3，文字用 UTF-16（browser-id3-writer 只生成标签，原文件的 ID3v2 和结尾的 ID3v1 去掉，音频原样接上） */
const writeMp3 = async (audio: Blob, tags: Tags): Promise<Blob> => {
  const writer = new ID3Writer(new ArrayBuffer(0))
  if (tags.title)
    writer.setFrame('TIT2', tags.title)
  if (tags.artists.length > 0)
    writer.setFrame('TPE1', tags.artists)
  if (tags.album)
    writer.setFrame('TALB', tags.album)
  if (tags.albumArtist)
    writer.setFrame('TPE2', tags.albumArtist)
  if (tags.track) {
    writer.setFrame('TRCK', tags.track.of === null
      ? `${tags.track.no}`
      : `${tags.track.no}/${tags.track.of}`)
  }
  if (tags.disc)
    writer.setFrame('TPOS', tags.disc)
  if (tags.released)
    writer.setFrame('TYER', tags.released.year)
  if (tags.subtitle)
    writer.setFrame('TIT3', tags.subtitle)
  if (tags.translatedTitle)
    writer.setFrame('TXXX', { description: 'TRANSLATED_TITLE', value: tags.translatedTitle })
  if (tags.label)
    writer.setFrame('TPUB', tags.label)
  if (tags.credits.composer.length > 0)
    writer.setFrame('TCOM', tags.credits.composer)
  if (tags.credits.lyricist.length > 0)
    writer.setFrame('TEXT', tags.credits.lyricist.join('/'))
  const involved = [
    ...tags.credits.arranger.map(name => ['arranger', name] as const),
    ...tags.credits.producer.map(name => ['producer', name] as const),
  ]
  if (involved.length > 0)
    writer.setFrame('IPLS', involved)
  if (tags.cover)
    writer.setFrame('APIC', { type: 3, data: tags.cover.data.buffer, description: '' })
  // 语言不知道时写 XXX（ID3v2.3 §4.9）
  if (tags.lyrics)
    writer.setFrame('USLT', { description: '', lyrics: tags.lyrics.synced, language: 'XXX' })
  if (tags.yrc)
    writer.setFrame('TXXX', { description: 'NETEASE_YRC', value: tags.yrc })
  if (tags.romalrc)
    writer.setFrame('TXXX', { description: 'NETEASE_ROMALRC', value: tags.romalrc })
  writer.setFrame('TXXX', {
    description: 'NETEASE_SONG_ID',
    value: String(tags.songId),
  })
  writer.setFrame('WOAS', tags.url)
  if (tags.duration !== null)
    writer.setFrame('TLEN', tags.duration)

  let start = 0
  for (let length = id3v2Length(await bytesAt(audio, 0, 10)); length > 0; length = id3v2Length(await bytesAt(audio, start, start + 10)))
    start += length
  const end = audio.size - start >= 128 && startsWith(await bytesAt(audio, audio.size - 128, audio.size - 125), ascii('TAG'))
    ? audio.size - 128
    : audio.size
  return new Blob([
    writer.addTag(),
    audio.slice(start, end),
  ], { type: 'audio/mpeg' })
}

/** FLAC 元数据块的种类（RFC 9639 §8.1） */
const BLOCK = { padding: 1, vorbisComment: 4, picture: 6 } as const

const header = (type: number, length: number, last: boolean): Uint8Array<ArrayBuffer> => new Uint8Array([
  (last ? 0x80 : 0) | type,
  (length >> 16) & 0xFF,
  (length >> 8) & 0xFF,
  length & 0xFF,
])

const utf8 = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text)

/** Vorbis 注释（RFC 9639 §8.6）：长度是小端的 */
const vorbisComment = (vendor: Uint8Array, fields: readonly (readonly [string, string])[]): Uint8Array<ArrayBuffer> => {
  const entries = fields.map(([name, value]) => utf8(`${name}=${value}`))
  const body = new Uint8Array(4 + vendor.length + 4 + entries.reduce((sum, entry) => sum + 4 + entry.length, 0))
  const view = new DataView(body.buffer)
  view.setUint32(0, vendor.length, true)
  body.set(vendor, 4)
  let at = 4 + vendor.length
  view.setUint32(at, entries.length, true)
  at += 4
  for (const entry of entries) {
    view.setUint32(at, entry.length, true)
    body.set(entry, at + 4)
    at += 4 + entry.length
  }
  return body
}

/** 封面（RFC 9639 §8.8）：类型 3 是正面封面；宽、高、色深、颜色数不知道时写 0 */
const pictureBlock = ({ mime, data }: NonNullable<Tags['cover']>): Uint8Array<ArrayBuffer> => {
  const type = utf8(mime)
  const body = new Uint8Array(4 + 4 + type.length + 4 + 4 * 4 + 4 + data.length)
  const view = new DataView(body.buffer)
  view.setUint32(0, 3)
  view.setUint32(4, type.length)
  body.set(type, 8)
  let at = 8 + type.length
  // 描述是空的；宽、高、色深、颜色数都是 0
  at += 4 + 4 * 4
  view.setUint32(at, data.length)
  body.set(data, at + 4)
  return body
}

/** 一项一条；歌手、作曲这类每人一条（RFC 9639 §8.6 允许同名的几条）。拿不到的（null）不写 */
const flacFields = (tags: Tags): (readonly [string, string])[] => {
  const fields: (readonly [string, string | null])[] = [
    ['TITLE', tags.title],
    ...tags.artists.map(name => ['ARTIST', name] as const),
    ['ALBUM', tags.album],
    ['ALBUMARTIST', tags.albumArtist],
    ['TRACKNUMBER', tags.track && `${tags.track.no}`],
    [
      'TRACKTOTAL',
      tags.track?.of != null
        ? `${tags.track.of}`
        : null,
    ],
    ['DISCNUMBER', tags.disc],
    ['DATE', tags.released?.date ?? null],
    ['SUBTITLE', tags.subtitle],
    ['TRANSLATED_TITLE', tags.translatedTitle],
    ['LABEL', tags.label],
    ...tags.credits.composer.map(name => ['COMPOSER', name] as const),
    ...tags.credits.lyricist.map(name => ['LYRICIST', name] as const),
    ...tags.credits.arranger.map(name => ['ARRANGER', name] as const),
    ...tags.credits.producer.map(name => ['PRODUCER', name] as const),
    ['LYRICS', tags.lyrics?.synced ?? null],
    ['UNSYNCEDLYRICS', tags.lyrics?.plain ?? null],
    ['NETEASE_YRC', tags.yrc],
    ['NETEASE_ROMALRC', tags.romalrc],
    [
      'NETEASE_SONG_ID',
      String(tags.songId),
    ],
    ['NETEASE_URL', tags.url],
  ]
  return fields.filter((field): field is readonly [string, string] => field[1] !== null)
}

/**
 * FLAC（RFC 9639）：STREAMINFO 排第一，SEEKTABLE 等和音频有关的块原样保留；换掉 VORBIS_COMMENT（保留原来的 vendor）和 PICTURE，旧的填充不要。
 * SEEKTABLE 的偏移从第一帧算起（§8.5.1 表 7），元数据变长不用改
 */
const writeFlac = async (audio: Blob, tags: Tags): Promise<Blob> => {
  const kept: Blob[] = []
  let vendor = new Uint8Array()
  let at = 4
  for (let last = false; !last;) {
    const head = await bytesAt(audio, at, at + 4)
    const length = (head[1] << 16) | (head[2] << 8) | head[3]
    // 下载被截断、文件坏了：元数据块在文件结束前没走完，这首没法写，不往下读
    if (head.length < 4 || at + 4 + length > audio.size)
      throw new Error(`flac 的元数据块在第 ${at} 字节处超出了文件（${audio.size} 字节）`)
    last = (head[0] & 0x80) !== 0
    const type = head[0] & 0x7F
    const body = audio.slice(at + 4, at + 4 + length)
    if (type === BLOCK.vorbisComment) {
      const bytes = new Uint8Array(await body.arrayBuffer())
      vendor = bytes.slice(4, 4 + new DataView(bytes.buffer).getUint32(0, true))
    }
    else if (type !== BLOCK.picture && type !== BLOCK.padding) {
      kept.push(new Blob([
        header(type, length, false),
        body,
      ]))
    }
    at += 4 + length
  }
  const comment = vorbisComment(vendor, flacFields(tags))
  const picture = tags.cover && pictureBlock(tags.cover)
  const blocks: BlobPart[] = [
    ...kept,
    header(BLOCK.vorbisComment, comment.length, picture === null),
    comment,
    ...(picture
      ? [
          header(BLOCK.picture, picture.length, true),
          picture,
        ]
      : []),
  ]
  return new Blob([
    new Uint8Array(ascii('fLaC')),
    ...blocks,
    audio.slice(at),
  ], { type: 'audio/flac' })
}

export const writeSongInfo = async (audio: Blob, info: SongInfo): Promise<{ format: AudioFormat, file: Blob }> => {
  const tags = await tagsOf(info)
  const flac = startsWith(await bytesAt(audio, 0, 4), ascii('fLaC'))
  return flac
    ? { format: 'flac', file: await writeFlac(audio, tags) }
    : { format: 'mp3', file: await writeMp3(audio, tags) }
}
