import { expect, login, test } from '../fixture.ts';

for (const width of [768, 1024]) {
  test(`布局断点 ${width} 无页面横向溢出`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page, '/playlists/900000024');
    await expect(page.locator('main [data-song-id]')).toHaveCount(4);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    await expect(page.locator('main [aria-busy=true]')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForTimeout(250);
    await page.screenshot({
      path: info.outputPath(`layout-${width}.png`),
      fullPage: true,
    });
  });
}

test('慢响应显示加载、空歌单、断连提示与恢复', async ({ page, scan }) => {
  await page.request.post('/api/mock/scenario', { data: { name: 'slow' } });
  await login(page, '/playlists/900000024');
  await expect(page.locator('main [aria-busy=true]').first()).toBeVisible();
  await expect(page.locator('main [data-song-id]')).toHaveCount(4);
  await scan('playlist-slow-recovered');
  await page.request.post('/api/mock/scenario', {
    data: { name: 'empty-playlist' },
  });
  await page.goto('/playlists/900000019');
  await expect(
    page.getByText('这张歌单还没有歌', { exact: true }),
  ).toBeVisible();
  await scan('playlist-empty');
  await page.context().setOffline(true);
  await expect(page.getByText(/已离线|网络已断开|离线/).first()).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByText('已离线', { exact: true })).toHaveCount(0);
});
