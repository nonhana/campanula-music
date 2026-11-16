import { auditContrast as audit } from '../../tools/browser/contrast.ts';
import { expect, login, test } from '../fixture.ts';

test('日期图形内的可见文字在页面和日历入口保持对比度', async ({
  page,
}, info) => {
  await login(page);
  if (info.project.name === 'phone') {
    const calendar = page.getByRole('link', { name: /^每日推荐 ·/ });
    const date = calendar.locator('span[aria-hidden="true"]');
    await audit(page, info, 'daily-icon-default', {
      'daily-number.icon': date,
    });
    await calendar.focus();
    await audit(page, info, 'daily-icon-focus', { 'daily-number.icon': date });
  }
  await page.goto('/daily');
  await expect(page.locator('main [data-song-id]').first()).toBeVisible();
  const date = page.locator('main span.page, main span.phone');
  await audit(page, info, 'daily-page', { 'daily-number.page': date });
});

test('歌手排序的未选、选中和交互状态保持文字对比度', async ({ page }, info) => {
  await login(page, '/artists/33927412');
  const popular = page.locator('#artist-order-hot-tab');
  const latest = page.locator('#artist-order-time-tab');
  await expect(latest).toBeVisible();
  await audit(page, info, 'artist-sort-default', {
    'segmented.artist-order.popular': popular,
    'segmented.artist-order.latest': latest,
  });
  if (info.project.name === 'desktop') await latest.hover();
  else await latest.focus();
  await audit(page, info, 'artist-sort-interaction', {
    'segmented.artist-order.latest': latest,
  });
  await latest.click();
  await expect(latest).toHaveAttribute('aria-checked', 'true');
  await page.mouse.move(0, 0);
  await audit(page, info, 'artist-sort-selected', {
    'segmented.artist-order.popular': popular,
    'segmented.artist-order.latest': latest,
  });
});

test('歌单编辑计数和标签分组在初始、边界和裁切恢复状态保持对比度', async ({
  page,
}, info) => {
  await login(page, '/playlists/900000019');
  await page.getByRole('button', { name: '歌单操作：poems' }).click();
  await page.getByRole('menuitem', { name: '编辑歌单信息' }).click();
  const dialog = page.getByRole('dialog', {
    name: '编辑歌单信息',
    exact: true,
  });
  const name = dialog.getByRole('textbox', { name: '歌单名称', exact: true });
  const description = dialog.getByRole('textbox', {
    name: '简介',
    exact: true,
  });
  await expect(
    dialog.getByRole('group', { name: '语种', exact: true }),
  ).toBeVisible();
  const counters = {
    'text-field.name-counter': dialog.locator(
      'label[for="playlist-editor-name"] + span',
    ),
    'playlist-editor.description-counter': dialog.locator(
      'label[for="playlist-editor-description"] + span',
    ),
    'tag-picker.counter': dialog.locator(
      '[aria-labelledby="tag-picker-label"] > p > [role="status"]',
    ),
  };
  await audit(page, info, 'editor-counters-initial', counters);
  await name.fill('文'.repeat(20));
  await description.fill('文'.repeat(1000));
  await dialog.getByRole('button', { name: '华语', exact: true }).click();
  await dialog.getByRole('button', { name: '流行', exact: true }).click();
  await dialog.getByRole('button', { name: '清晨', exact: true }).click();
  await name.scrollIntoViewIfNeeded();
  await audit(page, info, 'editor-counters-boundary', counters);
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  await name.fill('文'.repeat(21));
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await audit(page, info, 'editor-name-error', {
    'text-field.name-counter': counters['text-field.name-counter'],
  });
  if (info.project.name === 'desktop') {
    const scroller = dialog.locator(
      '[aria-labelledby="tag-picker-label"] > div',
    );
    await scroller.evaluate((node) => {
      const heading = node.querySelector(
        '[role="group"][aria-label="场景"] > span',
      )!;
      node.scrollTop +=
        heading.getBoundingClientRect().top -
        node.getBoundingClientRect().top +
        12;
    });
    const clipping = await scroller.evaluate((node) => ({
      scrollTop: node.scrollTop,
      viewport: node.getBoundingClientRect().toJSON(),
      heading: node
        .querySelector('[role="group"][aria-label="场景"] > span')!
        .getBoundingClientRect()
        .toJSON(),
    }));
    await info.attach('tag-heading-clipping', {
      body: JSON.stringify(clipping),
      contentType: 'application/json',
    });
    expect(clipping.heading.top).toBeLessThan(clipping.viewport.top);
    await audit(
      page,
      info,
      'tag-heading-clipped',
      {
        'tag-picker.group-heading': dialog.locator(
          '[role="group"][aria-label="场景"] > span',
        ),
      },
      'clipped',
    );
  }
  for (const group of ['语种', '风格', '场景']) {
    const heading = dialog.locator(
      `[role="group"][aria-label="${group}"] > span`,
    );
    await heading.evaluate((node) =>
      node.scrollIntoView({ block: 'center', inline: 'nearest' }),
    );
    await audit(page, info, `tag-heading-${group}`, {
      'tag-picker.group-heading': heading,
    });
  }
});

test('搜索入口和歌单格子在架子裁切、露出与失败状态保持对比度', async ({
  page,
  environment,
}, info) => {
  await login(page, '/search');
  const search = page.getByRole('combobox', { name: '搜索', exact: true });
  await search.fill('夏に');
  await search.press('Enter');
  await expect(page.locator('main [data-song-id]').first()).toBeVisible();
  const seeAll = page
    .locator('section[aria-labelledby="overview-songs"]')
    .getByRole('link', { name: '查看全部', exact: true });
  await audit(page, info, 'search-see-all-default', {
    'text-button.search-see-all': seeAll,
  });
  if (info.project.name === 'desktop') await seeAll.hover();
  else await seeAll.focus();
  await audit(page, info, 'search-see-all-interaction', {
    'text-button.search-see-all': seeAll,
  });
  const tile = page.locator(
    'section[aria-labelledby="overview-playlists"] a[href="/playlists/900000024"]',
  );
  await expect(tile).toHaveCount(1);
  const targets = {
    'playlist-tile.name': tile.getByText('Mock · 4 首可播放', { exact: true }),
    ...(info.project.name === 'phone'
      ? {
          'playlist-tile.creator': tile.getByText('· 测试听众', {
            exact: true,
          }),
        }
      : {}),
  };
  await audit(page, info, 'playlist-tile-clipped', targets, 'clipped');
  await tile.evaluate((node) =>
    node.scrollIntoView({ block: 'center', inline: 'center' }),
  );
  await audit(page, info, 'playlist-tile-visible', targets);
  await environment.reset();
  await page.request.post('/api/mock/scenario', { data: { name: 'offline' } });
  await search.fill('how');
  await search.press('Enter');
  await expect(
    page.getByRole('button', { name: '重试', exact: true }).first(),
  ).toBeVisible();
  const failedSeeAll = page
    .locator('section[aria-labelledby="overview-songs"]')
    .getByRole('link', { name: '查看全部', exact: true });
  await failedSeeAll.scrollIntoViewIfNeeded();
  await audit(page, info, 'search-see-all-failed', {
    'text-button.search-see-all': failedSeeAll,
  });
});
