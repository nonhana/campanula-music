import type { SongDetailBody } from 'hana-music-api';

import { songOf } from '../../../src/lib/server/netease/songs.ts';
import { audioWav } from '../../_kit/mock/assets.ts';
import { readFixture } from '../../_kit/mock/read-fixture.ts';
import { RECORDED_ACCOUNT } from '../../_kit/sign-in.ts';
import { controlled, expect, test } from './fixture.ts';

test('生产 SW 安装控制后，空设备真正断网关闭重开并联网恢复', async ({
  page,
  context,
  production,
}, info) => {
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  await page.goto(production.baseURL);
  await expect(
    page.getByRole('heading', { name: '用网易云账号登录' }),
  ).toBeVisible();
  const before = await controlled(page);
  await info.attach('installed', {
    body: JSON.stringify(before),
    contentType: 'application/json',
  });
  expect(before.caches.map((item) => item.name)).toContain(
    `campanula-shell-${production.version}`,
  );
  await context.setOffline(true);
  await expect(page.getByText('网络已断开，只能播放已下载的歌')).toBeVisible();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(`${production.baseURL}/downloads`);
  expect(await reopened.evaluate(() => navigator.onLine)).toBe(false);
  await controlled(reopened);
  await expect(reopened.getByText('还没有下载的歌')).toBeVisible();
  await expect(
    reopened.getByText('网络已断开，只能播放已下载的歌'),
  ).toBeVisible();
  await reopened.screenshot({
    path: info.outputPath('offline-empty.png'),
    fullPage: true,
  });
  expect(
    await reopened.evaluate(() =>
      fetch('/api/account').then(
        () => 'unexpected',
        () => 'network-error',
      ),
    ),
  ).toBe('network-error');
  await context.setOffline(false);
  const response = reopened.waitForResponse(
    (response) => response.url().endsWith('/api/account') && response.ok(),
  );
  await reopened.reload();
  await response;
  await expect(
    reopened.getByText('网络已断开，只能播放已下载的歌'),
  ).toHaveCount(0);
  await reopened.screenshot({
    path: info.outputPath('recovered.png'),
    fullPage: true,
  });
});

test('生产离线重开读取已存账号与本机下载，实际播放后恢复匿名账号合同', async ({
  page,
  context,
  production,
}, info) => {
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  await page.goto(production.baseURL);
  await controlled(page);
  const body = (
    await readFixture('library/sync/before/003-song_detail.json.gz')
  ).response.body as SongDetailBody;
  const raw = body.songs[0];
  const song = {
    ...songOf(
      raw,
      body.privileges.find((item) => item.id === raw.id),
    ),
    album: {
      id: raw.al?.id ?? null,
      name: raw.al?.name ?? null,
      coverUrl: null,
    },
  };
  await page.evaluate(
    async ({ song, account, audio }) => {
      const open = indexedDB.open('campanula');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const transaction = db.transaction(
        ['session', 'library', 'downloads'],
        'readwrite',
      );
      transaction
        .objectStore('session')
        .put({ ...account, avatarUrl: null }, 'account');
      transaction.objectStore('library').put(account.id, 'owner');
      transaction.objectStore('library').put(true, 'firstSyncDone');
      transaction.objectStore('library').put([], 'playlists');
      transaction.objectStore('downloads').put(
        {
          song,
          audio: new Blob([new Uint8Array(audio)], { type: 'audio/wav' }),
          cover: null,
          lyrics: { kind: 'pureMusic' },
          album: null,
          sources: [{ kind: 'single' }],
          downloadedAt: 1,
        },
        song.id,
      );
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    },
    { song, account: RECORDED_ACCOUNT, audio: [...audioWav(song.id, 8)] },
  );
  await context.setOffline(true);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(`${production.baseURL}/downloads`);
  await controlled(reopened);
  const row = reopened.locator(`main [data-song-id="${song.id}"]`);
  await expect(
    reopened.getByRole('link', { name: '登录', exact: true }),
  ).toHaveCount(0);
  await expect(row).toBeVisible();
  await expect(row).toContainText(song.name!);
  await expect(
    reopened.getByText('网络已断开，只能播放已下载的歌'),
  ).toBeVisible();
  await row.locator('[data-play-target]').click();
  await reopened.getByRole('button', { name: /^打开播放页/ }).click();
  const player = reopened.getByRole('dialog', {
    name: '正在播放',
    exact: true,
  });
  await expect(
    player.getByRole('button', { name: '暂停', exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      Number(
        await player
          .getByRole('slider', { name: '播放进度' })
          .getAttribute('aria-valuenow'),
      ),
    )
    .toBeGreaterThan(0.1);
  await reopened.screenshot({
    path: info.outputPath('offline-download.png'),
    fullPage: true,
  });
  const cached = await controlled(reopened);
  expect(
    cached.caches
      .flatMap((cache) => cache.keys)
      .every((url) => !url.includes('/api/') && !url.startsWith('blob:')),
  ).toBe(true);
  await context.setOffline(false);
  await expect(
    reopened.getByText('网络已断开，只能播放已下载的歌'),
  ).toHaveCount(0);
  await reopened.reload();
  await expect(row).toBeVisible();
});
