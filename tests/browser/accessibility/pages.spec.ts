import { expect, login, test } from '../fixture.ts';

for (const [name, path, heading] of [
  ['library', '/', '我喜欢的音乐'],
  ['playlist', '/playlists/900000024', 'Mock · 4 首可播放'],
  ['album', '/albums/3149073', '测试专辑'],
  ['artist', '/artists/33927412', '测试歌手'],
  ['daily', '/daily', '每日推荐'],
  ['downloads-empty', '/downloads', '已下载'],
] as const) {
  test(`全页扫描 ${name}`, async ({ page, scan }) => {
    await login(page, path);
    if (name === 'daily')
      await expect(page.locator('main [data-song-id]').first()).toBeVisible();
    else
      await expect(
        page.getByRole('heading', { name: heading, exact: true }).first(),
      ).toBeVisible();
    await expect(page.locator('main [aria-busy=true]')).toHaveCount(0);
    await scan(name);
  });
}

test('全页扫描歌单菜单与编辑弹窗', async ({ page, scan }) => {
  await login(page, '/playlists/900000019');
  await page.getByRole('button', { name: '歌单操作：poems' }).click();
  await expect(
    page.getByRole('menuitem', { name: '编辑歌单信息' }),
  ).toBeVisible();
  await scan('playlist-menu');
  await page.getByRole('menuitem', { name: '编辑歌单信息' }).click();
  await expect(page.getByRole('textbox', { name: '歌单名称' })).toBeFocused();
  await scan('playlist-editor');
});
