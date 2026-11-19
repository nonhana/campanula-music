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

test('曲库返回恢复横架位置，多歌手分隔、窄屏布局、空已下载与设置标题一致', async ({
  page,
}, info) => {
  await page.request.post('/api/mock/scenario', { data: { name: 'large' } });
  await login(page, '/');
  if (info.project.name === 'desktop') {
    const strip = page.getByRole('list', { name: /^我喜欢的音乐的前/ });
    await expect(strip.getByRole('listitem').first()).toBeVisible();
    await expect(
      strip.getByRole('listitem').filter({ hasText: ' / ' }).first(),
    ).toBeVisible();
    await strip.evaluate((node) => {
      node.scrollLeft = 240;
    });
    const shelf = page.locator('[data-shelf="自建歌单"]');
    await expect(shelf).toBeVisible();
    await shelf.evaluate((node) => {
      node.scrollLeft = 260;
    });
    const visibleHref = await shelf.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return (
        [...node.querySelectorAll<HTMLAnchorElement>('a[href]')]
          .find((a) => {
            const rect = a.getBoundingClientRect();
            return rect.left >= box.left + 8 && rect.right <= box.right - 8;
          })
          ?.getAttribute('href') ?? null
      );
    });
    expect(visibleHref).not.toBeNull();
    await shelf.locator(`a[href="${visibleHref}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${visibleHref}$`));
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(() => strip.evaluate((n) => n.scrollLeft))
      .toBeGreaterThan(100);
    await expect
      .poll(() => shelf.evaluate((n) => n.scrollLeft))
      .toBeGreaterThan(100);

    await page.setViewportSize({ width: 768, height: 900 });
    await page.getByRole('button', { name: '展开导航', exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        strip
          .getByRole('listitem')
          .first()
          .evaluate((n) => n.getBoundingClientRect().width),
      )
      .toBeGreaterThanOrEqual(180);

    await page.goto('/downloads');
    await expect(
      page.getByText('还没有下载的歌', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('searchbox', { name: '在已下载里搜索' }),
    ).toHaveCount(0);

    await page.goto('/settings');
    await expect(page).toHaveTitle('设置 · Campanula');
    return;
  }

  await page.goto('/daily');
  await expect(page.locator('main [data-song-id]').first()).toBeVisible();
  await expect(page.getByText('30 首', { exact: true })).toHaveCount(1);

  await page.goto('/search?q=%E7%9C%9F%E5%A4%9C%E4%B8%AD&type=songs');
  await expect(page.locator('main [data-song-id]').first()).toBeVisible();
  await expect(page.getByText('30 首', { exact: true })).toHaveCount(0);

  await page.goto('/settings');
  await expect(page).toHaveTitle('设置 · Campanula');
});

test('首次同步失败与启动失败保持正确标题与语义', async ({ page }, info) => {
  await page.route('**/api/playlists?*', (route) =>
    route.fulfill({ status: 500, body: '' }),
  );
  await login(page, '/');
  await expect(
    page.getByText('我喜欢的音乐没能同步', { exact: true }),
  ).toBeVisible();
  if (info.project.name === 'phone') {
    await expect(
      page.getByText('这张歌单没能加载', { exact: true }),
    ).toHaveCount(0);
  }
  await page.unroute('**/api/playlists?*');
  await page.request.post('/api/mock/scenario', { data: { name: 'offline' } });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});
