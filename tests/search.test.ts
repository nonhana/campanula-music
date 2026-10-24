import type { Song } from '#lib/api/library.js'
import type { SearchKind } from '#lib/api/search.js'
import type { App } from '#lib/app/app.js'
import type { SearchList } from '#lib/app/search.js'
import { describe, expect, it } from 'vitest'
import { SEARCH_KINDS } from '#lib/api/search.js'
import { SUGGEST_DELAY } from '#lib/app/search.js'
import { held, never } from './harness/hold'
import { DAILY, listener } from './harness/listener'
import { signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()

// 搜索（#31、#32）：边输入边给建议；按搜索后拉四类结果（单曲、歌单、歌手、专辑，综合由它们拼成），每类一页一页地取；
// 在结果里点一首歌是插播。录制见 tests/fixtures/netease/README.md 的 #31、#32 两条
/** 先打了“夜に”、再打完“夜に駆ける”时网易云给的建议 */
const SUGGEST_YORU_NI = 'search/songs/001-search_suggest.json.gz'
const SUGGEST_YORU_NI_KAKERU = 'search/songs/002-search_suggest.json.gz'
/** 打了“周杰伦”时网易云给的建议：单曲 4、歌手 1、专辑 2、歌单 2 */
const SUGGEST_JAY = 'search/kinds/002-search_suggest.json.gz'
/** 打了“真夜中”时网易云给的建议：单曲 4、专辑 2、歌单 2，没有歌手；第 2、3 首歌名一个用 ～（U+FF5E）、一个用 〜（U+301C） */
const SUGGEST_MAYONAKA = 'search/kinds/001-search_suggest.json.gz'
/** 搜“夜に駆ける”的单曲第一页：录的是 limit 100、截到 30 首，都能放完整的 */
const SONGS_YORU_NI_KAKERU = 'search/songs/003-cloudsearch.json.gz'
/** 搜“Sea Of Tired Slowed”的单曲：28 首，一页就完，第 26、27、28 首无版权 */
const SONGS_SEA_OF_TIRED = 'search/songs/004-cloudsearch.json.gz'
// #32 同一批录的“真夜中”（2026-10-18 18:3x 北京时间），前后页对得上
/** “真夜中”的单曲第 1、2 页（每页 30 首，网易云说共 330 首） */
const SONGS_MAYONAKA = 'search/results/001-cloudsearch.json.gz'
const SONGS_MAYONAKA_2 = 'search/results/002-cloudsearch.json.gz'
/** “真夜中”的歌单第 1、2 页（共 189 张） */
const PLAYLISTS_MAYONAKA = 'search/results/003-cloudsearch.json.gz'
const PLAYLISTS_MAYONAKA_2 = 'search/results/004-cloudsearch.json.gz'
/** “真夜中”的歌手：27 位，一页就完；第 2 位没有头像 */
const ARTISTS_MAYONAKA = 'search/results/005-cloudsearch.json.gz'
/** “真夜中”的专辑第 1、2 页（共 503 张） */
const ALBUMS_MAYONAKA = 'search/results/006-cloudsearch.json.gz'
const ALBUMS_MAYONAKA_2 = 'search/results/007-cloudsearch.json.gz'
/** 前一天（#31 返工时）录的“真夜中”专辑第 1 页：网易云的先后变了，和今天的第 2 页有 5 张重复 */
const ALBUMS_MAYONAKA_DAY_BEFORE = 'search/kinds/005-cloudsearch.json.gz'
/** “初音ミク”的歌手：第 1 页 30 位、第 2 页 10 位（共 40 位） */
const ARTISTS_MIKU = 'search/results/008-cloudsearch.json.gz'
const ARTISTS_MIKU_2 = 'search/results/009-cloudsearch.json.gz'
/** “Sea Of Tired Slowed”的歌手：一位都没有（网易云不给列表，只说共 0 位） */
const ARTISTS_NONE = 'search/results/010-cloudsearch.json.gz'
/** 网易云回打卡成功（#31 真账号上从搜索打卡 1 次时录的） */
const CHECK_IN = 'search/check-in/001-scrobble.json.gz'
/** 搜索结果的第一首（YOASOBI 的《夜に駆ける》）的试听片段地址（匿名录的，30 秒） */
const FIRST_RESULT_URL = 'playback/song_url_v1.anon-trial.json'
/** 别的歌的播放地址：压着不回，只看播放队列和取了哪首的地址 */
const SOME_PLAY_URL = 'playback/liked/001-song_url_v1.json.gz'
/** 在“夜に駆ける”的搜索结果里点歌：播放来源是这次搜索 */
const SEARCHED = { kind: 'search', keyword: '夜に駆ける' } as const

const { signInAtHearts, reopen } = listener(world)

/** 每类结果是网易云 cloudsearch 的哪个 type */
const TYPES: Record<SearchKind, number> = {
  songs: 1,
  playlists: 1000,
  artists: 100,
  albums: 10,
}

/**
 * 网易云对四类搜索各回什么：给了录制的回录制，没给的压着不回（用哪份录制都一样，永远不回）。
 * 四类一起发出去，到服务端的先后不固定，按 type 对上
 */
async function replySearch(fixtures: Partial<Record<SearchKind, string>>): Promise<void> {
  for (const kind of SEARCH_KINDS) {
    const fixture = fixtures[kind]
    await world.netease.reply(fixture ?? SONGS_MAYONAKA, {
      when: { type: TYPES[kind] },
      until: fixture
        ? undefined
        : never(),
    })
  }
}

/** 按搜索，网易云按 fixtures 回（没给的压着），等回来的都处理完 */
async function searchFor(app: App, keyword: string, fixtures: Partial<Record<SearchKind, string>>): Promise<void> {
  await replySearch(fixtures)
  void app.search(keyword)
  await world.settle()
}

/** 按搜索，网易云压着四类结果都不回：只看搜索历史 */
async function searchHeld(app: App, keyword: string): Promise<void> {
  await searchFor(app, keyword, {})
}

/** 显示着的一类结果；没显示就报错 */
function shownList<K extends SearchKind>(app: App, kind: K): Extract<SearchList<K>, { status: 'shown' }> {
  const list = app.state.search.results?.[kind]
  if (list?.status !== 'shown')
    throw new Error(`${kind} 没显示：${JSON.stringify(list)}`)
  return list as Extract<SearchList<K>, { status: 'shown' }>
}

/** 问过网易云哪些词的建议 */
function suggestedKeywords(): unknown[] {
  return world.netease.calls.filter(call => call.module === 'search_suggest').map(call => call.query)
}

/** 网易云被问了哪些词的这类结果（查询参数），按先后 */
function searched(kind: SearchKind): unknown[] {
  return world.netease.calls.filter(call => call.module === 'cloudsearch' && (call.query as { type: number }).type === TYPES[kind]).map(call => call.query)
}

/** 按搜索，网易云回录下的单曲结果（别的几类压着）；返回显示出来的歌 */
async function searchShown(app: App, keyword: string, fixture: string): Promise<readonly Song[]> {
  await searchFor(app, keyword, { songs: fixture })
  return shownList(app, 'songs').items
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
    const { app } = await signInAtHearts(world.device())

    app.suggest('夜')
    await world.clock.advance(SUGGEST_DELAY - 1)
    app.suggest('夜に')
    await world.clock.advance(SUGGEST_DELAY - 1)
    expect(suggestedKeywords()).toEqual([])

    await world.netease.reply(SUGGEST_YORU_NI)
    await world.clock.advance(1)
    expect(suggestedKeywords()).toEqual([
      { keywords: '夜に' },
    ])
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
    const { app } = await signInAtHearts(world.device())

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
    const { app } = await signInAtHearts(world.device())

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
    const { app } = await signInAtHearts(world.device())
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
    const { app } = await signInAtHearts(world.device())
    const slow = held()
    await world.netease.reply(SUGGEST_YORU_NI, { until: slow.until })

    app.suggest('夜に')
    await world.clock.advance(SUGGEST_DELAY)
    app.suggest('夜に駆ける')
    app.suggest('  ')
    await world.clock.advance(SUGGEST_DELAY)
    slow.release()
    await world.settle()

    expect(suggestedKeywords()).toEqual([
      { keywords: '夜に' },
    ])
    expect(app.state.search.suggestions).toBeNull()
  })
})

describe('搜索历史', () => {
  it('按搜索就记进搜索历史：新的在前，搜过的挪到最前，最多 20 个', async () => {
    const { app } = await signInAtHearts(world.device())

    for (const keyword of ['夜に駆ける', 'YOASOBI', ' 夜に駆ける '])
      await searchHeld(app, keyword)
    expect(app.state.search.history).toEqual(['夜に駆ける', 'YOASOBI'])

    for (let n = 1; n <= 20; n += 1)
      await searchHeld(app, `第 ${n} 个词`)
    expect(app.state.search.history).toEqual(Array.from({ length: 20 }, (_, index) => `第 ${20 - index} 个词`))
  })

  it('只存在这台设备上：重新打开 App、退出登录再登录都还在，别的设备上没有', async () => {
    const device = world.device()
    const { app } = await signInAtHearts(device)
    await searchHeld(app, '夜に駆ける')

    const reopened = (await reopen(device)).app
    expect(reopened.state.search.history).toEqual(['夜に駆ける'])

    await world.netease.reply('login/logout.json')
    await reopened.logout()
    await world.netease.reply('library/likelist.json', {
      until: never(),
    })
    await signIn(world, reopened)
    expect(reopened.state.search.history).toEqual(['夜に駆ける'])

    const { app: elsewhere } = await signInAtHearts(world.device())
    expect(elsewhere.state.search.history).toEqual([])
  })

  it('清空：本机存的也删掉，重新打开 App 也没有了', async () => {
    const device = world.device()
    const { app } = await signInAtHearts(device)
    await searchHeld(app, '夜に駆ける')
    await searchHeld(app, 'YOASOBI')

    await app.clearSearchHistory()
    expect(app.state.search.history).toEqual([])

    const reopened = (await reopen(device)).app
    expect(reopened.state.search.history).toEqual([])
  })
})

describe('单曲结果', () => {
  it('按搜索：用前台请求问网易云这个词的第一页（30 首），歌曲只留界面用得到的字段，总数是网易云给的', async () => {
    const { app } = await signInAtHearts(world.device())

    await searchFor(app, '真夜中', { songs: SONGS_MAYONAKA })

    expect(searched('songs')).toEqual([
      {
        keywords: '真夜中',
        type: 1,
        limit: 30,
        offset: 0,
      },
    ])
    expect(app.state.search.results?.keyword).toBe('真夜中')
    const songs = shownList(app, 'songs')
    expect(songs.total).toBe(330)
    expect(songs.items).toHaveLength(30)
    expect(songs.items[0]).toEqual({
      id: 1317285056,
      name: '真夜中のドア〜stay with me (シングルver.)',
      artists: [
        { id: 160053, name: '松原みき' },
      ],
      album: { id: 73881727, name: 'Light Mellow 松原みき', coverUrl: 'http://p3.music.126.net/rddYSzo2ZLxZ3HMerP_-0A==/109951172387752494.jpg' },
      duration: 274400,
      availability: 'full',
    })
  })

  it('无版权的歌标出来（网易云的权限信息 st 小于 0）；一页就取完了，没有“显示更多”', async () => {
    const { app } = await signInAtHearts(world.device())

    const songs = await searchShown(app, 'Sea Of Tired Slowed', SONGS_SEA_OF_TIRED)

    expect(songs.filter(song => song.availability === 'noCopyright').map(song => song.id)).toEqual([2108191414, 26864092, 2108191413])
    expect(songs.filter(song => song.availability === 'full')).toHaveLength(25)
    expect(shownList(app, 'songs')).toMatchObject({ total: 28, more: null })
  })

  it('显示更多：从已经取到的地方接着问网易云下一页，接在后面；后面还有就还能再取', async () => {
    const { app } = await signInAtHearts(world.device())
    await searchFor(app, '真夜中', { songs: SONGS_MAYONAKA })

    await world.netease.reply(SONGS_MAYONAKA_2)
    await app.moreSearchResults('真夜中', 'songs')

    expect(searched('songs')).toEqual([
      {
        keywords: '真夜中',
        type: 1,
        limit: 30,
        offset: 0,
      },
      {
        keywords: '真夜中',
        type: 1,
        limit: 30,
        offset: 30,
      },
    ])
    const songs = shownList(app, 'songs')
    expect(songs.items).toHaveLength(60)
    // 第一页的最后一首、第二页的第一首和最后一首
    expect([songs.items[29].id, songs.items[30].id, songs.items[59].id]).toEqual([1873231849, 1325356411, 1819306501])
    expect(songs.more).toEqual({ status: 'notLoaded' })
  })
})

describe('结果页：四类一起拉', () => {
  it('按搜索：四类的第一页一起问网易云，各拉各的，慢的那类还在加载时别的照常显示', async () => {
    const { app } = await signInAtHearts(world.device())
    const slow = held()
    await world.netease.reply(SONGS_MAYONAKA, {
      when: { type: TYPES.songs },
    })
    await world.netease.reply(PLAYLISTS_MAYONAKA, {
      when: { type: TYPES.playlists },
      until: slow.until,
    })
    await world.netease.reply(ARTISTS_MAYONAKA, {
      when: { type: TYPES.artists },
    })
    await world.netease.reply(ALBUMS_MAYONAKA, {
      when: { type: TYPES.albums },
    })

    void app.search('真夜中')
    await world.settle()

    expect(world.netease.calls.filter(call => call.module === 'cloudsearch').map(call => call.query)).toEqual(expect.arrayContaining(
      SEARCH_KINDS.map(kind => ({
        keywords: '真夜中',
        type: TYPES[kind],
        limit: 30,
        offset: 0,
      })),
    ))
    expect(app.state.search.results?.playlists).toEqual({ status: 'loading' })
    expect([shownList(app, 'songs').total, shownList(app, 'artists').total, shownList(app, 'albums').total]).toEqual([330, 27, 503])

    slow.release()
    await world.settle()
    expect(shownList(app, 'playlists').total).toBe(189)
  })

  it('打开结果页（返回到这一页、刷新）：这个词的结果记着就不再问，也不记进搜索历史；换了词四类都重新问', async () => {
    const { app } = await signInAtHearts(world.device())
    await searchFor(app, '真夜中', {
      songs: SONGS_MAYONAKA,
      playlists: PLAYLISTS_MAYONAKA,
      artists: ARTISTS_MAYONAKA,
      albums: ALBUMS_MAYONAKA,
    })

    await app.openSearch('真夜中')
    expect(world.netease.calls.filter(call => call.module === 'cloudsearch')).toHaveLength(4)

    await replySearch({ songs: SONGS_SEA_OF_TIRED, artists: ARTISTS_NONE })
    void app.openSearch('Sea Of Tired Slowed')
    await world.settle()
    expect(world.netease.calls.filter(call => call.module === 'cloudsearch')).toHaveLength(8)
    expect(app.state.search.results).toMatchObject({
      keyword: 'Sea Of Tired Slowed',
      songs: { status: 'shown', total: 28 },
      playlists: { status: 'loading' },
    })
    expect(app.state.search.history).toEqual(['真夜中'])
  })

  it('接着又搜了别的词：先搜的晚回来也不显示', async () => {
    const { app } = await signInAtHearts(world.device())
    const slow = held()
    await world.netease.reply(SONGS_YORU_NI_KAKERU, {
      when: { type: TYPES.songs },
      until: slow.until,
    })
    for (const kind of ['playlists', 'artists', 'albums'] as const) {
      await world.netease.reply(SONGS_YORU_NI_KAKERU, {
        when: { type: TYPES[kind] },
        until: never(),
      })
    }
    void app.search('夜に駆ける')
    await world.settle()
    expect(app.state.search.results).toMatchObject({
      keyword: '夜に駆ける',
      songs: { status: 'loading' },
    })

    await searchFor(app, '真夜中', { songs: SONGS_MAYONAKA })
    slow.release()
    await world.settle()

    expect(app.state.search.results?.keyword).toBe('真夜中')
    expect(shownList(app, 'songs').items[0].id).toBe(1317285056)
  })

  it('断网时四类都没搜成，说明是断网（不连网易云），词照样记进搜索历史；联网后再打开，四类重新问', async () => {
    const device = world.device()
    const { app } = await signInAtHearts(device)

    device.setOnline(false)
    await app.search('真夜中')
    const offline = {
      status: 'failed',
      failure: { kind: 'offline' },
    }
    expect(app.state.search.results).toEqual({
      keyword: '真夜中',
      songs: offline,
      playlists: offline,
      artists: offline,
      albums: offline,
    })
    expect(app.state.search.history).toEqual(['真夜中'])
    expect(world.netease.calls.filter(call => call.module === 'cloudsearch')).toEqual([])

    device.setOnline(true)
    await replySearch({
      songs: SONGS_MAYONAKA,
      playlists: PLAYLISTS_MAYONAKA,
      artists: ARTISTS_MAYONAKA,
      albums: ALBUMS_MAYONAKA,
    })
    await app.openSearch('真夜中')
    expect(SEARCH_KINDS.map(kind => app.state.search.results?.[kind].status)).toEqual(['shown', 'shown', 'shown', 'shown'])
  })

  it('退出登录：建议和结果都不再显示，搜索历史留着', async () => {
    const { app } = await signInAtHearts(world.device())
    await searchFor(app, '真夜中', { songs: SONGS_MAYONAKA })
    await world.netease.reply(SUGGEST_YORU_NI)
    app.suggest('夜に')
    await world.clock.advance(SUGGEST_DELAY)

    await world.netease.reply('login/logout.json')
    await app.logout()
    expect(app.state.search).toEqual({
      history: ['真夜中'],
      suggestions: null,
      results: null,
    })
  })
})

describe('歌单、歌手、专辑结果', () => {
  it('歌单：封面、名字、创建者、首数、播放次数；显示更多接着取下一页', async () => {
    const { app } = await signInAtHearts(world.device())
    await searchFor(app, '真夜中', { playlists: PLAYLISTS_MAYONAKA })
    expect(shownList(app, 'playlists').items[0]).toEqual({
      id: 8668352551,
      name: '听·ずっと真夜中でいいのに。热门精选|あいつら全員同窓会',
      coverUrl: expect.stringMatching(/^http:\/\/p1\.music\.126\.net\/iUoVqfWMQ0y03ROTBVBSpQ==\/109951170268045811\.jpg/),
      creator: '用户332',
      trackCount: 30,
      playCount: 912449,
    })

    await world.netease.reply(PLAYLISTS_MAYONAKA_2)
    await app.moreSearchResults('真夜中', 'playlists')

    expect(searched('playlists')).toEqual([
      {
        keywords: '真夜中',
        type: 1000,
        limit: 30,
        offset: 0,
      },
      {
        keywords: '真夜中',
        type: 1000,
        limit: 30,
        offset: 30,
      },
    ])
    const playlists = shownList(app, 'playlists')
    expect(playlists.items).toHaveLength(60)
    expect(playlists.items[30].id).toBe(8198343746)
    expect(playlists).toMatchObject({
      total: 189,
      more: { status: 'notLoaded' },
    })
  })

  it('歌手：头像、名字、单曲数，没有头像的是 null；一页就取完了，没有“显示更多”', async () => {
    const { app } = await signInAtHearts(world.device())

    await searchFor(app, '真夜中', { artists: ARTISTS_MAYONAKA })

    const artists = shownList(app, 'artists')
    expect(artists.items.slice(0, 2)).toEqual([
      {
        id: 15021101,
        name: 'ずっと真夜中でいいのに。',
        avatarUrl: 'https://p4.music.126.net/it3tUtCfcRLZTxNhkjplRA==/109951165115946920.jpg',
        songCount: 332,
      },
      {
        id: 57866432,
        name: 'ずっと真夜中だと光合成できない',
        avatarUrl: null,
        songCount: 25,
      },
    ])
    expect(artists).toMatchObject({ total: 27, more: null })
    expect(artists.items).toHaveLength(27)
  })

  it('显示更多：取到网易云说的总数就没有更多了', async () => {
    const { app } = await signInAtHearts(world.device())
    await searchFor(app, '初音ミク', { artists: ARTISTS_MIKU })
    expect(shownList(app, 'artists')).toMatchObject({
      total: 40,
      more: { status: 'notLoaded' },
    })

    await world.netease.reply(ARTISTS_MIKU_2)
    await app.moreSearchResults('初音ミク', 'artists')

    const artists = shownList(app, 'artists')
    expect(artists.items).toHaveLength(40)
    expect(artists.items.slice(30, 32).map(artist => artist.id)).toEqual([15396, 14640])
    expect(artists).toMatchObject({ total: 40, more: null })
  })

  it('隔了一阵才显示更多：网易云的先后变了，下一页里前面已经列过的不再列一遍，再下一页照样从第 60 个起', async () => {
    const { app } = await signInAtHearts(world.device())
    await searchFor(app, '真夜中', { albums: ALBUMS_MAYONAKA_DAY_BEFORE })

    await world.netease.reply(ALBUMS_MAYONAKA_2)
    await app.moreSearchResults('真夜中', 'albums')

    const albums = shownList(app, 'albums')
    // 今天的第 2 页里 404416635、404201264、404113313、404243129、404201263 前一天在第 1 页
    expect(albums.items).toHaveLength(55)
    expect(albums.items.slice(30, 33).map(album => album.id)).toEqual([246353308, 366972781, 278596184])
    expect(new Set(albums.items.map(album => album.id)).size).toBe(55)

    await world.netease.reply(ALBUMS_MAYONAKA_2, {
      until: never(),
    })
    void app.moreSearchResults('真夜中', 'albums')
    await world.settle()
    expect(searched('albums').map(query => (query as { offset: number }).offset)).toEqual([0, 30, 60])
  })

  it('一位都没搜到：这一类是空的，总数 0，没有“显示更多”', async () => {
    const { app } = await signInAtHearts(world.device())

    await searchFor(app, 'Sea Of Tired Slowed', { artists: ARTISTS_NONE })

    expect(shownList(app, 'artists')).toEqual({
      status: 'shown',
      items: [],
      total: 0,
      offset: 0,
      more: null,
    })
  })

  it('专辑：封面、名字、歌手、发行时间；显示更多接着取下一页', async () => {
    const { app } = await signInAtHearts(world.device())
    await searchFor(app, '真夜中', { albums: ALBUMS_MAYONAKA })
    expect(shownList(app, 'albums').items[0]).toEqual({
      id: 82815921,
      name: '潜潜話',
      coverUrl: 'https://p4.music.126.net/yY7dfLy85x5shoR_5jqQNQ==/109951171178918869.jpg',
      artists: [
        { id: 15021101, name: 'ずっと真夜中でいいのに。' },
      ],
      publishedAt: 1572278400000,
    })

    await world.netease.reply(ALBUMS_MAYONAKA_2)
    await app.moreSearchResults('真夜中', 'albums')

    const albums = shownList(app, 'albums')
    expect(albums.items).toHaveLength(60)
    expect(albums.items[30].id).toBe(246353308)
    expect(albums).toMatchObject({
      total: 503,
      more: { status: 'notLoaded' },
    })
  })

  it('显示更多没取成（断网）：已经有的照常显示，说明原因；联网后再取一次就是重试', async () => {
    const device = world.device()
    const { app } = await signInAtHearts(device)
    await searchFor(app, '真夜中', { albums: ALBUMS_MAYONAKA })

    device.setOnline(false)
    await app.moreSearchResults('真夜中', 'albums')
    expect(shownList(app, 'albums')).toMatchObject({
      more: {
        status: 'failed',
        failure: { kind: 'offline' },
      },
    })
    expect(shownList(app, 'albums').items).toHaveLength(30)

    device.setOnline(true)
    await world.netease.reply(ALBUMS_MAYONAKA_2)
    await app.moreSearchResults('真夜中', 'albums')
    expect(shownList(app, 'albums').items).toHaveLength(60)
    expect(searched('albums').map(query => (query as { offset: number }).offset)).toEqual([0, 30])
  })
})

describe('在结果里点歌是插播', () => {
  it('排在当前这首后面马上放，播放队列里其余的歌和先后都不变；这首的播放来源是这次搜索', async () => {
    const device = world.device()
    const { app } = await signInAtHearts(device)
    await world.netease.reply(DAILY)
    await app.openDaily()
    const daily = app.state.daily?.status === 'shown'
      ? app.state.daily.songs.map(song => song.id)
      : []
    await world.netease.reply(SOME_PLAY_URL, {
      until: never(),
    })
    app.play({ kind: 'daily' }, daily[2])
    await world.settle()
    const songs = await searchShown(app, '夜に駆ける', SONGS_YORU_NI_KAKERU)

    await world.netease.reply(FIRST_RESULT_URL, {
      until: never(),
    })
    app.play(SEARCHED, songs[0].id)
    await world.settle()

    const { queue, current } = app.state.player
    expect(queue.map(entry => entry.song.id)).toEqual([
      ...daily.slice(0, 3),
      songs[0].id,
      ...daily.slice(3),
    ])
    expect(current).toBe(3)
    expect(queue[3].source).toEqual(SEARCHED)
    expect(queue.filter((_, index) => index !== 3).every(entry => entry.source.kind === 'daily')).toBe(true)
    expect(device.requests.at(-1)?.path).toBe(`/api/songs/${songs[0].id}/play-url?quality=exhigh`)
  })

  it('插播的歌听完打卡：播放来源是这次搜索，服务端照 SDK 文档报 search、来源编号 0', async () => {
    const device = world.device()
    const tab = await signInAtHearts(device)
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
    expect(sent).toEqual([
      {
        method: 'POST',
        path: `/api/songs/${songs[0].id}/check-in`,
        body: { source: SEARCHED, seconds: 10 },
      },
    ])
    expect(world.netease.calls.filter(call => call.module === 'scrobble').map(call => call.query)).toEqual([
      {
        id: songs[0].id,
        sourceid: 0,
        source: 'search',
        time: 10,
      },
    ])
  })

  it('“显示更多”加进来的歌，点了也是插播', async () => {
    const device = world.device()
    const { app } = await signInAtHearts(device)
    await searchFor(app, '真夜中', { songs: SONGS_MAYONAKA })
    await world.netease.reply(SONGS_MAYONAKA_2)
    await app.moreSearchResults('真夜中', 'songs')
    const song = shownList(app, 'songs').items[30]

    await world.netease.reply(SOME_PLAY_URL, {
      until: never(),
    })
    app.play({ kind: 'search', keyword: '真夜中' }, song.id)
    await world.settle()

    expect(app.state.player.queue.map(entry => entry.song.id)).toEqual([song.id])
    expect(device.requests.at(-1)?.path).toBe(`/api/songs/${song.id}/play-url?quality=exhigh`)
  })
})
