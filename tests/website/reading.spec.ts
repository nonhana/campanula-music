import { expect, test } from './fixture.ts';

test('所有正式文章直接刷新可读，目录与正文没有横向溢出', async ({
  page,
  scan,
}) => {
  for (const path of [
    '/guide/server/',
    '/guide/docker/',
    '/guide/node/',
    '/guide/upgrade/',
    '/guide/listen/',
    '/development/',
    '/404.html',
  ]) {
    await page.goto(path);
    await page.reload();
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
    await scan(path.replaceAll('/', '-') || 'home');
  }
});

test('首页、部署选择、长文目录、复制命令和返回保留阅读位置与焦点', async ({
  page,
  context,
  baseURL,
  scan,
}, info) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/guide/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '跳到正文' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await scan('guide');
  const entry = page.locator('#deploy-vercel');
  await entry.focus();
  await entry.press('Enter');
  await expect(page).toHaveURL(/\/guide\/vercel\/$/);
  await expect(page.locator('h1')).toBeVisible();
  const menu = page.locator('#chapter-menu');
  const toggle = page.locator('#chapter-toggle');
  if (info.project.name === 'phone') {
    await expect(menu).not.toHaveAttribute('open');
    await toggle.focus();
    await toggle.press('Enter');
    await expect(menu).toHaveAttribute('open');
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(menu).not.toHaveAttribute('open');
    await toggle.press('Enter');
  }
  const chapter = page.locator('.chapter-link').last();
  const hash = await chapter.getAttribute('href');
  await chapter.click();
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).hash))
    .toBe(hash);
  if (info.project.name === 'phone') {
    await expect(menu).not.toHaveAttribute('open');
    await expect(page.locator(hash!)).toBeFocused();
  }
  await page.reload();
  await expect(page.locator(hash!)).toBeInViewport();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: baseURL,
  });
  await page.getByRole('button', { name: '复制命令' }).click();
  await expect(page.getByRole('status')).toHaveText('已复制');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'openssl rand -base64 32',
  );
  await scan('vercel');
  await page.locator('#reading-back').click();
  await expect(page).toHaveURL(/\/guide\/(?:#main)?$/);
  await expect(entry).toBeFocused();
  expect(requests.filter((url) => /\/demo\/|\.mp3(?:\?|$)/.test(url))).toEqual(
    [],
  );
  await page.locator('#development-guide').focus();
  const before = await page.evaluate(() => scrollY);
  await page.locator('#development-guide').press('Enter');
  await page.goBack();
  await expect(page.locator('#development-guide')).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
  await page.locator('#reading-back').click();
  await expect(page).toHaveURL(`${baseURL}/`);
  expect(await page.locator('html').getAttribute('data-home-enter')).toBeNull();
  await expect(page.locator('#home-deploy')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test.describe('关闭 JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('仍能从首页截图进入部署、目录、文章和 404 出口', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.demo-note')).toContainText('开启 JavaScript');
    expect(
      await page
        .locator('.demo-still img')
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    ).toBe(true);
    await expect(page.locator('#demo-frame')).not.toHaveAttribute('src');
    await page.locator('#home-deploy').click();
    await page.locator('#deploy-vercel').click();
    await expect(page.locator('.chapter-link').first()).toBeVisible();
    await page.locator('.chapter-link').last().click();
    await expect(page).toHaveURL(/#/);
    await expect(page.locator('[data-copy-command]')).toBeDisabled();
    await expect(page.locator('.copy-command code')).toHaveText(
      'openssl rand -base64 32',
    );
    await page.locator('#reading-back').click();
    await page.locator('#deploy-server').click();
    await page.locator('a[href="/guide/node/"]').first().click();
    await expect(page.locator('h1')).toBeVisible();
    expect((await page.goto('/missing-guide/'))?.status()).toBe(404);
    await page.locator('#reading-back').click();
    await expect(page).toHaveURL(/\/guide\/$/);
    await page.goto('/demo/');
    await expect(page.locator('#demo-fallback')).toBeVisible();
    await expect(page.locator('#demo-fallback img')).toBeVisible();
    await page.locator('#demo-fallback a[href="/guide/"]').click();
    await expect(page).toHaveURL(/\/guide\/$/);
  });
});

test('首页往返保留品牌、入口焦点与 axe 证据', async ({ page, scan }) => {
  await page.goto('/');
  await expect(page.locator('.demo-window')).toHaveAttribute('data-ready', '');
  await expect(page.locator('.home-brand')).toBeVisible();
  await scan('home');
  await page.locator('#home-deploy').click();
  await page.locator('#reading-back').click();
  expect(await page.locator('html').getAttribute('data-home-enter')).toBeNull();
  await expect(page.locator('#home-deploy')).toBeFocused();
});
