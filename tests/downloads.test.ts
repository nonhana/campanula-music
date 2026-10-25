import { describe, expect, it } from 'vitest'

import type { Device } from './harness/device'
import { loadFixture } from './harness/fixtures'
import { held, never } from './harness/hold'
import { ALBUM_MISSING, checkIns, COLLECTED_ALBUMS, COLLECTED_ARTISTS, DOWNLOAD_COVER_BYTES as COVER_BYTES, current, HEARTS, LIKED_TRACK_IDS, likedPage, likedSong, listener, DOWNLOAD_LYRICS as LYRICS, PLAYLISTS_WITH_POEMS, playUrlRequests, serveDownload as serve, storedCheckIns, VILLAGE } from './harness/listener'
import { signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInWithLiked, replyLibrary, downloadLiked: download } = listener(world, { playlists: PLAYLISTS_WITH_POEMS })

// 下载单曲与离线播放（#38，Spec #11“客户端：下载”、ADR-0006）：浏览器向服务端要下载地址，直连网易云的音频服务器、图片服务器把完整音频和封面缩略图下下来，连同歌词、歌曲信息存进这台设备。
// 下载属于设备，和登录、登录的是哪个账号都无关；服务器那边（有哪些文件、传得快慢、传到一半断开）由测试在设备的文件替身上决定

/** 我喜欢的音乐里的《LOSER》（米津玄師，第 4 页）：验证关卡①录了它极高音质的下载地址（9,757,301 字节的 mp3）。封面缩略图按 512 取（网易云的缩略图地址加 ?param=512y512） */
const LOSER = {
  id: 512359195,
  downloadUrl: 'playback/song_download_url_v1.vip-exhigh.json',
  audio: 'https://m801.music.126.net/20261008224945/895f88271a03b13d0a15d19022bee628/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/32069287514/68e9/2e06/8622/0e659917c7eb4e6786a3109a3b804432.mp3?vuutv=8CTY6jdoXzr+FND29mouuWAQAhn+719U7vqUHnf2DMKu5tjuwBhsDU1n3eUSIkzxkpUHJq9HugLMRG3mosrW5fqtz+mJyfM7ibV2W+jw4Zg=',
  bytes: 9_757_301,
  cover: 'https://p3.music.126.net/IeyCexR3Hg9NnVY9TDCD3w==/109951166530781958.jpg?param=512y512',
}
/** 我喜欢的音乐里无版权的一首（Sea Of Tired（Slowed）），和只能放试听片段的一首（第 2 页，会员歌） */
const NO_COPYRIGHT = 2108191414
const TRIAL = 2636390698

/** 我喜欢的音乐的第 1～3 首：#38 录了它们极高音质的下载地址，和 playback/liked/ 的在线播放地址是同一批歌（tests/playback.test.ts 的 FIRST、SECOND、THIRD） */
const FIRST = { id: 3433267939, downloadUrl: 'playback/downloads/002-song_download_url_v1.json.gz', playUrl: 'playback/liked/001-song_url_v1.json.gz' }
const SECOND = { id: 2662577181, downloadUrl: 'playback/downloads/003-song_download_url_v1.json.gz', playUrl: 'playback/liked/002-song_url_v1.json.gz' }
const THIRD = { id: 4208408, downloadUrl: 'playback/downloads/004-song_download_url_v1.json.gz', playUrl: 'playback/liked/003-song_url_v1.json.gz' }

const LIKED = { kind: 'playlist', id: 900000001 } as const
const DOWNLOADS = { kind: 'downloads' } as const

const serveLoser = (device: Device): void => {
  device.files.put(LOSER.audio, { bytes: LOSER.bytes, type: 'audio/mpeg' })
  device.files.put(LOSER.cover, { bytes: COVER_BYTES, type: 'image/jpeg' })
}

const storedDownloads = async (device: Device): Promise<Record<string, any>[]> => ((await device.stored()).downloads ?? []).map(([, value]) => value as Record<string, any>)

/** 下载地址的录制里音频地址和字节数 */
const audioOf = async (fixture: string): Promise<{ url: string, size: number }> => {
  const { data } = (await loadFixture(fixture)).outcome.response.body as { data: { url: string, size: number } }
  return {
    url: data.url.replace(/^http:/, 'https:'),
    size: data.size,
  }
}

/** 只挑音频地址的下载记录（封面也是同一个替身里的请求） */
const audioStarts = (device: Device, url: string): number[] => device.files.requests.flatMap((each, index) => each === url
  ? [device.files.starts[index]!]
  : [])

const downloadUrlRequests = (device: Device): string[] => device.requests.flatMap(request => request.path.includes('/download-url')
  ? [request.path]
  : [])

describe('下载一首', () => {
  it('界面传进来的 Song 是 Svelte 的状态代理：下载照样存进本机，不会卡在 100%', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, FIRST.id)
    // Svelte 5 的 $state 会把歌变成代理，IndexedDB 克隆不了代理；App 收到界面传来的对象要能自己处理
    const proxied = new Proxy(song, {})

    await serve(device, song, FIRST.downloadUrl)
    await world.netease.reply(FIRST.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)
    app.download(proxied)
    await world.settle()

    expect(app.state.downloads.has(FIRST.id)).toBe(true)
    expect(app.state.downloads.tasks.has(FIRST.id)).toBe(false)
    const [stored] = ((await device.stored()).downloads ?? []).map(([, value]) => value as Record<string, any>)
    expect(stored.song).toEqual(song)
    expect(() => structuredClone(stored.song)).not.toThrow()
  })

  it('完整音频、封面缩略图、歌词和歌曲信息一起存进这台设备：下载地址按极高音质向服务端要，音频和封面由浏览器直连网易云下', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, LOSER.id)
    serveLoser(device)
    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)

    app.download(song)
    await world.settle()

    expect(device.requests.map(request => request.path)).toContain(`/api/songs/${LOSER.id}/download-url?quality=exhigh`)
    expect(world.netease.calls.find(call => call.module === 'song_download_url_v1')).toMatchObject({
      query: { id: LOSER.id, level: 'exhigh' },
    })
    expect(device.files.requests).toEqual(expect.arrayContaining([LOSER.audio, LOSER.cover]))
    const [stored] = await storedDownloads(device)
    expect(stored.song).toEqual(song)
    expect(stored.audio).toBeInstanceOf(Blob)
    expect(stored.audio).toMatchObject({ size: LOSER.bytes, type: 'audio/mpeg' })
    expect(stored.cover).toMatchObject({ size: COVER_BYTES, type: 'image/jpeg' })
    expect(stored.lyrics.kind).toBe('word')
    expect(stored.lyrics.lines).toHaveLength(45)
    expect(stored.lyrics.lines[3]).toMatchObject({ text: '夢ならばどれほどよかったでしょう', translation: '如果这一切都是梦境该有多好' })
    expect(stored.lyrics).toMatchObject({
      yrc: expect.stringContaining('[830,4980](830,380,0)夢(1210,330,0)な'),
      romalrc: expect.stringContaining('[00:00.850]yu me na ra ba do re ho do yo ka tta de sho u'),
    })
    expect(app.state.downloads.songs).toEqual([song])
    expect(app.state.downloads.tasks.size).toBe(0)
  })

  it('下载中看得到音频收到了多少字节、一共多少', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    serveLoser(device)
    const transfer = held()
    device.files.next(LOSER.audio, { until: transfer.until })
    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)

    app.download(likedSong(app, LOSER.id))
    await world.settle()
    expect(app.state.downloads.tasks.get(LOSER.id)).toMatchObject({
      status: 'downloading',
      received: Math.floor(LOSER.bytes / 2),
      total: LOSER.bytes,
    })
    expect(app.state.downloads.songs).toEqual([])

    transfer.release()
    await world.settle()
    expect(app.state.downloads.tasks.size).toBe(0)
    expect(app.state.downloads.songs?.map(song => song.id)).toEqual([LOSER.id])
  })

  it('试听、无版权的歌不能下载，已经下载过的、断网时也不下：不发请求，说明为什么', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)

    expect(app.download(likedSong(app, TRIAL))).toBe('trial')
    expect(app.download(likedSong(app, NO_COPYRIGHT))).toBe('noCopyright')
    device.setOnline(false)
    expect(app.download(likedSong(app, LOSER.id))).toBe('offline')
    device.setOnline(true)
    serveLoser(device)
    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)
    expect(app.download(likedSong(app, LOSER.id))).toBeNull()
    expect(app.download(likedSong(app, LOSER.id))).toBe('queued')
    await world.settle()
    expect(app.download(likedSong(app, LOSER.id))).toBe('downloaded')
    await world.settle()

    expect(downloadUrlRequests(device)).toEqual([`/api/songs/${LOSER.id}/download-url?quality=exhigh`])
    expect(app.state.downloads.songs?.map(song => song.id)).toEqual([LOSER.id])
    expect(app.state.downloads.tasks.size).toBe(0)
  })

  it('音频传到一半断开：标成没下成、说明原因，什么都不存；重试从断点接着下，不从头下', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, LOSER.id)
    serveLoser(device)
    device.files.next(LOSER.audio, { cut: true })
    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)

    app.download(song)
    await world.settle()
    expect(app.state.downloads.tasks.get(LOSER.id)).toMatchObject({
      status: 'failed',
      received: Math.floor(LOSER.bytes / 2),
      total: LOSER.bytes,
      failure: { kind: 'interrupted' },
    })
    expect(app.state.library?.notice).toEqual({
      kind: 'downloadFailed',
      song,
      failure: { kind: 'interrupted' },
    })
    expect(await storedDownloads(device)).toEqual([])
    expect(app.state.downloads.songs).toEqual([])

    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)
    expect(app.download(song)).toBeNull()
    await world.settle()
    expect(device.files.requests.filter(url => url === LOSER.audio)).toHaveLength(2)
    expect(device.files.requests.flatMap((url, index) => url === LOSER.audio
      ? [device.files.starts[index]!]
      : [])).toEqual([
      0,
      Math.floor(LOSER.bytes / 2),
    ])
    expect(app.state.downloads.tasks.size).toBe(0)
    expect(app.state.downloads.songs).toEqual([song])
    expect(await storedDownloads(device)).toHaveLength(1)
  })

  it('下载失败的提示带重试动作：点重试重新下载，成功后提示消失', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, LOSER.id)
    serveLoser(device)
    device.files.next(LOSER.audio, { cut: true })
    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)

    app.download(song)
    await world.settle()
    expect(app.state.library?.notice).toEqual({
      kind: 'downloadFailed',
      song,
      failure: { kind: 'interrupted' },
    })
    expect(app.state.library?.noticeActions).toContain('retry')

    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)
    await app.noticeAction('retry')
    await world.settle()

    expect(device.files.requests.filter(url => url === LOSER.audio)).toHaveLength(2)
    expect(app.state.downloads.songs).toEqual([song])
    expect(app.state.library?.notice).toBeNull()
  })

  it('网易云回得慢、下载地址还没回来时退出登录：回来的“需要登录”不算登录失效，App 是退出了；这首留在队列里等下一次登录', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, LOSER.id)
    const slow = held()
    await world.netease.reply(LOSER.downloadUrl, { until: slow.until })
    await world.netease.reply(LYRICS, { until: slow.until })
    await world.netease.reply(ALBUM_MISSING)
    app.download(song)
    await world.settle()

    await world.netease.reply('login/logout.json')
    await app.logout()
    await world.settle()
    expect(app.state.session.status).toBe('signedOut')
    slow.release()
    await world.settle()
    expect(app.state.session.status).toBe('signedOut')
    expect(app.state.downloads.songs).toEqual([])
    expect(app.state.downloads.tasks.get(LOSER.id)).toMatchObject({ status: 'queued' })
  })

  it('后台通道停着时（登录失效）要下载地址：登录失效照常，这首留在队列里，重新登录后再接着下', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, LOSER.id)
    // 登录 Cookie 被删掉：下一个请求网易云说需要登录，续期也没成功
    await device.setCookie('campanula_login=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict')
    app.download(song)
    await world.settle()
    expect(app.state.session.status).toBe('loginExpired')
    expect(app.state.downloads.songs).toEqual([])
    expect(app.state.downloads.tasks.get(LOSER.id)).toMatchObject({
      status: 'queued',
      received: 0,
    })
  })

  it('退出登录以后不能下载：不发请求，说明要先登录', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, LOSER.id)
    await world.netease.reply('login/logout.json')
    await app.logout()
    await world.settle()
    const requested = device.requests.length

    expect(app.download(song)).toBe('signedOut')
    await world.settle()
    expect(app.state.downloads.tasks.size).toBe(0)
    expect(device.requests.slice(requested)).toEqual([])
  })
})

describe('下载属于这台设备', () => {
  it('退出登录、换另一个账号登录，下载都还在：另一个账号也看得到', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const first = await download(device, app, FIRST)
    const second = await download(device, app, SECOND)

    await world.netease.reply('login/logout.json')
    await app.logout()
    await world.settle()
    expect(app.state.session.status).toBe('signedOut')
    expect(app.state.downloads.songs).toEqual([second, first])
    expect(await storedDownloads(device)).toHaveLength(2)

    await replyLibrary({
      through: 'hearts',
      until: never(),
    })
    await signIn(world, app, { another: true })
    await world.settle()
    expect(app.state.downloads.songs).toEqual([second, first])
    expect(await storedDownloads(device)).toHaveLength(2)
  })

  it('没登录时打开 App 也有下载：点一首，整个已下载替换播放队列，放的是本机文件、不取播放地址；也能删', async () => {
    const device = world.device()
    const signedIn = await signInWithLiked(device)
    const first = await download(device, signedIn.app, FIRST)
    const second = await download(device, signedIn.app, SECOND)
    await world.netease.reply('login/logout.json')
    await signedIn.app.logout()
    await world.settle()
    signedIn.close()

    const tab = await device.open()
    const { app } = tab
    expect(app.state.session.status).toBe('signedOut')
    expect(app.state.downloads.songs).toEqual([second, first])

    app.play(DOWNLOADS, first.id)
    await world.settle()
    expect(app.state.player.queue).toEqual([
      { song: second, source: DOWNLOADS },
      { song: first, source: DOWNLOADS },
    ])
    expect(current(app)).toBe(first.id)
    const player = tab.audio.find(audio => !audio.paused)!
    expect(device.objectUrls.blobOf(player.src)).toMatchObject({ size: ((await loadFixture(FIRST.downloadUrl)).outcome.response.body as { data: { url: string, size: number } }).data.size, type: 'audio/mpeg' })
    player.ready(192.648)
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(app.state.player).toMatchObject({ status: 'playing', trial: false })
    expect(playUrlRequests(device)).toEqual([])

    await app.deleteDownloads([second.id])
    expect(app.state.downloads.songs).toEqual([first])
    expect((await storedDownloads(device)).map(stored => stored.song.id)).toEqual([first.id])
  })

  it('没登录时删掉正在放的那首下载：这首接着放完（文件已经在播放器里），之后放不了的不再放，不去取播放地址', async () => {
    const device = world.device()
    const signedIn = await signInWithLiked(device)
    const first = await download(device, signedIn.app, FIRST)
    const second = await download(device, signedIn.app, SECOND)
    await world.netease.reply('login/logout.json')
    await signedIn.app.logout()
    await world.settle()
    const { app } = signedIn

    app.play(DOWNLOADS, first.id)
    await world.settle()
    const player = signedIn.audio.find(audio => !audio.paused)!
    player.ready(192.648)
    await world.settle()

    await app.deleteDownloads([first.id])
    await world.settle()
    expect(current(app)).toBe(first.id)
    expect(app.state.player.neighbors).toEqual({ previous: 0, next: 0 })
    await app.deleteDownloads([second.id])
    await world.settle()
    expect(app.state.player.neighbors).toEqual({ previous: null, next: null })

    player.end()
    await world.settle()
    expect(app.state.player.status).toBe('paused')
    app.togglePlay()
    await world.settle()
    expect(app.state.player).toMatchObject({
      status: 'paused',
      notice: { kind: 'nothingPlayable' },
    })
    expect(playUrlRequests(device)).toEqual([])
  })
})

describe('放已下载的歌', () => {
  it('已下载的歌即使在线也放本机文件：点它不取播放地址；下一首是已下载的，空闲的播放器缓冲的也是本机文件', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const first = await download(device, app, FIRST)
    await download(device, app, THIRD)

    await world.netease.reply(SECOND.playUrl)
    app.play(LIKED, first.id)
    await world.settle()
    const player = tab.audio.find(audio => !audio.paused)!
    expect(device.objectUrls.blobOf(player.src)?.size).toBe(((await loadFixture(FIRST.downloadUrl)).outcome.response.body as { data: { url: string, size: number } }).data.size)
    player.ready(192.648)
    await world.settle()
    expect(tab.sounding()).toBe(player)
    expect(playUrlRequests(device)).toEqual([`/api/songs/${SECOND.id}/play-url?quality=exhigh`])

    app.next()
    await world.settle()
    const second = tab.audio.find(audio => audio !== player)!
    second.ready(240.413)
    await world.settle()
    expect(current(app)).toBe(SECOND.id)
    expect(device.objectUrls.blobOf(player.src)?.size).toBe(((await loadFixture(THIRD.downloadUrl)).outcome.response.body as { data: { url: string, size: number } }).data.size)
    expect(playUrlRequests(device)).toEqual([`/api/songs/${SECOND.id}/play-url?quality=exhigh`])
  })

  it('正在在线放的那首下载完了：照样能拖进度，这首接着放完（换成本机文件从下一次放这首起）', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    await world.netease.reply(FIRST.playUrl)
    await world.netease.reply(SECOND.playUrl)
    app.play(LIKED, FIRST.id)
    await world.settle()
    const player = tab.audio.find(audio => !audio.paused)!
    player.ready(192.648)
    await world.settle()

    await download(device, app, FIRST)
    app.seek(100)
    await world.settle()
    expect(player.currentTime).toBe(100)
    expect(tab.sounding()).toBe(player)
    expect(app.state.player).toMatchObject({ status: 'playing', position: 100 })
  })

  it('断网时下载的歌词、封面缩略图照样在：看歌词不发请求，锁屏上的封面是本机的', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const first = await download(device, app, FIRST)
    device.setOnline(false)
    const requested = device.requests.length

    await app.openLyrics(first.id)
    const shown = app.state.lyrics
    if (shown?.status !== 'shown' || shown.lyrics.kind !== 'word')
      throw new Error(`没显示下载的歌词：${JSON.stringify(shown)}`)
    expect(shown.lyrics.lines[3]).toMatchObject({ text: '夢ならばどれほどよかったでしょう' })

    const cover = app.state.downloads.coverOf(first.album.coverUrl!)
    expect(cover && device.objectUrls.blobOf(cover)).toMatchObject({ size: COVER_BYTES, type: 'image/jpeg' })
    expect(app.state.downloads.coverOf(likedSong(app, SECOND.id).album.coverUrl!)).toBeNull()

    app.play(LIKED, first.id)
    await world.settle()
    expect(tab.mediaSession.metadata?.artwork[0]?.src).toBe(cover)
    expect(device.requests.slice(requested)).toEqual([])
  })

  it('断网时没下载的歌放不了：点它没反应，放的时候跳过，列表循环只在下载了的几首里转；联网后又都能放', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const first = await download(device, app, FIRST)
    const third = await download(device, app, THIRD)
    device.setOnline(false)
    await world.settle()
    expect(app.state.online).toBe(false)

    app.play(LIKED, SECOND.id)
    await world.settle()
    expect(app.state.player.queue).toEqual([])

    app.play(LIKED, first.id)
    await world.settle()
    const liked = app.state.library!.liked!.songs
    expect(app.state.player.queue.map(entry => entry.song.id)).toEqual(liked.map(song => song.id))
    expect(app.state.player.neighbors).toEqual({ previous: 2, next: 2 })
    const player = tab.audio.find(audio => !audio.paused)!
    player.ready(192.648)
    await world.settle()
    expect(tab.sounding()).toBe(player)

    player.end()
    await world.settle()
    expect(current(app)).toBe(third.id)
    tab.audio.find(audio => audio !== player)!.ready(310)
    await world.settle()
    app.next()
    await world.settle()
    expect(current(app)).toBe(first.id)
    expect(playUrlRequests(device)).toEqual([])

    await world.netease.reply(SECOND.playUrl)
    device.setOnline(true)
    await world.settle()
    expect(app.state.online).toBe(true)
    expect(app.state.player.neighbors.next).toBe(1)
  })

  it('断网时播放全部：从歌单里第一首下载了的开始放', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const third = await download(device, app, THIRD)
    device.setOnline(false)
    await world.settle()

    app.playAll(LIKED)
    await world.settle()
    expect(current(app)).toBe(third.id)
    expect(app.state.player.queue).toHaveLength(app.state.library!.liked!.songs.length)
  })

  it('没登录时放着已下载的歌关掉 App：再打开时恢复播放队列和进度，停着等按播放', async () => {
    const device = world.device()
    const signedIn = await signInWithLiked(device)
    const first = await download(device, signedIn.app, FIRST)
    const second = await download(device, signedIn.app, SECOND)
    await world.netease.reply('login/logout.json')
    await signedIn.app.logout()
    await world.settle()
    signedIn.app.play(DOWNLOADS, first.id)
    await world.settle()
    const player = signedIn.audio.find(audio => !audio.paused)!
    player.ready(192.648)
    await world.settle()
    player.progress(42)
    await world.settle()
    signedIn.close()

    const { app } = await device.open()
    expect(app.state.session.status).toBe('signedOut')
    expect(app.state.player).toMatchObject({
      queue: [
        { song: second, source: DOWNLOADS },
        { song: first, source: DOWNLOADS },
      ],
      current: 1,
      position: 42,
      status: 'paused',
    })
  })
})

describe('已下载页', () => {
  it('在已下载里搜索：歌名、歌手、专辑都搜，不分大小写和全角半角；播放全部从最前面那首放', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const first = await download(device, app, FIRST)
    const second = await download(device, app, SECOND)

    expect(app.searchDownloads('laura')).toEqual([second])
    expect(app.searchDownloads('山岡')).toEqual([second])
    expect(app.searchDownloads('ＳＩＬＥＮＴ ＨＩＬＬ')).toEqual([second])
    expect(app.searchDownloads('夏に')).toEqual([first])
    expect(app.searchDownloads('没有这首')).toEqual([])
    expect(app.searchDownloads(' ')).toEqual([second, first])

    app.playAll(DOWNLOADS)
    await world.settle()
    expect(current(app)).toBe(second.id)
    expect(app.state.player.queue.map(entry => entry.source)).toEqual([DOWNLOADS, DOWNLOADS])
  })
})

describe('下载时多存的歌曲信息（#79）', () => {
  it('歌曲信息里有第几首、碟号、别名、译名、发行时间；下载时顺手取专辑信息（专辑歌手、歌曲数、发行日期、发行公司），和下载存在一起', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, VILLAGE.fightOrFlight.id)
    expect(song).toMatchObject({
      trackNumber: 6,
      disc: '1',
      aliases: [],
      translations: [],
      publishedAt: 1441900800007,
    })
    await serve(device, song, VILLAGE.fightOrFlight.downloadUrl)
    await world.netease.reply(VILLAGE.fightOrFlight.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(VILLAGE.page)

    app.download(song)
    await world.settle()

    expect(device.requests.map(request => request.path)).toContain(`/api/albums/${VILLAGE.id}`)
    const [stored] = await storedDownloads(device)
    expect(stored.song).toEqual(song)
    expect(stored.album).toMatchObject({
      id: VILLAGE.id,
      artist: { name: 'Stereophonics' },
      songCount: 10,
      publishedAt: 1441900800000,
      company: '华纳音乐',
    })
  })

  it('同一批下载里同一张专辑只取一次：两首一起下，专辑页只要一次，两首都存上这份专辑信息', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    for (const recorded of [VILLAGE.fightOrFlight, VILLAGE.sunny]) {
      await serve(device, likedSong(app, recorded.id), recorded.downloadUrl)
      await world.netease.reply(recorded.downloadUrl, {
        when: { id: recorded.id },
      })
      await world.netease.reply(LYRICS)
    }
    await world.netease.reply(VILLAGE.page)

    app.download(likedSong(app, VILLAGE.fightOrFlight.id))
    app.download(likedSong(app, VILLAGE.sunny.id))
    await world.settle()

    expect(world.netease.calls.filter(call => call.module === 'album').map(call => call.query)).toEqual([
      { id: VILLAGE.id },
    ])
    expect(app.state.downloads.songs).toHaveLength(2)
    expect((await storedDownloads(device)).map(stored => stored.album?.company)).toEqual(['华纳音乐', '华纳音乐'])
  })

  it('专辑取不到（网易云说没有这张专辑）时照常下载，只是少专辑信息', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, VILLAGE.fightOrFlight.id)
    await serve(device, song, VILLAGE.fightOrFlight.downloadUrl)
    await world.netease.reply(VILLAGE.fightOrFlight.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)

    app.download(song)
    await world.settle()

    expect(app.state.downloads.songs).toEqual([song])
    const [stored] = await storedDownloads(device)
    expect(stored.album).toBeNull()
  })

  it('这台设备上有这张专辑的专辑页时不再取，用专辑页里的', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    await world.netease.reply(VILLAGE.page)
    await app.openAlbum(VILLAGE.id)
    const song = likedSong(app, VILLAGE.fightOrFlight.id)
    await serve(device, song, VILLAGE.fightOrFlight.downloadUrl)
    await world.netease.reply(VILLAGE.fightOrFlight.downloadUrl)
    await world.netease.reply(LYRICS)

    app.download(song)
    await world.settle()

    expect(world.netease.calls.filter(call => call.module === 'album')).toHaveLength(1)
    const [stored] = await storedDownloads(device)
    expect(stored.album).toMatchObject({ id: VILLAGE.id, company: '华纳音乐' })
  })
})

/** 网易云回打卡成功：#38 在真账号上打的一次，播放来源是 download、sourceid 0，18.8 分钟后计入了听歌排行 */
const CHECK_IN = 'playback/downloads/001-scrobble.json.gz'

describe('听歌打卡', () => {
  it('登录着从已下载放的歌听完了照常打卡：播放来源是已下载，网易云收到的来源是 download、编号 0', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const first = await download(device, app, FIRST)
    await download(device, app, SECOND)

    app.play(DOWNLOADS, first.id)
    await world.settle()
    tab.audio.find(audio => !audio.paused)!.ready(192.648)
    await world.settle()
    await world.clock.advance(30_000)
    await world.netease.reply(CHECK_IN)
    app.next()
    await world.settle()

    expect(checkIns(device)).toEqual([
      {
        songId: first.id,
        body: { source: DOWNLOADS, seconds: 30 },
      },
    ])
    expect(world.netease.calls.filter(call => call.module === 'scrobble').map(call => call.query)).toEqual([
      {
        id: first.id,
        sourceid: 0,
        source: 'download',
        time: 30,
      },
    ])
  })

  it('没登录时放已下载的歌不打卡；放到一半登录了，接着放，这首登录前听的秒数不补记，登录后听的照常打卡', async () => {
    const device = world.device()
    const tab = await signInWithLiked(device)
    const { app } = tab
    const first = await download(device, app, FIRST)
    const second = await download(device, app, SECOND)
    await world.netease.reply('login/logout.json')
    await app.logout()
    await world.settle()

    // 已下载里第二首下得晚，排在前面
    app.play(DOWNLOADS, second.id)
    await world.settle()
    const player = tab.audio.find(audio => !audio.paused)!
    player.ready(240.413)
    await world.settle()
    await world.clock.advance(40_000)
    app.next()
    await world.settle()
    tab.audio.find(audio => audio !== player)!.ready(192.648)
    await world.settle()
    expect(current(app)).toBe(first.id)
    expect(await storedCheckIns(device)).toEqual([])

    await world.clock.advance(25_000)
    await replyLibrary({
      through: 'hearts',
      until: never(),
    })
    await signIn(world, app)
    await world.settle()
    expect(current(app)).toBe(first.id)
    expect(app.state.player.status).toBe('playing')

    await world.clock.advance(15_000)
    await world.netease.reply(CHECK_IN)
    app.next()
    await world.settle()
    expect(checkIns(device)).toEqual([
      {
        songId: first.id,
        body: { source: DOWNLOADS, seconds: 15 },
      },
    ])
    expect(await storedCheckIns(device)).toEqual([])
  })
})

describe('整批下载（#39，规则⑦⑧⑪⑫）', () => {
  it('整张歌单：跳过已下载、试听、无版权并逐项说明；排队、下载中、完成各自记着；每首记下从哪张歌单、专辑来的', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const first = await download(device, app, FIRST)
    const second = likedSong(app, SECOND.id)
    const third = likedSong(app, THIRD.id)
    const trial = likedSong(app, TRIAL)
    const noCopyright = likedSong(app, NO_COPYRIGHT)
    await serve(device, second, SECOND.downloadUrl)
    await serve(device, third, THIRD.downloadUrl)
    const secondAudio = await audioOf(SECOND.downloadUrl)
    const transfer = held()
    device.files.next(secondAudio.url, { until: transfer.until })
    await world.netease.reply(SECOND.downloadUrl)
    await world.netease.reply(THIRD.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)
    await world.netease.reply(ALBUM_MISSING)

    const source = { kind: 'playlist', id: LIKED.id, name: '我喜欢的音乐' } as const
    const outcome = await app.downloadSongs([
      first,
      second,
      third,
      trial,
      noCopyright,
    ], source)
    expect(outcome).toEqual({
      queued: 2,
      downloaded: 1,
      trial: 1,
      noCopyright: 1,
    })
    await world.settle()
    expect(app.state.library?.notice).toEqual({
      kind: 'downloadsAdded',
      queued: 2,
      downloaded: 1,
      trial: 1,
      noCopyright: 1,
    })
    expect([
      ...app.state.downloads.tasks.keys(),
    ]).toEqual([SECOND.id, THIRD.id])
    expect(app.state.downloads.tasks.get(SECOND.id)).toMatchObject({
      status: 'downloading',
      received: Math.floor(secondAudio.size / 2),
      total: secondAudio.size,
      sources: [source],
    })
    expect(app.state.downloads.tasks.get(THIRD.id)).toEqual({
      status: 'queued',
      song: third,
      sources: [source],
      received: 0,
      total: null,
    })

    transfer.release()
    await world.settle()
    expect(app.state.downloads.tasks.size).toBe(0)
    expect(app.state.downloads.has(SECOND.id)).toBe(true)
    expect(app.state.downloads.has(THIRD.id)).toBe(true)

    const stored = await storedDownloads(device)
    const sourcesOf = (songId: number) => stored.find(record => record.song.id === songId)!.sources
    expect(sourcesOf(FIRST.id)).toEqual([
      { kind: 'single' },
      source,
    ])
    expect(sourcesOf(SECOND.id)).toEqual([source])
    expect(sourcesOf(THIRD.id)).toEqual([source])

    // 已经下载过的再从专辑点下载：只补来源，不再下一次（规则⑦）
    const album = { kind: 'album', id: VILLAGE.id, name: 'Keep The Village Alive' } as const
    expect(await app.downloadSongs([second], album)).toEqual({
      queued: 0,
      downloaded: 1,
      trial: 0,
      noCopyright: 0,
    })
    expect((await storedDownloads(device)).find(record => record.song.id === SECOND.id)!.sources).toEqual([source, album])
  })

  it('整张专辑：专辑页的曲目全部进队列，每首记下专辑来源；空间不够就整队暂停，一首都没开始', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    await world.netease.reply(VILLAGE.page)
    await app.openAlbum(VILLAGE.id)
    await world.settle()
    const opened = app.state.library?.albumPage(VILLAGE.id)
    if (opened?.status !== 'shown')
      throw new Error(`专辑页没打开：${JSON.stringify(opened)}`)
    const album = {
      kind: 'album',
      id: VILLAGE.id,
      name: opened.content.album.name,
    } as const
    // 一点空间都没有：整队暂停，连下载地址都不取（规则⑪）
    device.storage.quota = 0

    const outcome = await app.downloadAlbum(VILLAGE.id)
    expect(outcome).toMatchObject({
      queued: opened.content.songs.filter(song => song.availability === 'full').length,
    })
    await world.settle()
    expect(app.state.downloads.paused).toBe('storageFull')
    expect(app.state.downloads.tasks.size).toBe(opened.content.songs.filter(song => song.availability === 'full').length)
    expect([
      ...app.state.downloads.tasks.values(),
    ].every(task => JSON.stringify(task.sources) === JSON.stringify([album]))).toBe(true)
    expect(app.state.library?.notice).toEqual({ kind: 'downloadsPaused' })
    expect(app.state.library?.noticeActions).toContain('resume')
    expect(downloadUrlRequests(device)).toEqual([])
  })

  it('断网中断后联网自动重新排队，从断点接着下，不从头下', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, LOSER.id)
    serveLoser(device)
    const transfer = held()
    device.files.next(LOSER.audio, { until: transfer.until, cut: true })
    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)

    app.download(song)
    await world.settle()
    expect(app.state.downloads.tasks.get(LOSER.id)).toMatchObject({ status: 'downloading' })

    device.setOnline(false)
    transfer.release()
    await world.settle()
    expect(app.state.online).toBe(false)
    expect(app.state.downloads.tasks.get(LOSER.id)).toMatchObject({
      status: 'queued',
      received: Math.floor(LOSER.bytes / 2),
      total: LOSER.bytes,
    })
    expect(app.state.downloads.tasks.get(LOSER.id)?.status).not.toBe('failed')
    expect(await storedDownloads(device)).toEqual([])

    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)
    device.setOnline(true)
    await world.settle()

    expect(audioStarts(device, LOSER.audio)).toEqual([
      0,
      Math.floor(LOSER.bytes / 2),
    ])
    expect(app.state.downloads.tasks.size).toBe(0)
    const [stored] = await storedDownloads(device)
    expect(stored.audio).toMatchObject({ size: LOSER.bytes, type: 'audio/mpeg' })
    expect(app.state.downloads.songs).toEqual([song])
  })

  it('服务器不支持分段请求、回了整份文件：之前收到的作废，从头收一遍，文件不重复也不缺', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, LOSER.id)
    serveLoser(device)
    const transfer = held()
    device.files.next(LOSER.audio, { until: transfer.until, cut: true })
    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)

    app.download(song)
    await world.settle()
    device.setOnline(false)
    transfer.release()
    await world.settle()
    expect(app.state.downloads.tasks.get(LOSER.id)).toMatchObject({
      status: 'queued',
      received: Math.floor(LOSER.bytes / 2),
    })

    // 这次音频服务器不认 Range：回整份文件，App 把断点丢掉、从头收
    device.files.put(LOSER.audio, {
      bytes: LOSER.bytes,
      type: 'audio/mpeg',
      ranges: false,
    })
    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)
    device.setOnline(true)
    await world.settle()

    expect(audioStarts(device, LOSER.audio)).toEqual([
      0,
      Math.floor(LOSER.bytes / 2),
    ])
    const [stored] = await storedDownloads(device)
    expect(stored.audio).toMatchObject({ size: LOSER.bytes, type: 'audio/mpeg' })
    expect(app.state.downloads.songs).toEqual([song])
  })

  it('存储空间不够：整队暂停、只提示一次，腾出空间点“继续下载”后从断点接着下', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const song = likedSong(app, LOSER.id)
    serveLoser(device)
    const transfer = held()
    device.files.next(LOSER.audio, { until: transfer.until, cut: true })
    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)

    app.download(song)
    await world.settle()
    device.setOnline(false)
    transfer.release()
    await world.settle()
    expect(app.state.downloads.tasks.get(LOSER.id)).toMatchObject({
      status: 'queued',
      received: Math.floor(LOSER.bytes / 2),
    })

    // 联网了，但一点空间都没有：先暂停整队，不要下载地址、不要开始传
    device.storage.quota = 0
    const requested = downloadUrlRequests(device).length
    device.setOnline(true)
    await world.settle()
    expect(app.state.downloads.paused).toBe('storageFull')
    expect(app.state.library?.notice).toEqual({ kind: 'downloadsPaused' })
    expect(app.state.library?.noticeActions).toContain('resume')
    expect(downloadUrlRequests(device)).toHaveLength(requested)

    // 腾出空间，点“继续下载”：用同一条下载地址从断点接着下
    device.storage.quota = Number.MAX_SAFE_INTEGER
    await world.netease.reply(LOSER.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)
    app.resumeDownloads()
    await world.settle()
    expect(app.state.downloads.paused).toBeNull()
    expect(app.state.library?.notice).toBeNull()
    expect(audioStarts(device, LOSER.audio)).toEqual([
      0,
      Math.floor(LOSER.bytes / 2),
    ])
    expect(app.state.downloads.songs).toEqual([song])
  })

  it('退出登录时正在下的那首继续下完；排队中的留着，新账号登录后才去取地址，拿不到完整音频的标失败并说明原因（规则⑧）', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const first = likedSong(app, FIRST.id)
    const second = likedSong(app, SECOND.id)
    const third = likedSong(app, THIRD.id)
    for (const recorded of [FIRST, SECOND, THIRD])
      await serve(device, likedSong(app, recorded.id), recorded.downloadUrl)
    const firstAudio = await audioOf(FIRST.downloadUrl)
    const transfer = held()
    device.files.next(firstAudio.url, { until: transfer.until })
    await world.netease.reply(FIRST.downloadUrl)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)

    app.download(first)
    app.download(second)
    app.download(third)
    await world.settle()
    expect(app.state.downloads.tasks.get(FIRST.id)).toMatchObject({ status: 'downloading' })
    expect(app.state.downloads.tasks.get(SECOND.id)).toMatchObject({ status: 'queued' })
    expect(app.state.downloads.tasks.get(THIRD.id)).toMatchObject({ status: 'queued' })
    const requested = downloadUrlRequests(device)

    await world.netease.reply('login/logout.json')
    await app.logout()
    await world.settle()
    expect(app.state.session.status).toBe('signedOut')
    expect(app.state.downloads.tasks.size).toBe(3)
    expect(downloadUrlRequests(device)).toEqual(requested)

    // 地址已经拿到：退出后照样下完
    transfer.release()
    await world.settle()
    expect(app.state.downloads.has(FIRST.id)).toBe(true)
    expect(app.state.downloads.tasks.has(SECOND.id)).toBe(true)
    expect(app.state.downloads.tasks.has(THIRD.id)).toBe(true)

    // 换另一个账号：排队中的用新登录去取地址；第三首这个账号下不了完整的
    await replyLibrary({
      through: 'hearts',
      until: never(),
    })
    await world.netease.reply(SECOND.downloadUrl)
    await world.netease.reply('playback/downloads/005-song_download_url_v1.no-full-audio.constructed.json')
    await world.netease.reply(LYRICS)
    await world.netease.reply(LYRICS)
    await world.netease.reply(ALBUM_MISSING)
    await world.netease.reply(ALBUM_MISSING)
    await signIn(world, app, { another: true })
    await world.settle()

    expect(app.state.session).toMatchObject({ status: 'signedIn' })
    expect(app.state.downloads.has(SECOND.id)).toBe(true)
    expect(app.state.downloads.tasks.get(THIRD.id)).toMatchObject({
      status: 'failed',
      failure: { kind: 'unavailable' },
      sources: [
        { kind: 'single' },
      ],
    })
    const loginAt = device.requests.findLastIndex(request => request.path === '/api/login/sms')
    const secondUrlAt = device.requests.findIndex(request => request.path.includes(`/api/songs/${SECOND.id}/download-url`))
    expect(secondUrlAt).toBeGreaterThan(loginAt)
  })

  it('歌单还没同步完就下载整张：先把已经同步的放进队列，同步完把后面的补上（规则⑫）', async () => {
    const device = world.device()
    await world.netease.reply(HEARTS)
    await world.netease.reply(PLAYLISTS_WITH_POEMS)
    await world.netease.reply(COLLECTED_ALBUMS)
    await world.netease.reply(COLLECTED_ARTISTS)
    await world.netease.reply(LIKED_TRACK_IDS)
    const page2 = held()
    for (const page of [1, 2, 3, 4, 5]) {
      await world.netease.reply(likedPage(page), page === 2
        ? { until: page2.until }
        : {})
    }
    const tab = await device.open()
    await signIn(world, tab.app)
    await world.settle()
    const { app } = tab
    expect(app.state.library?.liked).toMatchObject({ complete: false })
    const synced = app.state.library!.liked!.songs
    expect(synced.length).toBeGreaterThan(0)
    expect(synced.length).toBeLessThan(4984)

    // 一点空间都没有：队列一进来就暂停，不会有任何下载请求
    device.storage.quota = 0
    await app.downloadPlaylist(900000001)
    await world.settle()
    const fullSynced = synced.filter(song => song.availability === 'full').length
    expect(app.state.downloads.paused).toBe('storageFull')
    expect(app.state.downloads.tasks.size).toBe(fullSynced)
    expect([
      ...app.state.downloads.tasks.values(),
    ][0]?.sources).toEqual([
      {
        kind: 'playlist',
        id: 900000001,
        name: '我喜欢的音乐',
      },
    ])

    // 同步完：后面的歌继续补进同一个队列，暂停着的也照样补
    const queuedBefore = app.state.downloads.tasks.size
    page2.release()
    await world.settle()
    expect(app.state.library?.liked).toMatchObject({ complete: true })
    const all = app.state.library!.liked!.songs
    expect(all.length).toBeGreaterThan(synced.length)
    expect(app.state.downloads.tasks.size).toBe(all.filter(song => song.availability === 'full').length)
    expect(app.state.downloads.tasks.size).toBeGreaterThan(queuedBefore)
    expect(app.state.downloads.paused).toBe('storageFull')
    expect(device.requests.filter(request => request.path.includes('/download-url'))).toEqual([])
  })

  it('弹窗只选一部分：不同步补上剩下的（fill 为 false）', async () => {
    const device = world.device()
    await world.netease.reply(HEARTS)
    await world.netease.reply(PLAYLISTS_WITH_POEMS)
    await world.netease.reply(COLLECTED_ALBUMS)
    await world.netease.reply(COLLECTED_ARTISTS)
    await world.netease.reply(LIKED_TRACK_IDS)
    const page2 = held()
    for (const page of [1, 2, 3, 4, 5]) {
      await world.netease.reply(likedPage(page), page === 2
        ? { until: page2.until }
        : {})
    }
    const tab = await device.open()
    await signIn(world, tab.app)
    await world.settle()
    const { app } = tab
    expect(app.state.library?.liked).toMatchObject({ complete: false })
    const synced = app.state.library!.liked!.songs
    const chosen = synced.filter(song => song.availability === 'full').slice(0, 1)
    expect(chosen).toHaveLength(1)

    device.storage.quota = 0
    await app.downloadPlaylist(900000001, chosen, { fill: false })
    await world.settle()
    expect(app.state.downloads.tasks.size).toBe(1)

    // 后面的歌同步进来，但没有设置“已加载全选”，所以不补
    page2.release()
    await world.settle()
    expect(app.state.library?.liked).toMatchObject({ complete: true })
    expect(app.state.downloads.tasks.size).toBe(1)
  })
})
