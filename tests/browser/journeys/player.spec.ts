import { audioWav } from '../../_kit/mock/assets.ts';
import { expect, login, test } from '../fixture.ts';

test('播放、切歌、歌词、队列和键盘滑块', async ({ page, scan }, info) => {
  const audio = audioWav(3433267939, 30);
  await page.route('**/mock-assets/audio/**', (route) =>
    route.fulfill({ body: audio, contentType: 'audio/wav' }),
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
