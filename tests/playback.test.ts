import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Song } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'

import type { FakeAudio } from './harness/browser'
import { MEDIA_ERR_NETWORK, MEDIA_ERR_SRC_NOT_SUPPORTED } from './harness/browser'
import type { Device, Tab } from './harness/device'
import { loadFixture } from './harness/fixtures'
import { held, never } from './harness/hold'
import { checkIns, current, likedPage, likedSong, listener, PLAYLISTS_WITH_POEMS, playUrlRequests, queueIds, storedCheckIns } from './harness/listener'
import { RECORDED_ACCOUNT, signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInWithLiked, signInAtLikedTracks, reopen, replyLibrary } = listener(world, { playlists: PLAYLISTS_WITH_POEMS })

// 点歌就播放（#24）：浏览器拿服务端取的播放地址直连网易云的音频服务器，两个播放器轮流放（ADR-0010）；音频服务器那边（数据什么时候够放、放到哪了、断流）由测试在播放器替身上决定

const LIKED = { kind: 'playlist', id: 900000001 } as const

/** 我喜欢的音乐里的歌、它们的播放地址（极高音质，#24 录制）和音频的时长（秒，录制里的 time）：第 1～3 首、无版权那首前后各一首、最后一首 */
const FIRST = { id: 3433267939, url: 'playback/liked/001-song_url_v1.json.gz', duration: 192.648 }
const SECOND = { id: 2662577181, url: 'playback/liked/002-song_url_v1.json.gz', duration: 240.413 }
const THIRD = { id: 4208408, url: 'playback/liked/003-song_url_v1.json.gz', duration: 310 }
const BEFORE_NO_COPYRIGHT = { id: 2092188841, url: 'playback/liked/004-song_url_v1.json.gz', duration: 176.097 }
const AFTER_NO_COPYRIGHT = { id: 2044505920, url: 'playback/liked/005-song_url_v1.json.gz', duration: 225.245 }
const LAST = { id: 22712173, url: 'playback/liked/006-song_url_v1.json.gz', duration: 532.866 }
const RECORDED = [
  FIRST,
  SECOND,
  THIRD,
  BEFORE_NO_COPYRIGHT,
  AFTER_NO_COPYRIGHT,
  LAST,
]
type Recorded = typeof FIRST
/** 我喜欢的音乐里无版权的一首（Sea Of Tired（Slowed）），夹在上面两首中间 */
const NO_COPYRIGHT = 2108191414

/** 匿名录的专辑（library/album.json）：只有一首，非会员只能试听；它的试听片段地址（30 秒） */
const TRIAL_ALBUM = { id: 84072830, song: 1409311773 }
const TRIAL_URL = 'playback/song_url_v1.anon-trial.json'

/** 已录的搜索结果和同一首歌的真实 30 秒试听地址（#31）；也在我喜欢的音乐第 5 页里 */
const SEARCHED = { kind: 'search', keyword: '夜に駆ける' } as const
const SEARCH_SONG = { id: TRIAL_ALBUM.song, url: TRIAL_URL, duration: 30.04 }
const SEARCH_RESULTS = 'search/songs/003-cloudsearch.json.gz'

/** 听众按搜索，单曲结果显示出来；不看的其他三类结果一直等着（和 search.test.ts 一样） */
const showSearch = async (app: App, keyword: string = SEARCHED.keyword, fixture = SEARCH_RESULTS): Promise<readonly Song[]> => {
  await world.netease.reply(fixture, {
    when: { type: 1 },
  })
  for (const type of [1000, 100, 10]) {
    await world.netease.reply(fixture, {
      when: { type },
      until: never(),
    })
  }
  void app.search(keyword)
  await world.settle()
  const songs = app.state.search.results?.songs
  if (songs?.status !== 'shown')
    throw new Error('搜索的单曲结果没显示')
  return songs.items
}

/** 搜索结果里的同一首歌先从我喜欢的音乐加入空队列并出声；再点搜索结果时，能核对当前这首的来源也没变 */
const playSearchedSongUntilSounding = async (tab: Tab): Promise<FakeAudio> => {
  await showSearch(tab.app)
  await world.netease.reply(SEARCH_SONG.url)
  tab.app.addToQueue(LIKED, likedSong(tab.app, SEARCH_SONG.id))
  await world.settle()
  await world.netease.reply(SECOND.url)
  tab.app.addToQueue(LIKED, likedSong(tab.app, SECOND.id))
  await world.settle()
  const player = tab.audio.find(audio => !audio.paused)!
  player.ready(SEARCH_SONG.duration)
  await world.settle()
  return player
}

/** 点一首歌，让它出声：网易云回这首和下一首（空闲的播放器预先缓冲）的播放地址。返回出声的播放器 */
const playUntilSounding = async (tab: Tab, song: Recorded, next: Recorded): Promise<FakeAudio> => {
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

const other = (tab: Tab, player: FakeAudio) => tab.audio.find(audio => audio !== player)!

/** 录下的播放地址：服务端换成 https 交给浏览器 */
const recordedUrl = async (path: string): Promise<string> => {
  const { outcome } = await loadFixture(path)
  const body = outcome.response.body as { data: { url: string }[] }
  return body.data[0].url.replace(/^http:/, 'https:')
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
    expect(world.netease.calls.find(call => call.module === 'song_url_v1')).toMatchObject({
      query: { id: FIRST.id, level: 'exhigh' },
    })
    const player = tab.audio.find(audio => audio.src !== '')!
    expect(player.src).toBe(await recordedUrl(FIRST.url))
    expect(player.paused).toBe(false)
    expect(app.state.player.status).toBe('buffering')

    player.ready(192.648)
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(app.state.player).toMatchObject({
      status: 'playing',
      duration: 192.648,
      position: 0,
      trial: false,
      notice: null,
    })
  })

  it('换一首、还在取它的地址时：旧的那首接着出声，但它的进度、放完都不算到新的这首上', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    player.progress(100)
    await world.netease.reply(THIRD.url, {
      until: never(),
    })
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

describe('只同步了一部分的歌单', () => {
  it('我喜欢的音乐只同步了前两页时点歌：先用已经同步的部分替换播放队列，同步完把后面的补上（规则⑫）', async () => {
    const device = world.device()
    const tab = await device.open()
    const { app } = tab
    await replyLibrary()
    await world.netease.reply(likedPage(1))
    await world.netease.reply(likedPage(2))
    const page3 = held()
    await world.netease.reply(likedPage(3), { until: page3.until })
    await world.netease.reply(likedPage(4))
    await world.netease.reply(likedPage(5))
    await replyLibrary({
      from: 'likedTracks',
      through: 'likedTracks',
      until: never(),
    })
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
    await world.netease.reply(FIRST.url, {
      until: never(),
    })
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

  it('点歌后又选了下一首播放、加入播放队列、移出：同步完补上时这些照旧，补上的歌不插到“下一首播放”的前面', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const RHYTHM = { kind: 'playlist', id: 900000009 } as const
    await world.netease.reply('library/sync/before/013-playlist_detail.json.gz')
    const missingPage = held()
    await world.netease.reply('library/sync/before/014-song_detail.json.gz', { until: missingPage.until })
    void app.openPlaylist(RHYTHM.id)
    await world.settle()
    const partial = app.state.library!.songsOf(RHYTHM.id)!.songs.map(song => song.id)
    await world.netease.reply(FIRST.url, {
      until: never(),
    })
    app.play(RHYTHM, partial[0])
    await world.settle()

    // 歌单的最后一首（第 35 首）选下一首播放；补上的第 34 首在歌单里排在它前面
    const last = app.state.player.queue.at(-1)!.song
    const elsewhere = app.state.library!.liked!.songs.find(song => !partial.includes(song.id))!
    app.playNext(RHYTHM, last)
    app.addToQueue(LIKED, elsewhere)
    app.removeFromQueue(queueIds(app).indexOf(partial[5]))
    missingPage.release()
    await world.settle()
    const rhythm = app.state.library!.songsOf(RHYTHM.id)!.songs.map(song => song.id)
    expect(rhythm).toHaveLength(35)
    expect(rhythm[34]).toBe(last.id)
    expect(queueIds(app)).toEqual([
      rhythm[0],
      last.id,
      ...rhythm.slice(1, 34).filter(id => id !== partial[5]),
      elsewhere.id,
    ])
    expect(app.state.player.current).toBe(0)
  })
})

describe('试听和无版权', () => {
  it('会员歌对非会员只能试听：专辑页里标着试听；点了放试听片段，播放条标“试听”', async () => {
    const device = world.device()
    const tab = await signInAtLikedTracks(device)
    const { app } = tab
    await world.netease.reply('library/album.json')
    await app.openAlbum(TRIAL_ALBUM.id)
    const page = app.state.library!.albumPage(TRIAL_ALBUM.id)
    if (page?.status !== 'shown')
      throw new Error('专辑页没显示')
    expect(page.content.songs.map(song => [song.id, song.availability])).toEqual([
      [TRIAL_ALBUM.song, 'trial'],
    ])

    await world.netease.reply(TRIAL_URL)
    app.play({ kind: 'album', id: TRIAL_ALBUM.id }, TRIAL_ALBUM.song)
    await world.settle()
    const player = tab.audio.find(audio => !audio.paused)!
    expect(player.src).toBe(await recordedUrl(TRIAL_URL))
    player.ready(30.04)
    await world.settle()
    expect(app.state.player).toMatchObject({ status: 'playing', trial: true, duration: 30.04 })
    expect(app.state.player.queue).toEqual([
      expect.objectContaining({
        source: { kind: 'album', id: TRIAL_ALBUM.id },
      }),
    ])
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
    await world.netease.reply(THIRD.url, {
      until: never(),
    })
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
    expect(app.state.player).toMatchObject({
      status: 'paused',
      position: 61.2,
      notice: { kind: 'streamFailed' },
    })
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
    expect(app.state.player).toMatchObject({
      status: 'buffering',
      notice: { kind: 'slow' },
    })

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
    expect(app.state.player).toMatchObject({
      status: 'paused',
      notice: { kind: 'streamFailed' },
    })
    expect(tab.audio.every(audio => audio.paused)).toBe(true)
  })

  it('断网时按播放、播放队列里一首都没下载（#38）：不去取播放地址，说明现在都放不了；联网后按播放接着放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await playUntilSounding(tab, FIRST, SECOND)
    app.togglePlay()
    await world.settle()
    device.setOnline(false)
    await world.settle()
    app.togglePlay()
    await world.settle()
    expect(app.state.player).toMatchObject({
      status: 'paused',
      current: 0,
      notice: { kind: 'nothingPlayable' },
    })
    expect(playUrlRequests(device)).toEqual([FIRST.id, SECOND.id].map(id => `/api/songs/${id}/play-url?quality=exhigh`))

    device.setOnline(true)
    await world.settle()
    app.togglePlay()
    await world.settle()
    expect(app.state.player).toMatchObject({ status: 'playing', current: 0, notice: null })
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
    expect(app.state.player).toMatchObject({
      status: 'paused',
      position: 0,
      notice: { kind: 'streamFailed' },
      change: 'continue',
    })
    expect(current(app)).toBe(SECOND.id)

    app.togglePlay()
    await world.settle()
    const retried = tab.audio.find(audio => !audio.paused)!
    expect(retried.src).toBe(await recordedUrl(SECOND.url))
    expect(retried.error).toBeNull()
  })

  it('取下一首的地址时断网了（#38：断网时没下载的下一首放不了，不取它的地址）：联网后马上再准备，照样交接', async () => {
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
    expect(app.state.player.neighbors.next).toBeNull()

    await world.netease.reply(SECOND.url)
    device.setOnline(true)
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

  it('播放队列只有一首、地址已经过期时按下一首：重新取地址，从头放；取地址时旧的那个还在报进度也不影响', async () => {
    const device = world.device()
    const tab = await signInAtLikedTracks(device)
    const { app } = tab
    await world.netease.reply('library/album.json')
    await app.openAlbum(TRIAL_ALBUM.id)
    await world.netease.reply(TRIAL_URL)
    app.play({ kind: 'album', id: TRIAL_ALBUM.id }, TRIAL_ALBUM.song)
    await world.settle()
    const player = tab.audio.find(audio => !audio.paused)!
    player.ready(30.04)
    await world.settle()
    // 试听片段的地址 1,200 秒后过期（提前 1 分钟当作过期）
    await world.clock.advance(20 * 60_000)

    const slow = held()
    await world.netease.reply(TRIAL_URL, { until: slow.until })
    app.next()
    await world.settle()
    expect(app.state.player.status).toBe('loading')
    player.progress(18)
    expect(app.state.player.position).toBe(0)
    slow.release()
    await world.settle()
    const restarted = tab.audio.find(audio => audio !== player)!
    expect(restarted.paused).toBe(false)
    expect(restarted.currentTime).toBe(0)
    restarted.ready(30.04)
    await world.settle()
    expect(tab.sounding()).toBe(restarted)
    expect(app.state.player).toMatchObject({ status: 'playing', position: 0 })
  })

  it('退出登录：停下，清空播放队列；锁屏和通知栏上不再显示这首歌', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await playUntilSounding(tab, FIRST, SECOND)
    await world.netease.reply('login/logout.json')
    await app.logout()
    expect(tab.sounding()).toBeUndefined()
    expect(app.state.player).toMatchObject({ queue: [], current: null, status: 'paused' })
    expect(tab.mediaSession).toMatchObject({ metadata: null, playbackState: 'none', position: null })
  })
})

describe('跳到某个位置（波浪进度条、点歌词的一行）', () => {
  it('在放时跳：当前的播放器从那里接着放，进度马上跟着变', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    player.progress(10)

    app.seek(95.5)
    expect(player.currentTime).toBe(95.5)
    expect(app.state.player).toMatchObject({ status: 'playing', position: 95.5 })
    await world.settle()
    expect(tab.sounding()).toBe(player)
  })

  it('超出这首的长度：最早到开头，最晚到结尾', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)

    app.seek(-3)
    expect(player.currentTime).toBe(0)
    expect(app.state.player.position).toBe(0)
    app.seek(1000)
    expect(player.currentTime).toBe(FIRST.duration)
    expect(app.state.player.position).toBe(FIRST.duration)
  })

  it('停着时跳：按播放从跳到的地方接着放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    player.progress(42)
    app.togglePlay()
    await world.settle()

    app.seek(120)
    expect(app.state.player).toMatchObject({ status: 'paused', position: 120 })
    app.togglePlay()
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(player.currentTime).toBe(120)
    expect(app.state.player).toMatchObject({ status: 'playing', position: 120 })
  })

  it('还在取播放地址时跳：取到后从跳到的地方开始放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const slow = held()
    await world.netease.reply(FIRST.url, { until: slow.until })
    app.play(LIKED, FIRST.id)
    await world.settle()

    app.seek(30)
    expect(app.state.player).toMatchObject({ status: 'loading', position: 30 })
    await world.netease.reply(SECOND.url)
    slow.release()
    await world.settle()
    const player = tab.audio.find(audio => !audio.paused)!
    player.ready(FIRST.duration)
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(player.currentTime).toBe(30)
    expect(app.state.player).toMatchObject({ status: 'playing', position: 30 })
  })

  it('快放完、下一首已经开始交接时往回跳：交接取消，当前这首从跳到的地方接着放；再放到结尾照样交接', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    player.progress(188)
    await world.settle()
    expect(spare.paused).toBe(false)

    app.seek(60)
    await world.settle()
    expect(spare.paused).toBe(true)
    spare.ready(SECOND.duration)
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(player.currentTime).toBe(60)
    expect(current(app)).toBe(FIRST.id)
    expect(app.state.player).toMatchObject({ status: 'playing', position: 60 })

    await world.netease.reply(THIRD.url)
    player.progress(191.7)
    await world.settle()
    expect(tab.sounding()).toBe(spare)
    expect(spare.currentTime).toBe(0)
    expect(current(app)).toBe(SECOND.id)
  })
})

describe('播放队列', () => {
  it('在播放队列里点一首：放这一首，播放队列不变', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await playUntilSounding(tab, FIRST, SECOND)
    const queue = queueIds(app)

    await world.netease.reply(THIRD.url)
    app.playFromQueue(2)
    await world.settle()
    expect(current(app)).toBe(THIRD.id)
    expect(queueIds(app)).toEqual(queue)
    expect(tab.audio.find(audio => !audio.paused)?.src).toBe(await recordedUrl(THIRD.url))
  })

  it('点播放队列里无版权的歌：不放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await playUntilSounding(tab, FIRST, SECOND)

    app.playFromQueue(queueIds(app).indexOf(NO_COPYRIGHT))
    await world.settle()
    expect(current(app)).toBe(FIRST.id)
    expect(app.state.player.status).toBe('playing')
  })
})

/** 另一个播放来源（一张专辑）：歌从这里放进播放队列时，播放来源跟着它 */
const ALBUM = { kind: 'album', id: TRIAL_ALBUM.id } as const

// 下一首播放、加入播放队列、插播（#26，逻辑原型规则①–⑤）。插播照听众的做法，在显示出来的搜索结果里点歌
describe('下一首播放、加入播放队列、插播', () => {
  it.each([
    ['下一首播放', 'playNext'],
    ['加入播放队列', 'addToQueue'],
    ['在搜索结果里点歌', 'play'],
  ] as const)('播放队列是空的时选“%s”：队列里只有这一首，直接开始放（规则①）', async (_, action) => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const song = action === 'play'
      ? (await showSearch(app))[0]
      : likedSong(app, SECOND.id)
    const source = action === 'play'
      ? SEARCHED
      : ALBUM
    const url = action === 'play'
      ? SEARCH_SONG.url
      : SECOND.url

    await world.netease.reply(url)
    if (action === 'play')
      app.play(source, song.id)
    else
      app[action](source, song)
    expect(app.state.player.queue).toEqual([
      { song, source },
    ])
    expect(app.state.player).toMatchObject({ current: 0, status: 'loading', change: 'pick' })
    await world.settle()
    expect(tab.audio.find(audio => !audio.paused)?.src).toBe(await recordedUrl(url))
    expect(app.state.player.status).toBe('buffering')
  })

  it('下一首播放排在当前这首紧后面，加入播放队列排到最后，其余歌的先后不变；每首记着自己的播放来源', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await world.netease.reply(FIRST.url, {
      until: never(),
    })
    app.addToQueue(LIKED, likedSong(app, FIRST.id))
    app.addToQueue(LIKED, likedSong(app, SECOND.id))
    app.addToQueue(ALBUM, likedSong(app, THIRD.id))
    expect(queueIds(app)).toEqual([FIRST.id, SECOND.id, THIRD.id])

    app.playNext(ALBUM, likedSong(app, LAST.id))
    expect(queueIds(app)).toEqual([FIRST.id, LAST.id, SECOND.id, THIRD.id])
    expect(app.state.player.queue.map(entry => entry.source)).toEqual([LIKED, ALBUM, LIKED, ALBUM])
    expect(current(app)).toBe(FIRST.id)
    expect(app.state.player.status).toBe('loading')
  })

  it('连续几次下一首播放：后加的先放（规则⑤），放完它们再接着原来的顺序', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await world.netease.reply(FIRST.url, {
      until: never(),
    })
    app.addToQueue(LIKED, likedSong(app, FIRST.id))
    app.addToQueue(LIKED, likedSong(app, SECOND.id))
    app.playNext(LIKED, likedSong(app, THIRD.id))
    app.playNext(LIKED, likedSong(app, LAST.id))
    expect(queueIds(app)).toEqual([FIRST.id, LAST.id, THIRD.id, SECOND.id])

    const played = []
    for (let i = 0; i < 3; i++) {
      app.next()
      played.push(current(app))
    }
    expect(played).toEqual([LAST.id, THIRD.id, SECOND.id])
  })

  it('要放的歌本来就在播放队列里：从原位置挪过来，只留一份，播放来源改成新的（规则②）', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const [searched] = await showSearch(app)
    // 没等 FIRST 的请求到服务端就点搜索结果：两个请求谁先到不固定，按歌曲编号对上
    await world.netease.reply(FIRST.url, {
      until: never(),
      when: { id: FIRST.id },
    })
    app.play(LIKED, FIRST.id)
    const length = app.state.player.queue.length
    const count = (id: number) => queueIds(app).filter(each => each === id).length

    app.playNext(ALBUM, likedSong(app, THIRD.id))
    expect(app.state.player.queue[1]).toEqual({
      song: likedSong(app, THIRD.id),
      source: ALBUM,
    })
    app.addToQueue(ALBUM, likedSong(app, SECOND.id))
    expect(app.state.player.queue.at(-1)).toEqual({
      song: likedSong(app, SECOND.id),
      source: ALBUM,
    })
    expect(app.state.player.queue).toHaveLength(length)
    expect([
      count(THIRD.id),
      count(SECOND.id),
    ]).toEqual([1, 1])
    expect(current(app)).toBe(FIRST.id)

    await world.netease.reply(SEARCH_SONG.url, {
      until: never(),
      when: { id: SEARCH_SONG.id },
    })
    app.play(SEARCHED, searched.id)
    expect(app.state.player.queue[1]).toEqual({ song: searched, source: SEARCHED })
    expect(app.state.player.queue).toHaveLength(length)
    expect(count(searched.id)).toBe(1)
    expect(app.state.player.current).toBe(1)
    expect(queueIds(app).slice(0, 3)).toEqual([FIRST.id, searched.id, THIRD.id])
  })

  it('正在放的那首再被插播、下一首播放、加入播放队列：什么都不变，不从头放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playSearchedSongUntilSounding(tab)
    player.progress(10)
    await world.settle()
    const before = app.state.player
    const requests = playUrlRequests(device).length

    app.play(SEARCHED, SEARCH_SONG.id)
    app.playNext(ALBUM, likedSong(app, SEARCH_SONG.id))
    app.addToQueue(ALBUM, likedSong(app, SEARCH_SONG.id))
    await world.settle()
    expect(app.state.player).toBe(before)
    expect(tab.sounding()).toBe(player)
    expect(player.currentTime).toBe(10)
    expect(playUrlRequests(device)).toHaveLength(requests)
  })

  it('暂停着的当前这首再被插播：从暂停的地方接着放，不从头放；下一首播放、加入播放队列仍然什么都不变（逻辑原型 addSong）', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playSearchedSongUntilSounding(tab)
    player.progress(10)
    app.togglePlay()
    await world.settle()
    expect(app.state.player.status).toBe('paused')
    const paused = app.state.player
    const requests = playUrlRequests(device).length

    app.playNext(ALBUM, likedSong(app, SEARCH_SONG.id))
    app.addToQueue(ALBUM, likedSong(app, SEARCH_SONG.id))
    await world.settle()
    expect(app.state.player).toBe(paused)

    app.play(SEARCHED, SEARCH_SONG.id)
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(player.currentTime).toBe(10)
    expect(app.state.player).toMatchObject({
      status: 'playing',
      position: 10,
      queue: paused.queue,
      current: paused.current,
    })
    expect(playUrlRequests(device)).toHaveLength(requests)
  })

  it('插播：排在当前这首紧后面并立即放，被打断的那首不续播（规则④）：插播的放完接着放原来的下一首，退回去也从头放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await showSearch(app)
    const player = await playUntilSounding(tab, FIRST, SECOND)
    player.progress(100)
    await world.settle()

    await world.netease.reply(SEARCH_SONG.url)
    app.play(SEARCHED, SEARCH_SONG.id)
    expect(app.state.player).toMatchObject({ current: 1, status: 'loading', change: 'pick' })
    expect(queueIds(app).slice(0, 3)).toEqual([FIRST.id, SEARCH_SONG.id, SECOND.id])
    await world.settle()
    const searched = other(tab, player)
    expect(searched.src).toBe(await recordedUrl(SEARCH_SONG.url))
    searched.ready(SEARCH_SONG.duration)
    await world.settle()
    expect(tab.sounding()).toBe(searched)
    expect(current(app)).toBe(SEARCH_SONG.id)

    searched.end()
    await world.settle()
    expect(current(app)).toBe(SECOND.id)
    app.previous()
    app.previous()
    expect(current(app)).toBe(FIRST.id)
    expect(app.state.player.position).toBe(0)
  })

  it('下一首变了：空闲的播放器重新准备新的下一首，快放完时交接给它（ADR-0010）', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    expect(spare.src).toBe(await recordedUrl(SECOND.url))

    await world.netease.reply(THIRD.url)
    app.playNext(ALBUM, likedSong(app, THIRD.id))
    await world.settle()
    expect(spare.src).toBe(await recordedUrl(THIRD.url))
    spare.ready(THIRD.duration)
    player.progress(191.7)
    await world.settle()
    expect(tab.sounding()).toBe(spare)
    expect(current(app)).toBe(THIRD.id)
  })

  it('已经开始交接给下一首、它还没出声时下一首变了：不交接给它，改准备新的下一首', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    player.progress(188)
    await world.settle()
    expect(spare.paused).toBe(false)

    await world.netease.reply(THIRD.url)
    app.addToQueue(ALBUM, likedSong(app, SECOND.id))
    await world.settle()
    expect(spare.src).toBe(await recordedUrl(THIRD.url))
    expect(spare.paused).toBe(true)
    spare.ready(THIRD.duration)
    player.progress(191.7)
    await world.settle()
    expect(tab.sounding()).toBe(spare)
    expect(current(app)).toBe(THIRD.id)
    expect(queueIds(app).at(-1)).toBe(SECOND.id)
  })

  it('无版权的歌：下一首播放、加入播放队列、插播都不放进播放队列', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const song = likedSong(app, NO_COPYRIGHT)
    await showSearch(app, 'Sea Of Tired Slowed', 'search/songs/004-cloudsearch.json.gz')

    app.addToQueue(LIKED, song)
    expect(app.state.player.queue).toEqual([])
    await queueOf(app, [FIRST, SECOND])
    app.playNext(LIKED, song)
    app.addToQueue(LIKED, song)
    app.play({ kind: 'search', keyword: 'Sea Of Tired Slowed' }, song.id)
    expect(queueIds(app)).toEqual([FIRST.id, SECOND.id])
    expect(current(app)).toBe(FIRST.id)
  })
})

describe('移出、清空播放队列', () => {
  it('移出某首：其余的先后不变，当前这首不变；移出的在当前这首前面时位置跟着变；正在放的那首移不掉', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await world.netease.reply(SECOND.url, {
      until: never(),
    })
    app.play(LIKED, SECOND.id)
    const ids = queueIds(app)

    app.removeFromQueue(2)
    expect(queueIds(app)).toEqual([
      ids[0],
      ids[1],
      ...ids.slice(3),
    ])
    expect(app.state.player.current).toBe(1)
    app.removeFromQueue(0)
    expect(queueIds(app)).toEqual([
      ids[1],
      ...ids.slice(3),
    ])
    expect(app.state.player.current).toBe(0)
    expect(current(app)).toBe(SECOND.id)

    const before = app.state.player
    app.removeFromQueue(0)
    expect(app.state.player).toBe(before)
  })

  it('移出的是下一首：空闲的播放器改准备新的下一首', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)

    await world.netease.reply(THIRD.url)
    app.removeFromQueue(1)
    await world.settle()
    expect(spare.src).toBe(await recordedUrl(THIRD.url))
  })

  it('清空：播放队列空了、停下，两个播放器都不出声，还在取的地址回来也不放；之后选下一首播放又直接开始放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const third = held()
    await world.netease.reply(THIRD.url, { until: third.until })
    app.next()
    app.next()
    await world.settle()
    expect(app.state.player.status).toBe('loading')

    app.clearQueue()
    expect(app.state.player).toMatchObject({
      queue: [],
      current: null,
      status: 'paused',
      notice: null,
    })
    third.release()
    await world.settle()
    expect(tab.sounding()).toBeUndefined()
    expect(player.paused).toBe(true)
    expect(app.state.player.queue).toEqual([])

    await world.netease.reply(SECOND.url)
    app.playNext(ALBUM, likedSong(app, SECOND.id))
    await world.settle()
    expect(queueIds(app)).toEqual([SECOND.id])
    expect(app.state.player.status).toBe('buffering')
  })
})

// 换碟（#51，DESIGN.md Cover Wheel）往哪转看 App 发布的换歌原因，不靠前后序号猜（随机播放时序号不连续）
describe('换歌原因', () => {
  it('在列表里点歌：点选；还没换过歌时没有原因', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    expect(app.state.player.change).toBeNull()

    await world.netease.reply(FIRST.url, {
      until: never(),
    })
    app.play(LIKED, FIRST.id)
    expect(app.state.player).toMatchObject({ change: 'pick', status: 'loading' })
    expect(current(app)).toBe(FIRST.id)
  })

  it('下一首、上一首：各自的原因；在播放队列里点歌：点选', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await playUntilSounding(tab, FIRST, SECOND)

    app.next()
    expect(current(app)).toBe(SECOND.id)
    expect(app.state.player.change).toBe('next')
    await world.settle()

    app.previous()
    expect(current(app)).toBe(FIRST.id)
    expect(app.state.player.change).toBe('previous')
    await world.settle()

    await world.netease.reply(THIRD.url)
    app.playFromQueue(2)
    expect(current(app)).toBe(THIRD.id)
    expect(app.state.player.change).toBe('pick')
  })

  it('连按 3 次下一首：当前这首直接是第 3 首；中间那首缓冲好了也不出声，晚回来的地址不放，最后出声的就是显示的那首', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    // 从最后一首开始：往后三首（列表循环回到第 1～3 首）都有录制
    const player = await playUntilSounding(tab, LAST, FIRST)
    const spare = other(tab, player)
    const second = held()
    const third = held()
    // 两首的地址几乎同时去取，到服务端的先后不固定：按歌曲编号对上（CI 上碰到过第 3 首拿到第 2 首的地址）
    await world.netease.reply(SECOND.url, {
      until: second.until,
      when: { id: SECOND.id },
    })
    await world.netease.reply(THIRD.url, {
      until: third.until,
      when: { id: THIRD.id },
    })

    app.next()
    app.next()
    app.next()
    expect(current(app)).toBe(THIRD.id)
    expect(app.state.player).toMatchObject({ change: 'next', status: 'loading' })
    await world.settle()
    // 第 1 次按下时空闲的播放器开始放第一首，它的数据这时才够
    spare.ready(FIRST.duration)
    await world.settle()
    expect(spare.sounding).toBe(false)
    expect(tab.sounding()).toBe(player)

    third.release()
    await world.settle()
    expect(spare.src).toBe(await recordedUrl(THIRD.url))
    spare.ready(THIRD.duration)
    await world.settle()
    second.release()
    await world.settle()
    expect(player.sounding).toBe(false)
    expect(tab.sounding()).toBe(spare)
    expect(spare.src).toBe(await recordedUrl(THIRD.url))
    expect(current(app)).toBe(THIRD.id)
    expect(app.state.player).toMatchObject({ change: 'next', status: 'playing' })
  })

  it('放完自动接续：下一首的地址没取到、没法交接，当前这首放完才换下一首', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await world.netease.reply(FIRST.url)
    await world.netease.reply(SECOND.url, {
      until: never(),
    })
    app.play(LIKED, FIRST.id)
    await world.settle()
    const player = tab.audio.find(audio => !audio.paused)!
    player.ready(FIRST.duration)
    await world.settle()

    player.end()
    await world.settle()
    expect(current(app)).toBe(SECOND.id)
    expect(app.state.player).toMatchObject({ change: 'continue', status: 'loading' })
  })

  it('交接时空闲的播放器先出声：自动接续', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    spare.ready(SECOND.duration)
    await world.netease.reply(THIRD.url)
    player.progress(191.7)
    expect(current(app)).toBe(FIRST.id)
    await world.settle()
    expect(tab.sounding()).toBe(spare)
    expect(current(app)).toBe(SECOND.id)
    expect(app.state.player.change).toBe('continue')
  })

  it('交接时旧的先放完、下一首还在缓冲：自动接续', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    player.progress(188)
    await world.settle()

    player.end()
    await world.settle()
    expect(current(app)).toBe(SECOND.id)
    expect(app.state.player).toMatchObject({ change: 'continue', status: 'buffering' })
  })

  it('网易云没给点的那首的播放地址：跳过它放下一首，原因是跳过', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await world.netease.reply('playback/song_url_v1.no-copyright.json')
    await world.netease.reply(SECOND.url, {
      until: never(),
    })
    app.play(LIKED, FIRST.id)
    expect(app.state.player.change).toBe('pick')

    await world.settle()
    expect(current(app)).toBe(SECOND.id)
    expect(app.state.player).toMatchObject({
      change: 'skip',
      status: 'loading',
      notice: {
        kind: 'skipped',
        song: { id: FIRST.id },
      },
    })
  })
})

/** 播放页上露出来的上一首、下一首（编号）：按上一首、下一首会换到的那首 */
const neighborIds = (app: App): { previous: number | null, next: number | null } => {
  const { queue, neighbors } = app.state.player
  const id = (index: number | null) => (index === null
    ? null
    : queue[index].song.id)
  return {
    previous: id(neighbors.previous),
    next: id(neighbors.next),
  }
}

// 手机播放页左右拖封面（#52，DESIGN.md Cover Wheel）：转盘上露出来的那张，得是松手切过去的那首
describe('按上一首、下一首会换到哪首', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('列表循环：列表里前后能放的那首，跳过无版权的、转一圈接上；网易云没给地址跳过的那首，在有歌出声之前也不算', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    expect(neighborIds(app)).toEqual({ previous: null, next: null })

    await world.netease.reply(BEFORE_NO_COPYRIGHT.url)
    app.play(LIKED, BEFORE_NO_COPYRIGHT.id)
    const ids = queueIds(app)
    expect(neighborIds(app)).toEqual({ previous: ids[ids.indexOf(BEFORE_NO_COPYRIGHT.id) - 1], next: AFTER_NO_COPYRIGHT.id })
    await world.settle()

    await world.netease.reply('playback/song_url_v1.no-copyright.json')
    await world.netease.reply(SECOND.url, {
      until: never(),
    })
    app.play(LIKED, FIRST.id)
    await world.settle()
    expect(current(app)).toBe(SECOND.id)
    expect(neighborIds(app)).toEqual({ previous: LAST.id, next: THIRD.id })
  })

  it('播放队列里只有一首：两边都没有（按下一首只会从头再放这首）', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await queueOf(app, [FIRST])
    expect(neighborIds(app)).toEqual({ previous: null, next: null })

    app.addToQueue(LIKED, likedSong(app, SECOND.id))
    expect(neighborIds(app)).toEqual({ previous: SECOND.id, next: SECOND.id })
  })

  it('随机播放：是按另排的播放顺序换到的那首，不是列表里的前后；退回上一首也一样', async () => {
    vi.spyOn(Math, 'random').mockImplementation(seeded(26))
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    app.setPlayMode('shuffle')
    await world.netease.reply(FIRST.url, {
      until: never(),
    })
    app.play(LIKED, FIRST.id)

    const shown: (number | null)[] = []
    for (let i = 0; i < 3; i++) {
      const { next } = neighborIds(app)
      shown.push(next)
      app.next()
      expect(current(app)).toBe(next)
    }
    const list = queueIds(app)
    expect(shown.map(id => list.indexOf(id!))).not.toEqual([1, 2, 3])
    expect(neighborIds(app).previous).toBe(shown[1])
    app.previous()
    expect(current(app)).toBe(shown[1])
  })
})

/** 可重现的伪随机数（mulberry32）：失败时按打出来的种子重跑同一串操作；也拿来顶替 Math.random，让随机播放的顺序固定 */
const seeded = (seed: number): () => number => {
  let state = seed
  return () => {
    state = (state + 0x6D2B79F5) | 0
    let next = Math.imul(state ^ (state >>> 15), 1 | state)
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

/** 用“加入播放队列”从空的播放队列放起：队列里就是这几首，从第一首开始（它的地址一直在取） */
const queueOf = async (app: App, songs: readonly Recorded[]): Promise<void> => {
  await world.netease.reply(songs[0].url, {
    until: never(),
  })
  for (const song of songs)
    app.addToQueue(LIKED, likedSong(app, song.id))
}

const nextTimes = (app: App, times: number): (number | null)[] => Array.from({ length: times }, () => {
  app.next()
  return current(app)
})

describe('播放模式', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('一开始是列表循环；清空播放队列也不变', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    expect(app.state.player.mode).toBe('loop')
    app.setPlayMode('one')
    app.clearQueue()
    expect(app.state.player.mode).toBe('one')
  })

  it('单曲循环：这首快放完时交接给同一首、从头再放；按下一首照样换到列表里的下一首', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    const requests = playUrlRequests(device).length

    app.setPlayMode('one')
    await world.settle()
    expect(spare.src).toBe(await recordedUrl(FIRST.url))
    expect(playUrlRequests(device)).toHaveLength(requests)
    spare.ready(FIRST.duration)
    player.progress(191.7)
    await world.settle()
    expect(tab.sounding()).toBe(spare)
    expect(current(app)).toBe(FIRST.id)
    expect(app.state.player).toMatchObject({ change: 'continue', position: 0 })

    app.next()
    expect(current(app)).toBe(SECOND.id)
  })

  it('随机播放：点歌先放点的那首，接下来不按列表的顺序；退回上一首就是刚才放的那首', async () => {
    vi.spyOn(Math, 'random').mockImplementation(seeded(26))
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    app.setPlayMode('shuffle')
    await world.netease.reply(FIRST.url, {
      until: never(),
    })
    app.play(LIKED, FIRST.id)
    expect(current(app)).toBe(FIRST.id)

    const played = nextTimes(app, 3)
    const list = queueIds(app)
    expect(played.map(id => list.indexOf(id!))).not.toEqual([1, 2, 3])
    app.previous()
    expect(current(app)).toBe(played[1])
  })

  it('随机播放：每首能放的都放一遍才回到开头那首', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await queueOf(app, RECORDED)
    app.setPlayMode('shuffle')

    const played = nextTimes(app, RECORDED.length)
    expect(new Set(played.slice(0, -1))).toEqual(new Set(RECORDED.slice(1).map(song => song.id)))
    expect(played.at(-1)).toBe(FIRST.id)
  })

  it('随机播放时选下一首播放：就是下一首；加入播放队列：排到最后，别的都放过了才放它（规则③）', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const [added, ...rest] = RECORDED.slice(1)
    await queueOf(app, [FIRST, ...rest])
    app.setPlayMode('shuffle')

    app.addToQueue(ALBUM, likedSong(app, added.id))
    expect(queueIds(app).at(-1)).toBe(added.id)
    const elsewhere = app.state.library!.liked!.songs.find(song => song.availability === 'full' && !RECORDED.some(each => each.id === song.id))!
    app.playNext(ALBUM, elsewhere)
    expect(queueIds(app)[1]).toBe(elsewhere.id)

    const played = nextTimes(app, rest.length + 2)
    expect(played[0]).toBe(elsewhere.id)
    expect(new Set(played.slice(1, -1))).toEqual(new Set(rest.map(song => song.id)))
    expect(played.at(-1)).toBe(added.id)
  })

  it('切到随机播放：当前这首和还没放到的下一首播放留在最前；切回列表循环：从当前这首接着按列表往下', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await queueOf(app, [
      FIRST,
      SECOND,
      THIRD,
      BEFORE_NO_COPYRIGHT,
    ])
    app.playNext(ALBUM, likedSong(app, AFTER_NO_COPYRIGHT.id))
    app.playNext(ALBUM, likedSong(app, LAST.id))

    app.setPlayMode('shuffle')
    expect(nextTimes(app, 2)).toEqual([LAST.id, AFTER_NO_COPYRIGHT.id])
    app.setPlayMode('loop')
    expect(nextTimes(app, 2)).toEqual([SECOND.id, THIRD.id])
  })

  it('放到了的“下一首播放”就不再算（自动接续上来的也一样）：之后切到随机播放，按下一首会换歌', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    await world.netease.reply(THIRD.url)
    app.playNext(ALBUM, likedSong(app, THIRD.id))
    await world.settle()
    spare.ready(THIRD.duration)
    player.progress(191.7)
    await world.settle()
    expect(current(app)).toBe(THIRD.id)

    app.setPlayMode('shuffle')
    app.next()
    expect(current(app)).not.toBe(THIRD.id)
  })
})

describe('随机操作检查（借鉴逻辑原型）', () => {
  it('随便怎么点歌、切歌、暂停，音频服务器怎么断流、出错，每一步之后：显示“取播放地址中”时，一定有一个取当前这首播放地址的请求在路上', async () => {
    // 全局的 Date 被世界的时钟冻结在同一时刻，不能拿来当种子
    const seed = Math.floor(Math.random() * 100_000)
    const random = seeded(seed)
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]
    /** 压着的网易云返回，随机地放出来 */
    let holds: (() => void)[] = []
    let queued = 0

    /** 网易云总还有四份播放地址没用掉，一半压着。录到地址的只有几首：回的不是请求的那首时，服务端认作网易云没给地址，App 跳过它、接着取下一首的，正好也让“跳过”这条路走得到。连着跳过把四份都用完时，替身没有返回、服务端出错，App 停下说明原因 */
    const topUp = async (): Promise<void> => {
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
          ...(audio.src && !audio.error
            ? ['ready', 'ready', 'fail']
            : []),
          ...(audio.sounding
            ? ['progress', 'progress', 'end', 'stall']
            : []),
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

  it('随便怎么点歌、下一首播放、加入播放队列、插播、移出、清空、换播放模式、切歌，每一步之后：同一首歌不会在播放队列里出现两次；按下一首会换歌，还没放到的“下一首播放”按下一首就是它（当前这首不会还记在“下一首播放”里）；按上一首、下一首换到的就是播放页上露出来的那首', async () => {
    const seed = Math.floor(Math.random() * 100_000)
    const random = seeded(seed)
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]
    const modes = ['loop', 'one', 'shuffle'] as const

    for (let round = 0; round < 8; round++) {
      const device = world.device()
      const tab = await signInWithLiked(device)
      const { app } = tab
      const [searched] = await showSearch(app)
      // 播放地址都不回：这里只看播放队列，换上来的歌停在没取到地址
      const songs = [
        ...app.state.library!.liked!.songs.slice(0, 12),
        likedSong(app, NO_COPYRIGHT),
        searched,
      ]
      /** 听众选了“下一首播放”、还没放到的歌，后加的在前：照规则①②⑤和“退回上一首、点别的歌、点歌、清空后不再算”记的 */
      let upNext: number[] = []
      const steps: string[] = []

      for (let step = 0; step < 120; step++) {
        const { queue, current: at } = app.state.player
        const now = current(app)
        /** 播放页上露出来的上一首、下一首：没有时按了不换歌 */
        const shown = neighborIds(app)
        const action = pick([
          'play',
          'playNext',
          'playNext',
          'playNext',
          'addToQueue',
          'addToQueue',
          'interject',
          'remove',
          'clear',
          'mode',
          'mode',
          'mode',
          'next',
          'next',
          'next',
          'next',
          'previous',
          'jump',
        ] as const)
        const song = action === 'interject'
          ? searched
          : pick(songs)
        const off = song.availability === 'noCopyright'
        let expected: number | undefined
        /** 按了下一首，播放队列里还有别的能放的歌：要换歌 */
        let moves = false
        switch (action) {
          case 'play':
            app.play(LIKED, song.id)
            if (!off)
              upNext = []
            break
          case 'playNext':
            app.playNext(pick([LIKED, ALBUM]), song)
            if (!off && now !== null && song.id !== now) {
              upNext = [
                song.id,
                ...upNext.filter(id => id !== song.id),
              ]
            }
            break
          case 'addToQueue':
            app.addToQueue(pick([LIKED, ALBUM]), song)
            upNext = upNext.filter(id => id !== song.id)
            break
          case 'interject':
            app.play(SEARCHED, song.id)
            upNext = upNext.filter(id => id !== song.id)
            break
          case 'remove': {
            const index = Math.floor(random() * (queue.length + 1))
            app.removeFromQueue(index)
            if (index !== at && queue[index])
              upNext = upNext.filter(id => id !== queue[index].song.id)
            break
          }
          case 'clear':
            app.clearQueue()
            upNext = []
            break
          case 'mode':
            app.setPlayMode(pick(modes))
            break
          case 'next':
            expected = upNext[0]
            moves = queue.filter(entry => entry.song.availability !== 'noCopyright').length > 1
            app.next()
            break
          case 'previous':
            app.previous()
            upNext = []
            break
          case 'jump': {
            const index = Math.floor(random() * queue.length)
            app.playFromQueue(index)
            if (index !== at && queue[index]?.song.availability !== 'noCopyright')
              upNext = []
            break
          }
        }
        steps.push(`${action}${[
          'play',
          'playNext',
          'addToQueue',
          'interject',
        ].includes(action)
          ? ` ${song.id}`
          : ''}`)
        await world.settle()

        const where = `种子 ${seed}，第 ${round} 轮，操作 ${steps.join(' → ')}`
        const ids = queueIds(app)
        expect(new Set(ids).size, `同一首歌不会在播放队列里出现两次（${where}）`).toBe(ids.length)
        const { current: index } = app.state.player
        expect(index === null
          ? ids.length === 0
          : index >= 0 && index < ids.length, `当前这首在播放队列里（${where}）`).toBe(true)
        if (moves)
          expect(current(app), `按下一首会换歌（${where}）`).not.toBe(now)
        if (expected !== undefined)
          expect(current(app), `按下一首放的是还没放到的“下一首播放”里最后加的那首（${where}）`).toBe(expected)
        if (action === 'next' || action === 'previous') {
          expect(current(app), `按${action === 'next'
            ? '下'
            : '上'}一首换到的是露出来的那首（${where}）`).toBe(shown[action] ?? now)
        }
        upNext = upNext.filter(id => id !== current(app))
      }
    }
  }, 120_000)
})

// 后台播放与恢复（#27）：播放队列、当前这首、播放进度、这首已经听了多少秒都存在本机，重新打开时恢复（Spec #11“客户端：播放队列与播放”）

const storedProgress = async (device: Device): Promise<unknown> => {
  const { player = [] } = await device.stored()
  return player.find(([key]) => key === 'progress')?.[1]
}

describe('关掉再打开', () => {
  it('恢复播放队列（每首的播放来源、还没放到的下一首播放、播放模式）和进度，停着等按播放，不算换歌；按播放重新取地址，从原来的位置接着放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const album = { kind: 'album', id: TRIAL_ALBUM.id } as const
    await world.netease.reply(LAST.url)
    app.playNext(album, likedSong(app, LAST.id))
    app.setPlayMode('one')
    player.progress(100)
    const before = app.state.player

    const { app: reopened, ...again } = await reopen(device, tab)
    await world.settle()
    const sent = playUrlRequests(device).length
    expect(reopened.state.player).toMatchObject({
      queue: before.queue,
      current: before.current,
      position: 100,
      status: 'paused',
      mode: 'one',
      change: null,
      notice: null,
    })
    expect(reopened.state.player.queue[1]).toMatchObject({
      song: { id: LAST.id },
      source: album,
    })
    expect(again.sounding()).toBeUndefined()
    reopened.setPlayMode('shuffle')
    expect(neighborIds(reopened).next).toBe(LAST.id)

    await world.netease.reply(FIRST.url)
    reopened.togglePlay()
    expect(reopened.state.player.status).toBe('loading')
    await world.settle()
    expect(playUrlRequests(device).slice(sent)[0]).toBe(`/api/songs/${FIRST.id}/play-url?quality=exhigh`)
    const resumed = again.audio.find(audio => !audio.paused)!
    expect(resumed.src).toBe(await recordedUrl(FIRST.url))
    expect(resumed.currentTime).toBe(100)
    await world.netease.reply(LAST.url)
    resumed.ready(FIRST.duration)
    await world.settle()
    expect(again.sounding()).toBe(resumed)
    expect(reopened.state.player).toMatchObject({ status: 'playing', position: 100, change: null })
  })

  it('这首已经听了多少秒也存着：关掉时不算这首结束，再打开按播放后接着累计；按实际出声的时间算，跳过去的不算（听歌打卡按它算，规则⑥、#28）', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const player = await playUntilSounding(tab, FIRST, SECOND)
    await world.clock.advance(60_000)
    player.progress(60)

    const { app: reopened, ...again } = await reopen(device, tab)
    await world.settle()
    expect(await storedProgress(device)).toMatchObject({ songId: FIRST.id, position: 60, listened: 60 })

    await world.netease.reply(FIRST.url)
    await world.netease.reply(SECOND.url)
    reopened.togglePlay()
    await world.settle()
    const resumed = again.audio.find(audio => !audio.paused)!
    resumed.ready(FIRST.duration)
    await world.settle()
    reopened.seek(150)
    await world.clock.advance(30_000)
    resumed.progress(180)
    await world.settle()
    expect(await storedProgress(device)).toMatchObject({ songId: FIRST.id, position: 180, listened: 90 })
  })
})

describe('退出登录、换账号', () => {
  it('主动退出：本机存着的播放队列删掉，别的标签页存的也删（这个标签页没在放）', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const playing = await reopen(device)
    await world.settle()
    await playUntilSounding(playing, FIRST, SECOND)
    await world.settle()
    playing.close()
    expect(await storedProgress(device)).toMatchObject({ songId: FIRST.id })

    await world.netease.reply('login/logout.json')
    await tab.app.logout()
    await world.settle()
    expect((await device.stored()).player).toEqual([])
  })

  /** 登录 Cookie 没了：下一个请求服务端说需要登录，整个 App 变成登录失效 */
  const expireLogin = async (device: Device, app: App): Promise<void> => {
    await device.setCookie('campanula_login=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict')
    await app.openLyrics(FIRST.id)
    if (app.state.session.status !== 'loginExpired')
      throw new Error('登录没失效')
  }

  it('登录失效后换了另一个账号登录：清空播放队列（规则⑩），登录失效期间接着放的那首停下，本机存的也删；上一个账号取的播放地址不再用', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playSearchedSongUntilSounding(tab)
    await expireLogin(device, app)
    expect(tab.sounding()).toBe(player)

    await replyLibrary({
      through: 'hearts',
      until: never(),
    })
    await signIn(world, app, { another: true })
    await world.settle()
    expect(app.state.player).toMatchObject({ queue: [], current: null, status: 'paused' })
    expect(tab.sounding()).toBeUndefined()
    expect((await device.stored()).player).toEqual([])

    await showSearch(app)
    // 播放地址按账号给（会员和非会员不一样）：同一首歌换了账号要重新取
    const sent = playUrlRequests(device).length
    await world.netease.reply(SEARCH_SONG.url, {
      until: never(),
    })
    app.play(SEARCHED, SEARCH_SONG.id)
    await world.settle()
    expect(playUrlRequests(device).slice(sent)).toEqual([`/api/songs/${SEARCH_SONG.id}/play-url?quality=exhigh`])
  })

  it('登录失效后同一个账号重新登录：播放队列照旧，接着放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const queue = app.state.player.queue
    await expireLogin(device, app)

    await replyLibrary({
      through: 'hearts',
      until: never(),
    })
    await signIn(world, app)
    await world.settle()
    expect(app.state.player.queue).toBe(queue)
    expect(current(app)).toBe(FIRST.id)
    expect(tab.sounding()).toBe(player)
  })

  it('关掉时播放队列还在，再打开时登录已经失效，换了另一个账号登录：不恢复，本机存的删掉（规则⑩）', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    await playUntilSounding(tab, FIRST, SECOND)
    await world.settle()
    tab.close()

    await world.netease.reply('login/user_account.invalid.json')
    await world.netease.reply('login/login_refresh.301-invalid.json')
    const { app } = await device.open()
    expect(app.state.session.status).toBe('loginExpired')
    expect(app.state.player.queue).toEqual([])

    await replyLibrary({
      through: 'hearts',
      until: never(),
    })
    await signIn(world, app, { another: true })
    await world.settle()
    expect(app.state.player.queue).toEqual([])
    expect((await device.stored()).player).toEqual([])
  })
})

// 通知栏和锁屏的控件用 Media Session（Spec #11）：显示封面、歌名，能暂停、切歌；交接后显示新的那首（ADR-0010）
describe('锁屏和通知栏', () => {
  it('显示正在放的那首的歌名、歌手、专辑、封面和进度；按暂停、播放就暂停、接着放；拖进度条就跳过去', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app, mediaSession } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    expect(mediaSession.metadata).toMatchObject({
      title: '夏に溶ける (feat. 鏡音リン)',
      artist: 'ごめんなさいが言えなくて / 鏡音リン',
      album: '夏に溶ける',
      artwork: [
        { src: 'https://p4.music.126.net/Lw6wl5jXi7R7Bi5KI0-Tdg==/109951173904017056.jpg?param=512y512', sizes: '512x512' },
      ],
    })
    expect(mediaSession.playbackState).toBe('playing')
    expect(mediaSession.position).toEqual({ duration: FIRST.duration, position: 0, playbackRate: 1 })

    mediaSession.press('pause')
    await world.settle()
    expect(app.state.player.status).toBe('paused')
    expect(tab.sounding()).toBeUndefined()
    expect(mediaSession.playbackState).toBe('paused')

    mediaSession.press('play')
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(mediaSession.playbackState).toBe('playing')

    mediaSession.press('seekto', { seekTime: 120 })
    expect(player.currentTime).toBe(120)
    expect(mediaSession.position).toEqual({ duration: FIRST.duration, position: 120, playbackRate: 1 })
  })

  it('快放完时交接给下一首：显示新的那首和它的时长；按下一首、上一首，换歌原因各是 next、previous（换碟往对的方向转）', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app, mediaSession } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    spare.ready(SECOND.duration)
    player.progress(190)
    await world.netease.reply(THIRD.url)
    player.progress(191.7)
    await world.settle()
    expect(tab.sounding()).toBe(spare)
    expect(mediaSession.metadata).toMatchObject({ title: 'Theme Of Laura II', artist: '山岡晃', album: 'SILENT HILL 2 ORIGINAL SOUNDTRACK -2024-' })
    expect(mediaSession.position).toEqual({ duration: SECOND.duration, position: 0, playbackRate: 1 })

    mediaSession.press('nexttrack')
    expect(current(app)).toBe(THIRD.id)
    expect(app.state.player.change).toBe('next')
    await world.settle()

    mediaSession.press('previoustrack')
    expect(current(app)).toBe(SECOND.id)
    expect(app.state.player.change).toBe('previous')
  })
})

/** 我喜欢的音乐里的一首（第 3,728 首），验证关卡①按各种音质录过它的播放地址 */
const RECORDED_IN_QUALITIES = { id: 512359195, exhigh: 'playback/song_url_v1.vip-exhigh.json', lossless: 'playback/song_url_v1.vip-lossless.json' }

describe('在线播放音质', () => {
  it('一开始是极高；设成无损后按无损取播放地址，关掉再打开还是无损', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    expect(app.state.player.quality).toBe('exhigh')

    app.setPlayQuality('lossless')
    expect(app.state.player.quality).toBe('lossless')
    await world.netease.reply(RECORDED_IN_QUALITIES.lossless, {
      until: never(),
    })
    app.play(LIKED, RECORDED_IN_QUALITIES.id)
    await world.settle()
    expect(playUrlRequests(device)).toEqual([`/api/songs/${RECORDED_IN_QUALITIES.id}/play-url?quality=lossless`])
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'song_url_v1',
      query: { id: RECORDED_IN_QUALITIES.id, level: 'lossless' },
    })

    const { app: reopened, ...again } = await reopen(device, tab)
    await world.settle()
    expect(reopened.state.player.quality).toBe('lossless')
    const sent = playUrlRequests(device).length
    await world.netease.reply(RECORDED_IN_QUALITIES.lossless)
    reopened.togglePlay()
    await world.settle()
    expect(playUrlRequests(device).slice(sent)).toEqual([`/api/songs/${RECORDED_IN_QUALITIES.id}/play-url?quality=lossless`])
    expect(again.audio.find(audio => !audio.paused)?.src).toBe(await recordedUrl(RECORDED_IN_QUALITIES.lossless))
  })

  it('放着时换音质：正在放的那首不换、不中断；空闲的播放器按新音质重新取下一首的地址', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    await world.netease.reply(RECORDED_IN_QUALITIES.exhigh)
    app.playNext(LIKED, likedSong(app, RECORDED_IN_QUALITIES.id))
    await world.settle()
    expect(spare.src).toBe(await recordedUrl(RECORDED_IN_QUALITIES.exhigh))
    const sent = playUrlRequests(device).length

    await world.netease.reply(RECORDED_IN_QUALITIES.lossless)
    app.setPlayQuality('lossless')
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(playUrlRequests(device).slice(sent)).toEqual([`/api/songs/${RECORDED_IN_QUALITIES.id}/play-url?quality=lossless`])
    expect(spare.src).toBe(await recordedUrl(RECORDED_IN_QUALITIES.lossless))
  })
})

// 听歌打卡（#28，Spec #11“客户端：听歌打卡”）：每首歌结束（播完或切走）时按实际听的整数秒打卡，带上这首自己的播放来源。
// 要发的打卡先记在本机（记着是哪个网易云账号的），经后台通道发给同一个账号，发成了再删

/** 网易云回打卡成功（#28 用 SDK 2.9.0 的新接口录的，真账号上确认计入了听歌排行） */
const CHECK_IN = 'playback/check-in/001-scrobble.json.gz'

/** 服务端调网易云打卡时的参数，按先后 */
const neteaseCheckIns = (): unknown[] => world.netease.calls.flatMap(call => call.module === 'scrobble'
  ? [call.query]
  : [])

describe('听歌打卡', () => {
  it('切走一首（按下一首）：按实际出声的秒数取整打卡，带上这首自己的播放来源；暂停着的时间不算。发成了本机不再留着', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await playUntilSounding(tab, FIRST, SECOND)
    await world.clock.advance(30_400)
    app.togglePlay()
    await world.settle()
    await world.clock.advance(60_000)
    app.togglePlay()
    await world.settle()
    expect(app.state.player.status).toBe('playing')
    await world.clock.advance(10_000)

    await world.netease.reply(CHECK_IN)
    app.next()
    await world.settle()
    expect(checkIns(device)).toEqual([
      {
        songId: FIRST.id,
        body: { source: LIKED, seconds: 40 },
      },
    ])
    expect(neteaseCheckIns()).toEqual([
      {
        id: FIRST.id,
        sourceid: LIKED.id,
        source: 'list',
        time: 40,
      },
    ])
    expect(await storedCheckIns(device)).toEqual([])
  })

  it('放完（快放完时交接给下一首）：这首按实际出声的秒数打卡；接着放的那首从 0 秒另算', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    const spare = other(tab, player)
    spare.ready(SECOND.duration)
    await world.clock.advance(191_700)

    await world.netease.reply(CHECK_IN)
    await world.netease.reply(THIRD.url)
    player.progress(191.7)
    await world.settle()
    expect(tab.sounding()).toBe(spare)
    expect(checkIns(device)).toEqual([
      {
        songId: FIRST.id,
        body: { source: LIKED, seconds: 192 },
      },
    ])

    await world.clock.advance(3_000)
    await world.netease.reply(CHECK_IN)
    app.next()
    await world.settle()
    expect(checkIns(device).at(-1)).toEqual({
      songId: SECOND.id,
      body: { source: LIKED, seconds: 3 },
    })
  })

  it('被插播打断的那首：当场按实际出声的秒数打卡（规则④）；插播进来的那首打卡时带着它自己的播放来源', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await showSearch(app)
    const player = await playUntilSounding(tab, FIRST, SECOND)
    await world.clock.advance(25_000)

    await world.netease.reply(CHECK_IN)
    await world.netease.reply(SEARCH_SONG.url)
    app.play(SEARCHED, SEARCH_SONG.id)
    await world.settle()
    expect(checkIns(device)).toEqual([
      {
        songId: FIRST.id,
        body: { source: LIKED, seconds: 25 },
      },
    ])

    other(tab, player).ready(SEARCH_SONG.duration)
    await world.settle()
    expect(current(app)).toBe(SEARCH_SONG.id)
    await world.clock.advance(10_000)
    await world.netease.reply('search/check-in/001-scrobble.json.gz')
    app.next()
    await world.settle()
    expect(neteaseCheckIns()).toEqual([
      {
        id: FIRST.id,
        sourceid: LIKED.id,
        source: 'list',
        time: 25,
      },
      {
        id: SEARCH_SONG.id,
        sourceid: 0,
        source: 'search',
        time: 10,
      },
    ])
  })

  it('断网时听完的歌：打卡记在本机，记着是哪个账号的；联网后补发，发成了再删', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const player = await playUntilSounding(tab, FIRST, SECOND)
    await world.clock.advance(30_000)
    device.setOnline(false)
    player.end()
    await world.settle()
    expect(checkIns(device)).toEqual([])
    expect(await storedCheckIns(device)).toEqual([
      {
        songId: FIRST.id,
        source: LIKED,
        seconds: 30,
        owner: RECORDED_ACCOUNT.id,
      },
    ])

    await world.netease.reply(CHECK_IN)
    device.setOnline(true)
    await world.settle()
    expect(checkIns(device)).toEqual([
      {
        songId: FIRST.id,
        body: { source: LIKED, seconds: 30 },
      },
    ])
    expect(await storedCheckIns(device)).toEqual([])
  })

  /** 放 40 秒第一首，按下一首时才发现登录 Cookie 没了：打卡被说需要登录，App 变成登录失效 */
  const expireWhileCheckingIn = async (device: Device, tab: Tab): Promise<FakeAudio> => {
    const player = await playUntilSounding(tab, FIRST, SECOND)
    await world.clock.advance(40_000)
    await device.setCookie('campanula_login=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict')
    tab.app.next()
    await world.settle()
    if (tab.app.state.session.status !== 'loginExpired')
      throw new Error('登录没失效')
    return player
  }

  it('发打卡时才知道登录失效（续期也没成功）：App 变成登录失效，打卡留在本机；登录失效期间接着听完的也记着，同一个账号重新登录后按先后补发', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await expireWhileCheckingIn(device, tab)
    expect(checkIns(device)).toHaveLength(1)
    expect(neteaseCheckIns()).toEqual([])
    expect(await storedCheckIns(device)).toEqual([
      {
        songId: FIRST.id,
        source: LIKED,
        seconds: 40,
        owner: RECORDED_ACCOUNT.id,
      },
    ])

    other(tab, player).ready(SECOND.duration)
    await world.settle()
    expect(current(app)).toBe(SECOND.id)
    await world.clock.advance(20_000)
    other(tab, player).end()
    await world.settle()
    expect(checkIns(device)).toHaveLength(1)
    expect(await storedCheckIns(device)).toEqual([
      {
        songId: FIRST.id,
        source: LIKED,
        seconds: 40,
        owner: RECORDED_ACCOUNT.id,
      },
      {
        songId: SECOND.id,
        source: LIKED,
        seconds: 20,
        owner: RECORDED_ACCOUNT.id,
      },
    ])

    await replyLibrary({
      through: 'hearts',
      until: never(),
    })
    await world.netease.reply(CHECK_IN)
    await world.netease.reply(CHECK_IN)
    await signIn(world, app)
    await world.settle()
    expect(checkIns(device).slice(1)).toEqual([
      {
        songId: FIRST.id,
        body: { source: LIKED, seconds: 40 },
      },
      {
        songId: SECOND.id,
        body: { source: LIKED, seconds: 20 },
      },
    ])
    expect(neteaseCheckIns()).toHaveLength(2)
    expect(await storedCheckIns(device)).toEqual([])
  })

  it('补发前换了另一个账号登录：上一个账号的打卡丢弃，不会记到新账号头上', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    await expireWhileCheckingIn(device, tab)
    expect(await storedCheckIns(device)).toHaveLength(1)

    await replyLibrary({
      through: 'hearts',
      until: never(),
    })
    await signIn(world, tab.app, { another: true })
    await world.settle()
    expect(checkIns(device)).toHaveLength(1)
    expect(neteaseCheckIns()).toEqual([])
    expect(await storedCheckIns(device)).toEqual([])
  })

  it('补发前退出了（断网时退出）：打卡丢弃；联网后、同一个账号再登录也不补发', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const player = await playUntilSounding(tab, FIRST, SECOND)
    await world.clock.advance(30_000)
    device.setOnline(false)
    player.end()
    await world.settle()
    expect(await storedCheckIns(device)).toHaveLength(1)

    await app.logout()
    await world.settle()
    expect(app.state.session.status).toBe('signedOut')
    expect(await storedCheckIns(device)).toEqual([])

    await world.netease.reply('login/logout.json')
    device.setOnline(true)
    await world.settle()
    await replyLibrary({
      through: 'hearts',
      until: never(),
    })
    await signIn(world, app)
    await world.settle()
    expect(checkIns(device)).toEqual([])
    expect(await storedCheckIns(device)).toEqual([])
  })

  it('放到一半关掉 App 不算结束，不打卡；再打开接着放，听完时之前听的秒数合成一条（规则⑥）', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const player = await playUntilSounding(tab, FIRST, SECOND)
    await world.clock.advance(60_000)
    player.progress(60)

    const { app: reopened, ...again } = await reopen(device, tab)
    await world.settle()
    expect(checkIns(device)).toEqual([])
    expect(await storedCheckIns(device)).toEqual([])

    await world.netease.reply(FIRST.url)
    await world.netease.reply(SECOND.url)
    reopened.togglePlay()
    await world.settle()
    again.audio.find(audio => !audio.paused)!.ready(FIRST.duration)
    await world.settle()
    await world.clock.advance(30_000)
    await world.netease.reply(CHECK_IN)
    reopened.next()
    await world.settle()
    expect(checkIns(device)).toEqual([
      {
        songId: FIRST.id,
        body: { source: LIKED, seconds: 90 },
      },
    ])
  })

  it('联网时主动退出：正在放的那首算结束，先把它的打卡发出去，再删曲库副本和播放队列、退出；界面马上变成未登录', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await playUntilSounding(tab, FIRST, SECOND)
    await world.clock.advance(50_000)

    const slow = held()
    await world.netease.reply(CHECK_IN, { until: slow.until })
    await world.netease.reply('login/logout.json')
    const loggingOut = app.logout()
    await world.settle()
    expect(app.state.session.status).toBe('signedOut')
    expect(tab.sounding()).toBeUndefined()
    expect(checkIns(device)).toEqual([
      {
        songId: FIRST.id,
        body: { source: LIKED, seconds: 50 },
      },
    ])
    expect(device.requests.some(request => request.path === '/api/logout')).toBe(false)
    expect((await device.stored()).library).not.toEqual([])

    slow.release()
    await loggingOut
    await world.settle()
    expect(device.requests.at(-1)?.path).toBe('/api/logout')
    expect(neteaseCheckIns()).toEqual([
      {
        id: FIRST.id,
        sourceid: LIKED.id,
        source: 'list',
        time: 50,
      },
    ])
    const stored = await device.stored()
    expect([stored.library, stored.player, stored.checkIns]).toEqual([[], [], []])
  })
})
