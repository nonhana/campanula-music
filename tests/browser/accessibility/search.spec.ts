import { expect, login, test } from '../fixture.ts';

test('搜索建议和历史弹层的名称、关联、键盘选择与收起', async ({
  page,
  scan,
}, info) => {
  await login(page, '/search');
  const search = page.getByRole('combobox', { name: '搜索', exact: true });
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await search.fill('夏に');
  const suggestions = page.getByRole('listbox', { name: '搜索建议' });
  await expect(suggestions).toBeVisible();
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  await expect(search).toHaveAttribute(
    'aria-controls',
    (await suggestions.getAttribute('id'))!,
  );
  await search.press('ArrowDown');
  const active = suggestions.getByRole('option').first();
  await expect(active).toHaveAttribute('aria-selected', 'true');
  await expect(search).toHaveAttribute(
    'aria-activedescendant',
    (await active.getAttribute('id'))!,
  );
  await expect(search).toBeFocused();
  await scan('search-suggestions');
  await search.press('Enter');
  await expect(page.locator('main [data-song-id]').first()).toBeVisible();
  await expect(suggestions).toHaveCount(0);
  await search.fill('Theme');
  await search.press('Enter');
  await expect(page).toHaveURL(/q=Theme/);
  await expect(
    page.getByRole('heading', { name: /^“Theme”\s*的搜索结果$/ }),
  ).toBeVisible();
  await expect(page.locator('main [data-song-id]').first()).toBeVisible();
  await page.goto('/search');
  await search.fill('');
  await expect(page.getByRole('heading', { name: '搜索历史' })).toBeVisible();
  await scan('search-history');
  const history = page.getByRole(
    info.project.name === 'desktop' ? 'dialog' : 'region',
    { name: '搜索历史', exact: true },
  );
  const clear = history.getByRole('button', { name: '清空', exact: true });
  const newest = history.getByRole('button', { name: 'Theme', exact: true });
  const oldest = history.getByRole('button', { name: '夏に', exact: true });
  if (info.project.name === 'desktop') {
    await expect(search).toHaveAttribute('aria-expanded', 'true');
    await expect(search).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(search).toHaveAttribute(
      'aria-controls',
      (await history.getAttribute('id'))!,
    );
    await search.press('ArrowDown');
    await expect(newest).toBeFocused();
    await page.keyboard.press('Enter');
  } else await newest.press('Enter');
  await expect(page).toHaveURL(/q=Theme/);
  await expect(
    page.getByRole('heading', { name: /^“Theme”\s*的搜索结果$/ }),
  ).toBeVisible();
  await expect(search).toHaveValue('Theme');
  await expect(history).toHaveCount(0);
  await expect(page.locator('main [data-song-id]').first()).toBeVisible();
  await search.fill('');
  if (info.project.name === 'desktop') {
    await search.press('ArrowDown');
    await expect(newest).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(search).toBeFocused();
    await expect(search).toHaveAttribute('aria-expanded', 'false');
    await expect(history).toHaveCount(0);
    await search.fill('');
    await search.press('ArrowUp');
    await expect(oldest).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /^账号：/ })).toBeFocused();
    await expect(history).toHaveCount(0);
    await expect(search).toHaveAttribute('aria-expanded', 'false');
    await search.fill('');
    await search.press('ArrowDown');
    await expect(newest).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(clear).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(search).toBeFocused();
    await search.press('ArrowDown');
    await expect(newest).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(clear).toBeFocused();
    await page.keyboard.press('Enter');
  } else await clear.press('Enter');
  await expect(history).toHaveCount(0);
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await scan('search-history-cleared');
});
