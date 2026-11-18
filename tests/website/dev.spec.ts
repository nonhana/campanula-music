import { expect, test } from './fixture.ts';

test('docs:dev 的目录入口真正执行示例，首页可进入指南，独立播放页可播放，深链刷新也可用', async ({
  page,
  request,
}) => {
  for (const path of [
    '/demo/',
    '/demo/playlists/',
    '/demo/playlists/501/',
    '/demo/playlists/502/',
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text()).toContain(
      '<title>Campanula 示例播放器</title>',
    );
  }
  await page.goto('/');
  await expect(page.locator('#home-source')).toBeVisible();
  await page.locator('#home-deploy').click();
  await expect(
    page.getByRole('heading', { name: '部署 Campanula' }),
  ).toBeVisible();
  await page.goto('/demo/?screen=player');
  const player = page.getByRole('dialog', { name: '正在播放', exact: true });
  await player.getByRole('button', { name: '播放', exact: true }).click();
  await expect(page.getByRole('status', { name: '播放状态' })).toContainText(
    '正在播放：Window Light',
  );
  await page.goto('/demo/playlists/501/');
  await expect(page.locator('main [data-song-id="101"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('main [data-song-id="103"]')).toBeVisible();
});
