import { expect, login, test } from '../fixture.ts';

test('保存歌单名称，刷新后同一歌单保留新名字', async ({ page }) => {
  await login(page, '/playlists/900000019');
  await expect(
    page.getByRole('heading', { name: 'poems', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '歌单操作：poems' }).click();
  await page.getByRole('menuitem', { name: '编辑歌单信息' }).click();
  const dialog = page.getByRole('dialog', { name: '编辑歌单信息' });
  await dialog.getByRole('textbox', { name: '歌单名称' }).fill('');
  await expect(
    dialog.getByRole('button', { name: '保存', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole('textbox', { name: '歌单名称' })
    .fill('浏览器保存的歌单');
  await test.step('通过保存按钮提交并显示新名字', async () => {
    await dialog.getByRole('button', { name: '保存', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '浏览器保存的歌单', exact: true }),
    ).toBeVisible();
  });
  await page.reload();
  await expect(page).toHaveURL(/\/playlists\/900000019$/);
  await expect(
    page.getByRole('heading', { name: '浏览器保存的歌单', exact: true }),
  ).toBeVisible();
});

test('保存被拒绝时显示失败并回到原名，恢复后可再保存', async ({
  page,
  scan,
}) => {
  await login(page, '/playlists/900000019');
  await page.route('**/api/playlists/900000019/name', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { kind: 'neteaseUnavailable' } },
    }),
  );
  await page.getByRole('button', { name: '歌单操作：poems' }).click();
  await page.getByRole('menuitem', { name: '编辑歌单信息' }).click();
  await page.getByRole('textbox', { name: '歌单名称' }).fill('被拒绝的修改');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'poems', exact: true }),
  ).toBeVisible();
  await scan('save-failed');
  await page.unroute('**/api/playlists/900000019/name');
  await page.getByRole('button', { name: '歌单操作：poems' }).click();
  await page.getByRole('menuitem', { name: '编辑歌单信息' }).click();
  await page.getByRole('textbox', { name: '歌单名称' }).fill('恢复后的修改');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '恢复后的修改', exact: true }),
  ).toBeVisible();
});
