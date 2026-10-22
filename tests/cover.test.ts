import type { Device, Tab } from './harness/device'
import { describe, expect, it } from 'vitest'
import { held, never } from './harness/hold'
import { signIn } from './harness/sign-in'
import { useWorld } from './harness/world'

const world = useWorld()

// 换歌单封面（#34，Spec #11 用户故事 90–92）：选图后先检查能不能用、把长边超过 3200 的缩小，
// 再在裁剪页里裁成 800×800 JPEG，三步上传（申请凭证 → 浏览器直传 → 设为封面）。
// 录制见 tests/fixtures/netease/README.md 的验证关卡②里封面一条

/** 自建歌单 jazz（公开、2 首，#22 录制）：换封面的目标 */
const JAZZ = 900000002
const HEARTS = 'library/likelist.json'
const PLAYLISTS = 'library/sync/deleted/001-user_playlist.json.gz'
const COLLECTED_ALBUMS = 'library/album-artist/001-album_sublist.json.gz'
const COLLECTED_ARTISTS = 'library/album-artist/002-artist_sublist.json.gz'
const LIKED_TRACK_IDS = 'library/playlist_detail.liked-full.json.gz'
/** 申请上传凭证、设为封面（验证关卡②录的，图片编号和歌单 jazz 对得上） */
const TOKEN = 'playlist-edit/image_upload_token.json'
const SET_COVER = 'playlist-edit/playlist_cover_update.imgid.json'
/** 歌单已经被删掉时设封面：网易云照样回 200（验证关卡②） */
const SET_COVER_DELETED = 'playlist-edit/playlist_cover_update.deleted-playlist.json'
const UPLOAD_URL = 'https://nosup-hz1.127.net/yyimgs/h0MaD8lPOfhxfbHJMb7atA==/109951174079391436?offset=0&complete=true&version=1.0'
const NEW_COVER = 'https://p1.music.126.net/h0MaD8lPOfhxfbHJMb7atA==/109951174079391436.jpg'

/** 登录，后台同步停在我喜欢的音乐的曲目编号：本机副本里有红心、歌单列表、收藏的专辑和歌手 */
async function signInHeld(device: Device): Promise<Tab> {
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

describe('选图', () => {
  it('大图先缩到长边 3200 再裁，原图尺寸记着', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)

    await app.prepareCover(JAZZ, device.images.file({ name: 'photo.jpg', type: 'image/jpeg', bytes: 3_000_000, width: 8000, height: 6000 }))

    expect(app.state.cover).toMatchObject({
      status: 'cropping',
      playlistId: JAZZ,
      small: false,
      image: { width: 3200, height: 2400, origWidth: 8000, origHeight: 6000 },
    })
    expect(device.requests.filter(request => request.path.includes('/cover'))).toEqual([])
  })

  it('小图能用，但记下原图尺寸太小、提示可能会糊', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)

    await app.prepareCover(JAZZ, device.images.file({ name: 'avatar.jpg', type: 'image/jpeg', width: 200, height: 200 }))

    expect(app.state.cover).toMatchObject({ status: 'cropping', small: true })
  })

  it('超过 20 MB 不读，换一张', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)

    await app.prepareCover(JAZZ, device.images.file({ name: 'huge.jpg', type: 'image/jpeg', bytes: 21 * 1024 * 1024 }))

    expect(app.state.cover).toEqual({
      status: 'unusable',
      playlistId: JAZZ,
      problem: { kind: 'tooBig' },
    })
    expect(device.requests.filter(request => request.path.includes('/cover'))).toEqual([])
  })

  it('照片是 HEIC 时解不开：说明为什么不能用', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)

    await app.prepareCover(JAZZ, device.images.file({ name: '15917.heic', type: 'image/heic', decodable: false }))

    expect(app.state.cover).toMatchObject({ status: 'unusable', problem: { kind: 'heic' } })
  })

  it('不是图片：解码失败、类型也不是图片', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)

    await app.prepareCover(JAZZ, device.images.file({ name: 'notes.txt', type: 'text/plain', decodable: false }))

    expect(app.state.cover).toMatchObject({ status: 'unusable', problem: { kind: 'notImage' } })
  })

  it('看着是图片但解不开：说图片读不出来', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)

    await app.prepareCover(JAZZ, device.images.file({ name: 'broken.jpg', type: 'image/jpeg', decodable: false }))

    expect(app.state.cover).toMatchObject({ status: 'unusable', problem: { kind: 'unreadable' } })
  })
})

describe('三步上传', () => {
  it('申请凭证 → 浏览器直传 → 设为封面；成功时封面马上换成返回的地址，存进本机', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await app.prepareCover(JAZZ, device.images.file({ name: 'photo.jpg', type: 'image/jpeg', width: 1200, height: 800 }))
    const crop = { x: 200, y: 60, size: 740 }

    await world.netease.reply(TOKEN)
    await world.netease.reply(SET_COVER)
    const outcome = await app.uploadCover(crop)

    expect(outcome).toEqual({ ok: true, coverUrl: NEW_COVER })
    expect(device.requests.at(-1)).toEqual({ method: 'POST', path: `/api/playlists/${JAZZ}/cover`, body: { imgId: '109951174079391436' } })
    expect(device.images.exports).toMatchObject([{ crop }])
    expect(device.images.uploads).toHaveLength(1)
    expect(device.images.uploads[0]).toMatchObject({ url: UPLOAD_URL, token: '' })
    expect(device.images.uploads[0].jpeg.size).toBe(300_000)
    expect(app.state.cover).toEqual({ status: 'done', playlistId: JAZZ, coverUrl: NEW_COVER })
    expect(app.state.library?.playlists?.find(playlist => playlist.id === JAZZ)?.coverUrl).toBe(NEW_COVER)
    const stored = (await device.stored()).library.find(([key]) => key === 'playlists')?.[1] as { id: number, coverUrl: string }[]
    expect(stored.find(playlist => playlist.id === JAZZ)?.coverUrl).toBe(NEW_COVER)
  })
})

/** 裁好的取景框（工作位图上的位置） */
const CROP = { x: 200, y: 60, size: 740 }

async function ready(device: Device, app: import('#lib/app/app.js').App): Promise<void> {
  await app.prepareCover(JAZZ, device.images.file({ name: 'photo.jpg', type: 'image/jpeg', width: 1200, height: 800 }))
}

describe('三步失败和取消', () => {
  it('第一步没成：说明原因，不直传、不设封面', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await ready(device, app)

    device.setOnline(false)
    const outcome = await app.uploadCover(CROP)

    expect(outcome).toEqual({ ok: false, step: 'token', failure: { kind: 'offline' } })
    expect(app.state.cover).toMatchObject({ status: 'failed', upload: { step: 'token', imgId: null, failure: { kind: 'offline' } } })
    expect(device.images.uploads).toHaveLength(0)
    expect(world.netease.calls.some(call => call.module === 'playlist_cover_update')).toBe(false)
  })

  it('直传没成：图片没有传上去，不设封面（设封面不检查图片，不能让它把封面弄坏）', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await ready(device, app)

    await world.netease.reply(TOKEN)
    device.images.uploadError = new TypeError('Failed to fetch')
    const outcome = await app.uploadCover(CROP)

    expect(outcome).toEqual({ ok: false, step: 'upload', failure: { kind: 'uploadFailed' } })
    expect(app.state.cover).toMatchObject({ status: 'failed', upload: { step: 'upload', imgId: null, failure: { kind: 'uploadFailed' } } })
    expect(device.requests.at(-1)).toEqual({ method: 'POST', path: `/api/playlists/${JAZZ}/cover/token`, body: {} })
    expect(world.netease.calls.some(call => call.module === 'playlist_cover_update')).toBe(false)
  })

  it('直传没成后重试：从申请凭证重来，直传成功了才设封面', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await ready(device, app)
    await world.netease.reply(TOKEN)
    device.images.uploadError = new TypeError('Failed to fetch')
    expect(await app.uploadCover(CROP)).toEqual({ ok: false, step: 'upload', failure: { kind: 'uploadFailed' } })

    device.images.uploadError = null
    await world.netease.reply(TOKEN)
    await world.netease.reply(SET_COVER)
    expect(await app.retryCover()).toEqual({ ok: true, coverUrl: NEW_COVER })
    expect(world.netease.calls.filter(call => call.module === 'image_upload_token')).toHaveLength(2)
    expect(device.images.uploads).toHaveLength(2)
    expect(world.netease.calls.filter(call => call.module === 'playlist_cover_update')).toHaveLength(1)
  })

  it('第三步没成：图片已经传上去了，重试只再设一次，不重新上传', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await ready(device, app)
    await world.netease.reply(TOKEN)
    device.images.holdUploads = true
    const uploading = app.uploadCover(CROP)
    await world.settle()
    expect(device.images.uploads).toHaveLength(1)

    device.setOnline(false)
    device.images.releaseUpload()
    expect(await uploading).toEqual({ ok: false, step: 'set', failure: { kind: 'offline' } })
    expect(app.state.cover).toMatchObject({ status: 'failed', upload: { step: 'set', imgId: '109951174079391436' } })

    device.setOnline(true)
    await world.netease.reply(SET_COVER)
    expect(await app.retryCover()).toEqual({ ok: true, coverUrl: NEW_COVER })
    expect(device.images.uploads).toHaveLength(1)
    expect(world.netease.calls.filter(call => call.module === 'image_upload_token')).toHaveLength(1)
    expect(world.netease.calls.filter(call => call.module === 'playlist_cover_update')).toHaveLength(1)
  })

  it('申请凭证时取消：回到裁剪，不直传、不设封面', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await ready(device, app)
    const token = held()
    await world.netease.reply(TOKEN, { until: token.until })

    const uploading = app.uploadCover(CROP)
    await world.settle()
    expect(app.state.cover).toMatchObject({ status: 'uploading', upload: { step: 'token' } })

    app.cancelCover()
    expect(app.state.cover).toMatchObject({ status: 'cropping', playlistId: JAZZ })
    token.release()
    expect(await uploading).toBeNull()
    expect(device.images.uploads).toHaveLength(0)
    expect(world.netease.calls.some(call => call.module === 'playlist_cover_update')).toBe(false)
  })

  it('取消后回到裁剪、挪了取景框再使用：重新导出，不用取消前那张', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await ready(device, app)
    const token = held()
    await world.netease.reply(TOKEN, { until: token.until })
    const first = app.uploadCover(CROP)
    await world.settle()
    app.cancelCover()
    token.release()
    await first
    expect(device.images.exports).toHaveLength(1)

    await world.netease.reply(TOKEN)
    await world.netease.reply(SET_COVER)
    const moved = { x: 120, y: 40, size: 640 }
    expect(await app.uploadCover(moved)).toEqual({ ok: true, coverUrl: NEW_COVER })
    expect(device.images.exports).toHaveLength(2)
    expect(device.images.exports[1].crop).toEqual(moved)
  })

  it('直传时取消：回到裁剪，不设封面', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await ready(device, app)
    await world.netease.reply(TOKEN)
    device.images.holdUploads = true

    const uploading = app.uploadCover(CROP)
    await world.settle()
    expect(app.state.cover).toMatchObject({ status: 'uploading', upload: { step: 'upload' } })

    app.cancelCover()
    expect(app.state.cover).toMatchObject({ status: 'cropping', playlistId: JAZZ })
    expect(device.images.uploads[0].aborted).toBe(true)
    expect(await uploading).toBeNull()
    expect(world.netease.calls.some(call => call.module === 'playlist_cover_update')).toBe(false)
  })

  it('导出 JPEG 没成：还没开始任何一步；重试会重新导出', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await ready(device, app)
    device.images.exportError = new Error('canvas 出错')

    expect(await app.uploadCover(CROP)).toEqual({ ok: false, step: null, failure: { kind: 'exportFailed' } })
    expect(app.state.cover).toMatchObject({ status: 'failed', upload: { step: null, failure: { kind: 'exportFailed' } } })
    expect(device.images.uploads).toHaveLength(0)
    expect(world.netease.calls.some(call => call.module === 'image_upload_token')).toBe(false)

    device.images.exportError = null
    await world.netease.reply(TOKEN)
    await world.netease.reply(SET_COVER)
    expect(await app.retryCover()).toEqual({ ok: true, coverUrl: NEW_COVER })
    expect(device.images.exports).toHaveLength(1)
  })

  it('歌单已经被删掉时设封面也回 200：照常收下新封面地址，等下次同步才发现', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await ready(device, app)
    await world.netease.reply(TOKEN)
    await world.netease.reply(SET_COVER_DELETED)

    expect(await app.uploadCover(CROP)).toEqual({ ok: true, coverUrl: NEW_COVER })
    expect(app.state.library?.playlists?.find(playlist => playlist.id === JAZZ)?.coverUrl).toBe(NEW_COVER)
  })

  it('第三步已经发出：取消和关闭都不算，等它回来', async () => {
    const device = world.device()
    const { app } = await signInHeld(device)
    await ready(device, app)
    await world.netease.reply(TOKEN)
    device.images.holdUploads = true
    const uploading = app.uploadCover(CROP)
    await world.settle()

    const setting = held()
    await world.netease.reply(SET_COVER, { until: setting.until })
    device.images.releaseUpload()
    await world.settle()
    expect(app.state.cover).toMatchObject({ status: 'uploading', upload: { step: 'set' } })

    app.cancelCover()
    app.closeCover()
    expect(app.state.cover).toMatchObject({ status: 'uploading', upload: { step: 'set' } })

    setting.release()
    expect(await uploading).toEqual({ ok: true, coverUrl: NEW_COVER })
  })
})
