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
      await page.evaluate(() => document.documentElement.scrollWidth),
      path,
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
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
  const copy = page.getByRole('button', { name: '复制到剪贴板' });
  await copy.press('Enter');
  await expect(copy).toBeFocused();
  await expect(
    page.locator('.expressive-code [aria-live="polite"]'),
  ).toHaveText('复制成功！');
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
  await expect(page.locator('html')).not.toHaveAttribute('data-home-opening');
  await expect(page.locator('#home-deploy')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('代码块内的复制按钮在横向滚动时留在右上角，窄屏表格留在正文内', async ({
  page,
}, info) => {
  if (info.project.name === 'phone')
    await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/guide/server/');
  await page.evaluate(() => document.fonts.ready);
  const code = page.locator('article pre').first();
  const copy = page.getByRole('button', { name: '复制到剪贴板' }).first();
  await expect(copy).toBeVisible();
  await expect(copy).toHaveText('');
  await expect(copy).toHaveCSS('opacity', '1');
  await expect(code).toHaveAttribute('tabindex', '0');
  const card = await code.locator('..').boundingBox();
  const button = await copy.boundingBox();
  expect(button!.y - card!.y).toBeLessThan(12);
  expect(card!.x + card!.width - button!.x - button!.width).toBeLessThan(12);
  expect(button!.x).toBeGreaterThan(card!.x);
  const scrolled = await code.evaluate((pre) => {
    pre.scrollLeft = pre.scrollWidth;
    return pre.scrollLeft;
  });
  expect(scrolled).toBeGreaterThan(0);
  expect(await copy.boundingBox()).toEqual(button);

  const tables = page.getByRole('table');
  await expect(tables).toHaveCount(2);
  for (const table of await tables.all()) {
    const header = table.getByRole('columnheader').first();
    const cell = table.getByRole('cell').first();
    expect(
      await header.evaluate((th) => getComputedStyle(th).backgroundColor),
    ).not.toBe(
      await table.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    );
    expect(
      await cell.evaluate((td) =>
        Number.parseFloat(getComputedStyle(td).paddingInlineStart),
      ),
    ).toBeGreaterThan(0);
    expect(
      await table.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('表格和代码块四角完整，单行代码的复制图标上下等距', async ({
  page,
}, info) => {
  if (info.project.name === 'phone')
    await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/guide/vercel/');
  await page.evaluate(() => document.fonts.ready);
  const frame = page.locator('.expressive-code .frame').first();
  const table = page.getByRole('table').first();
  for (const [container, label] of [
    [frame, '代码块'],
    [table, '表格'],
  ] as const) {
    await container.scrollIntoViewIfNeeded();
    expect
      .soft(
        await container.evaluate((element) => {
          const { left, right, top, bottom } = element.getBoundingClientRect();
          const center = document.elementFromPoint(
            (left + right) / 2,
            (top + bottom) / 2,
          );
          const corners = [
            [left + 3, top + 3],
            [right - 3, top + 3],
            [left + 3, bottom - 3],
            [right - 3, bottom - 3],
          ] as const;
          return (
            element.contains(center) &&
            corners.every(
              ([x, y]) => !element.contains(document.elementFromPoint(x, y)),
            )
          );
        }),
        label,
      )
      .toBe(true);
  }
  await frame.scrollIntoViewIfNeeded();
  const copy = frame.getByRole('button', { name: '复制到剪贴板' });
  const cardBounds = (await frame.boundingBox())!;
  const buttonBounds = (await copy.boundingBox())!;
  const top = buttonBounds.y - cardBounds.y;
  const bottom =
    cardBounds.y + cardBounds.height - (buttonBounds.y + buttonBounds.height);
  expect.soft(bottom).toBeGreaterThan(0);
  expect.soft(top).toBeCloseTo(bottom, 0);
});

test.describe('关闭 JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('首页文档和源码链接可用，读者可以打开部署、目录、文章和 404 出口', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Campanula', exact: true }),
    ).toBeVisible();
    for (const [label, href] of [
      ['部署指南', '/guide/'],
      ['安装与离线播放', '/guide/listen/'],
      ['升级与回退', '/guide/upgrade/'],
      ['本地开发', '/development/'],
    ])
      await expect(
        page.getByRole('link', { name: label, exact: true }),
      ).toHaveAttribute('href', href);
    await expect(page.getByRole('link', { name: /GitHub/ })).toHaveAttribute(
      'href',
      /^https:\/\/github\.com\/nonhana\/campanula-music\b/,
    );
    await expect(page.locator('iframe, audio')).toHaveCount(0);
    await page.locator('#home-deploy').click();
    await page.locator('#deploy-vercel').click();
    await expect(page.locator('.chapter-link').first()).toBeVisible();
    await page.locator('.chapter-link').last().click();
    await expect(page).toHaveURL(/#/);
    await expect(
      page.getByRole('button', { name: '复制到剪贴板' }),
    ).toHaveCount(0);
    await expect(page.locator('article pre code')).toHaveText(
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
  await expect(page.locator('html')).not.toHaveAttribute('data-home-opening');
  const brand = (await page.locator('.home-brand [data-brand]').boundingBox())!;
  const top = (await page.locator('.home-brand').boundingBox())!;
  const bottom = (await page.locator('.more-guides').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(brand.x + brand.width / 2).toBeCloseTo(viewport.width / 2, 0);
  expect((top.y + bottom.y + bottom.height) / 2).toBeCloseTo(
    viewport.height / 2,
    0,
  );
  await expect(page.locator('.home-brand')).toBeVisible();
  await scan('home');
  await page.locator('#home-deploy').click();
  await page.locator('#reading-back').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-home-opening');
  await expect(page.locator('#home-deploy')).toBeFocused();
});
