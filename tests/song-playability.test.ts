import { describe, expect, it } from 'vitest'

import type { Song } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'

import type { Device } from './harness/device'
import { loadFixture } from './harness/fixtures'
import { likedSong, listener, PLAYLISTS_WITH_POEMS } from './harness/listener'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInWithLiked } = listener(world, { playlists: PLAYLISTS_WITH_POEMS })

// App 接缝上“每首歌现在能不能放”和“下载那一项现在能不能选”（#74）：界面不再自己拼联网、登录和下载状态，只读 App 给的答案。下载了的总能放（ADR-0006）；没下载的要联网、登录着；无版权的不能放。准备借 #38 的下载录制：我喜欢的音乐的第 1 首能下完整音频。

const FIRST = { id: 3433267939, downloadUrl: 'playback/downloads/002-song_download_url_v1.json.gz' }
const SECOND = 2662577181
const NO_COPYRIGHT = 2108191414
const TRIAL = 2636390698
const LYRICS = 'playback/lyric_new.all-forms.json'
const COVER_BYTES = 41_000

/** 下载这一首、等它下完：录制里有下载地址、音频大小和歌词；封面缩略图按 512 取 */
const download = async (device: Device, app: App, id: number): Promise<Song> => {
  await world.clock.advance(1000)
  const song = likedSong(app, id)
  const { data } = (await loadFixture(FIRST.downloadUrl)).outcome.response.body as { data: { url: string, size: number } }
  device.files.put(data.url.replace(/^http:/, 'https:'), { bytes: data.size, type: 'audio/mpeg' })
  device.files.put(`${song.album.coverUrl!.replace(/^http:/, 'https:')}?param=512y512`, { bytes: COVER_BYTES, type: 'image/jpeg' })
  await world.netease.reply(FIRST.downloadUrl)
  await world.netease.reply(LYRICS)
  app.download(song)
  await world.settle()
  if (!app.state.downloads.has(song.id))
    throw new Error(`《${song.name}》没下完：${JSON.stringify(app.state.downloads.tasks.get(song.id))}`)
  return song
}

describe('每首歌现在能不能放：App 给出的答案', () => {
  it('在线、登录着：无版权的不能放；试听和完整都能放；下载那一项的原因也由 App 给出', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const first = likedSong(app, FIRST.id)
    const noCopyright = likedSong(app, NO_COPYRIGHT)
    const trial = likedSong(app, TRIAL)

    expect(app.state.playable(first)).toBe(true)
    expect(app.state.playable(trial)).toBe(true)
    expect(app.state.playable(noCopyright)).toBe(false)
    expect(app.state.downloadBlock(first)).toBeNull()
    expect(app.state.downloadBlock(trial)).toBe('trial')
    expect(app.state.downloadBlock(noCopyright)).toBe('noCopyright')
  })

  it('断网时只有下载过的能放；没登录时也一样，下载了的永远能放', async () => {
    const device = world.device()
    const { app } = await signInWithLiked(device)
    const first = await download(device, app, FIRST.id)
    const second = likedSong(app, SECOND)

    device.setOnline(false)
    await world.settle()
    expect(app.state.playable(first)).toBe(true)
    expect(app.state.playable(second)).toBe(false)
    expect(app.state.downloadBlock(first)).toBe('downloaded')
    expect(app.state.downloadBlock(second)).toBe('offline')

    device.setOnline(true)
    await world.netease.reply('login/logout.json')
    await app.logout()
    await world.settle()
    expect(app.state.playable(first)).toBe(true)
    expect(app.state.playable(second)).toBe(false)
    expect(app.state.downloadBlock(first)).toBe('downloaded')
    expect(app.state.downloadBlock(second)).toBe('signedOut')
  })
})
