import { describe, expect, it } from 'vitest'

import { never } from './harness/hold'
import { listener } from './harness/listener'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInAtHearts, dailySongs } = listener(world)

// 每日推荐（#29）：听众打开时用前台请求拉，只在这次登录期间记着；点一首歌就用整份每日推荐替换播放队列。录制见 tests/fixtures/netease/README.md 的 #29 一条
/** 录下的每日推荐有 31 首，第一首和第三首 */
const RAIN = 443070379
const THIRD = 3408879610
const DAILY_SOURCE = { kind: 'daily' } as const
/** 网易云回打卡成功（#29 真账号上从每日推荐打卡 1 次时录的） */
const CHECK_IN = 'discover/daily/002-scrobble.json.gz'
/** 别的歌的播放地址：压着不回，只看播放队列和取了哪首的地址 */
const SOME_PLAY_URL = 'playback/liked/001-song_url_v1.json.gz'

const dailyCalls = (): number => world.netease.calls.filter(call => call.module === 'recommend_songs').length

describe('每日推荐', () => {
  it('打开每日推荐：用前台请求拉今天这份，歌曲只留界面用得到的字段', async () => {
    const { app } = await signInAtHearts(world.device())

    const songs = await dailySongs(app)

    expect(dailyCalls()).toBe(1)
    // 测试的时钟从北京时间 2026-10-12 08:00 开始
    expect(app.state.daily?.day).toBe('2026-10-12')
    expect(songs).toHaveLength(31)
    expect(songs[0]).toEqual({
      id: RAIN,
      name: 'Rain (From "The Last Emperor")',
      artists: [
        { id: 15289, name: '坂本龍一' },
        { id: 430807, name: 'Brussels Philharmonic' },
      ],
      album: { id: 35012060, name: 'Ryuichi Sakamoto - Music For Film', coverUrl: 'http://p3.music.126.net/XDu14l6k0aObvUs4nFFFGw==/18339853951789381.jpg' },
      duration: 256069,
      availability: 'full',
    })
  })

  it('点一首歌：用整份每日推荐替换播放队列、从这首开始放，每首的播放来源都是每日推荐', async () => {
    const device = world.device()
    const { app } = await signInAtHearts(device)
    const songs = await dailySongs(app)

    await world.netease.reply(SOME_PLAY_URL, {
      until: never(),
    })
    app.play(DAILY_SOURCE, THIRD)
    await world.settle()

    const { queue, current } = app.state.player
    expect(queue.map(entry => entry.song.id)).toEqual(songs.map(song => song.id))
    expect(queue.every(entry => entry.source.kind === 'daily')).toBe(true)
    expect(current).toBe(2)
    expect(device.requests.at(-1)?.path).toBe(`/api/songs/${THIRD}/play-url?quality=exhigh`)
  })

  it('播放全部：用整份每日推荐替换播放队列，从第一首开始放', async () => {
    const device = world.device()
    const { app } = await signInAtHearts(device)
    const songs = await dailySongs(app)

    await world.netease.reply(SOME_PLAY_URL, {
      until: never(),
    })
    app.playAll(DAILY_SOURCE)
    await world.settle()

    const { queue, current } = app.state.player
    expect(queue.map(entry => entry.song.id)).toEqual(songs.map(song => song.id))
    expect(queue.every(entry => entry.source.kind === 'daily')).toBe(true)
    expect(current).toBe(0)
    expect(device.requests.at(-1)?.path).toBe(`/api/songs/${RAIN}/play-url?quality=exhigh`)
  })

  it('断网时没拉成，说明是断网（不连网易云）；联网后再打开就拉到了', async () => {
    const device = world.device()
    const { app } = await signInAtHearts(device)

    device.setOnline(false)
    await app.openDaily()
    expect(app.state.daily).toEqual({
      day: '2026-10-12',
      status: 'failed',
      failure: { kind: 'offline' },
    })
    expect(dailyCalls()).toBe(0)

    device.setOnline(true)
    await dailySongs(app)
    expect(app.state.daily?.day).toBe('2026-10-12')
  })

  it('这次登录里再打开不再拉；过了第二天北京时间 6:00，网易云换了一份，再打开就重新拉', async () => {
    const { app } = await signInAtHearts(world.device())
    await dailySongs(app)

    // 从北京时间 10-12 08:00 到 10-13 05:59：还是 10-12 那份
    await world.clock.advance((21 * 60 + 59) * 60_000)
    await app.openDaily()
    expect(dailyCalls()).toBe(1)
    expect(app.state.daily).toMatchObject({ day: '2026-10-12', status: 'shown' })

    await world.clock.advance(60_000)
    await dailySongs(app)
    expect(dailyCalls()).toBe(2)
    expect(app.state.daily?.day).toBe('2026-10-13')
  })

  it('退出登录：每日推荐不再显示', async () => {
    const { app } = await signInAtHearts(world.device())
    await dailySongs(app)

    await world.netease.reply('login/logout.json')
    await app.logout()
    expect(app.state.daily).toBeNull()
  })

  it('从每日推荐放进播放队列的歌听完打卡：播放来源是每日推荐，服务端照 SDK 文档报 recommend、来源编号 0', async () => {
    const device = world.device()
    const tab = await signInAtHearts(device)
    const { app } = tab
    // 匿名录的专辑只有一首，有它的播放地址（非会员放 30 秒的试听片段）：像从每日推荐的“更多”菜单加进播放队列
    const album = { id: 84072830, song: 1409311773 }
    await world.netease.reply('library/album.json')
    await app.openAlbum(album.id)
    const page = app.state.library?.albumPage(album.id)
    if (page?.status !== 'shown')
      throw new Error('专辑页没显示')
    await world.netease.reply('playback/song_url_v1.anon-trial.json')
    app.addToQueue(DAILY_SOURCE, page.content.songs[0])
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
        path: `/api/songs/${album.song}/check-in`,
        body: { source: DAILY_SOURCE, seconds: 10 },
      },
    ])
    expect(world.netease.calls.filter(call => call.module === 'scrobble').map(call => call.query)).toEqual([
      {
        id: album.song,
        sourceid: 0,
        source: 'recommend',
        time: 10,
      },
    ])
  })
})
