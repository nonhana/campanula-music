import { expect, test } from './fixture.ts';

declare global {
  interface Window {
    __websiteAudios: HTMLAudioElement[];
  }
}

test('真实试听播放、换歌、歌词翻译、队列、曲库与离页停播，数据与能力独立', async ({
  page,
  context,
  scan,
}, info) => {
  await context.addInitScript(() => {
    window.__websiteAudios = [];
    window.Audio = new Proxy(window.Audio, {
      construct(Target, args) {
        const audio = new Target(...args);
        window.__websiteAudios.push(audio);
        return audio;
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('.demo-window')).toHaveAttribute('data-ready', '');
  const frame = page.frameLocator('#demo-frame');
  const player = frame.getByRole('region', { name: '正在播放', exact: true });
  await expect(player).toBeVisible();
  await player.getByRole('button', { name: '播放', exact: true }).click();
  const status = frame.getByRole('status', { name: '播放状态' });
  await expect(status).toContainText('正在播放：Window Light');
  const content = page
    .frames()
    .find((frame) => frame.url().includes('/demo/'))!;
  await expect
    .poll(() =>
      content.evaluate(() =>
        window.__websiteAudios.some(
          (audio) => !audio.paused && audio.currentTime > 0,
        ),
      ),
    )
    .toBe(true);
  await player.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(status).toContainText('已暂停');
  const progress = player.getByRole('slider', { name: '播放进度' });
  await progress.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
  if (info.project.name === 'phone')
    await player.getByRole('button', { name: '显示歌词' }).click();
  await expect(
    player.getByRole('group', { name: '歌词', exact: true }),
  ).toContainText('光落在窗边');
  await scan('demo-lyrics');
  if (info.project.name === 'desktop')
    await player.getByRole('tab', { name: '播放队列' }).click();
  else
    await player.getByRole('button', { name: '播放队列', exact: true }).click();
  await expect(
    frame.locator('[data-song-id="102"]').filter({ visible: true }).first(),
  ).toContainText('Tidal Steps');
  await scan('demo-queue');
  if (info.project.name === 'phone') await page.keyboard.press('Escape');
  await player.getByRole('button', { name: '下一首', exact: true }).click();
  await expect(status).toContainText('Tidal Steps');
  await player.getByRole('button', { name: '收起播放页', exact: true }).click();
  await expect(frame.getByRole('heading', { name: '示例曲库' })).toBeVisible();
  await frame.locator('main [data-song-id="103"] [data-play-target]').click();
  await expect(status).toContainText('正在播放：After the Rain');
  await scan('demo-library');
  const boundary = await content.evaluate(async () => ({
    databases: (await indexedDB.databases()).map((db) => db.name),
    caches: await caches.keys(),
    workers: (await navigator.serviceWorker.getRegistrations()).map(
      (worker) => worker.scope,
    ),
    cookies: document.cookie,
    local: Object.keys(localStorage),
  }));
  expect(boundary.databases).toEqual(['campanula-website-demo-v1:embedded']);
  expect(boundary.caches).toEqual([]);
  expect(boundary.workers).toEqual([]);
  expect(boundary.cookies).toBe('');
  expect(boundary.local).toEqual([]);
  await expect
    .poll(() =>
      content.evaluate(() =>
        window.__websiteAudios.some(
          (audio) =>
            !audio.paused &&
            audio.currentSrc.endsWith('/rain.mp3') &&
            !audio.paused &&
            audio.currentTime > 0,
        ),
      ),
    )
    .toBe(true);
  const [observer] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => {
      window.open('/guide/', 'website-audio-observer');
    }),
  ]);
  await observer.waitForLoadState();
  await observer.evaluate(() => {
    const frame = window.opener.document.querySelector(
      '#demo-frame',
    ) as HTMLIFrameElement;
    window.__websiteAudios = [...frame.contentWindow!.__websiteAudios];
  });
  expect(
    await observer.evaluate(() =>
      window.__websiteAudios.some(
        (audio) => !audio.paused && audio.currentSrc.endsWith('/rain.mp3'),
      ),
    ),
  ).toBe(true);
  await page.locator('#home-deploy').click();
  await expect(page).toHaveURL(/\/guide\/$/);
  expect(
    await observer.evaluate(() => window.__websiteAudios.length),
  ).toBeGreaterThan(0);
  await expect
    .poll(() =>
      observer.evaluate(() =>
        window.__websiteAudios.every(
          (audio) => audio.paused && audio.getAttribute('src') === null,
        ),
      ),
    )
    .toBe(true);
  await observer.close();
  await expect(page.locator('iframe, audio')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('.demo-window')).toHaveAttribute('data-ready', '');
  await expect(
    frame
      .getByRole('button', { name: '播放', exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test('媒体失败保留截图与部署入口，重试恢复本地试听', async ({ page, scan }) => {
  await page.route('**/media/*.mp3', (route) => route.abort('failed'));
  await page.goto('/');
  await expect(page.locator('.demo-window')).toHaveAttribute('data-ready', '');
  await page
    .frameLocator('#demo-frame')
    .getByRole('region', { name: '正在播放', exact: true })
    .getByRole('button', { name: '播放', exact: true })
    .click();
  await expect(page.locator('#demo-status')).toContainText('音频没能播放');
  await expect(page.locator('#demo-frame')).not.toHaveAttribute('src');
  await expect(page.locator('.demo-still')).toBeVisible();
  await expect(page.locator('#home-deploy')).toBeVisible();
  await scan('media-failed');
  await page.unroute('**/media/*.mp3');
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.locator('.demo-window')).toHaveAttribute('data-ready', '');
  await page
    .frameLocator('#demo-frame')
    .getByRole('region', { name: '正在播放', exact: true })
    .getByRole('button', { name: '播放', exact: true })
    .click();
  await expect(
    page.frameLocator('#demo-frame').getByRole('status', { name: '播放状态' }),
  ).toContainText('正在播放');
});

test('允许的示例深链直接打开和刷新，未开放入口不会发业务请求', async ({
  page,
  context,
}) => {
  for (const path of [
    '/demo/',
    '/demo/playlists/',
    '/demo/playlists/501/',
    '/demo/playlists/502/',
  ]) {
    await page.goto(path);
    await expect(page.locator('main [data-song-id="101"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('main [data-song-id="103"]')).toBeVisible();
  }
  expect(await context.cookies()).toEqual([]);
  expect((await page.request.get('/api/account')).status()).toBe(404);
  expect((await page.request.get('/service-worker.js')).status()).toBe(404);
  expect((await page.request.get('/demo/api/account')).status()).toBe(404);
});

test('试听保留已有实例的本机数据，不接收实例退出广播', async ({ page }) => {
  await page.goto('/guide/');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('campanula', 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('sentinel');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('sentinel', 'readwrite');
        tx.objectStore('sentinel').put('synthetic-download', 'saved');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
    await (
      await caches.open('campanula-shell:sentinel')
    ).put('/saved', new Response('synthetic-shell'));
    localStorage.setItem('website-test-sentinel', 'synthetic-settings');
    document.cookie =
      'website-test-sentinel=synthetic-cookie; Path=/; SameSite=Lax';
  });
  await page.goto('/');
  await expect(page.locator('.demo-window')).toHaveAttribute('data-ready', '');
  const frame = page.frameLocator('#demo-frame');
  await frame
    .getByRole('region', { name: '正在播放', exact: true })
    .getByRole('button', { name: '播放', exact: true })
    .click();
  await page.evaluate(() => {
    const channel = new BroadcastChannel('campanula:session');
    channel.postMessage({ type: 'signedOut' });
    channel.close();
  });
  await expect(frame.getByRole('status', { name: '播放状态' })).toContainText(
    '正在播放',
  );
  const saved = await page.evaluate(async () => {
    const download = await new Promise((resolve, reject) => {
      const request = indexedDB.open('campanula', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const read = db
          .transaction('sentinel')
          .objectStore('sentinel')
          .get('saved');
        read.onsuccess = () => {
          resolve(read.result);
          db.close();
        };
      };
    });
    return {
      download,
      shell: await (await (
        await caches.open('campanula-shell:sentinel')
      ).match('/saved'))!.text(),
      setting: localStorage.getItem('website-test-sentinel'),
      cookie: document.cookie,
    };
  });
  expect(saved).toEqual({
    download: 'synthetic-download',
    shell: 'synthetic-shell',
    setting: 'synthetic-settings',
    cookie: 'website-test-sentinel=synthetic-cookie',
  });
});
