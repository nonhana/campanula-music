import { expect, login, test } from '../fixture.ts';

test('歌曲菜单按钮都有名称', async ({ page, scan }) => {
  await login(page, '/playlists/900000024');
  await expect(page.locator('main [data-song-id]')).toHaveCount(4);
  await scan('song-buttons');
});
