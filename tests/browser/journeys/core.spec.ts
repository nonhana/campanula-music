import { expect, login, test } from '../fixture.ts';

test('通过歌曲菜单导航专辑和歌手，再播放每日推荐', async ({ page }) => {
  await login(page, '/playlists/900000024');
  await page
    .locator('main [data-song-id="3433267939"]')
    .getByRole('button', { name: /^更多操作/ })
    .click();
  await page.getByRole('menuitem', { name: '查看专辑' }).click();
  await expect(page).toHaveURL(/\/albums\/3149073$/);
  await expect(
    page.getByRole('heading', { name: '测试专辑', exact: true }),
  ).toBeVisible();
  await page
    .locator('main [data-song-id="3433267939"]')
    .getByRole('button', { name: /^更多操作/ })
    .click();
  await page.getByRole('menuitem', { name: /^查看歌手/ }).click();
  await expect(page).toHaveURL(/\/artists\/33927412$/);
  await expect(
    page.getByRole('heading', { name: '测试歌手', exact: true }),
  ).toBeVisible();
  await page.goto('/daily');
  await page.getByRole('button', { name: '播放全部', exact: true }).click();
  await expect(page.getByRole('button', { name: /^打开播放页/ })).toBeVisible();
});

test('搜索正常、空、失败提示和重新搜索恢复', async ({
  page,
  environment,
  scan,
}) => {
  await login(page, '/search');
  const search = page.getByRole('combobox', { name: '搜索', exact: true });
  await search.fill('夏に');
  await search.press('Enter');
  await expect(page).toHaveURL(/q=/);
  await expect(page.locator('main [data-song-id]').first()).toBeVisible();
  await scan('search-results');
  await environment.reset();
  await page.request.post('/api/mock/scenario', {
    data: { name: 'empty-search' },
  });
  await search.fill('没有匹配');
  await search.press('Enter');
  await expect(page.getByText(/没有找到|没有相关/).first()).toBeVisible();
  await scan('search-empty');
  await page.request.post('/api/mock/scenario', { data: { name: 'offline' } });
  await search.fill('how');
  await search.press('Enter');
  await expect(
    page.getByRole('button', { name: '重试', exact: true }).first(),
  ).toBeVisible();
  await scan('search-failed');
  await environment.reset();
  await page.getByRole('button', { name: '重试', exact: true }).first().click();
  await expect(page.locator('main [data-song-id]').first()).toBeVisible();
});

test('退出账号后进入登录画面', async ({ page, scan }, info) => {
  await login(page);
  if (info.project.name === 'phone') {
    await page.getByRole('link', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '退出登录', exact: true }).click();
  } else {
    const account = page.getByRole('button', { name: /^账号/ });
    await account.focus();
    await page.keyboard.press('ArrowDown');
    await expect(
      page.getByRole('menuitem', { name: '设置', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(account).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(
      page.getByRole('menuitem', { name: '设置', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('End');
    await expect(
      page.getByRole('menuitem', { name: '退出登录' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
  }
  const dialog = page.getByRole('dialog', { name: /退出登录/ });
  await scan('account-logout');
  await dialog.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '用网易云账号登录' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '用网易云账号登录' }),
  ).toBeVisible();
});
