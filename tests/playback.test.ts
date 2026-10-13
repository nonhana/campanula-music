import type { App } from '$lib/app/app'
import type { FakeAudio } from './harness/browser'
import type { Device, Tab } from './harness/device'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { MEDIA_ERR_NETWORK, MEDIA_ERR_SRC_NOT_SUPPORTED } from './harness/browser'
import { signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()

// 点歌就播放（#24）：浏览器拿服务端取的播放地址直连网易云的音频服务器，两个播放器轮流放（ADR-0010）。
// 音频服务器那边（数据什么时候够放、放到哪了、断流）由测试在播放器替身上决定

const HEARTS = 'library/likelist.json'
const PLAYLISTS = 'library/sync/before/001-user_playlist.json.gz'
const COLLECTED_ALBUMS = 'library/album-artist/001-album_sublist.json.gz'
const COLLECTED_ARTISTS = 'library/album-artist/002-artist_sublist.json.gz'
const LIKED_TRACK_IDS = 'library/playlist_detail.liked-full.json.gz'
const PAGE = (n: number) => `library/song_detail.liked-page${n}.json.gz`
const LIKED = { kind: 'playlist', id: 900000001 } as const

/** 我喜欢的音乐里的歌、它们的播放地址（极高音质，#24 录制）和音频的时长（秒，录制里的 time）：第 1～3 首、无版权那首前后各一首、最后一首 */
const FIRST = { id: 3433267939, url: 'playback/liked/001-song_url_v1.json.gz', duration: 192.648 }
const SECOND = { id: 2662577181, url: 'playback/liked/002-song_url_v1.json.gz', duration: 240.413 }
const THIRD = { id: 4208408, url: 'playback/liked/003-song_url_v1.json.gz', duration: 310 }
const BEFORE_NO_COPYRIGHT = { id: 2092188841, url: 'playback/liked/004-song_url_v1.json.gz', duration: 176.097 }
const AFTER_NO_COPYRIGHT = { id: 2044505920, url: 'playback/liked/005-song_url_v1.json.gz', duration: 225.245 }
const LAST = { id: 22712173, url: 'playback/liked/006-song_url_v1.json.gz', duration: 532.866 }
const RECORDED = [FIRST, SECOND, THIRD, BEFORE_NO_COPYRIGHT, AFTER_NO_COPYRIGHT, LAST]
type Recorded = typeof FIRST
/** 我喜欢的音乐里无版权的一首（Sea Of Tired（Slowed）），夹在上面两首中间 */
const NO_COPYRIGHT = 2108191414

/** 匿名录的专辑（library/album.json）：只有一首，非会员只能试听；它的试听片段地址（30 秒） */
const TRIAL_ALBUM = { id: 84072830, song: 1409311773 }
const TRIAL_URL = 'playback/song_url_v1.anon-trial.json'

/** 网易云压着不回 */
const never = () => new Promise<void>(() => {})

async function readRecording(path: string): Promise<{ response: { body: any } }> {
  const bytes = await readFile(new URL(`./fixtures/netease/${path}`, import.meta.url))
  return JSON.parse((path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8'))
}

/** 点一首歌，让它出声：网易云回这首和下一首（空闲的播放器预先缓冲）的播放地址。返回出声的播放器 */
async function playUntilSounding(tab: Tab, song: Recorded, next: Recorded): Promise<FakeAudio> {
  await world.netease.reply(song.url)
  await world.netease.reply(next.url)
  tab.app.play(LIKED, song.id)
  await world.settle()
  const player = tab.audio.find(audio => !audio.paused)!
  player.ready(song.duration)
  await world.settle()
  if (tab.sounding() !== player)
    throw new Error('点的歌没出声')
  return player
}

/** 另一个播放器 */
const other = (tab: Tab, player: FakeAudio) => tab.audio.find(audio => audio !== player)!

/** 录下的播放地址：服务端换成 https 交给浏览器 */
async function recordedUrl(path: string): Promise<string> {
  const { response } = await readRecording(path)
  return (response.body.data[0].url as string).replace(/^http:/, 'https:')
}

/** 登录，后台同步完我喜欢的音乐后停在下一张歌单 */
async function signInWithLiked(device: Device): Promise<Tab> {
  const tab = await device.open()
  await world.netease.reply(HEARTS)
  await world.netease.reply(PLAYLISTS)
  await world.netease.reply(COLLECTED_ALBUMS)
  await world.netease.reply(COLLECTED_ARTISTS)
  await world.netease.reply(LIKED_TRACK_IDS)
  for (const page of [1, 2, 3, 4, 5])
    await world.netease.reply(PAGE(page))
  await world.netease.reply(LIKED_TRACK_IDS, { until: never() })
  await signIn(world, tab.app)
  await world.settle()
  if (!tab.app.state.library?.liked?.complete)
    throw new Error('我喜欢的音乐没同步完')
  return tab
}

/** 取过哪些歌的播放地址，按先后 */
function playUrlRequests(device: Device): string[] {
  return device.requests.flatMap(request => request.path.startsWith('/api/songs/') ? [request.path] : [])
}

/** 当前这首的编号 */
function current(app: App): number | null {
  const { queue, current } = app.state.player
  return current === null ? null : queue[current].song.id
}

describe('点歌', () => {
  it('在我喜欢的音乐里点一首歌：整个列表替换播放队列，每首记着播放来源；服务端按极高音质取这首的播放地址，浏览器拿 https 地址直连网易云的音频服务器放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const liked = app.state.library!.liked!

    await world.netease.reply(FIRST.url)
    await world.netease.reply(SECOND.url)
    app.play(LIKED, FIRST.id)
    expect(app.state.player.status).toBe('loading')
    await world.settle()

    const { queue } = app.state.player
    expect(queue.map(entry => entry.song.id)).toEqual(liked.songs.map(song => song.id))
    expect(queue.every(entry => entry.source.kind === 'playlist' && entry.source.id === LIKED.id)).toBe(true)
    expect(current(app)).toBe(FIRST.id)
    expect(playUrlRequests(device)[0]).toBe(`/api/songs/${FIRST.id}/play-url?quality=exhigh`)
    expect(world.netease.calls.find(call => call.module === 'song_url_v1')).toMatchObject({ query: { id: FIRST.id, level: 'exhigh' } })
    const player = tab.audio.find(audio => audio.src !== '')!
    expect(player.src).toBe(await recordedUrl(FIRST.url))
    expect(player.paused).toBe(false)
    expect(app.state.player.status).toBe('buffering')

    player.ready(192.648)
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(app.state.player).toMatchObject({ status: 'playing', duration: 192.648, position: 0, trial: false, notice: null })
  })

  it('换一首、还在取它的地址时：旧的那首接着出声，但它的进度、放完都不算到新的这首上', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    player.progress(100)
    await world.netease.reply(THIRD.url, { until: never() })
    app.play(LIKED, THIRD.id)
    await world.settle()
    expect(app.state.player).toMatchObject({ status: 'loading', position: 0 })
    expect(current(app)).toBe(THIRD.id)

    player.progress(150)
    player.end()
    await world.settle()
    expect(current(app)).toBe(THIRD.id)
    expect(app.state.player).toMatchObject({ status: 'loading', position: 0 })
    expect(playUrlRequests(device)).toHaveLength(3)
  })
})

/** 一个压着不回的网易云返回：release() 了才回 */
function held() {
  let release = (): void => {}
  const until = new Promise<void>((resolve) => {
    release = resolve
  })
  return { until, release }
}

/** 登录，后台同步停在我喜欢的音乐的曲目编号 */
async function signInHeldAtLiked(device: Device): Promise<Tab> {
  const tab = await device.open()
  await world.netease.reply(HEARTS)
  await world.netease.reply(PLAYLISTS)
  await world.netease.reply(COLLECTED_ALBUMS)
  await world.netease.reply(COLLECTED_ARTISTS)
  await world.netease.reply(LIKED_TRACK_IDS, { until: never() })
  await signIn(world, tab.app)
  await world.settle()
  return tab
}

const queueIds = (app: App) => app.state.player.queue.map(entry => entry.song.id)

describe('只同步了一部分的歌单', () => {
  it('我喜欢的音乐只同步了前两页时点歌：先用已经同步的部分替换播放队列，同步完把后面的补上（规则⑫）', async () => {
    const device = world.device()
    const tab = await device.open()
    const { app } = tab
    await world.netease.reply(HEARTS)
    await world.netease.reply(PLAYLISTS)
    await world.netease.reply(COLLECTED_ALBUMS)
    await world.netease.reply(COLLECTED_ARTISTS)
    await world.netease.reply(LIKED_TRACK_IDS)
    await world.netease.reply(PAGE(1))
    await world.netease.reply(PAGE(2))
    const page3 = held()
    await world.netease.reply(PAGE(3), { until: page3.until })
    await world.netease.reply(PAGE(4))
    await world.netease.reply(PAGE(5))
    await world.netease.reply(LIKED_TRACK_IDS, { until: never() })
    await signIn(world, app)
    await world.settle()
    const partial = app.state.library!.liked!
    expect(partial.complete).toBe(false)
    expect(partial.songs).toHaveLength(2000)

    await world.netease.reply(FIRST.url)
    await world.netease.reply(SECOND.url)
    app.play(LIKED, FIRST.id)
    await world.settle()
    expect(queueIds(app)).toEqual(partial.songs.map(song => song.id))

    page3.release()
    await world.settle()
    const liked = app.state.library!.liked!
    expect(liked.complete).toBe(true)
    expect(liked.songs.length).toBeGreaterThan(4900)
    expect(queueIds(app)).toEqual(liked.songs.map(song => song.id))
    expect(app.state.player.queue.every(entry => entry.source.kind === 'playlist' && entry.source.id === LIKED.id)).toBe(true)
    expect(current(app)).toBe(FIRST.id)
    expect(app.state.player.current).toBe(0)
  })

  it('已经同步的歌散在歌单中间时（别的歌单里同步过的歌也有歌曲信息）：同步完按歌单的顺序排好，当前这首不变', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    // 作者的自建歌单 rhythm（35 首）：只有第 34 首不在我喜欢的音乐里，打开时其余 34 首已经有歌曲信息（#22 录制）
    const RHYTHM = { kind: 'playlist', id: 900000009 } as const
    await world.netease.reply('library/sync/before/013-playlist_detail.json.gz')
    const missingPage = held()
    await world.netease.reply('library/sync/before/014-song_detail.json.gz', { until: missingPage.until })
    void app.openPlaylist(RHYTHM.id)
    await world.settle()
    const partial = app.state.library!.songsOf(RHYTHM.id)!
    expect(partial.complete).toBe(false)
    expect(partial.songs).toHaveLength(34)

    const first = partial.songs[0].id
    await world.netease.reply(FIRST.url, { until: never() })
    app.play(RHYTHM, first)
    await world.settle()
    expect(queueIds(app)).toEqual(partial.songs.map(song => song.id))

    missingPage.release()
    await world.settle()
    const rhythm = app.state.library!.songsOf(RHYTHM.id)!
    expect(rhythm.complete).toBe(true)
    expect(queueIds(app)).toEqual(rhythm.songs.map(song => song.id))
    expect(queueIds(app)[33]).toBe(1401042579)
    expect(current(app)).toBe(first)
  })
})

describe('试听和无版权', () => {
  it('会员歌对非会员只能试听：专辑页里标着试听；点了放试听片段，播放条标“试听”', async () => {
    const device = world.device()
    const tab = await signInHeldAtLiked(device)
    const { app } = tab
    await world.netease.reply('library/album.json')
    await app.openAlbum(TRIAL_ALBUM.id)
    const page = app.state.library!.albumPage(TRIAL_ALBUM.id)
    if (page?.status !== 'shown')
      throw new Error('专辑页没显示')
    expect(page.content.songs.map(song => [song.id, song.availability])).toEqual([[TRIAL_ALBUM.song, 'trial']])

    await world.netease.reply(TRIAL_URL)
    app.play({ kind: 'album', id: TRIAL_ALBUM.id }, TRIAL_ALBUM.song)
    await world.settle()
    const player = tab.audio.find(audio => !audio.paused)!
    expect(player.src).toBe(await recordedUrl(TRIAL_URL))
    player.ready(30.04)
    await world.settle()
    expect(app.state.player).toMatchObject({ status: 'playing', trial: true, duration: 30.04 })
    expect(app.state.player.queue).toEqual([expect.objectContaining({ source: { kind: 'album', id: TRIAL_ALBUM.id } })])
  })

  it('无版权的歌：列表里标出来，点了不放；前一首放完时跳过它，不取它的地址', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const { songs } = app.state.library!.liked!
    // 我喜欢的音乐里 38 首无版权、6 首会员账号也只能试听（hana-music-api#65 里数过的录制）
    expect(songs.filter(song => song.availability === 'noCopyright')).toHaveLength(38)
    expect(songs.filter(song => song.availability === 'trial')).toHaveLength(6)
    expect(songs.find(song => song.id === NO_COPYRIGHT)?.availability).toBe('noCopyright')

    app.play(LIKED, NO_COPYRIGHT)
    await world.settle()
    expect(app.state.player.queue).toEqual([])
    expect(playUrlRequests(device)).toEqual([])

    const player = await playUntilSounding(tab, BEFORE_NO_COPYRIGHT, AFTER_NO_COPYRIGHT)
    const spare = other(tab, player)
    expect(spare.src).toBe(await recordedUrl(AFTER_NO_COPYRIGHT.url))
    spare.ready(AFTER_NO_COPYRIGHT.duration)
    await world.netease.reply(THIRD.url, { until: never() })
    player.progress(175.2)
    await world.settle()
    expect(current(app)).toBe(AFTER_NO_COPYRIGHT.id)
    expect(tab.sounding()).toBe(spare)
    expect(playUrlRequests(device).some(path => path.includes(String(NO_COPYRIGHT)))).toBe(false)
  })
})

describe('播放地址过期', () => {
  it('暂停 20 多分钟后再按播放：重新取地址，从原来的位置接着放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    player.progress(83.5)
    app.togglePlay()
    await world.settle()
    expect(app.state.player).toMatchObject({ status: 'paused', position: 83.5 })
    expect(tab.sounding()).toBeUndefined()

    await world.clock.advance(25 * 60_000)
    await world.netease.reply(FIRST.url)
    await world.netease.reply(SECOND.url)
    app.togglePlay()
    expect(app.state.player.status).toBe('loading')
    await world.settle()
    expect(playUrlRequests(device).filter(path => path.includes(String(FIRST.id)))).toHaveLength(2)
    const resumed = other(tab, player)
    expect(resumed.src).toBe(await recordedUrl(FIRST.url))
    expect(resumed.currentTime).toBe(83.5)
    expect(resumed.paused).toBe(false)

    resumed.ready(FIRST.duration)
    await world.settle()
    expect(tab.sounding()).toBe(resumed)
    expect(app.state.player).toMatchObject({ status: 'playing', position: 83.5, notice: null })
  })

  it('放着放着地址过期、音频服务器断开：不提示，重新取地址从断开的位置接着放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    player.progress(120)
    await world.clock.advance(20 * 60_000)
    await world.netease.reply(FIRST.url)
    await world.netease.reply(SECOND.url)
    player.fail(MEDIA_ERR_NETWORK)
    expect(app.state.player.status).toBe('loading')
    await world.settle()
    const resumed = other(tab, player)
    expect(resumed.src).toBe(await recordedUrl(FIRST.url))
    expect(resumed.currentTime).toBe(120)
    resumed.ready(FIRST.duration)
    await world.settle()
    expect(app.state.player).toMatchObject({ status: 'playing', position: 120, notice: null })
  })
})

describe('断流和出错', () => {
  it('在线播放到一半断流：停在原来的位置，明确提示；按播放从那里接着放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    player.progress(61.2)
    player.fail(MEDIA_ERR_NETWORK)
    await world.settle()
    expect(app.state.player).toMatchObject({ status: 'paused', position: 61.2, notice: { kind: 'streamFailed' } })
    expect(tab.sounding()).toBeUndefined()

    app.togglePlay()
    await world.settle()
    const resumed = tab.audio.find(audio => !audio.paused)!
    expect(resumed.src).toBe(await recordedUrl(FIRST.url))
    expect(resumed.currentTime).toBe(61.2)
    resumed.ready(FIRST.duration)
    await world.settle()
    expect(tab.sounding()).toBe(resumed)
    expect(app.state.player).toMatchObject({ status: 'playing', position: 61.2, notice: null })
  })

  it('数据接不上、缓冲了 8 秒还没出声：提示网络慢；接上了提示消失', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    player.progress(30)
    player.stall()
    await world.settle()
    expect(app.state.player).toMatchObject({ status: 'buffering', notice: null })
    await world.clock.advance(7_000)
    expect(app.state.player.notice).toBeNull()
    await world.clock.advance(1_000)
    expect(app.state.player).toMatchObject({ status: 'buffering', notice: { kind: 'slow' } })

    player.ready(FIRST.duration)
    await world.settle()
    expect(app.state.player).toMatchObject({ status: 'playing', notice: null })
  })

  it('点的歌一开始就没加载出来：停下，明确提示', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await world.netease.reply(FIRST.url)
    app.play(LIKED, FIRST.id)
    await world.settle()
    tab.audio.find(audio => !audio.paused)!.fail(MEDIA_ERR_SRC_NOT_SUPPORTED)
    await world.settle()
    expect(app.state.player).toMatchObject({ status: 'paused', notice: { kind: 'streamFailed' } })
    expect(tab.audio.every(audio => audio.paused)).toBe(true)
  })

  it('断网时点歌：没取到播放地址，停下说明原因；联网后按播放重试', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    device.setOnline(false)
    app.play(LIKED, FIRST.id)
    await world.settle()
    expect(app.state.player).toMatchObject({ status: 'paused', current: 0, notice: { kind: 'urlFailed', failure: { kind: 'offline' } } })

    device.setOnline(true)
    await world.netease.reply(FIRST.url)
    await world.netease.reply(SECOND.url)
    app.togglePlay()
    expect(app.state.player).toMatchObject({ status: 'loading', notice: null })
    await world.settle()
    expect(tab.audio.find(audio => !audio.paused)?.src).toBe(await recordedUrl(FIRST.url))
  })
})

describe('两个播放器交替（ADR-0010）', () => {
  it('当前这首出声后，空闲的播放器取好下一首的地址、缓冲着；剩 1 秒时它开始放，出声了再停旧的', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    expect(playUrlRequests(device)).toEqual([FIRST.id, SECOND.id].map(id => `/api/songs/${id}/play-url?quality=exhigh`))
    expect(spare.src).toBe(await recordedUrl(SECOND.url))
    expect(spare.paused).toBe(true)

    spare.ready(SECOND.duration)
    player.progress(190)
    await world.settle()
    expect(spare.paused).toBe(true)

    await world.netease.reply(THIRD.url)
    player.progress(191.7)
    expect(spare.paused).toBe(false)
    expect(player.sounding).toBe(true)
    await world.settle()
    expect(tab.sounding()).toBe(spare)
    expect(player.paused).toBe(true)
    expect(current(app)).toBe(SECOND.id)
    expect(app.state.player).toMatchObject({ status: 'playing', duration: SECOND.duration })
    // 换下来的那个接着缓冲第三首
    expect(player.src).toBe(await recordedUrl(THIRD.url))
  })

  it('下一首还没缓冲好：剩 5 秒就开始交接；旧的先放完时等新的出声，不重新取地址', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    player.progress(188)
    await world.settle()
    expect(spare.paused).toBe(false)

    player.end()
    await world.settle()
    expect(current(app)).toBe(SECOND.id)
    expect(app.state.player.status).toBe('buffering')
    expect(playUrlRequests(device)).toHaveLength(2)

    await world.netease.reply(THIRD.url)
    spare.ready(SECOND.duration)
    await world.settle()
    expect(tab.sounding()).toBe(spare)
    expect(app.state.player.status).toBe('playing')
  })

  it('交接失败（下一首没加载出来）：让当前这首放完，再停下明确提示；按播放重试下一首', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    spare.ready(SECOND.duration)
    player.progress(191.7)
    spare.fail(MEDIA_ERR_NETWORK)
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(current(app)).toBe(FIRST.id)

    player.end()
    await world.settle()
    expect(app.state.player).toMatchObject({ status: 'paused', position: 0, notice: { kind: 'streamFailed' } })
    expect(current(app)).toBe(SECOND.id)

    app.togglePlay()
    await world.settle()
    const retried = tab.audio.find(audio => !audio.paused)!
    expect(retried.src).toBe(await recordedUrl(SECOND.url))
    expect(retried.error).toBeNull()
  })

  it('取下一首的地址时断网了：当前这首剩 20 秒时再准备一次，照样交接', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await world.netease.reply(FIRST.url)
    app.play(LIKED, FIRST.id)
    await world.settle()
    const player = tab.audio.find(audio => !audio.paused)!
    device.setOnline(false)
    player.ready(FIRST.duration)
    await world.settle()
    expect(playUrlRequests(device)).toHaveLength(1)

    device.setOnline(true)
    await world.netease.reply(SECOND.url)
    await world.clock.advance(150_000)
    player.progress(150)
    await world.settle()
    expect(playUrlRequests(device)).toHaveLength(1)

    await world.clock.advance(25_000)
    player.progress(175)
    await world.settle()
    expect(playUrlRequests(device)).toEqual([FIRST.id, SECOND.id].map(id => `/api/songs/${id}/play-url?quality=exhigh`))
    const spare = other(tab, player)
    expect(spare.src).toBe(await recordedUrl(SECOND.url))

    spare.ready(SECOND.duration)
    await world.netease.reply(THIRD.url)
    player.progress(191.7)
    await world.settle()
    expect(tab.sounding()).toBe(spare)
    expect(current(app)).toBe(SECOND.id)
  })
})

describe('上一首、下一首、暂停', () => {
  it('下一首：空闲的播放器已经缓冲好就直接放，不重新取地址；出声了再停旧的', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    spare.ready(SECOND.duration)
    await world.netease.reply(THIRD.url)
    app.next()
    expect(current(app)).toBe(SECOND.id)
    expect(player.sounding).toBe(true)
    await world.settle()
    expect(tab.sounding()).toBe(spare)
    expect(player.paused).toBe(true)
    expect(playUrlRequests(device)).toEqual([FIRST.id, SECOND.id, THIRD.id].map(id => `/api/songs/${id}/play-url?quality=exhigh`))
  })

  it('上一首：在第一首时转到最后一首', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await playUntilSounding(tab, FIRST, SECOND)
    await world.netease.reply(LAST.url)
    app.previous()
    await world.settle()
    expect(current(app)).toBe(LAST.id)
    expect(tab.audio.find(audio => !audio.paused)?.src).toBe(await recordedUrl(LAST.url))
  })

  it('暂停后接着放：还是那个播放器，地址没过期就不重新取', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    player.progress(42)
    app.togglePlay()
    await world.settle()
    expect(player.paused).toBe(true)
    expect(app.state.player.status).toBe('paused')

    app.togglePlay()
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(app.state.player).toMatchObject({ status: 'playing', position: 42 })
    expect(playUrlRequests(device)).toHaveLength(2)
  })

  it('退出登录：停下，清空播放队列', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await playUntilSounding(tab, FIRST, SECOND)
    await world.netease.reply('login/logout.json')
    await app.logout()
    expect(tab.sounding()).toBeUndefined()
    expect(app.state.player).toMatchObject({ queue: [], current: null, status: 'paused' })
  })
})

describe('随机操作检查（借鉴逻辑原型）', () => {
  /** 可重现的伪随机数（mulberry32）：失败时按打出来的种子重跑同一串操作 */
  function seeded(seed: number): () => number {
    let state = seed
    return () => {
      state = (state + 0x6D2B79F5) | 0
      let next = Math.imul(state ^ (state >>> 15), 1 | state)
      next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296
    }
  }

  it('随便怎么点歌、切歌、暂停，音频服务器怎么断流、出错，每一步之后：显示“取播放地址中”时，一定有一个取当前这首播放地址的请求在路上', async () => {
    // 全局的 Date 被世界的时钟冻结在同一时刻，不能拿来当种子
    const seed = Math.floor(Math.random() * 100_000)
    const random = seeded(seed)
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]
    /** 压着的网易云返回，随机地放出来 */
    let holds: (() => void)[] = []
    let queued = 0

    /**
     * 网易云总还有四份播放地址没用掉，一半压着。录到地址的只有几首：回的不是请求的那首时，服务端认作网易云没给地址，App 跳过它、
     * 接着取下一首的，正好也让“跳过”这条路走得到。连着跳过把四份都用完时，替身没有返回、服务端出错，App 停下说明原因
     */
    async function topUp(): Promise<void> {
      while (queued - world.netease.calls.filter(call => call.module === 'song_url_v1').length < 4) {
        queued += 1
        const { url } = pick(RECORDED)
        if (random() < 0.5) {
          await world.netease.reply(url)
          continue
        }
        const hold = held()
        holds.push(hold.release)
        await world.netease.reply(url, { until: hold.until })
      }
    }

    for (let round = 0; round < 4; round++) {
      const device = world.device()
      const tab = await signInWithLiked(device)
      const { app } = tab
      queued = world.netease.calls.filter(call => call.module === 'song_url_v1').length
      const steps: string[] = []

      for (let step = 0; step < 60; step++) {
        await topUp()
        const audio = pick(tab.audio)
        const actions = [
          'play',
          'play',
          'toggle',
          'next',
          'previous',
          'advance',
          'release',
          'release',
          'network',
          ...(audio.src && !audio.error ? ['ready', 'ready', 'fail'] : []),
          ...(audio.sounding ? ['progress', 'progress', 'end', 'stall'] : []),
        ]
        const action = pick(actions)
        steps.push(action)
        switch (action) {
          case 'play':
            app.play(LIKED, pick(RECORDED).id)
            break
          case 'toggle':
            app.togglePlay()
            break
          case 'next':
            app.next()
            break
          case 'previous':
            app.previous()
            break
          case 'advance':
            await world.clock.advance(pick([1_000, 9_000, 21 * 60_000]))
            break
          case 'release':
            holds.splice(Math.floor(random() * holds.length), 1)[0]?.()
            break
          case 'network':
            device.setOnline(random() < 0.7)
            break
          case 'ready':
            audio.ready(200)
            break
          case 'fail':
            audio.fail(pick([MEDIA_ERR_NETWORK, MEDIA_ERR_SRC_NOT_SUPPORTED]))
            break
          case 'progress':
            audio.progress(random() * 200)
            break
          case 'end':
            audio.end()
            break
          case 'stall':
            audio.stall()
            break
        }
        await world.settle()

        const where = `种子 ${seed}，第 ${round} 轮，操作 ${steps.join(' → ')}`
        if (app.state.player.status === 'loading') {
          const path = `/api/songs/${current(app)}/play-url?quality=exhigh`
          expect(device.pending.some(request => request.path === path), `显示“取播放地址中”时一定有取当前这首地址的请求在路上（${where}）`).toBe(true)
        }
      }

      for (const release of holds)
        release()
      holds = []
      device.setOnline(true)
      await world.settle()
    }
  }, 120_000)
})
