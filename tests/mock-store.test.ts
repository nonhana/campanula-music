import { beforeEach, describe, expect, it } from 'vitest'

import { buildSeed, FOUR_PLAYABLE_PLAYLIST, LIKED_PLAYLIST, POEMS_PLAYLIST } from '../src/lib/server/mock/seed.ts'
import { MockStore } from '../src/lib/server/mock/store.ts'

// mock 的状态化曲库：种子从录制拼出来，写改状态、读回能看到，reset 回种子。
const store = new MockStore('before')

const playlists = async () => (await store.userPlaylist()).playlist as { id: number, name: string, trackCount: number, trackIds: { id: number }[], privacy: number, status: number }[]

describe('mock 曲库', () => {
  beforeEach(async () => {
    await store.reset('before')
  })

  it('种子：54 张录制歌单 + 4 首可播放歌单，4,984 首红心，poems 2 首', async () => {
    const seed = await buildSeed('before')
    expect(seed.playlists).toHaveLength(55)
    expect(seed.liked.size).toBe(4984)
    expect(seed.songs.size).toBeGreaterThan(4000)
    expect(seed.details.get(POEMS_PLAYLIST)?.playlist.trackIds).toHaveLength(2)
    expect(seed.details.get(FOUR_PLAYABLE_PLAYLIST)?.playlist.trackIds).toHaveLength(4)
    expect(seed.details.get(LIKED_PLAYLIST)?.playlist.trackIds).toHaveLength(4984)
    expect(seed.byId.get(LIKED_PLAYLIST)?.trackCount).toBe(4984)
  }, 30_000)

  it('改名、简介、标签、隐私、封面改完，歌单列表和详情都看得到', async () => {
    const id = 900000019
    await store.renamePlaylist(id, '改过的名字')
    await store.describePlaylist(id, '改过的简介')
    await store.tagPlaylist(id, ['华语', '流行'])
    await store.publishPlaylist(id)
    await store.setCover(id, '/mock-assets/uploads/1')
    const detail = await store.playlistDetail(id)
    expect(detail?.playlist.name).toBe('改过的名字')
    expect(detail?.playlist.description).toBe('改过的简介')
    expect(detail?.playlist.tags).toEqual(['华语', '流行'])
    expect(detail?.playlist.privacy).toBe(0)
    expect(detail?.playlist.coverImgUrl).toBe('/mock-assets/uploads/1')
    expect((await playlists()).find(item => item.id === id)?.name).toBe('改过的名字')
  })

  it('加歌、移除、排序改的是同一份歌单，重复加报重复，删掉的歌单报不存在', async () => {
    const id = 900000019
    const song = 3433267939
    expect(await store.addTracks(id, [song])).toEqual(expect.objectContaining({ ok: true }))
    expect((await store.playlistDetail(id))?.playlist.trackIds.map(track => track.id)).toContain(song)
    expect(await store.addTracks(id, [song])).toEqual(expect.objectContaining({ ok: false, status: 502 }))
    expect(await store.removeTracks(id, [song])).toEqual(expect.objectContaining({ ok: true }))
    expect((await store.playlistDetail(id))?.playlist.trackIds.map(track => track.id)).not.toContain(song)
    const detail = await store.playlistDetail(900000002)
    const order = detail!.playlist.trackIds.map(track => track.id).reverse()
    await store.orderTracks(900000002, order)
    expect((await store.playlistDetail(900000002))?.playlist.trackIds.map(track => track.id)).toEqual(order)
    await store.deletePlaylist(900000002)
    expect(await store.addTracks(900000002, [song])).toEqual(expect.objectContaining({ ok: false, status: 404 }))
  })

  it('新建的歌单是空的，排在我喜欢的音乐后面；红心改我喜欢的音乐和 likelist', async () => {
    const created = await store.createPlaylist('测试新建', 10)
    expect(created.ok).toBe(true)
    const createdId = (created.body as { id: number }).id
    const list = await playlists()
    expect(list.some(item => item.id === createdId && item.trackCount === 0)).toBe(true)
    const before = (await store.likelist()).ids as number[]
    const seed = await buildSeed('before')
    const song = [
      ...seed.songs.keys(),
    ].find(id => !seed.liked.has(id))!
    await store.heart(song, true)
    expect((await store.likelist()).ids as number[]).toContain(song)
    expect((await store.playlistDetail(LIKED_PLAYLIST))?.playlist.trackIds.map(track => track.id)).toContain(song)
    await store.heart(song, false)
    expect((await store.likelist()).ids as number[]).not.toContain(song)
    expect((await store.likelist()).ids as number[]).toHaveLength(before.length)
  })

  it('取消收藏专辑、歌手后再收藏，又回到列表里', async () => {
    const seed = await buildSeed('before')
    const albumId = (seed.albums[0] as { id: number }).id
    const artistId = (seed.artists[0] as { id: number }).id
    await store.collectAlbum(albumId, false)
    expect(((await store.albumSublist()).data as { id: number }[]).some(album => album.id === albumId)).toBe(false)
    await store.collectAlbum(albumId, true)
    expect(((await store.albumSublist()).data as { id: number }[]).some(album => album.id === albumId)).toBe(true)
    await store.collectArtist(artistId, false)
    expect(((await store.artistSublist()).data as { id: number }[]).some(artist => artist.id === artistId)).toBe(false)
    await store.collectArtist(artistId, true)
    expect(((await store.artistSublist()).data as { id: number }[]).some(artist => artist.id === artistId)).toBe(true)
  }, 30_000)

  it('reset 回到种子：写过的都没了', async () => {
    await store.renamePlaylist(900000019, '临时名字')
    await store.reset('before')
    expect((await store.playlistDetail(900000019))?.playlist.name).toBe('poems')
    expect(await playlists()).toHaveLength(55)
  })

  it('after 种子：poems 3 首；deleted 种子：没有 poems', async () => {
    await store.reset('after')
    expect((await store.playlistDetail(POEMS_PLAYLIST))?.playlist.trackIds).toHaveLength(3)
    expect((await playlists()).find(item => item.id === POEMS_PLAYLIST)?.trackCount).toBe(3)
    await store.reset('deleted')
    expect((await store.playlistDetail(POEMS_PLAYLIST))?.playlist.status).toBe(10)
    expect((await playlists()).some(item => item.id === POEMS_PLAYLIST)).toBe(false)
  })
})
