import { expect, login, test } from '../fixture.ts';

test('键盘把歌曲加入歌单，关闭浮层返回原歌曲并刷新读回', async ({
  page,
  scan,
}) => {
  await login(page, '/playlists/900000024');
  const row = page.locator('main [data-song-id="3433267939"]');
  const more = row.getByRole('button', { name: /^更多操作/ });
  await more.focus();
  await page.keyboard.press('Enter');
  const add = page.getByRole('menuitem', { name: '加入歌单', exact: true });
  await expect(page.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem').nth(1)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(add).toBeFocused();
  await page.keyboard.press('Enter');
  const target = page.getByRole('menuitem', { name: /^poems/ });
  await expect(target).toBeEnabled();
  await scan('add-to-playlist');
  await expect(page.getByRole('menuitem', { name: '新建歌单' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(target).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(add).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: '新建歌单' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(target).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(more).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(more).not.toBeFocused();
  await page.keyboard.press('Tab');
  await expect(more).toBeFocused();
  await expect(more).toHaveCSS('outline-style', 'solid');
  await page.goto('/playlists/900000019');
  await expect(page.locator('main [data-song-id="3433267939"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('main [data-song-id="3433267939"]')).toBeVisible();
});

test('编辑弹窗的 Tab 循环和 Escape 恢复焦点', async ({ page, scan }) => {
  await login(page, '/playlists/900000019');
  const trigger = page.getByRole('button', { name: '歌单操作：poems' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem').first()).toBeFocused();
  const edit = page.getByRole('menuitem', { name: '编辑歌单信息' });
  for (
    let i = 0;
    i < 4 && !(await edit.evaluate((el) => el === document.activeElement));
    i++
  )
    await page.keyboard.press('ArrowDown');
  await expect(edit).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '编辑歌单信息' });
  await expect(dialog.getByRole('textbox', { name: '歌单名称' })).toBeFocused();
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press('Tab');
    await expect
      .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  await expect
    .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
    .toBe(true);
  await scan('dialog-keyboard');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem').first()).toBeFocused();
  for (
    let i = 0;
    i < 4 && !(await edit.evaluate((el) => el === document.activeElement));
    i++
  )
    await page.keyboard.press('ArrowDown');
  await expect(edit).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('textbox', { name: '歌单名称' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
