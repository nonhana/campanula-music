import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'

import { endpoints } from '#lib/api/endpoints.js'
import type { Api, Result } from '#lib/app/api-client.js'
import type { App } from '#lib/app/app.js'
import { createLocalDatabase } from '#lib/app/local.js'
import type { BackgroundLane } from '#lib/app/pacing.js'
import type { Player, PlayerState } from '#lib/app/player.js'
import { INITIAL_PLAYER } from '#lib/app/player.js'
import type { SavedPlayerStore } from '#lib/app/saved-queue.js'
import { createSavedQueue } from '#lib/app/saved-queue.js'
import { createSessionRound } from '#lib/app/session-round.js'

import type { FakeAudio } from './harness/browser'
import type { Device, Tab } from './harness/device'
import { held, never } from './harness/hold'
import { ALBUM_MISSING, checkIns, DAILY, likedSong, listener, serveDownload, storedCheckIns } from './harness/listener'
import { ANOTHER_ACCOUNT, signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

// 会话一轮（#69）：退出、登录失效、换账号之后，上一轮发出去的请求回来时不能再改新一轮的状态。这里从 App 的接缝看：旧的“需要登录”不把新登录的账号判成登录失效，旧的成功回复也不落进新会话。

const world = useWorld()
const { signInAtLikedTracks, signInWithLiked, replyLibrary } = listener(world)

const SEARCH_301 = 'search/cloudsearch.301-invalid.constructed.json'
const DOWNLOAD_301 = 'playback/downloads/song_download_url_v1.301-invalid.constructed.json'
const DOWNLOAD_OK = 'playback/downloads/002-song_download_url_v1.json.gz'
const LYRICS = 'playback/lyric_new.all-forms.json'
const LYRICS_301 = 'playback/lyric_new.301-invalid.constructed.json'
const CHECK_IN = 'playback/check-in/001-scrobble.json.gz'
const CHECK_IN_405 = 'playback/check-in/scrobble.405-rate-limited.constructed.json'
const LIKED = { kind: 'playlist', id: 900000001 } as const
const FIRST = { id: 3433267939, url: 'playback/liked/001-song_url_v1.json.gz', duration: 192.648 }
const SECOND = { id: 2662577181, url: 'playback/liked/002-song_url_v1.json.gz', duration: 240.413 }
const THIRD = { id: 4208408, url: 'playback/liked/003-song_url_v1.json.gz', duration: 310 }

/** 退出 A、登录 B：登录 B 的曲库同步只放红心，停在后面 */
const switchAccount = async (device: Device, app: App): Promise<void> => {
  await world.netease.reply('login/logout.json')
  await app.logout()
  await replyLibrary({
    through: 'hearts',
    until: never(),
  })
  await signIn(world, app, { another: true })
}

/** 同一台设备上两个标签页都登录着；A 先把曲库同步完，B 从本机副本读出同一份 */
const twoSignedInTabs = async (device: Device): Promise<{ tabA: Tab, tabB: Tab }> => {
  const tabA = await signInWithLiked(device)
  await world.netease.reply('login/user_account.vip.json')
  await replyLibrary({
    through: 'hearts',
    until: never(),
  })
  const tabB = await device.open()
  await world.settle()
  if (tabB.app.state.session.status !== 'signedIn' || !tabB.app.state.library?.liked)
    throw new Error(`第二个标签页没登录/没读出曲库：${JSON.stringify(tabB.app.state)}`)
  return { tabA, tabB }
}

/** 在一个标签页里放一首歌，让它出声；下一首的播放地址也备好 */
const playTrack = async (tab: Tab, song: typeof FIRST, next: typeof FIRST): Promise<FakeAudio> => {
  await world.netease.reply(song.url, {
    when: { id: song.id },
  })
  await world.netease.reply(next.url, {
    when: { id: next.id },
  })
  tab.app.play(LIKED, song.id)
  await world.settle()
  const player = tab.audio.find(audio => !audio.paused)
  if (!player)
    throw new Error(`${song.id} 没开始加载`)
  player.ready(song.duration)
  await world.settle()
  if (tab.sounding() !== player)
    throw new Error(`${song.id} 没出声`)
  return player
}

/** 一个只让测试手动回答的 Api：记录发过几次，回答排队 */
const controlledApi = (): { api: Api, pending: Array<(result: Result<unknown>) => void>, calls: () => number } => {
  const pending: Array<(result: Result<unknown>) => void> = []
  let calls = 0
  const api = {
    get: (..._args: unknown[]) => {
      calls += 1
      return new Promise<Result<unknown>>(resolve => pending.push(resolve))
    },
    post: (..._args: unknown[]) => {
      throw new Error('这个测试只发 GET')
    },
  } as unknown as Api
  return {
    api,
    pending,
    calls: () => calls,
  }
}

describe('旧会话的回复', () => {
  it('退出前发出的选择器搜索，新账号登录后才回 401：不把新会话判成登录失效', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const slow = held()
    await world.netease.reply(SEARCH_301, { until: slow.until })
    // 旧请求回 301 后，服务端会拿旧的、已经失效的凭据续期一次
    await world.netease.reply('login/login_refresh.301-invalid.json')

    const stale = app.searchSongs('真夜中')
    await world.settle()
    expect(device.pending.map(request => request.path)).toContain('/api/search/songs?keywords=%E7%9C%9F%E5%A4%9C%E4%B8%AD&offset=0')
    await switchAccount(device, app)

    slow.release()
    await world.settle()

    expect(await stale).toMatchObject({
      ok: false,
      failure: { kind: 'needsLogin' },
    })
    expect(device.responses).toContainEqual({ method: 'GET', path: '/api/search/songs?keywords=%E7%9C%9F%E5%A4%9C%E4%B8%AD&offset=0', status: 401 })
    expect(app.state.session).toEqual({ status: 'signedIn', account: ANOTHER_ACCOUNT })
  })

  it('退出前要的下载地址，新账号登录后才回 401：不把新会话判成登录失效，排队的那首用新账号接着下', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, FIRST.id)
    await serveDownload(device, song, DOWNLOAD_OK)
    const slow = held()
    await world.netease.reply(DOWNLOAD_301, { until: slow.until })
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)
    await world.netease.reply('login/login_refresh.301-invalid.json')

    expect(app.download(song)).toBeNull()
    await world.settle()
    expect(device.pending.map(request => request.path)).toContain('/api/songs/3433267939/download-url?quality=exhigh')

    // 新账号登录后队列接着走：用新会话重新要地址、歌词、专辑
    await world.netease.reply(DOWNLOAD_OK)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)
    await switchAccount(device, app)

    slow.release()
    await world.settle()

    expect(device.responses).toContainEqual({ method: 'GET', path: '/api/songs/3433267939/download-url?quality=exhigh', status: 401 })
    expect(app.state.session).toEqual({ status: 'signedIn', account: ANOTHER_ACCOUNT })
    expect(app.state.downloads.tasks.size).toBe(0)
    expect(app.state.downloads.has(FIRST.id)).toBe(true)
    expect((await device.stored()).downloads ?? []).toHaveLength(1)
  })

  it('退出前打开的歌词，新账号登录后才回 401：不把新会话判成登录失效', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const slow = held()
    await world.netease.reply(LYRICS_301, { until: slow.until })
    await world.netease.reply('login/login_refresh.301-invalid.json')

    const stale = app.openLyrics(1466598056)
    await world.settle()
    await switchAccount(device, app)

    slow.release()
    await stale

    expect(device.responses).toContainEqual({ method: 'GET', path: '/api/songs/1466598056/lyrics', status: 401 })
    expect(app.state.lyrics).toBeNull()
    expect(app.state.session).toEqual({ status: 'signedIn', account: ANOTHER_ACCOUNT })
  })

  it('退出前打开的每日推荐晚回来：新会话里不显示它', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const slow = held()
    await world.netease.reply(DAILY, { until: slow.until })

    const stale = app.openDaily()
    await world.settle()
    await switchAccount(device, app)

    slow.release()
    await stale

    expect(app.state.daily).toBeNull()
    expect(app.state.session).toEqual({ status: 'signedIn', account: ANOTHER_ACCOUNT })
  })
})

describe('两个标签页退出', () => {
  it('限流时退出不被打卡锁卡住，发起方仍发最后一首', async () => {
    const device = world.device()
    const { tabA, tabB } = await twoSignedInTabs(device)
    world.netease.anyOrder()
    const aPlayer = await playTrack(tabA, FIRST, SECOND)
    await playTrack(tabB, SECOND, THIRD)
    await world.clock.advance(30_000)

    await world.netease.reply(CHECK_IN_405, {
      when: { id: FIRST.id },
    })
    await world.netease.reply(CHECK_IN, {
      when: { id: SECOND.id },
    })
    aPlayer.end()
    await world.settle()
    expect(checkIns(device).some(request => request.songId === FIRST.id)).toBe(true)

    const loggingOut = tabB.app.logout()
    try {
      await vi.waitFor(() => expect(tabA.app.state.session.status).toBe('signedOut'))
      await loggingOut
    }
    finally {
      // 万一断言先失败：推进过限流、联网，让另一个标签页的锁和退出收尾都能结束
      await world.clock.advance(31_000)
      device.setOnline(true)
      await loggingOut.catch(() => {})
      await world.settle()
    }

    expect(tabB.app.state.session.status).toBe('signedOut')
    expect(checkIns(device).some(request => request.songId === SECOND.id)).toBe(true)
    expect(await storedCheckIns(device)).toEqual([])
  })

  it('离线时退出不被打卡锁卡住，其他标签页的最后一首不留下', async () => {
    const device = world.device()
    const { tabA, tabB } = await twoSignedInTabs(device)
    world.netease.anyOrder()
    const aPlayer = await playTrack(tabA, FIRST, SECOND)
    await playTrack(tabB, SECOND, THIRD)
    await world.clock.advance(30_000)

    device.setOnline(false)
    aPlayer.end()
    await world.settle()
    const before = checkIns(device).length

    const loggingOut = tabB.app.logout()
    try {
      await vi.waitFor(() => expect(tabA.app.state.session.status).toBe('signedOut'))
      await loggingOut
    }
    finally {
      device.setOnline(true)
      await world.settle()
    }

    expect(tabB.app.state.session.status).toBe('signedOut')
    // 离线时两个标签页都发不出去；退出清空待发，不会留下孤儿打卡
    expect(checkIns(device)).toHaveLength(before)
    expect(await storedCheckIns(device)).toEqual([])
  })
})

describe('会话一轮核心', () => {
  it('两个 needsLogin 同时回来：只过期一次、两个结果都丢掉', async () => {
    const { api, pending, calls } = controlledApi()
    let expired = 0
    let stops = 0
    const lane: BackgroundLane = {
      send: async () => null,
      stop: () => { stops += 1 },
      resume: () => {},
    }
    const round = createSessionRound({
      api,
      lane,
      expired: () => {
        expired += 1
        void round.change({ kind: 'loginExpired' })
      },
    })
    await round.change({ kind: 'signedIn', account: ANOTHER_ACCOUNT })
    const before = round.current

    const first = round.api.get(endpoints.account)
    const second = round.api.get(endpoints.account)
    expect(calls()).toBe(2)

    pending[0]({
      ok: false,
      failure: { kind: 'needsLogin' },
    })
    await vi.waitFor(() => expect(expired).toBe(1))
    // 第一个 401 已经让这一轮失效；先重新登录（新轮次），再放回旧请求，专门核对轮次令牌
    await round.change({ kind: 'signedIn', account: ANOTHER_ACCOUNT })
    pending[1]({
      ok: false,
      failure: { kind: 'needsLogin' },
    })

    await expect(first).resolves.toBeNull()
    await expect(second).resolves.toBeNull()
    expect(expired).toBe(1)
    expect(stops).toBe(1)
    expect(round.current).toBe(before + 2)
  })

  it('某个清理监听者抛错：其余清理照常跑、change 不 reject、记日志', async () => {
    const { api } = controlledApi()
    const lane: BackgroundLane = {
      send: async () => null,
      stop: () => {},
      resume: () => {},
    }
    const round = createSessionRound({
      api,
      lane,
      expired: () => {},
    })
    let cleared = 0
    const logged: unknown[][] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args)
    })
    try {
      round.onChange(() => {
        throw new Error('清理失败')
      })
      round.onChange(() => {
        cleared += 1
      })
      await expect(round.change({ kind: 'signedOut', by: 'other-tab' })).resolves.toBeUndefined()
      expect(cleared).toBe(1)
      expect(logged).toEqual([
        [
          '会话切换清理失败',
          'signedOut',
          expect.any(Error),
        ],
      ])
    }
    finally {
      spy.mockRestore()
    }
  })
})

describe('保存的播放队列核心', () => {
  it('别的标签页退出：停播不写最后一首，也不直接发', async () => {
    const { api } = controlledApi()
    let expiries = 0
    let stopped = 0
    let sent = 0
    let queue!: SavedPlayerStore
    const player = {
      stop: () => {
        stopped += 1
        queue.forget([
          {
            songId: 1,
            source: { kind: 'downloads' },
            seconds: 10,
          },
        ])
      },
      adopt: () => {},
      restore: () => {},
    } as unknown as Player
    const lane: BackgroundLane = {
      send: async () => null,
      stop: () => {},
      resume: () => {},
    }
    const round = createSessionRound({
      api,
      lane,
      expired: () => {
        expiries += 1
      },
    })
    queue = createSavedQueue({
      db: createLocalDatabase(new IDBFactory()),
      session: round,
      player: () => player,
      read: () => ({ ...INITIAL_PLAYER, current: null }) as PlayerState,
      send: () => {},
      sendBeforeLogout: async () => { sent += 1 },
    })

    await round.change({ kind: 'signedIn', account: ANOTHER_ACCOUNT })
    await round.change({ kind: 'signedOut', by: 'other-tab' })

    expect(stopped).toBe(1)
    expect(sent).toBe(0)
    expect(expiries).toBe(0)
    expect(await queue.pending.all()).toEqual([])
  })
})
