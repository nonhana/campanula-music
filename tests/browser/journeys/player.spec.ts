import { audioResponse, audioWav } from '../../_kit/mock/assets.ts';
import { expect, login, test } from '../fixture.ts';

test('队列抽屉同步跟手，跨原点、尺寸变化和回弹中再抓住都不跳位，取消后恢复静止', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, '/playlists/900000024');
  await page
    .locator('main [data-song-id="3433267939"] [data-play-target]')
    .click();
  await page.getByRole('button', { name: /^打开播放页/ }).click();
  const player = page.getByRole('dialog', { name: '正在播放', exact: true });
  await player.getByRole('button', { name: '播放队列', exact: true }).click();
  const queue = page.getByRole('dialog', { name: '播放队列', exact: true });
  await expect
    .poll(() => queue.evaluate((el) => el.getBoundingClientRect().top))
    .toBeCloseTo(118.16, 1);
  const restingTop = await queue.evaluate(
    (el) => el.getBoundingClientRect().top,
  );
  expect(
    await queue.evaluate((el) => el.getBoundingClientRect().bottom),
  ).toBeCloseTo(892, 1);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const handle = queue.getByRole('button', {
    name: '收起播放队列',
    exact: true,
  });
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  let samples;
  try {
    samples = await queue.evaluate(
      async (panel, { x, y }) => {
        const grip = panel.querySelector('button')!;
        const move = (at: number) =>
          grip.dispatchEvent(
            new PointerEvent('pointermove', {
              pointerId: 1,
              pointerType: 'mouse',
              isPrimary: true,
              button: -1,
              buttons: 1,
              clientX: x,
              clientY: at,
            }),
          );
        const start = panel.getBoundingClientRect().top;
        move(y + 80);
        const immediate = panel.getBoundingClientRect().top - start;
        await Promise.resolve();
        const flushed = panel.getBoundingClientRect().top - start;
        move(y);
        await Promise.resolve();
        const origin = panel.getBoundingClientRect().top - start;
        move(y - 100);
        const overdrag = panel.getBoundingClientRect().top - start;
        move(y);
        const secondOrigin = panel.getBoundingClientRect().top - start;
        const cancel = () =>
          grip.dispatchEvent(
            new PointerEvent('pointercancel', {
              pointerId: 1,
              pointerType: 'mouse',
              isPrimary: true,
            }),
          );
        move(y + 80);
        panel.style.maxHeight = `${panel.clientHeight - 100}px`;
        const resized = panel.getBoundingClientRect().top - start;
        move(y + 120);
        const resizedMove = panel.getBoundingClientRect().top - start;
        const frame = () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
        // Svelte Tween 用 performance.now 计时：定格逻辑时钟，让回弹确实推进 30ms，避免依赖机器快慢。
        const nativeNow = performance.now.bind(performance);
        let time = nativeNow();
        performance.now = () => time;
        try {
          cancel();
          const released = panel.getBoundingClientRect().top - start;
          time += 30;
          await frame();
          const rebounding = panel.getBoundingClientRect().top - start;
          grip.dispatchEvent(
            new PointerEvent('pointerdown', {
              pointerId: 1,
              pointerType: 'mouse',
              isPrimary: true,
              button: 0,
              buttons: 1,
              clientX: x,
              clientY: y + rebounding,
            }),
          );
          move(y + rebounding + 20);
          const caught = panel.getBoundingClientRect().top - start - rebounding;
          time += 300;
          await frame();
          const regrabbed =
            panel.getBoundingClientRect().top - start - rebounding;
          cancel();
          time += 500;
          await frame();
          return {
            immediate,
            flushed,
            origin,
            overdrag,
            secondOrigin,
            resized,
            resizedMove,
            released,
            rebounding,
            caught,
            regrabbed,
          };
        } finally {
          performance.now = nativeNow;
        }
      },
      { x, y },
    );
  } finally {
    await page.mouse.up();
  }
  expect(samples.immediate).toBeCloseTo(80, 1);
  expect(samples.flushed).toBeCloseTo(80, 1);
  expect(samples.origin).toBeCloseTo(0, 1);
  expect(samples.overdrag).toBeLessThan(-10);
  expect(samples.secondOrigin).toBeCloseTo(0, 1);
  expect(samples.resized).toBeCloseTo(80, 1);
  expect(samples.resizedMove).toBeCloseTo(120, 1);
  expect(samples.released).toBeCloseTo(120, 1);
  expect(samples.rebounding).toBeGreaterThan(0);
  expect(samples.rebounding).toBeLessThan(120);
  expect(samples.caught).toBeCloseTo(20, 1);
  expect(samples.regrabbed).toBeCloseTo(20, 1);
  await expect
    .poll(() => queue.evaluate((el) => el.getBoundingClientRect().top))
    .toBeCloseTo(restingTop, 1);
  await expect(queue).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(queue).toHaveCount(0);
  await expect(
    player.getByRole('button', { name: '播放队列', exact: true }),
  ).toBeFocused();
});

test('测试音频支持范围请求和原生跳转', async ({ page }) => {
  await page.goto('/login');
  const url = '/mock-assets/audio/1.wav';
  const response = await page.request.get(url, {
    headers: { range: 'bytes=44-47' },
  });
  expect(response.status()).toBe(206);
  expect(response.headers()['content-range']).toBe('bytes 44-47/32044');
  expect(await response.body()).toHaveLength(4);
  const result = await page.evaluate(async (url) => {
    const audio = new Audio(url);
    try {
      await audio.play();
      audio.pause();
      const settled = new Promise<void>((resolve) =>
        audio.addEventListener('seeked', () => resolve(), { once: true }),
      );
      audio.currentTime = 1;
      await settled;
      return audio.currentTime;
    } finally {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }, url);
  expect(result).toBe(1);
});

test('播放、切歌、歌词、队列和键盘滑块', async ({ page, scan }, info) => {
  const audio = audioWav(3433267939, 30);
  await page.route('**/mock-assets/audio/**', (route) =>
    route.fulfill(
      audioResponse(
        audio,
        route.request().method(),
        route.request().headers().range,
      ),
    ),
  );
  await login(page, '/playlists/900000024');
  const first = page.locator(
    'main [data-song-id="3433267939"] [data-play-target]',
  );
  await first.click();
  const open = page.getByRole('button', { name: /^打开播放页/ });
  await expect(open).toBeVisible();
  const initial = await open.getAttribute('aria-label');
  await open.click();
  const player = page.getByRole('dialog', { name: '正在播放', exact: true });
  await expect(player).toBeVisible();
  await expect(
    player.getByRole('button', { name: '暂停', exact: true }),
  ).toBeVisible();
  await player.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.getByRole('status', { name: '播放状态' })).toContainText(
    '已暂停',
  );
  const progress = player.getByRole('slider', { name: '播放进度' });
  await expect(progress).toHaveAttribute('aria-disabled', 'false');
  await progress.focus();
  await page.keyboard.press('Home');
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await scan('player-paused');
  await progress.focus();
  await page.keyboard.press('ArrowRight');
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
  await page.keyboard.press('ArrowLeft');
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await expect(
    progress.locator(
      'xpath=ancestor-or-self::*[@aria-live and @aria-live!="off"]',
    ),
  ).toHaveCount(0);
  if (info.project.name === 'desktop') {
    const volume = player.getByRole('slider', { name: '音量' });
    await volume.focus();
    await page.keyboard.press('Home');
    await expect(volume).toHaveValue('0');
    await page.keyboard.press('ArrowRight');
    await expect(volume).toHaveValue('0.01');
    await player.getByRole('tab', { name: '播放队列' }).click();
    await expect(
      player.getByRole('button', { name: '清空', exact: true }),
    ).toBeVisible();
    await scan('player-queue');
    await player.getByRole('tab', { name: '歌词', exact: true }).click();
  } else {
    await expect(player.getByRole('slider', { name: '音量' })).toHaveCount(0);
    await player.getByRole('button', { name: '播放队列', exact: true }).click();
    const queue = page.getByRole('dialog', { name: '播放队列', exact: true });
    await expect(
      queue.getByRole('button', { name: '清空', exact: true }),
    ).toBeVisible();
    await scan('player-queue');
    await page.keyboard.press('Escape');
    await expect(
      player.getByRole('button', { name: '播放队列', exact: true }),
    ).toBeFocused();
    await player.getByRole('button', { name: '显示歌词' }).click();
  }
  await expect(
    player.getByRole('group', { name: '歌词', exact: true }),
  ).toBeVisible();
  const lyrics = player.getByRole('group', { name: '歌词', exact: true });
  await lyrics.focus();
  await expect(lyrics).toBeFocused();
  await page.keyboard.press('Home');
  await expect.poll(() => lyrics.evaluate((el) => el.scrollTop)).toBe(0);
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(() => lyrics.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await scan('player-lyrics');
  await player.getByRole('button', { name: '播放', exact: true }).click();
  await expect(page.getByRole('status', { name: '播放状态' })).toContainText(
    '正在播放',
  );
  const announcement = await page
    .getByRole('status', { name: '播放状态' })
    .textContent();
  const mutations = page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let changes = 0;
        const observer = new MutationObserver((records) => {
          changes += records.length;
        });
        observer.observe(document.querySelector('[aria-label="播放状态"]')!, {
          characterData: true,
          childList: true,
          subtree: true,
        });
        setTimeout(() => {
          observer.disconnect();
          resolve(changes);
        }, 1500);
      }),
  );
  await expect
    .poll(async () => Number(await progress.getAttribute('aria-valuenow')))
    .toBeGreaterThan(0);
  await expect(page.getByRole('status', { name: '播放状态' })).toHaveText(
    announcement!,
  );
  expect(await mutations, '播放进度变化不能反复改写状态播报').toBe(0);
  await player.getByRole('button', { name: '下一首', exact: true }).click();
  await player.getByRole('button', { name: '收起播放页', exact: true }).click();
  await expect(open).not.toHaveAttribute('aria-label', initial!);
});
