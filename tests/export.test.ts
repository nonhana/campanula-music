import { describe, expect, it } from 'vitest'

import { FakeFolder } from './harness/browser'
import { held } from './harness/hold'
import { listener, PLAYLISTS_WITH_POEMS, VILLAGE } from './harness/listener'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInWithLiked, downloadLiked } = listener(world, { playlists: PLAYLISTS_WITH_POEMS })

/** 两首同一张专辑的下载：Fight Or Flight 先下完 */
const twoDownloads = async () => {
  const device = world.device()
  const tab = await signInWithLiked(device)
  const fight = await downloadLiked(device, tab.app, VILLAGE.fightOrFlight, { album: VILLAGE.page })
  const sunny = await downloadLiked(device, tab.app, VILLAGE.sunny)
  return { device, app: tab.app, fight, sunny }
}

const FIGHT_FILE = 'Stereophonics - Fight Or Flight.mp3'
const SUNNY_FILE = 'Stereophonics - Sunny.mp3'

// 导出（#79，ADR-0014）：把这台设备上的下载另存进听众这次选的文件夹，下载本身照旧留在 Campanula 里。文件里写了哪些歌曲信息由写歌曲信息核心测
// （tests/song-info-core.test.ts）；这里看选文件夹、文件名、进度、取消和失败。文件夹由设备的文件夹替身决定：选哪个、取消、里面已有什么、写到一半压着或失败

describe('导出', () => {
  it('先弹出文件夹选择器，再逐首写进听众选的文件夹，文件名是“歌手 - 歌名.mp3”；写完记着导出了哪几首、写进了哪个文件夹，下载照旧留着', async () => {
    const { device, app, fight, sunny } = await twoDownloads()
    const folder = new FakeFolder('音乐')
    device.folders.next(folder)

    await app.exportDownloads([fight.id, sunny.id])

    expect(device.folders.opened).toBe(1)
    expect([
      ...folder.files.keys(),
    ]).toEqual([FIGHT_FILE, SUNNY_FILE])
    expect(app.state.exporting).toEqual({
      status: 'finished',
      folder: '音乐',
      exported: [fight, sunny],
      failed: [],
    })
    expect(app.state.downloads.songs).toEqual([sunny, fight])
  })

  it('听众在选择器里取消了：什么都不做', async () => {
    const { device, app, fight } = await twoDownloads()
    device.folders.next('cancel')

    await app.exportDownloads([fight.id])

    expect(device.folders.opened).toBe(1)
    expect(app.state.exporting).toBeNull()
  })

  it('文件夹里已有同名文件时不覆盖，依次加“ (2)”“ (3)”', async () => {
    const { device, app, fight } = await twoDownloads()
    const folder = new FakeFolder('音乐', [FIGHT_FILE, 'Stereophonics - Fight Or Flight (2).mp3'])
    device.folders.next(folder)

    await app.exportDownloads([fight.id])

    expect([
      ...folder.files.keys(),
    ]).toEqual([FIGHT_FILE, 'Stereophonics - Fight Or Flight (2).mp3', 'Stereophonics - Fight Or Flight (3).mp3'])
    expect(folder.files.get(FIGHT_FILE)?.size).toBe(0)
  })

  it('写的时候看得到第几首、写过多少字节；中途取消：正在写的这首丢弃（不留空文件），已经写完的留着', async () => {
    const { device, app, fight, sunny } = await twoDownloads()
    const folder = new FakeFolder('音乐')
    const slow = held()
    folder.nextWrite(SUNNY_FILE, { until: slow.until })
    device.folders.next(folder)

    const exporting = app.exportDownloads([fight.id, sunny.id])
    await folder.writing(SUNNY_FILE)
    const bytes = app.state.downloads.sizeOf(fight.id) + app.state.downloads.sizeOf(sunny.id)
    expect(app.state.exporting).toEqual({
      status: 'writing',
      folder: '音乐',
      total: 2,
      done: 1,
      written: app.state.downloads.sizeOf(fight.id),
      bytes,
    })
    app.cancelExport()
    slow.release()
    await exporting

    expect([
      ...folder.files.keys(),
    ]).toEqual([FIGHT_FILE])
    expect(app.state.exporting).toEqual({
      status: 'finished',
      folder: '音乐',
      exported: [fight],
      failed: [],
    })
  })

  it('一首没写成（空间不够、文件夹不让写）时说明原因，其余照常导出；没写成的那首不算进写过的字节', async () => {
    const { device, app, fight, sunny } = await twoDownloads()
    const folder = new FakeFolder('音乐')
    folder.nextWrite(FIGHT_FILE, {
      error: new DOMException('The operation failed because it would cause the application to exceed its storage quota.', 'QuotaExceededError'),
    })
    const slow = held()
    folder.nextWrite(SUNNY_FILE, { until: slow.until })
    device.folders.next(folder)

    const exporting = app.exportDownloads([fight.id, sunny.id])
    await folder.writing(SUNNY_FILE)
    expect(app.state.exporting).toMatchObject({ status: 'writing', done: 1, written: 0 })
    slow.release()
    await exporting

    expect([
      ...folder.files.keys(),
    ]).toEqual([SUNNY_FILE])
    expect(app.state.exporting).toEqual({
      status: 'finished',
      folder: '音乐',
      exported: [sunny],
      failed: [
        {
          song: fight,
          failure: { kind: 'storageFull' },
        },
      ],
    })
  })

  it('导出后一键从 Campanula 删除这几首：下载没了，导出的文件留着', async () => {
    const { device, app, fight, sunny } = await twoDownloads()
    const folder = new FakeFolder('音乐')
    device.folders.next(folder)
    await app.exportDownloads([fight.id, sunny.id])

    await app.deleteDownloads([fight.id, sunny.id])
    app.closeExport()

    expect(app.state.downloads.songs).toEqual([])
    expect((await device.stored()).downloads).toEqual([])
    expect([
      ...folder.files.keys(),
    ]).toEqual([FIGHT_FILE, SUNNY_FILE])
    expect(app.state.exporting).toBeNull()
  })

  it('浏览器不支持选文件夹时没有导出', async () => {
    const device = world.device()
    device.folders.supported = false
    const { app } = await device.open()

    expect(app.state.exportable).toBe(false)
  })
})

describe('多选删除', () => {
  it('一次删掉勾选的几首下载：本机存的也删掉', async () => {
    const { device, app, fight, sunny } = await twoDownloads()

    await app.deleteDownloads([fight.id, sunny.id])

    expect(app.state.downloads.songs).toEqual([])
    expect((await device.stored()).downloads).toEqual([])
    expect(app.state.downloads.has(fight.id)).toBe(false)
    expect(app.state.downloads.has(sunny.id)).toBe(false)
  })
})
