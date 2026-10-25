import { describe, expect, it } from 'vitest'

import type { Song } from '#lib/api/library.js'
import type { App } from '#lib/app/app.js'

import { listener } from './harness/listener'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInAtHearts, signInAtLikedTracks, signInSynced, dailySongs, openJazz } = listener(world)

// 加入歌单的目标和不可选理由（#73，GLOSSARY“加入歌单”，Spec #11 多选 · #98）：单曲时我喜欢的音乐在最前，然后是自建歌单，当前歌单、已红心、已在歌单里写明理由；多选时只有当前歌单以外的自建歌单，不含我喜欢的音乐和收藏的歌单（红心只能一首一首点）。规则只在 App 里，界面照着答案画（走 World / Device 的 App 接入点）。
const LIKED_ID = 900000001
const JAZZ_ID = 900000002
/** jazz 的两个曲目编号：录制里没有它们的歌曲信息（列表里只有编号） */
const JAZZ_TRACKS = [2066710146, 1828149330]
const ADD = 'playlist-edit/playlist_tracks.add.json'
const LIKE = 'like-collect/like.like.json'

const ownIds = (app: App): number[] => app.state.library?.playlists?.filter(playlist => playlist.kind === 'own').map(playlist => playlist.id) ?? []

describe('加入歌单的目标和理由', () => {
  it('单曲：我喜欢的音乐在最前；当前歌单、已红心、已在歌单里各写明理由', async () => {
    const device = world.device()
    const { app } = await signInSynced(device)
    const [song] = await dailySongs(app)

    const rows = app.addTargets({ mode: 'song', song, currentPlaylistId: JAZZ_ID })
    expect(rows).not.toBeNull()

    expect(rows![0]).toMatchObject({
      id: LIKED_ID,
      kind: 'liked',
      total: app.state.library?.liked?.total,
      blocked: null,
    })
    expect(rows!.slice(1).every(target => target.kind === 'own')).toBe(true)
    expect(rows!.filter(target => target.kind === 'own').map(target => target.id)).toEqual(ownIds(app))

    expect(rows!.find(target => target.id === JAZZ_ID)).toMatchObject({ kind: 'own', blocked: 'currentPlaylist' })

    const other = rows!.find(target => target.kind === 'own' && target.blocked === null)
    expect(other).toBeTruthy()
    const before = other!.total
    await world.netease.reply(ADD)
    await app.addToPlaylist(other!.id, song)
    const afterAdd = app.addTargets({ mode: 'song', song, currentPlaylistId: JAZZ_ID })
    const added = afterAdd!.find(target => target.id === other!.id)
    expect(added).toMatchObject({ blocked: 'alreadyInPlaylist' })
    expect(added!.total).toBe(before! + 1)
    expect(added!.total).toBe(app.state.library?.songsOf(other!.id)?.total ?? -1)

    await world.netease.reply(LIKE)
    await app.heart(song, true)
    const afterHeart = app.addTargets({ mode: 'song', song, currentPlaylistId: JAZZ_ID })
    expect(afterHeart!.find(target => target.id === LIKED_ID)).toMatchObject({ blocked: 'alreadyHearted' })
  })

  it('已在歌单里按基线看歌曲信息：只有曲目编号、信息还没取到时仍显示可加', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: false })
    const song: Song = {
      id: JAZZ_TRACKS[0]!,
      name: 'jazz 曲目',
      artists: [],
      album: { id: 0, name: '测试专辑', coverUrl: '' },
      duration: 1,
      downloadSize: null,
      availability: 'full',
      trackNumber: null,
      disc: null,
      aliases: [],
      translations: [],
      publishedAt: null,
    }

    const rows = app.addTargets({ mode: 'song', song, currentPlaylistId: null })
    expect(rows!.find(target => target.id === JAZZ_ID)).toMatchObject({ blocked: null })
  })

  it('多选：目标只有当前歌单以外的自建歌单，不含我喜欢的音乐和收藏的歌单', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    const rows = app.addTargets({ mode: 'multi', currentPlaylistId: JAZZ_ID })
    expect(rows).not.toBeNull()
    expect(rows!.map(target => target.id)).toEqual(ownIds(app).filter(id => id !== JAZZ_ID))
    expect(rows!.every(target => target.kind === 'own' && target.blocked === null)).toBe(true)
    expect(rows!.map(target => target.id)).not.toContain(LIKED_ID)

    expect(rows!.every(target => target.total === (app.state.library?.songsOf(target.id)?.total ?? -1))).toBe(true)
  })

  it('歌单列表还没同步到：两个模式都不给目标', async () => {
    const device = world.device()
    const { app } = await signInAtHearts(device)
    const song: Song = {
      id: 1,
      name: '测试歌曲',
      artists: [],
      album: { id: 0, name: '测试专辑', coverUrl: '' },
      duration: 1,
      downloadSize: null,
      availability: 'full',
      trackNumber: null,
      disc: null,
      aliases: [],
      translations: [],
      publishedAt: null,
    }

    expect(app.state.library?.playlists).toBeNull()
    expect(app.addTargets({ mode: 'song', song, currentPlaylistId: null })).toBeNull()
    expect(app.addTargets({ mode: 'multi', currentPlaylistId: JAZZ_ID })).toBeNull()
  })
})
