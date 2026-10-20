import { beforeEach, describe, expect, it } from 'vitest'
import { configure, coverage, invokeModule, loginCredentials, reset } from '../src/lib/server/mock/runtime.ts'
import { validateBody } from './harness/schemas'

// mock 的 SDK 边界：读走录制和状态，写改状态，没覆盖的明确失败；返回体都要过 SDK 的结构定义。
const { credentials } = loginCredentials()
const cookie = { cookie: credentials }

describe('mock SDK 边界', () => {
  beforeEach(async () => {
    await reset()
  })

  it('账号、歌单、红心、曲目、播放地址都从录制和状态里来', async () => {
    const account = await invokeModule('user_account', {}, cookie)
    await validateBody('UserAccountBody', account.body)
    expect((account.body as { profile?: { userId?: number } }).profile?.userId).toBe(10000001)

    const list = await invokeModule('user_playlist', { uid: 10000001, limit: 1000 }, cookie)
    await validateBody('UserPlaylistBody', list.body)
    expect((list.body as { playlist: unknown[] }).playlist).toHaveLength(55)

    const poems = await invokeModule('playlist_detail', { id: 900000019 }, cookie)
    await validateBody('PlaylistDetailBody', poems.body)
    expect((poems.body as { playlist: { trackIds: unknown[] } }).playlist.trackIds).toHaveLength(2)

    const hearts = await invokeModule('likelist', { uid: 10000001 }, cookie)
    await validateBody('LikelistBody', hearts.body)
    expect((hearts.body as { ids: unknown[] }).ids).toHaveLength(4984)

    const songs = await invokeModule('song_detail', { ids: '3433267939,2662577181' }, cookie)
    await validateBody('SongDetailBody', songs.body)
    expect((songs.body as { songs: unknown[] }).songs).toHaveLength(2)

    const captcha = await invokeModule('captcha_sent', { ctcode: '86', phone: '13800000000' }, cookie)
    expect((captcha.body as { code: number }).code).toBe(200)

    const search = await invokeModule('cloudsearch', { keywords: '夜に駆ける', type: 1, limit: 30, offset: 0 }, cookie)
    await validateBody('CloudsearchBody', search.body)
    expect(((search.body as { result: { songs: unknown[] } }).result.songs)).toHaveLength(30)

    const url = await invokeModule('song_url_v1', { id: 3433267939, level: 'exhigh' }, cookie)
    await validateBody('SongUrlV1Body', url.body)
    const data = (url.body as { data: { url: string }[] }).data[0]!
    expect(data.url).toBe('/mock-assets/audio/3433267939.wav')
  })

  it('外部地址全部换成本地资源，返回体里没有网易云域名', async () => {
    for (const [module, query, name] of [
      ['user_playlist', { uid: 10000001, limit: 1000 }, 'UserPlaylistBody'],
      ['playlist_detail', { id: 900000019 }, 'PlaylistDetailBody'],
      ['cloudsearch', { keywords: '真夜中', type: 1, limit: 30, offset: 0 }, 'CloudsearchBody'],
    ] as const) {
      const result = await invokeModule(module, query, cookie)
      await validateBody(name, result.body)
      const text = JSON.stringify(result.body)
      expect(text).not.toMatch(/music\.126\.net|127\.net|163\.com|netease\.com/)
    }
  })

  it('写操作改状态，刷新后还能读到；reset 回种子', async () => {
    await invokeModule('playlist_name_update', { id: 900000019, name: '改过的名字' }, cookie)
    expect(((await invokeModule('playlist_detail', { id: 900000019 }, cookie)).body as { playlist: { name: string } }).playlist.name).toBe('改过的名字')

    const added = await invokeModule('playlist_tracks', { op: 'add', pid: 900000019, tracks: '3433267939' }, cookie)
    await validateBody('PlaylistTracksBody', added.body)
    expect(((await invokeModule('playlist_detail', { id: 900000019 }, cookie)).body as { playlist: { trackIds: { id: number }[] } }).playlist.trackIds.map(track => track.id)).toContain(3433267939)

    await invokeModule('like', { id: 910000101, like: true }, cookie)
    expect(((await invokeModule('likelist', { uid: 10000001 }, cookie)).body as { ids: number[] }).ids).toContain(910000101)

    await reset()
    expect(((await invokeModule('playlist_detail', { id: 900000019 }, cookie)).body as { playlist: { name: string } }).playlist.name).toBe('poems')
  })

  it('没覆盖的模块和查询明确失败，并记进覆盖报告', async () => {
    await expect(invokeModule('not_a_module', {}, cookie)).rejects.toMatchObject({ status: 500 })
    await expect(invokeModule('cloudsearch', { keywords: '没录过', type: 1, limit: 30, offset: 0 }, cookie)).rejects.toMatchObject({ status: 500 })
    const report = await coverage()
    expect((report.misses as unknown[]).length).toBeGreaterThanOrEqual(2)
  })

  it('场景：登录失效、限流、删除、空歌单、部分同步、延迟、断网', async () => {
    await configure('login-expired')
    const account = await invokeModule('user_account', {}, cookie)
    expect((account.body as { account: unknown }).account).toBeNull()
    await expect(invokeModule('likelist', { uid: 10000001 }, cookie)).rejects.toMatchObject({ status: 301 })

    await configure('rate-limited')
    await expect(invokeModule('likelist', { uid: 10000001 }, cookie)).rejects.toMatchObject({ status: 405, body: { retryAfter: 30 } })

    await configure('deleted-playlist')
    expect(((await invokeModule('user_playlist', { uid: 10000001, limit: 1000 }, cookie)).body as { playlist: { id: number }[] }).playlist.some(item => item.id === 900000019)).toBe(false)
    expect(((await invokeModule('playlist_detail', { id: 900000019 }, cookie)).body as { playlist: { status: number } }).playlist.status).toBe(10)

    await configure('empty-playlist')
    expect(((await invokeModule('playlist_detail', { id: 900000019 }, cookie)).body as { playlist: { trackIds: unknown[] } }).playlist.trackIds).toHaveLength(0)

    await configure('partial-sync')
    await invokeModule('song_detail', { ids: '3433267939' }, cookie)
    await expect(invokeModule('song_detail', { ids: '2662577181' }, cookie)).rejects.toMatchObject({ status: 502 })

    await configure('slow')
    const started = Date.now()
    await invokeModule('likelist', { uid: 10000001 }, cookie)
    expect(Date.now() - started).toBeGreaterThanOrEqual(700)

    await configure('offline')
    await expect(invokeModule('likelist', { uid: 10000001 }, cookie)).rejects.toMatchObject({ status: 503 })
  })
})
