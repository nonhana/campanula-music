import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseBuffer } from 'music-metadata'
import { describe, expect, it } from 'vitest'

import type { AlbumResponse, Song } from '#lib/api/library.js'
import type { LyricsResponse } from '#lib/api/playback.js'
import type { SongInfo } from '#lib/app/song-info-core.js'
import { writeSongInfo } from '#lib/app/song-info-core.js'

// 写歌曲信息核心（#79，第六个纯逻辑接入点）：输入原文件和下载里存着的歌曲信息，输出新文件。用 music-metadata 把新文件解回来，
// 逐项核对票里那张表；音频部分一个字节不差。样本是生成的两秒静音（tests/fixtures/audio/README.md），不是真歌。

const AUDIO = join(import.meta.dirname, 'fixtures/audio')
const bytesOf = (name: string): Uint8Array<ArrayBuffer> => new Uint8Array(readFileSync(join(AUDIO, name)))
/** 带着旧的 ID3v2.4（标题“旧标题”）和结尾的 ID3v1 */
const MP3 = bytesOf('silence.mp3')
/** 带着旧的 VORBIS_COMMENT（标题“旧标题”）、一张旧封面、SEEKTABLE 和 8 KB 填充 */
const FLAC = bytesOf('silence.flac')
const COVER = bytesOf('cover.jpg')

const song: Song = {
  id: 34586046,
  name: 'Fight Or Flight',
  artists: [
    { id: 99995, name: 'Stereophonics' },
    { id: 1, name: 'Kelly Jones' },
  ],
  album: { id: 3149073, name: 'Keep The Village Alive', coverUrl: 'https://p4.music.126.net/cover.jpg' },
  duration: 221146,
  downloadSize: null,
  availability: 'full',
  trackNumber: 6,
  disc: '1/2',
  aliases: ['别名一', '别名二'],
  translations: ['战或逃'],
  // 北京时间 2015-09-11 00:00:00.007
  publishedAt: 1441900800007,
}

const album: AlbumResponse['album'] = {
  id: 3149073,
  name: 'Keep The Village Alive',
  coverUrl: 'https://p4.music.126.net/cover.jpg',
  artist: { id: 99995, name: 'Stereophonics' },
  publishedAt: 1441900800000,
  description: null,
  songCount: 10,
  company: '华纳音乐',
}

const lyrics: LyricsResponse = {
  kind: 'word',
  lines: [
    {
      start: 0,
      text: '作词: Kelly Jones',
      words: null,
      translation: null,
      romanization: null,
    },
    {
      start: 0.276,
      text: '作曲: Kelly Jones/Richard Jones',
      words: null,
      translation: null,
      romanization: null,
    },
    {
      start: 0.552,
      text: '编曲 : Stereophonics',
      words: null,
      translation: null,
      romanization: null,
    },
    {
      start: 0.828,
      text: '制作人：Jim Lowe、Kelly Jones',
      words: null,
      translation: null,
      romanization: null,
    },
    {
      start: 12.5,
      text: 'Fight or flight',
      words: [
        { start: 12.5, end: 13, text: 'Fight or flight' },
      ],
      translation: '战或逃',
      romanization: null,
    },
    {
      start: 75.04,
      text: 'No translation here',
      words: [
        { start: 75.04, end: 76, text: 'No translation here' },
      ],
      translation: null,
      romanization: null,
    },
  ],
  translated: true,
  romanized: false,
  yrc: '[12500,500](12500,500,0)Fight or flight',
  romalrc: '[00:12.500]fight or flight',
}

const full: SongInfo = {
  song,
  album,
  cover: new Blob([COVER]),
  lyrics,
}

/** 主歌词（椒盐音乐 SPL 的写法）：每行带时间的原文，下一行是同一时间戳的翻译；署名行留在开头 */
const SYNCED = [
  '[00:00.000]作词: Kelly Jones',
  '[00:00.276]作曲: Kelly Jones/Richard Jones',
  '[00:00.552]编曲 : Stereophonics',
  '[00:00.828]制作人：Jim Lowe、Kelly Jones',
  '[00:12.500]Fight or flight',
  '[00:12.500]战或逃',
  '[01:15.040]No translation here',
].join('\n')

const parse = async (file: Blob) => parseBuffer(new Uint8Array(await file.arrayBuffer()))

/** 一个 ID3v2 标签多长（头 10 字节 + 尺寸，尺寸是 4 个 7 位字节，ID3v2.3 §3.1） */
const id3Length = (bytes: Uint8Array): number => bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33
  ? 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9])
  : 0

/** FLAC 的元数据块（RFC 9639 §8.1：头 1 字节的最高位是“最后一块”，低 7 位是种类，3 字节大端的长度）和第一帧从哪开始 */
const flacBlocks = (bytes: Uint8Array): { blocks: { type: number, body: Uint8Array }[], frames: number } => {
  const blocks: { type: number, body: Uint8Array }[] = []
  let at = 4
  for (let last = false; !last;) {
    last = (bytes[at] & 0x80) !== 0
    const length = (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]
    blocks.push({
      type: bytes[at] & 0x7F,
      body: bytes.subarray(at + 4, at + 4 + length),
    })
    at += 4 + length
  }
  return { blocks, frames: at }
}

/** VORBIS_COMMENT 开头的 vendor（长度是小端的，RFC 9639 §8.6） */
const vendorOf = (body: Uint8Array): string => new TextDecoder().decode(body.subarray(4, 4 + new DataView(body.buffer, body.byteOffset).getUint32(0, true)))

describe('mp3：ID3v2.3', () => {
  it('表里每一项都写进去：歌名、歌手、专辑、专辑歌手、第几首、碟号、年份、别名、译名、发行公司、作曲作词编曲制作人、封面、歌词、逐字时间、音译、网易云编号和页面、时长', async () => {
    const { format, file } = await writeSongInfo(new Blob([MP3]), full)
    expect(format).toBe('mp3')
    const { common, native } = await parse(file)
    expect(common).toMatchObject({
      title: 'Fight Or Flight',
      artists: ['Stereophonics', 'Kelly Jones'],
      album: 'Keep The Village Alive',
      albumartist: 'Stereophonics',
      track: { no: 6, of: 10 },
      disk: { no: 1, of: 2 },
      year: 2015,
      subtitle: ['别名一 / 别名二'],
      label: ['华纳音乐'],
      lyricist: ['Kelly Jones'],
      composer: ['Kelly Jones', 'Richard Jones'],
      arranger: ['Stereophonics'],
      producer: ['Jim Lowe', 'Kelly Jones'],
      lyrics: [
        { text: SYNCED },
      ],
    })
    expect(common.picture).toEqual([
      expect.objectContaining({ format: 'image/jpeg', type: 'Cover (front)', data: COVER }),
    ])
    const frames = Object.fromEntries((native['ID3v2.3'] ?? []).map(tag => [tag.id, tag.value]))
    expect(frames).toMatchObject({
      'TXXX:TRANSLATED_TITLE': '战或逃',
      'TXXX:NETEASE_YRC': '[12500,500](12500,500,0)Fight or flight',
      'TXXX:NETEASE_ROMALRC': '[00:12.500]fight or flight',
      'TXXX:NETEASE_SONG_ID': '34586046',
      'WOAS': 'https://music.163.com/song?id=34586046',
      'TLEN': '221146',
    })
  })

  it('去掉原来开头的 ID3v2、结尾的 ID3v1，新标签拼在原音频前面，音频部分一个字节不差', async () => {
    const { file } = await writeSongInfo(new Blob([MP3]), full)
    const written = new Uint8Array(await file.arrayBuffer())
    const audio = MP3.subarray(id3Length(MP3), MP3.length - 128)
    expect(new TextDecoder().decode(MP3.subarray(MP3.length - 128, MP3.length - 125))).toBe('TAG')
    expect(written.subarray(id3Length(written))).toEqual(audio)
    const { common, native } = await parse(file)
    expect(common.title).toBe('Fight Or Flight')
    expect(Object.keys(native)).toEqual(['ID3v2.3'])
  })
})

describe('flac：Vorbis 注释和 PICTURE 块', () => {
  it('表里每一项都写进去：歌手每位一条，日期写 YYYY-MM-DD，歌词带时间的和纯文本的各一份；时长不写（STREAMINFO 里本来就有）', async () => {
    const { format, file } = await writeSongInfo(new Blob([FLAC]), full)
    expect(format).toBe('flac')
    const { common, native } = await parse(file)
    expect(common).toMatchObject({
      title: 'Fight Or Flight',
      artists: ['Stereophonics', 'Kelly Jones'],
      album: 'Keep The Village Alive',
      albumartist: 'Stereophonics',
      track: { no: 6, of: 10 },
      disk: { no: 1, of: 2 },
      date: '2015-09-11',
      subtitle: ['别名一 / 别名二'],
      label: ['华纳音乐'],
      lyricist: ['Kelly Jones'],
      composer: ['Kelly Jones', 'Richard Jones'],
      arranger: ['Stereophonics'],
      producer: ['Jim Lowe', 'Kelly Jones'],
    })
    expect(common.picture).toEqual([
      expect.objectContaining({ format: 'image/jpeg', type: 'Cover (front)', data: COVER }),
    ])
    expect((native.vorbis ?? []).filter(tag => tag.id !== 'METADATA_BLOCK_PICTURE').map(tag => [tag.id, tag.value])).toEqual([
      ['TITLE', 'Fight Or Flight'],
      ['ARTIST', 'Stereophonics'],
      ['ARTIST', 'Kelly Jones'],
      ['ALBUM', 'Keep The Village Alive'],
      ['ALBUMARTIST', 'Stereophonics'],
      ['TRACKNUMBER', '6'],
      ['TRACKTOTAL', '10'],
      ['DISCNUMBER', '1/2'],
      ['DATE', '2015-09-11'],
      ['SUBTITLE', '别名一 / 别名二'],
      ['TRANSLATED_TITLE', '战或逃'],
      ['LABEL', '华纳音乐'],
      ['COMPOSER', 'Kelly Jones'],
      ['COMPOSER', 'Richard Jones'],
      ['LYRICIST', 'Kelly Jones'],
      ['ARRANGER', 'Stereophonics'],
      ['PRODUCER', 'Jim Lowe'],
      ['PRODUCER', 'Kelly Jones'],
      ['LYRICS', SYNCED],
      [
        'UNSYNCEDLYRICS',
        [
          '作词: Kelly Jones',
          '作曲: Kelly Jones/Richard Jones',
          '编曲 : Stereophonics',
          '制作人：Jim Lowe、Kelly Jones',
          'Fight or flight',
          '战或逃',
          'No translation here',
        ].join('\n'),
      ],
      ['NETEASE_YRC', '[12500,500](12500,500,0)Fight or flight'],
      ['NETEASE_ROMALRC', '[00:12.500]fight or flight'],
      ['NETEASE_SONG_ID', '34586046'],
      ['NETEASE_URL', 'https://music.163.com/song?id=34586046'],
    ])
  })

  it('sTREAMINFO 排第一、SEEKTABLE 原样保留，换掉 VORBIS_COMMENT（vendor 不变）和 PICTURE，旧的填充不要；音频部分一个字节不差，仍能解出时长', async () => {
    const { file } = await writeSongInfo(new Blob([FLAC]), full)
    const written = new Uint8Array(await file.arrayBuffer())
    const before = flacBlocks(FLAC)
    const after = flacBlocks(written)
    expect(before.blocks.map(block => block.type)).toEqual([0, 3, 4, 6, 1])
    expect(after.blocks.map(block => block.type)).toEqual([0, 3, 4, 6])
    expect(after.blocks[0].body).toEqual(before.blocks[0].body)
    expect(after.blocks[1].body).toEqual(before.blocks[1].body)
    expect(vendorOf(after.blocks[2].body)).toBe('reference libFLAC 1.5.0 20250211')
    expect(written.subarray(after.frames)).toEqual(FLAC.subarray(before.frames))
    const { format } = await parse(file)
    expect(format.duration).toBeCloseTo(2, 1)
  })
})

describe('坏文件', () => {
  it('flac 的元数据块在文件结束前没走完（下载被截断、文件坏了）：明确失败，不卡住', async () => {
    const truncated = new Blob([
      FLAC.subarray(0, 60),
    ])
    await expect(writeSongInfo(truncated, full)).rejects.toThrow()
  })
})

/** 网易云什么都没给的一首（云盘上传、没匹配上曲库的歌这类）：只有编号 */
const bare: SongInfo = {
  song: {
    id: 1,
    name: null,
    artists: [
      { id: 0, name: null },
    ],
    album: { id: 0, name: null, coverUrl: null },
    duration: null,
    downloadSize: null,
    availability: 'full',
    trackNumber: 0,
    disc: null,
    aliases: [],
    translations: [],
    publishedAt: 0,
  },
  album: null,
  cover: null,
  lyrics: { kind: 'none' },
}

/** mp3 里写了哪些帧、flac 里写了哪些注释（PICTURE 块另算） */
const written = async (info: SongInfo) => {
  const mp3 = await parse((await writeSongInfo(new Blob([MP3]), info)).file)
  const flac = await parse((await writeSongInfo(new Blob([FLAC]), info)).file)
  return {
    mp3: Object.fromEntries((mp3.native['ID3v2.3'] ?? []).map(tag => [tag.id, tag.value])),
    flac: Object.fromEntries((flac.native.vorbis ?? []).map(tag => [tag.id, tag.value])),
    pictures: [mp3.common.picture, flac.common.picture],
  }
}

describe('拿不到的不写', () => {
  it('网易云没给的、0 和空字符串都不写，只剩网易云编号和页面；没有歌词不写歌词，没有封面不写封面', async () => {
    const { mp3, flac, pictures } = await written(bare)
    expect(mp3).toEqual({
      'TXXX:NETEASE_SONG_ID': '1',
      'WOAS': 'https://music.163.com/song?id=1',
    })
    expect(flac).toEqual({
      NETEASE_SONG_ID: '1',
      NETEASE_URL: 'https://music.163.com/song?id=1',
    })
    expect(pictures).toEqual([undefined, undefined])
  })

  it('专辑信息里网易云写的空字符串公司、0 首不写；纯音乐不写歌词', async () => {
    const { mp3, flac } = await written({
      ...full,
      album: { ...album, company: '', songCount: 0 },
      lyrics: { kind: 'pureMusic' },
    })
    expect(mp3).toMatchObject({ TRCK: '6' })
    expect(Object.keys(mp3)).not.toContain('TPUB')
    expect(Object.keys(mp3)).not.toContain('USLT')
    expect(Object.keys(mp3)).not.toContain('TCOM')
    expect(flac).toMatchObject({ TRACKNUMBER: '6' })
    for (const name of [
      'TRACKTOTAL',
      'LABEL',
      'LYRICS',
      'UNSYNCEDLYRICS',
      'COMPOSER',
    ])
      expect(Object.keys(flac)).not.toContain(name)
  })

  it('封面不是 JPEG、PNG（比如 SVG）就不写', async () => {
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' })
    const { pictures } = await written({ ...bare, cover: svg })
    expect(pictures).toEqual([undefined, undefined])
  })
})

describe('碟号', () => {
  it.each([
    ['01', '1'],
    ['1/2', '1/2'],
    ['CD 01 Disc A', '1'],
    ['A', null],
    ['无', null],
    ['0', null],
    [null, null],
  ])('网易云写“%s”时写 %s', async (disc, expected) => {
    const { mp3, flac } = await written({
      ...bare,
      song: { ...bare.song, disc },
    })
    expect([mp3.TPOS ?? null, flac.DISCNUMBER ?? null]).toEqual([expected, expected])
  })
})

describe('发行日期', () => {
  it('按北京时间换算：UTC 2015-12-31 16:30 是北京时间 2016-01-01', async () => {
    const { mp3, flac } = await written({
      ...bare,
      song: {
        ...bare.song,
        publishedAt: Date.UTC(2015, 11, 31, 16, 30),
      },
    })
    expect([mp3.TYER, flac.DATE]).toEqual(['2016', '2016-01-01'])
  })

  it('歌曲没有发行时间（专辑页里的歌、网易云写 0）时用专辑的；都没有不写', async () => {
    const fromAlbum = await written({
      ...bare,
      album: { ...album, publishedAt: 1441900800000 },
    })
    expect([fromAlbum.mp3.TYER, fromAlbum.flac.DATE]).toEqual(['2015', '2015-09-11'])
    const neither = await written({
      ...bare,
      album: { ...album, publishedAt: 0 },
    })
    expect([neither.mp3.TYER, neither.flac.DATE]).toEqual([undefined, undefined])
  })
})

describe('歌词', () => {
  it('没有翻译的歌只有原文一行；署名行留在开头，也拆进作词、作曲（名字用 / 或、隔开）', async () => {
    const { mp3, flac } = await written({
      ...bare,
      lyrics: {
        kind: 'line',
        lines: [
          {
            start: 0,
            text: '作词 : 米津玄師',
            words: null,
            translation: null,
            romanization: null,
          },
          {
            start: 1.5,
            text: '作曲：米津玄師/室屋光一郎',
            words: null,
            translation: null,
            romanization: null,
          },
          {
            start: 61.234,
            text: '夢ならばどれほどよかったでしょう',
            words: null,
            translation: null,
            romanization: null,
          },
        ],
        translated: false,
        romanized: false,
        yrc: null,
        romalrc: null,
      },
    })
    const synced = '[00:00.000]作词 : 米津玄師\n[00:01.500]作曲：米津玄師/室屋光一郎\n[01:01.234]夢ならばどれほどよかったでしょう'
    expect(mp3).toMatchObject({
      USLT: expect.objectContaining({ text: synced }),
      TEXT: '米津玄師',
      TCOM: '室屋光一郎',
    })
    expect(flac).toMatchObject({
      LYRICS: synced,
      UNSYNCEDLYRICS: '作词 : 米津玄師\n作曲：米津玄師/室屋光一郎\n夢ならばどれほどよかったでしょう',
      LYRICIST: '米津玄師',
    })
    expect(Object.keys(mp3)).not.toContain('TXXX:NETEASE_YRC')
  })
})
