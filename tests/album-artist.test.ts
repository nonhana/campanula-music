import type { App } from '$lib/app/app'
import type { Device } from './harness/device'
import { describe, expect, it, vi } from 'vitest'
import { signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()

// 专辑页、歌手页（#23）：听众打开时用前台请求拉。收藏的专辑打开过就存进本机副本，别的只在这次登录期间记着。
// 录制见 tests/fixtures/netease/README.md 的 #23 一条
const DIR = 'library/album-artist'
const COLLECTED_ALBUMS = `${DIR}/001-album_sublist.json.gz`
const COLLECTED_ARTISTS = `${DIR}/002-artist_sublist.json.gz`
/** 收藏的专辑里多了 THE BOOK for,（录制时成对地收藏、马上取消收藏） */
const COLLECTED_ALBUMS_WITH_THE_BOOK = `${DIR}/011-album_sublist.json.gz`
/** 收藏的专辑 */
const KEEP_THE_VILLAGE_ALIVE = { id: 3149073, fixture: `${DIR}/008-album.json.gz` }
/** 收藏的专辑，没有简介（nonhana/hana-music-api#59） */
const SOUNDTRACK = { id: 3154337, fixture: `${DIR}/009-album.json.gz` }
/** 没收藏的专辑 */
const THE_BOOK = { id: 379547126, fixture: `${DIR}/010-album.json.gz` }
/** 专辑一页就取完的歌手（65 张） */
const YOASOBI = { id: 33927412, songs: `${DIR}/003-artist_top_song.json.gz`, albums: `${DIR}/004-artist_album.json.gz` }
/** 专辑超过一页的歌手（101 张） */
const MARASY = { id: 14786, songs: `${DIR}/005-artist_top_song.json.gz`, albums: [`${DIR}/006-artist_album.json.gz`, `${DIR}/007-artist_album.json.gz`] }

const HEARTS = 'library/likelist.json'
const PLAYLISTS = 'library/sync/before/001-user_playlist.json.gz'
const LIKED_TRACK_IDS = 'library/playlist_detail.liked-full.json.gz'
/** 网易云压着不回：后台同步停在这一步 */
const never = () => new Promise<void>(() => {})

/** 登录，后台同步拿到收藏的专辑和歌手后停在我喜欢的音乐 */
async function signInUntilCollected(device: Device, albums = COLLECTED_ALBUMS): Promise<App> {
  const { app } = await device.open()
  await world.netease.reply(HEARTS)
  await world.netease.reply(PLAYLISTS)
  await world.netease.reply(albums)
  await world.netease.reply(COLLECTED_ARTISTS)
  await world.netease.reply(LIKED_TRACK_IDS, { until: never() })
  await signIn(world, app)
  await vi.waitFor(() => expect(app.state.library?.artists).not.toBeNull())
  return app
}

/** 再打开一次 App：后台同步停在红心，显示的都是本机副本 */
async function reopen(device: Device): Promise<App> {
  await world.netease.reply('login/user_account.vip.json')
  await world.netease.reply(HEARTS, { until: never() })
  const { app } = await device.open()
  return app
}

describe('专辑页', () => {
  it('打开收藏的专辑：用前台请求拉曲目、简介和发行时间，存进本机副本；再次打开 App 后歌曲数没变就不再拉，断网也能看', async () => {
    const device = world.device()
    const app = await signInUntilCollected(device)

    await world.netease.reply(KEEP_THE_VILLAGE_ALIVE.fixture)
    await app.openAlbum(KEEP_THE_VILLAGE_ALIVE.id)

    expect(world.netease.calls.at(-1)).toMatchObject({ module: 'album', query: { id: KEEP_THE_VILLAGE_ALIVE.id } })
    const page = app.state.library?.albumPage(KEEP_THE_VILLAGE_ALIVE.id)
    expect(page).toMatchObject({
      status: 'shown',
      content: {
        album: {
          id: KEEP_THE_VILLAGE_ALIVE.id,
          name: 'Keep The Village Alive',
          coverUrl: 'https://p4.music.126.net/GdQ9aQ3f3pscKhOpmIV4eA==/18345351510219723.jpg',
          artist: { id: 99995, name: 'Stereophonics' },
          publishedAt: 1441900800000,
          description: expect.stringMatching(/^＊顶著‘英伦摇滚超级救世主乐团’/),
          songCount: 10,
        },
      },
    })
    if (page?.status !== 'shown')
      throw new Error('专辑页没显示')
    expect(page.content.songs).toHaveLength(10)
    expect(page.content.songs[0]).toEqual({
      id: 32019373,
      name: 'C\'est La Vie',
      artists: [{ id: 99995, name: 'Stereophonics' }],
      album: { id: KEEP_THE_VILLAGE_ALIVE.id, name: 'Keep The Village Alive', coverUrl: 'https://p3.music.126.net/GdQ9aQ3f3pscKhOpmIV4eA==/18345351510219723.jpg' },
      duration: 220320,
    })

    const reopened = await reopen(device)
    const calls = world.netease.calls.length
    await reopened.openAlbum(KEEP_THE_VILLAGE_ALIVE.id)
    expect(world.netease.calls).toHaveLength(calls)
    expect(reopened.state.library?.albumPage(KEEP_THE_VILLAGE_ALIVE.id)).toEqual(page)

    device.setOnline(false)
    await reopened.openAlbum(KEEP_THE_VILLAGE_ALIVE.id)
    expect(reopened.state.library?.albumPage(KEEP_THE_VILLAGE_ALIVE.id)).toEqual(page)
  })

  it('没有简介的专辑照常打开，简介是空的', async () => {
    const device = world.device()
    const app = await signInUntilCollected(device)

    await world.netease.reply(SOUNDTRACK.fixture)
    await app.openAlbum(SOUNDTRACK.id)

    const page = app.state.library?.albumPage(SOUNDTRACK.id)
    expect(page).toMatchObject({ status: 'shown', content: { album: { name: '月に寄りそう乙女の作法2 COMPLETE SOUNDTRACK', description: null } } })
    expect(page?.status === 'shown' && page.content.songs).toHaveLength(37)
  })

  it('打开没收藏的专辑：这次登录再打开不再拉，但不存进本机；再次打开 App 后断网就说没拉成', async () => {
    const device = world.device()
    const app = await signInUntilCollected(device)

    await world.netease.reply(THE_BOOK.fixture)
    await app.openAlbum(THE_BOOK.id)
    expect(app.state.library?.albumPage(THE_BOOK.id)).toMatchObject({ status: 'shown', content: { album: { name: 'THE BOOK for,', artist: { name: 'YOASOBI' } } } })
    const calls = world.netease.calls.length
    await app.openAlbum(THE_BOOK.id)
    expect(world.netease.calls).toHaveLength(calls)
    expect((await device.stored()).albumPages).toEqual([])

    const reopened = await reopen(device)
    expect(reopened.state.library?.albumPage(THE_BOOK.id)).toBeNull()
    device.setOnline(false)
    await reopened.openAlbum(THE_BOOK.id)

    expect(reopened.state.library?.albumPage(THE_BOOK.id)).toEqual({ status: 'failed', failure: { kind: 'offline' } })
  })

  it('在官方 App 里取消收藏的专辑：同步拿到收藏的专辑后，本机存着的专辑页也删掉', async () => {
    const device = world.device()
    const app = await signInUntilCollected(device, COLLECTED_ALBUMS_WITH_THE_BOOK)
    await world.netease.reply(THE_BOOK.fixture)
    await app.openAlbum(THE_BOOK.id)
    expect((await device.stored()).albumPages.map(([id]) => id)).toEqual([THE_BOOK.id])

    await world.netease.reply('login/user_account.vip.json')
    await world.netease.reply(HEARTS)
    await world.netease.reply(PLAYLISTS)
    await world.netease.reply(COLLECTED_ALBUMS)
    await world.netease.reply(COLLECTED_ARTISTS)
    await world.netease.reply(LIKED_TRACK_IDS, { until: never() })
    const { app: reopened } = await device.open()
    expect(reopened.state.library?.albumPage(THE_BOOK.id)).toMatchObject({ status: 'shown' })
    await vi.waitFor(() => expect(reopened.state.library?.albums).toHaveLength(55))

    expect(reopened.state.library?.albumPage(THE_BOOK.id)).toBeNull()
    expect((await device.stored()).albumPages).toEqual([])
  })

  it('退出登录：存着的专辑页一起删掉；换账号登录后看不到上一个账号打开过的专辑页和歌手页', async () => {
    const device = world.device()
    const app = await signInUntilCollected(device)
    await world.netease.reply(KEEP_THE_VILLAGE_ALIVE.fixture)
    await app.openAlbum(KEEP_THE_VILLAGE_ALIVE.id)
    await world.netease.reply(YOASOBI.songs)
    await world.netease.reply(YOASOBI.albums)
    await app.openArtist(YOASOBI.id)
    expect((await device.stored()).albumPages).toHaveLength(1)

    await world.netease.reply('login/logout.json')
    await app.logout()
    expect((await device.stored()).albumPages).toEqual([])

    await world.netease.reply(HEARTS, { until: never() })
    await signIn(world, app, { another: true })

    expect(app.state.library?.albumPage(KEEP_THE_VILLAGE_ALIVE.id)).toBeNull()
    expect(app.state.library?.artistPage(YOASOBI.id)).toBeNull()
  })
})

describe('歌手页', () => {
  it('打开歌手：用前台请求拉头部、热门歌曲和第一页专辑（新的在前）；不存进本机，再次打开 App 后断网就说没拉成', async () => {
    const device = world.device()
    const app = await signInUntilCollected(device)

    await world.netease.reply(YOASOBI.songs)
    await world.netease.reply(YOASOBI.albums)
    await app.openArtist(YOASOBI.id)

    const sent = world.netease.calls.slice(-2).map(({ module, query }) => ({ module, query }))
    expect(sent).toHaveLength(2)
    expect(sent).toEqual(expect.arrayContaining([
      { module: 'artist_top_song', query: { id: YOASOBI.id } },
      { module: 'artist_album', query: { id: YOASOBI.id, limit: 100, offset: 0 } },
    ]))
    const page = app.state.library?.artistPage(YOASOBI.id)
    expect(page).toMatchObject({
      status: 'shown',
      content: {
        artist: { id: YOASOBI.id, name: 'YOASOBI', avatarUrl: 'https://p4.music.126.net/1f_5IU9FLWRZjAJVXu-ipA==/109951172064233940.jpg', songCount: 148, albumCount: 65 },
        moreAlbums: null,
      },
    })
    if (page?.status !== 'shown')
      throw new Error('歌手页没显示')
    expect(page.content.hotSongs).toHaveLength(50)
    expect(page.content.hotSongs[0]).toEqual({
      id: 1472480890,
      name: '群青',
      artists: [{ id: YOASOBI.id, name: 'YOASOBI' }],
      album: { id: 94214994, name: '群青', coverUrl: 'https://p3.music.126.net/sF9I_mKMVNtsCD-ZXzfV_A==/109951165251958014.jpg' },
      duration: 248444,
    })
    expect(page.content.albums).toHaveLength(65)
    expect(page.content.albums[0]).toEqual({
      id: 397364476,
      name: 'オリオン (PSYQUI Remix)',
      coverUrl: 'https://p4.music.126.net/-uZkjczBHO7g5J4NvBnlKg==/109951173908849364.jpg',
      publishedAt: 1789315200000,
    })

    const reopened = await reopen(device)
    expect(reopened.state.library?.artistPage(YOASOBI.id)).toBeNull()
    device.setOnline(false)
    await reopened.openArtist(YOASOBI.id)

    expect(reopened.state.library?.artistPage(YOASOBI.id)).toEqual({ status: 'failed', failure: { kind: 'offline' } })
  })

  it('专辑超过一页的歌手：先显示前 100 张；再取一页从第 101 张接着取，取完就没有更多了', async () => {
    const device = world.device()
    const app = await signInUntilCollected(device)
    await world.netease.reply(MARASY.songs)
    await world.netease.reply(MARASY.albums[0])
    await app.openArtist(MARASY.id)
    expect(app.state.library?.artistPage(MARASY.id)).toMatchObject({ status: 'shown', content: { artist: { albumCount: 101 }, moreAlbums: { status: 'notLoaded' } } })

    await world.netease.reply(MARASY.albums[1])
    await app.moreArtistAlbums(MARASY.id)

    expect(device.requests.at(-1)?.path).toBe(`/api/artists/${MARASY.id}/albums?offset=100`)
    expect(world.netease.calls.at(-1)).toMatchObject({ module: 'artist_album', query: { id: MARASY.id, limit: 100, offset: 100 } })
    const page = app.state.library?.artistPage(MARASY.id)
    expect(page).toMatchObject({ status: 'shown', content: { moreAlbums: null } })
    const albums = page?.status === 'shown' ? page.content.albums : []
    expect(albums).toHaveLength(101)
    expect(albums.at(-1)).toMatchObject({ id: 45538, name: '幻想游戯~Museum of marasy' })
  })
})
