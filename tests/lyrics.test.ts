import { describe, expect, it } from 'vitest'

import type { Device } from './harness/device'
import { held } from './harness/hold'
import { listener } from './harness/listener'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInAtHearts } = listener(world)

// 播放页的歌词（#25）：听众看歌词时用前台请求取，服务端把网易云的 lyric_new 整理成一行一行的歌词。录制是匿名录的，网易云替身不看歌曲编号，所以哪首歌都能配哪份录制
const ALL_FORMS = 'playback/lyric_new.all-forms.json'
/** Shape of You：只有逐行歌词和翻译 */
const TRANSLATION = 'playback/lyric_new.translation.json'
const SONG = 1466598056

describe('歌词', () => {
  it('有逐字歌词时用逐字：每个词各有起止，翻译、音译配到对应的行；作词作曲这类署名也是一行', async () => {
    const device = world.device()
    const app = (await signInAtHearts(device)).app

    await world.netease.reply(ALL_FORMS)
    await app.openLyrics(SONG)

    expect(world.netease.calls.findLast(call => call.module === 'lyric_new')).toMatchObject({
      query: { id: SONG },
    })
    const shown = app.state.lyrics
    if (shown?.status !== 'shown' || shown.lyrics.kind !== 'word')
      throw new Error(`没显示逐字歌词：${JSON.stringify(shown)}`)
    expect(shown.songId).toBe(SONG)
    expect(shown.lyrics.lines.slice(0, 4)).toEqual([
      {
        start: 0,
        text: '作词: 米津玄師',
        words: null,
        translation: null,
        romanization: null,
      },
      {
        start: 0.276,
        text: '作曲: 米津玄師',
        words: null,
        translation: null,
        romanization: null,
      },
      {
        start: 0.552,
        text: '编曲: 米津玄師/室屋光一郎',
        words: null,
        translation: null,
        romanization: null,
      },
      {
        start: 0.83,
        text: '夢ならばどれほどよかったでしょう',
        words: [
          { start: 0.83, end: 1.21, text: '夢' },
          { start: 1.21, end: 1.54, text: 'な' },
          { start: 1.54, end: 1.74, text: 'ら' },
          { start: 1.74, end: 2.17, text: 'ば' },
          { start: 2.17, end: 2.6, text: 'ど' },
          { start: 2.6, end: 2.85, text: 'れ' },
          { start: 2.85, end: 3.13, text: 'ほ' },
          { start: 3.13, end: 3.46, text: 'ど' },
          { start: 3.46, end: 3.94, text: 'よ' },
          { start: 3.94, end: 4.21, text: 'か' },
          { start: 4.21, end: 4.3, text: 'っ' },
          { start: 4.3, end: 4.5, text: 'た' },
          { start: 4.5, end: 4.96, text: 'で' },
          { start: 4.96, end: 5.09, text: 'し' },
          { start: 5.09, end: 5.32, text: 'ょ' },
          { start: 5.32, end: 5.81, text: 'う' },
        ],
        translation: '如果这一切都是梦境该有多好',
        romanization: 'yu me na ra ba do re ho do yo ka tta de sho u',
      },
    ])
    // 录制里 42 行歌词都有翻译和音译，3 行署名没有
    expect(shown.lyrics.lines).toHaveLength(45)
    expect(shown.lyrics.lines.filter(line => line.translation !== null)).toHaveLength(42)
    expect(shown.lyrics.lines.filter(line => line.romanization !== null)).toHaveLength(42)
    expect(shown.lyrics.lines.at(-1)).toMatchObject({ text: '今でもあなたはわたしの光', translation: '时至今日 你仍是我的光芒' })
  })

  it('只有逐行歌词时整行一起：没有每个词的起止；翻译配到对应的行，空行（间奏）不算一行；这首没有音译', async () => {
    const device = world.device()
    const app = (await signInAtHearts(device)).app

    await world.netease.reply(TRANSLATION)
    await app.openLyrics(SONG)

    const shown = app.state.lyrics
    if (shown?.status !== 'shown' || shown.lyrics.kind !== 'line')
      throw new Error(`没显示逐行歌词：${JSON.stringify(shown)}`)
    const { lines } = shown.lyrics
    expect(lines.every(line => line.words === null && line.romanization === null)).toBe(true)
    const first = lines.findIndex(line => line.text === 'The club isn\'t the best place to find a lover')
    expect(lines.slice(first, first + 2)).toEqual([
      {
        start: 9.48,
        text: 'The club isn\'t the best place to find a lover',
        words: null,
        translation: '这俱乐部不是个能找到安慰的地方',
        romanization: null,
      },
      {
        start: 11.75,
        text: 'So the bar is where I go',
        words: null,
        translation: '所以我们去往酒吧',
        romanization: null,
      },
    ])
    // 26.88 秒那句之后是 29.58 秒的空行，下一行是 29.82 秒
    const beforeBreak = lines.findIndex(line => line.start === 26.88)
    expect(lines[beforeBreak + 1]).toMatchObject({ start: 29.82, text: 'Girl, you know I want your love', translation: '女孩儿 你知道我想得到你的爱' })
  })

  it('这首歌没有翻译或音译时说明没有（界面据此禁用开关）', async () => {
    const device = world.device()
    const app = (await signInAtHearts(device)).app
    /** 打开一首歌的歌词（网易云回这份录制），看它是逐字还是逐行、有没有翻译和音译 */
    const forms = async (fixture: string, songId: number) => {
      await world.netease.reply(fixture)
      await app.openLyrics(songId)
      const shown = app.state.lyrics
      if (shown?.status !== 'shown' || (shown.lyrics.kind !== 'word' && shown.lyrics.kind !== 'line'))
        throw new Error(`没显示歌词：${JSON.stringify(shown)}`)
      const { kind, lines, translated, romanized } = shown.lyrics
      // 说有的，一定有一行真的配上了；说没有的，一行都没有
      expect(lines.some(line => line.translation !== null)).toBe(translated)
      expect(lines.some(line => line.romanization !== null)).toBe(romanized)
      return { kind, translated, romanized }
    }

    // 孤勇者：逐字，没有翻译和音译
    expect(await forms('playback/lyric_new.yrc.json', 1901371647)).toEqual({ kind: 'word', translated: false, romanized: false })
    // 平凡之路：只有逐行，没有翻译和音译
    expect(await forms('playback/lyric_new.lrc-only.json', 28815250)).toEqual({ kind: 'line', translated: false, romanized: false })
    // Lemon 的另一个版本：逐行，翻译和音译都有
    expect(await forms('playback/lyric_new.romaji.json', 536622304)).toEqual({ kind: 'line', translated: true, romanized: true })
  })

  it('纯音乐、网易云没有歌词的歌：分别说明，不当作出错', async () => {
    const device = world.device()
    const app = (await signInAtHearts(device)).app

    await world.netease.reply('playback/lyric_new.pure-music.json')
    await app.openLyrics(SONG)
    expect(app.state.lyrics).toEqual({
      songId: SONG,
      status: 'shown',
      lyrics: { kind: 'pureMusic' },
    })

    await world.netease.reply('playback/lyric_new.uncollected.json')
    await app.openLyrics(SONG + 1)
    expect(app.state.lyrics).toEqual({
      songId: SONG + 1,
      status: 'shown',
      lyrics: { kind: 'none' },
    })
  })

  it('点歌词的一行：当前这首从这一行开始的地方接着放；停着时也从那里开始放', async () => {
    const device = world.device()
    const tab = await signInAtHearts(device)
    const { app } = tab
    // 匿名录的专辑只有一首，非会员放 30 秒的试听片段（从头开始）
    const album = { id: 84072830, song: 1409311773 }
    await world.netease.reply('library/album.json')
    await app.openAlbum(album.id)
    await world.netease.reply('playback/song_url_v1.anon-trial.json')
    app.play({ kind: 'album', id: album.id }, album.song)
    await world.settle()
    const player = tab.audio.find(audio => !audio.paused)!
    player.ready(30.04)
    await world.settle()

    await world.netease.reply(ALL_FORMS)
    await app.openLyrics(album.song)
    const shown = app.state.lyrics
    if (shown?.status !== 'shown' || shown.lyrics.kind !== 'word')
      throw new Error('没显示歌词')
    const lineAt = (text: string) => shown.lyrics.kind === 'word'
      ? shown.lyrics.lines.find(each => each.text === text)!.start
      : Number.NaN

    app.playFrom(lineAt('古びた思い出の埃を払う'))
    expect(player.currentTime).toBe(17.3)
    expect(app.state.player).toMatchObject({ status: 'playing', position: 17.3 })

    app.togglePlay()
    await world.settle()
    expect(app.state.player.status).toBe('paused')
    app.playFrom(lineAt('忘れた物を取りに帰るように'))
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(player.currentTime).toBe(11.78)
    expect(app.state.player).toMatchObject({ status: 'playing', position: 11.78 })
  })
})

describe('取歌词', () => {
  const lyricRequests = (device: Device) => device.requests.filter(request => /^\/api\/songs\/\d+\/lyrics$/.test(request.path)).length

  it('取的时候显示加载中，同一首不重复取；取到了再打开同一首也不再取', async () => {
    const device = world.device()
    const app = (await signInAtHearts(device)).app

    const slow = held()
    await world.netease.reply(ALL_FORMS, { until: slow.until })
    const opening = app.openLyrics(SONG)
    await world.settle()
    expect(app.state.lyrics).toEqual({ songId: SONG, status: 'loading' })
    await app.openLyrics(SONG)
    slow.release()
    await opening
    expect(app.state.lyrics).toMatchObject({
      songId: SONG,
      status: 'shown',
      lyrics: { kind: 'word' },
    })

    await app.openLyrics(SONG)
    expect(lyricRequests(device)).toBe(1)
  })

  it('没取到时说明原因，再打开就是重试', async () => {
    const device = world.device()
    const app = (await signInAtHearts(device)).app

    device.setOnline(false)
    await app.openLyrics(SONG)
    expect(app.state.lyrics).toEqual({
      songId: SONG,
      status: 'failed',
      failure: { kind: 'offline' },
    })

    device.setOnline(true)
    await world.netease.reply(ALL_FORMS)
    await app.openLyrics(SONG)
    expect(app.state.lyrics).toMatchObject({ songId: SONG, status: 'shown' })
  })

  it('换了一首歌：前一首的歌词晚回来也不显示', async () => {
    const device = world.device()
    const app = (await signInAtHearts(device)).app

    const slow = held()
    await world.netease.reply(ALL_FORMS, { until: slow.until })
    const first = app.openLyrics(SONG)
    await world.settle()
    await world.netease.reply('playback/lyric_new.pure-music.json')
    await app.openLyrics(SONG + 1)
    slow.release()
    await first
    expect(app.state.lyrics).toEqual({
      songId: SONG + 1,
      status: 'shown',
      lyrics: { kind: 'pureMusic' },
    })
  })

  it('取歌词时服务端说需要登录（登录 Cookie 没了）：整个 App 变成登录失效，不再显示歌词', async () => {
    const device = world.device()
    const app = (await signInAtHearts(device)).app

    await device.setCookie('campanula_login=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict')
    await app.openLyrics(SONG)
    expect(app.state.session.status).toBe('loginExpired')
    expect(app.state.lyrics).toBeNull()
  })
})
