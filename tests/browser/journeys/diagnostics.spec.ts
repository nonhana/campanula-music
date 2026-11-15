import { audioWav } from '../../_kit/mock/assets.ts';
import {
  hidden,
  install,
  keys,
  motion,
  roundtrip,
  sheet,
  shoot,
  slow,
  tween,
} from '../../tools/browser/sweep.ts';
import { expect, login, test } from '../fixture.ts';

test('独立截图、返回恢复、键盘、逐帧、慢放与抽屉诊断', async ({
  page,
}, info) => {
  await page.route('**/mock-assets/audio/**', (route) =>
    route.fulfill({ body: audioWav(3433267939, 30), contentType: 'audio/wav' }),
  );
  await install(page, { freshImages: true });
  await login(page, '/playlists');
  await expect(
    page.getByRole('link', { name: /^Mock · 4 首可播放/ }).first(),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const navigation = await motion(
    page,
    info,
    'navigation',
    undefined,
    () =>
      page
        .getByRole('link', { name: /^Mock · 4 首可播放/ })
        .first()
        .click(),
    [0, 150],
  );
  expect(
    navigation.anims.some((animation) =>
      animation.includes('::view-transition'),
    ),
  ).toBe(true);
  await page.goBack();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await roundtrip(
    page,
    page.getByRole('link', { name: /^Mock · 4 首可播放/ }).first(),
  );
  await page.goto('/playlists/900000024');
  const result = await shoot(page, info, 'playlist');
  expect(result.moves).toEqual([]);
  await expect(page.locator('main img').first()).toHaveAttribute(
    'src',
    /_fresh=/,
  );
  expect(
    await page.evaluate<string[]>(
      'Object.keys(window.__campanulaReplay.recorded)',
    ),
  ).toContain('/api/account');
  const steps = await keys(
    page,
    ['Enter', 'ArrowDown', 'Escape'],
    page
      .locator('main [data-song-id="3433267939"]')
      .getByRole('button', { name: /^更多操作/ }),
  );
  expect(steps.at(-1)?.ring).toBe(true);
  await expect(
    page
      .locator('main [data-song-id="3433267939"]')
      .getByRole('button', { name: /^更多操作/ }),
  ).toBeFocused();
  await expect(
    page.locator('[data-overlay="song-menu"] [role=region]'),
  ).toHaveCount(0);
  const reduced = await motion(
    page,
    info,
    'menu-reduced',
    '[data-overlay="playlist-menu"] > [role="region"]:not([inert])',
    () => page.getByRole('button', { name: /^歌单操作/ }).click(),
    [0, 150],
  );
  expect(reduced.anims.length).toBeGreaterThan(0);
  for (const animation of reduced.anims) {
    expect(animation).toMatch(/^\d+(?:\.\d+)?ms opacity$/);
    expect(Number.parseFloat(animation)).toBeLessThanOrEqual(150);
  }
  await page.keyboard.press('Escape');
  await expect(
    page.locator('[data-overlay="playlist-menu"] [role=region]'),
  ).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const frames = await motion(
    page,
    info,
    'menu',
    '[data-overlay="playlist-menu"] > [role="region"]:not([inert])',
    () => page.getByRole('button', { name: /^歌单操作/ }).click(),
    [0, 60, 150],
  );
  expect(frames.files).toHaveLength(3);
  expect(
    frames.anims.some(
      (animation) =>
        Number.parseFloat(animation) === 200 &&
        animation.includes('translate') &&
        animation.includes('scale'),
    ),
  ).toBe(true);
  await sheet(page, info, 'menu', frames.files);
  await page.keyboard.press('Escape');
  await slow(page, [
    () => page.getByRole('button', { name: /^歌单操作/ }).click(),
    () => page.keyboard.press('Escape'),
  ]);
  await page
    .locator('main [data-song-id="3433267939"] [data-play-target]')
    .click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: /^打开播放页/ }).click();
  const unseen = await hidden(page, () =>
    page
      .getByRole('dialog', { name: '正在播放', exact: true })
      .getByRole('button', { name: '下一首', exact: true })
      .click(),
  );
  expect(unseen.startedWhileHidden).toBe(0);
  expect(unseen.startedAfterShow).toBe(0);
  const pause = page
    .getByRole('dialog', { name: '正在播放', exact: true })
    .getByRole('button', { name: '暂停', exact: true });
  if (await pause.count()) await pause.click();
  await page.getByRole('button', { name: '收起播放页', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: '正在播放', exact: true }),
  ).toHaveCount(0);
  const files = await tween(
    page,
    info,
    'player',
    () => page.getByRole('button', { name: /^打开播放页/ }).click(),
    () => page.getByRole('button', { name: '收起播放页', exact: true }).click(),
    [0, 150],
  );
  expect(files).toHaveLength(2);
});
