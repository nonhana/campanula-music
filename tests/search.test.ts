import type { Song } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'
import type { Device, Tab } from './harness/device'
import { describe, expect, it } from 'vitest'
import { SUGGEST_DELAY } from '#lib/app/search.js'
import { held, never } from './harness/hold'
import { signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()

// 搜索单曲与插播（#31）：边输入边给建议，按搜索后拉单曲结果，在结果里点一首歌是插播。
// 录制见 tests/fixtures/netease/README.md 的 #31 一条
/** 先打了“夜に”、再打完“夜に駆ける”时网易云给的建议 */
const SUGGEST_YORU_NI = 'search/songs/001-search_suggest.json.gz'
const SUGGEST_YORU_NI_KAKERU = 'search/songs/002-search_suggest.json.gz'
/** 打了“周杰伦”时网易云给的建议：单曲 4、歌手 1、专辑 2、歌单 2 */
const SUGGEST_JAY = 'search/kinds/002-search_suggest.json.gz'
/** 打了“真夜中”时网易云给的建议：单曲 4、专辑 2、歌单 2，没有歌手；第 2、3 首歌名一个用 ～（U+FF5E）、一个用 〜（U+301C） */
const SUGGEST_MAYONAKA = 'search/kinds/001-search_suggest.json.gz'
/** 搜“夜に駆ける”的单曲结果：100 首截到 30 首，都能放完整的 */
const SONGS_YORU_NI_KAKERU = 'search/songs/003-cloudsearch.json.gz'
/** 搜“Sea Of Tired Slowed”的单曲结果：28 首，第 26、27、28 首无版权 */
const SONGS_SEA_OF_TIRED = 'search/songs/004-cloudsearch.json.gz'
/** 网易云回打卡成功（#31 真账号上从搜索打卡 1 次时录的） */
const CHECK_IN = 'search/check-in/001-scrobble.json.gz'
/** 搜索结果的第一首（YOASOBI 的《夜に駆ける》）的试听片段地址（匿名录的，30 秒） */
const FIRST_RESULT_URL = 'playback/song_url_v1.anon-trial.json'
/** 每日推荐（31 首）：先用它放着一个播放队列 */
const DAILY = 'discover/daily/001-recommend_songs.json.gz'
/** 别的歌的播放地址：压着不回，只看播放队列和取了哪首的地址 */
const SOME_PLAY_URL = 'playback/liked/001-song_url_v1.json.gz'
/** 在“夜に駆ける”的搜索结果里点歌：播放来源是这次搜索 */
const SEARCHED = { kind: 'search', keyword: '夜に駆ける' } as const

/** 登录，后台同步停在红心 */
async function signInHeld(device: Device): Promise<Tab> {
  const tab = await device.open()
  await world.netease.reply('library/likelist.json', { until: never() })
  await signIn(world, tab.app)
  return tab
}

/** 再打开一次 App：后台同步停在红心 */
async function reopen(device: Device): Promise<App> {
  await world.netease.reply('login/user_account.vip.json')
  await world.netease.reply('library/likelist.json', { until: never() })
  const { app } = await device.open()
  return app
}

/** 按搜索，网易云压着单曲结果不回：只看搜索历史 */
async function searchHeld(app: App, keyword: string): Promise<void> {
  await world.netease.reply(SONGS_YORU_NI_KAKERU, { until: never() })
  void app.search(keyword)
  await world.settle()
}

/** 问过网易云哪些词的建议 */
function suggestedKeywords(): unknown[] {
  return world.netease.calls.filter(call => call.module === 'search_suggest').map(call => call.query)
}

/** 网易云被问了哪些词的单曲结果 */
function searchedSongs(): unknown[] {
  return world.netease.calls.filter(call => call.module === 'cloudsearch').map(call => call.query)
}

/** 按搜索，网易云回录下的单曲结果；返回显示出来的歌 */
async function searchShown(app: App, keyword: string, fixture: string): Promise<readonly Song[]> {
  await world.netease.reply(fixture)
  await app.search(keyword)
  const results = app.state.search.results
  if (results?.status !== 'shown')
    throw new Error(`单曲结果没显示：${JSON.stringify(results)}`)
  return results.songs
}

/** 打了 keyword、停手后网易云回录下的建议；返回显示出来的建议 */
async function suggested(app: App, keyword: string, fixture: string): Promise<unknown> {
  await world.netease.reply(fixture)
  app.suggest(keyword)
  await world.clock.advance(SUGGEST_DELAY)
  return app.state.search.suggestions
}

describe('边输入边出建议', () => {
  it('停手一会儿才问网易云，只问最后打的词；不跨类别去重，和歌同名的歌手、专辑照样列出来', async () => {
    const { app } = await signInHeld(world.device())

    app.suggest('夜')
    await world.clock.advance(SUGGEST_DELAY - 1)
    app.suggest('夜に')
    await world.clock.advance(SUGGEST_DELAY - 1)
    expect(suggestedKeywords()).toEqual([])

    await world.netease.reply(SUGGEST_YORU_NI)
    await world.clock.advance(1)
    expect(suggestedKeywords()).toEqual([{ keywords: '夜に' }])
    // 网易云给了 3 首歌、1 位歌手、2 张专辑；歌手和专辑的名字都和前面的歌一样
    expect(app.state.search.suggestions).toEqual({
      keyword: '夜に',
      items: [
        { kind: 'song', name: '夜に駆ける' },
        { kind: 'song', name: '夜に浮かぶ' },
        { kind: 'song', name: '夜に駆ける (feat. 宵崎奏 & 初音ミク)' },
        { kind: 'artist', id: 37063847, name: '夜に駆ける' },
        { kind: 'album', id: 84072830, name: '夜に駆ける' },
        { kind: 'album', id: 97136563, name: '夜に浮かぶ' },
      ],
    })
  })

  it('照网易云给的列：单曲、歌手、专辑、歌单依次排；歌手、专辑、歌单带上编号（点了进它的页面）', async () => {
    const { app } = await signInHeld(world.device())

    expect(await suggested(app, '周杰伦', SUGGEST_JAY)).toEqual({
      keyword: '周杰伦',
      items: [
        { kind: 'song', name: '布拉格广场' },
        { kind: 'song', name: '屋顶' },
        { kind: 'song', name: '默 (Live)' },
        { kind: 'song', name: '想你就写信 (Live)' },
        { kind: 'artist', id: 6452, name: '周杰伦' },
        { kind: 'album', id: 21330, name: 'J-Top冠军精选' },
        { kind: 'album', id: 21349, name: '看我72变' },
        { kind: 'playlist', id: 11860849, name: '周杰伦最全歌曲集' },
        { kind: 'playlist', id: 2247605201, name: '周杰伦丨在网易云音乐最后的倔强' },
      ],
    })
  })

  it('单曲之间名字看起来一样的只留第一条；网易云没给的那类（这次没有歌手）就没有', async () => {
    const { app } = await signInHeld(world.device())

    expect(await suggested(app, '真夜中', SUGGEST_MAYONAKA)).toEqual({
      keyword: '真夜中',
      items: [
        { kind: 'song', name: '真夜中のドア〜stay with me (シングルver.)' },
        { kind: 'song', name: '真夜中のドア～stay with me' },
        { kind: 'song', name: '真夜中のドア〜stay with me 2024' },
        { kind: 'album', id: 251727242, name: '真夜中のドア〜stay with me 2024' },
        { kind: 'album', id: 2379020, name: '真夜中は純潔' },
        { kind: 'playlist', id: 3172143658, name: 'ずっと真夜中でいいのに。歌曲合辑' },
        { kind: 'playlist', id: 2887236905, name: 'ずっと真夜中でいいのに。' },
      ],
    })
  })

  it('接着打字：只显示最后打的词的建议，比它晚回来的旧词的不要', async () => {
    const { app } = await signInHeld(world.device())
    const slow = held()
    await world.netease.reply(SUGGEST_YORU_NI, { until: slow.until })
    await world.netease.reply(SUGGEST_YORU_NI_KAKERU)

    app.suggest('夜に')
    await world.clock.advance(SUGGEST_DELAY)
    app.suggest('夜に駆ける')
    await world.clock.advance(SUGGEST_DELAY)
    expect(app.state.search.suggestions?.keyword).toBe('夜に駆ける')

    slow.release()
    await world.settle()
    expect(app.state.search.suggestions).toEqual({
      keyword: '夜に駆ける',
      items: [
        { kind: 'song', name: '夜に駆ける' },
        { kind: 'song', name: '夜に駆ける (feat. 宵崎奏 & 初音ミク)' },
        { kind: 'song', name: '夜に駆ける - From THE FIRST TAKE' },
        { kind: 'artist', id: 37063847, name: '夜に駆ける' },
        { kind: 'album', id: 84072830, name: '夜に駆ける' },
        { kind: 'album', id: 175014930, name: '夜に駆ける - From THE FIRST TAKE' },
      ],
    })
  })

  it('清空搜索框：建议收起，还在等停手的不再问，在路上的回来了也不显示', async () => {
    const { app } = await signInHeld(world.device())
    const slow = held()
    await world.netease.reply(SUGGEST_YORU_NI, { until: slow.until })

    app.suggest('夜に')
    await world.clock.advance(SUGGEST_DELAY)
    app.suggest('夜に駆ける')
    app.suggest('  ')
    await world.clock.advance(SUGGEST_DELAY)
    slow.release()
    await world.settle()

    expect(suggestedKeywords()).toEqual([{ keywords: '夜に' }])
    expect(app.state.search.suggestions).toBeNull()
  })
})

describe('搜索历史', () => {
  it('按搜索就记进搜索历史：新的在前，搜过的挪到最前，最多 20 个', async () => {
    const { app } = await signInHeld(world.device())

    for (const keyword of ['夜に駆ける', 'YOASOBI', ' 夜に駆ける '])
      await searchHeld(app, keyword)
    expect(app.state.search.history).toEqual(['夜に駆ける', 'YOASOBI'])

    for (let n = 1; n <= 20; n += 1)
      await searchHeld(app, `第 ${n} 个词`)
    expect(app.state.search.history).toEqual(Array.from({ length: 20 }, (_, index) => `第 ${20 - index} 个词`))
  })

  it('只存在这台设备上：重新打开 App、退出登录再登录都还在，别的设备上没有', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await searchHeld(app, '夜に駆ける')

    const reopened = await reopen(device)
    expect(reopened.state.search.history).toEqual(['夜に駆ける'])

    await world.netease.reply('login/logout.json')
    await reopened.logout()
    await world.netease.reply('library/likelist.json', { until: never() })
    await signIn(world, reopened)
    expect(reopened.state.search.history).toEqual(['夜に駆ける'])

    const { app: elsewhere } = await signInHeld(world.device())
    expect(elsewhere.state.search.history).toEqual([])
  })

  it('清空：本机存的也删掉，重新打开 App 也没有了', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await searchHeld(app, '夜に駆ける')
    await searchHeld(app, 'YOASOBI')

    await app.clearSearchHistory()
    expect(app.state.search.history).toEqual([])

    const reopened = await reopen(device)
    expect(reopened.state.search.history).toEqual([])
  })
})

describe('单曲结果', () => {
  it('按搜索：用前台请求问网易云这个词的前 100 首单曲，歌曲只留界面用得到的字段', async () => {
    const { app } = await signInHeld(world.device())

    await world.netease.reply(SONGS_YORU_NI_KAKERU)
    await app.search('夜に駆ける')

    expect(searchedSongs()).toEqual([{ keywords: '夜に駆ける', type: 1, limit: 100 }])
    const results = app.state.search.results
    if (results?.status !== 'shown')
      throw new Error(`单曲结果没显示：${JSON.stringify(results)}`)
    expect(results.keyword).toBe('夜に駆ける')
    expect(results.songs).toHaveLength(30)
    expect(results.songs[0]).toEqual({
      id: 1409311773,
      name: '夜に駆ける',
      artists: [{ id: 33927412, name: 'YOASOBI' }],
      album: { id: 84072830, name: '夜に駆ける', coverUrl: 'http://p4.music.126.net/3xWlqwYmfwRFebeiONUpGg==/109951164546210608.jpg' },
      duration: 261013,
      availability: 'full',
    })
  })

  it('无版权的歌标出来（网易云的权限信息 st 小于 0）', async () => {
    const { app } = await signInHeld(world.device())

    await world.netease.reply(SONGS_SEA_OF_TIRED)
    await app.search('Sea Of Tired Slowed')

    const results = app.state.search.results
    if (results?.status !== 'shown')
      throw new Error(`单曲结果没显示：${JSON.stringify(results)}`)
    expect(results.songs.filter(song => song.availability === 'noCopyright').map(song => song.id)).toEqual([2108191414, 26864092, 2108191413])
    expect(results.songs.filter(song => song.availability === 'full')).toHaveLength(25)
  })

  it('打开结果页（返回到这一页、刷新）：这个词的结果显示着、正在拉就不再问，也不记进搜索历史', async () => {
    const { app } = await signInHeld(world.device())
    await world.netease.reply(SONGS_YORU_NI_KAKERU)
    await app.search('夜に駆ける')

    await app.openSearch('夜に駆ける')
    expect(searchedSongs()).toHaveLength(1)

    await world.netease.reply(SONGS_SEA_OF_TIRED)
    await app.openSearch('Sea Of Tired Slowed')
    expect(searchedSongs()).toHaveLength(2)
    expect(app.state.search.results).toMatchObject({ keyword: 'Sea Of Tired Slowed', status: 'shown' })
    expect(app.state.search.history).toEqual(['夜に駆ける'])
  })

  it('接着又搜了别的词：先搜的晚回来也不显示', async () => {
    const { app } = await signInHeld(world.device())
    const slow = held()
    await world.netease.reply(SONGS_YORU_NI_KAKERU, { until: slow.until })
    await world.netease.reply(SONGS_SEA_OF_TIRED)

    void app.search('夜に駆ける')
    await world.settle()
    expect(app.state.search.results).toEqual({ keyword: '夜に駆ける', status: 'loading' })
    await app.search('Sea Of Tired Slowed')
    slow.release()
    await world.settle()

    expect(app.state.search.results).toMatchObject({ keyword: 'Sea Of Tired Slowed', status: 'shown' })
  })

  it('断网时没搜成，说明是断网（不连网易云），词照样记进搜索历史；联网后再打开就搜到了', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)

    device.setOnline(false)
    await app.search('夜に駆ける')
    expect(app.state.search.results).toEqual({ keyword: '夜に駆ける', status: 'failed', failure: { kind: 'offline' } })
    expect(app.state.search.history).toEqual(['夜に駆ける'])
    expect(searchedSongs()).toEqual([])

    device.setOnline(true)
    await world.netease.reply(SONGS_YORU_NI_KAKERU)
    await app.openSearch('夜に駆ける')
    expect(app.state.search.results).toMatchObject({ keyword: '夜に駆ける', status: 'shown' })
  })

  it('退出登录：建议和结果都不再显示，搜索历史留着', async () => {
    const { app } = await signInHeld(world.device())
    await world.netease.reply(SONGS_YORU_NI_KAKERU)
    await app.search('夜に駆ける')
    await world.netease.reply(SUGGEST_YORU_NI)
    app.suggest('夜に')
    await world.clock.advance(SUGGEST_DELAY)

    await world.netease.reply('login/logout.json')
    await app.logout()
    expect(app.state.search).toEqual({ history: ['夜に駆ける'], suggestions: null, results: null })
  })
})

describe('在结果里点歌是插播', () => {
  it('排在当前这首后面马上放，播放队列里其余的歌和先后都不变；这首的播放来源是这次搜索', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await world.netease.reply(DAILY)
    await app.openDaily()
    const daily = app.state.daily?.status === 'shown' ? app.state.daily.songs.map(song => song.id) : []
    await world.netease.reply(SOME_PLAY_URL, { until: never() })
    app.play({ kind: 'daily' }, daily[2])
    await world.settle()
    const songs = await searchShown(app, '夜に駆ける', SONGS_YORU_NI_KAKERU)

    await world.netease.reply(FIRST_RESULT_URL, { until: never() })
    app.play(SEARCHED, songs[0].id)
    await world.settle()

    const { queue, current } = app.state.player
    expect(queue.map(entry => entry.song.id)).toEqual([...daily.slice(0, 3), songs[0].id, ...daily.slice(3)])
    expect(current).toBe(3)
    expect(queue[3].source).toEqual(SEARCHED)
    expect(queue.filter((_, index) => index !== 3).every(entry => entry.source.kind === 'daily')).toBe(true)
    expect(device.requests.at(-1)?.path).toBe(`/api/songs/${songs[0].id}/play-url?quality=exhigh`)
  })

  it('插播的歌听完打卡：播放来源是这次搜索，服务端照 SDK 文档报 search、来源编号 0', async () => {
    const device = world.device()
    const tab = await signInHeld(device)
    const { app } = tab
    const songs = await searchShown(app, '夜に駆ける', SONGS_YORU_NI_KAKERU)
    await world.netease.reply(FIRST_RESULT_URL)
    app.play(SEARCHED, songs[0].id)
    await world.settle()
    tab.audio.find(audio => !audio.paused)!.ready(30.04)
    await world.settle()
    await world.clock.advance(10_000)

    await world.netease.reply(CHECK_IN)
    app.clearQueue()
    await world.settle()
    const sent = device.requests.filter(request => request.path.endsWith('/check-in'))
    expect(sent).toEqual([{ method: 'POST', path: `/api/songs/${songs[0].id}/check-in`, body: { source: SEARCHED, seconds: 10 } }])
    expect(world.netease.calls.filter(call => call.module === 'scrobble').map(call => call.query)).toEqual([{ id: songs[0].id, sourceid: 0, source: 'search', time: 10 }])
  })
})
