import { describe, expect, it } from 'vitest';

import { FakeFolder } from './harness/browser';
import { held } from './harness/hold';
import {
  listener,
  PLAYLISTS_WITH_POEMS,
  playUrlRequests,
  VILLAGE,
} from './harness/listener';
import { useWorld } from './harness/world';

const world = useWorld();
const { signInWithLiked, downloadLiked } = listener(world, {
  playlists: PLAYLISTS_WITH_POEMS,
});

const twoDownloads = async () => {
  const device = world.device();
  const tab = await signInWithLiked(device);
  const fight = await downloadLiked(device, tab.app, VILLAGE.fightOrFlight, {
    album: VILLAGE.page,
  });
  const sunny = await downloadLiked(device, tab.app, VILLAGE.sunny);
  return { device, tab, app: tab.app, fight, sunny };
};

const FIGHT_FILE = 'Stereophonics - Fight Or Flight.mp3';
const SUNNY_FILE = 'Stereophonics - Sunny.mp3';

describe('导出', () => {
  it('先弹出文件夹选择器，再逐首写进听众选的文件夹，文件名是“歌手 - 歌名.mp3”；写完记着导出了哪几首、写进了哪个文件夹，下载照旧留着', async () => {
    const { device, app, fight, sunny } = await twoDownloads();
    const folder = new FakeFolder('音乐');
    device.folders.next(folder);

    const exporting = app.exportDownloads([fight.id, sunny.id]);
    expect(device.folders.opened).toBe(1);
    await exporting;

    expect([...folder.files.keys()]).toEqual([FIGHT_FILE, SUNNY_FILE]);
    expect(app.state.exporting).toEqual({
      status: 'finished',
      folder: '音乐',
      exported: [fight, sunny],
      failed: [],
    });
    expect(app.state.downloads.songs).toEqual([sunny, fight]);
  });

  it('听众在选择器里取消了：什么都不做', async () => {
    const { device, app, fight } = await twoDownloads();
    device.folders.next('cancel');

    await app.exportDownloads([fight.id]);

    expect(device.folders.opened).toBe(1);
    expect(app.state.exporting).toBeNull();
  });

  it.each(['文件句柄', '可写句柄'])(
    '等%s时取消：晚到的句柄不能把当前歌曲写进文件夹，原下载仍能离线播放',
    async (waiting) => {
      const { device, tab, app, fight, sunny } = await twoDownloads();
      const folder = new FakeFolder('音乐');
      const opened = held();
      const resume = held();
      const get = folder.getFileHandle.bind(folder);
      folder.getFileHandle = async (name, options) => {
        const handle = await get(name, options);
        if (!options?.create) return handle;
        if (waiting === '文件句柄') {
          opened.release();
          await resume.until;
          return handle;
        }
        return {
          async createWritable() {
            opened.release();
            await resume.until;
            return handle.createWritable();
          },
        };
      };
      device.folders.next(folder);
      const stored = (await device.stored()).downloads;

      const exporting = app.exportDownloads([fight.id, sunny.id]);
      await opened.until;
      expect([...folder.files.keys()]).toEqual([FIGHT_FILE]);
      expect(folder.files.get(FIGHT_FILE)?.size).toBe(0);
      app.cancelExport();
      resume.release();
      await exporting;

      expect([...folder.files.keys()]).toEqual([]);
      expect(app.state.exporting).toBeNull();
      expect(app.state.downloads.songs).toEqual([sunny, fight]);
      expect((await device.stored()).downloads).toEqual(stored);
      device.setOnline(false);
      app.play({ kind: 'downloads' }, fight.id);
      await world.settle();
      const player = tab.audio.find((audio) => !audio.paused)!;
      expect(device.objectUrls.blobOf(player.src)?.size).toBe(8_848_240);
      player.ready(fight.duration! / 1000);
      await world.settle();
      expect(app.state.player.status).toBe('playing');
      expect(tab.sounding()).toBe(player);
      expect(playUrlRequests(device)).toEqual([]);
    },
  );

  it('第二首等可写句柄时取消：保留同名原文件和已提交的第一首，不再创建第三首', async () => {
    const { device, app, fight, sunny } = await twoDownloads();
    const third = await downloadLiked(device, app, {
      id: 3433267939,
      downloadUrl: 'playback/downloads/002-song_download_url_v1.json.gz',
    });
    const folder = new FakeFolder('音乐');
    const existing = new Blob(['原来已经存在的歌曲']);
    folder.files.set(SUNNY_FILE, existing);
    const opened = held();
    const resume = held();
    const created: string[] = [];
    const get = folder.getFileHandle.bind(folder);
    const secondFile = 'Stereophonics - Sunny (2).mp3';
    folder.getFileHandle = async (name, options) => {
      const handle = await get(name, options);
      if (!options?.create) return handle;
      created.push(name);
      if (name !== secondFile) return handle;
      return {
        async createWritable() {
          opened.release();
          await resume.until;
          return handle.createWritable();
        },
      };
    };
    device.folders.next(folder);

    const exporting = app.exportDownloads([fight.id, sunny.id, third.id]);
    await opened.until;
    const completed = await folder.files.get(FIGHT_FILE)!.arrayBuffer();
    expect(completed.byteLength).toBeGreaterThan(0);
    expect(folder.files.get(secondFile)?.size).toBe(0);
    app.cancelExport();
    resume.release();
    await exporting;

    expect([...folder.files.keys()]).toEqual([SUNNY_FILE, FIGHT_FILE]);
    expect(await folder.files.get(SUNNY_FILE)!.text()).toBe(
      '原来已经存在的歌曲',
    );
    expect(await folder.files.get(FIGHT_FILE)!.arrayBuffer()).toEqual(
      completed,
    );
    expect(created).toEqual([FIGHT_FILE, secondFile]);
    expect(app.state.exporting).toEqual({
      status: 'finished',
      folder: '音乐',
      exported: [fight],
      failed: [],
    });
  });

  it.each(['写入完成', '提交完成'])(
    '%s后取消：只保留已经提交的文件，不再创建后续歌曲',
    async (stage) => {
      const { device, app, fight, sunny } = await twoDownloads();
      const folder = new FakeFolder('音乐');
      const reached = held();
      const resume = held();
      const created: string[] = [];
      const get = folder.getFileHandle.bind(folder);
      folder.getFileHandle = async (name, options) => {
        const handle = await get(name, options);
        if (!options?.create) return handle;
        created.push(name);
        return {
          async createWritable() {
            const writable = await handle.createWritable();
            return {
              ...writable,
              async write(file) {
                await writable.write(file);
                if (stage === '写入完成') {
                  reached.release();
                  await resume.until;
                }
              },
              async close() {
                await writable.close();
                // 文件系统标准先提交内容，再异步兑现 close()：https://fs.spec.whatwg.org/#create-a-new-filesystemwritablefilestream
                if (stage === '提交完成') {
                  reached.release();
                  await resume.until;
                }
              },
            };
          },
        };
      };
      device.folders.next(folder);

      const exporting = app.exportDownloads([fight.id, sunny.id]);
      await reached.until;
      const submitted = await folder.files.get(FIGHT_FILE)!.arrayBuffer();
      app.cancelExport();
      resume.release();
      await exporting;

      expect(created).toEqual([FIGHT_FILE]);
      if (stage === '写入完成') {
        expect(submitted.byteLength).toBe(0);
        expect([...folder.files.keys()]).toEqual([]);
        expect(app.state.exporting).toBeNull();
      } else {
        expect(submitted.byteLength).toBeGreaterThan(0);
        expect([...folder.files.keys()]).toEqual([FIGHT_FILE]);
        expect(await folder.files.get(FIGHT_FILE)!.arrayBuffer()).toEqual(
          submitted,
        );
        expect(app.state.exporting).toEqual({
          status: 'finished',
          folder: '音乐',
          exported: [fight],
          failed: [],
        });
      }
    },
  );

  it.each(['createWritable', 'close'])(
    '%s 被文件夹拒绝时撤回新文件，报告失败，继续导出其他歌曲',
    async (stage) => {
      const { device, app, fight, sunny } = await twoDownloads();
      const folder = new FakeFolder('音乐');
      const get = folder.getFileHandle.bind(folder);
      // 文件系统标准在申请可写流和提交时都检查写权限：https://fs.spec.whatwg.org/
      const denied = new DOMException('Permission denied', 'NotAllowedError');
      folder.getFileHandle = async (name, options) => {
        const handle = await get(name, options);
        if (!options?.create || name !== FIGHT_FILE) return handle;
        return {
          async createWritable() {
            if (stage === 'createWritable') throw denied;
            const writable = await handle.createWritable();
            return {
              ...writable,
              close: async () => {
                throw denied;
              },
            };
          },
        };
      };
      device.folders.next(folder);

      await app.exportDownloads([fight.id, sunny.id]);

      expect([...folder.files.keys()]).toEqual([SUNNY_FILE]);
      expect(folder.files.get(SUNNY_FILE)!.size).toBeGreaterThan(0);
      expect(app.state.exporting).toEqual({
        status: 'finished',
        folder: '音乐',
        exported: [sunny],
        failed: [{ song: fight, failure: { kind: 'notAllowed' } }],
      });
    },
  );

  it('文件夹里已有同名文件时不覆盖，依次加“ (2)”“ (3)”', async () => {
    const { device, app, fight } = await twoDownloads();
    const folder = new FakeFolder('音乐', [
      FIGHT_FILE,
      'Stereophonics - Fight Or Flight (2).mp3',
    ]);
    device.folders.next(folder);

    await app.exportDownloads([fight.id]);

    expect([...folder.files.keys()]).toEqual([
      FIGHT_FILE,
      'Stereophonics - Fight Or Flight (2).mp3',
      'Stereophonics - Fight Or Flight (3).mp3',
    ]);
    expect(folder.files.get(FIGHT_FILE)?.size).toBe(0);
  });

  it('写的时候看得到第几首、写过多少字节；中途取消：正在写的这首丢弃（不留空文件），已经写完的留着', async () => {
    const { device, app, fight, sunny } = await twoDownloads();
    const folder = new FakeFolder('音乐');
    const slow = held();
    folder.nextWrite(SUNNY_FILE, { until: slow.until });
    device.folders.next(folder);

    const exporting = app.exportDownloads([fight.id, sunny.id]);
    await folder.writing(SUNNY_FILE);
    const bytes =
      app.state.downloads.sizeOf(fight.id) +
      app.state.downloads.sizeOf(sunny.id);
    expect(app.state.exporting).toEqual({
      status: 'writing',
      folder: '音乐',
      total: 2,
      done: 1,
      written: app.state.downloads.sizeOf(fight.id),
      bytes,
    });
    app.cancelExport();
    slow.release();
    await exporting;

    expect([...folder.files.keys()]).toEqual([FIGHT_FILE]);
    expect(app.state.exporting).toEqual({
      status: 'finished',
      folder: '音乐',
      exported: [fight],
      failed: [],
    });
  });

  it('一首没写成（空间不够、文件夹不让写）时说明原因，其余照常导出；没写成的那首不算进写过的字节', async () => {
    const { device, app, fight, sunny } = await twoDownloads();
    const folder = new FakeFolder('音乐');
    folder.nextWrite(FIGHT_FILE, {
      error: new DOMException(
        'The operation failed because it would cause the application to exceed its storage quota.',
        'QuotaExceededError',
      ),
    });
    const slow = held();
    folder.nextWrite(SUNNY_FILE, { until: slow.until });
    device.folders.next(folder);

    const exporting = app.exportDownloads([fight.id, sunny.id]);
    await folder.writing(SUNNY_FILE);
    expect(app.state.exporting).toMatchObject({
      status: 'writing',
      done: 1,
      written: 0,
    });
    slow.release();
    await exporting;

    expect([...folder.files.keys()]).toEqual([SUNNY_FILE]);
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
    });
  });

  it('导出后一键从 Campanula 删除这几首：下载没了，导出的文件留着', async () => {
    const { device, app, fight, sunny } = await twoDownloads();
    const folder = new FakeFolder('音乐');
    device.folders.next(folder);
    await app.exportDownloads([fight.id, sunny.id]);

    await app.deleteDownloads([fight.id, sunny.id]);
    app.closeExport();

    expect(app.state.downloads.songs).toEqual([]);
    expect((await device.stored()).downloads).toEqual([]);
    expect([...folder.files.keys()]).toEqual([FIGHT_FILE, SUNNY_FILE]);
    expect(app.state.exporting).toBeNull();
  });

  it('浏览器不支持选文件夹时没有导出', async () => {
    const device = world.device();
    device.folders.supported = false;
    const { app } = await device.open();

    expect(app.state.exportable).toBe(false);
  });
});

describe('多选删除', () => {
  it('一次删掉勾选的几首下载：本机存的也删掉', async () => {
    const { device, app, fight, sunny } = await twoDownloads();

    await app.deleteDownloads([fight.id, sunny.id]);

    expect(app.state.downloads.songs).toEqual([]);
    expect((await device.stored()).downloads).toEqual([]);
    expect(app.state.downloads.has(fight.id)).toBe(false);
    expect(app.state.downloads.has(sunny.id)).toBe(false);
  });
});
