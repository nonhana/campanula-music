import type { Page } from '@playwright/test';

import { audioResponse, audioWav } from '../../_kit/mock/assets.ts';
import { auditContrast } from '../../tools/browser/contrast.ts';
import { expect, login, test } from '../fixture.ts';

const openPlayer = async (page: Page, cover: string) => {
  await page.route('**/mock-assets/cover/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path fill="${cover}" d="M0 0h100v100H0z"/></svg>`,
    }),
  );
  const audio = audioWav(3433267939, 30);
  await page.route('**/mock-assets/audio/**', (route) =>
    route.fulfill(
      audioResponse(
        audio,
        route.request().method(),
        route.request().headers().range,
      ),
    ),
  );
  await login(page, '/playlists/900000024');
  await page
    .locator('main [data-song-id="3433267939"] [data-play-target]')
    .click();
  await page.getByRole('button', { name: /^打开播放页/ }).click();
  const player = page.getByRole('dialog', { name: '正在播放', exact: true });
  await player.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.getByRole('status', { name: '播放状态' })).toContainText(
    '已暂停',
  );
  const progress = player.getByRole('slider', { name: '播放进度' });
  await expect(progress).toHaveAttribute('aria-disabled', 'false');
  await progress.focus();
  await page.keyboard.press('Home');
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(250);
  return player;
};

for (const [name, cover] of [
  ['black', '#000'],
  ['white', '#fff'],
] as const) {
  test(`播放页在${name}封面上标题、来源、时间与标签的文字对比度`, async ({
    page,
  }, info) => {
    const player = await openPlayer(page, cover);
    const artist = player.locator('.swap a[href^="/artists/"]');
    const album = player.locator('.swap a[href^="/albums/"]');
    const chrome = [
      { id: 'now-playing-title.name', locator: player.locator('.swap h2') },
      { id: 'now-playing-title.artist', locator: artist },
      { id: 'now-playing-title.album', locator: album },
      {
        id: `${info.project.name}-player-page.source`,
        locator: player.locator('p').filter({ hasText: /^来自/ }),
      },
      {
        id: 'wave-progress.times.elapsed',
        locator: player.locator('.times > span').nth(0),
      },
      {
        id: 'wave-progress.times.duration',
        locator: player.locator('.times > span').nth(1),
      },
      ...(info.project.name === 'phone'
        ? [
            {
              id: 'phone-player-page.state',
              locator: player.getByText('正在播放', { exact: true }),
            },
          ]
        : [
            {
              id: 'segmented.player-tab.selected',
              locator: player.getByRole('tab', { name: '歌词', exact: true }),
            },
            {
              id: 'segmented.player-tab.unselected',
              locator: player.getByRole('tab', {
                name: '播放队列',
                exact: true,
              }),
            },
          ]),
    ];
    await auditContrast(
      page,
      info,
      `${name}-default`,
      Object.fromEntries(chrome.map(({ id, locator }) => [id, locator])),
    );
    await artist.hover();
    await album.focus();
    await auditContrast(
      page,
      info,
      `${name}-hover-focus`,
      Object.fromEntries(chrome.map(({ id, locator }) => [id, locator])),
    );
    if (info.project.name === 'phone') {
      await player.getByRole('button', { name: '歌词', exact: true }).click();
      await expect(
        player.getByRole('group', { name: '歌词', exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(250);
      await auditContrast(
        page,
        info,
        `${name}-lyrics-visible`,
        Object.fromEntries(chrome.map(({ id, locator }) => [id, locator])),
      );
    }
  });

  test(`播放队列在${name}封面下当前行、普通行与进度背景的文字对比度`, async ({
    page,
  }, info) => {
    const player = await openPlayer(page, cover);
    if (info.project.name === 'desktop')
      await player.getByRole('tab', { name: '播放队列', exact: true }).click();
    else
      await player
        .getByRole('button', { name: '播放队列', exact: true })
        .click();
    const queue =
      info.project.name === 'desktop'
        ? player.getByRole('tabpanel', { name: '播放队列', exact: true })
        : page.getByRole('dialog', { name: '播放队列', exact: true });
    const buttons = queue.locator('[data-play-target]');
    await expect(buttons).toHaveCount(4);
    const markRows = async () => {
      for (let index = 0; index < 4; index++) {
        await buttons.nth(index).evaluate((button, index) => {
          button
            .closest('div.grid')!
            .setAttribute('data-contrast-queue-row', String(index));
        }, index);
      }
    };
    await markRows();
    const targets = [
      { id: 'queue-list.count', locator: queue.locator('header p') },
    ];
    for (const index of [0, 1]) {
      const row = queue.locator(`[data-contrast-queue-row="${index}"]`);
      targets.push(
        {
          id: `song-title.queue-name.${index}`,
          locator: row.locator(
            '[data-play-target] > span:first-child > span:first-child',
          ),
        },
        {
          id: `queue-list.artist.${index}`,
          locator: row.locator(
            ':scope > span.min-w-0 > span[aria-hidden="true"]',
          ),
        },
        {
          id: `queue-list.duration.${index}`,
          locator: row.locator(':scope > span.tabular-nums:not(.grid)'),
        },
      );
      if (index > 0)
        targets.push({
          id: 'now-index.queue-index.1',
          locator: row.locator(':scope > span.grid > span'),
        });
    }
    const edgeTargets = targets.slice(1);
    for (const index of [2, 3])
      targets.push({
        id: `now-index.queue-index.${index}`,
        locator: queue.locator(
          `[data-contrast-queue-row="${index}"] > span.grid > span`,
        ),
      });
    await page.waitForTimeout(250);
    await auditContrast(
      page,
      info,
      `${name}-queue-start`,
      Object.fromEntries(targets.map(({ id, locator }) => [id, locator])),
    );
    const progress = player.getByRole('slider', { name: '播放进度' });
    if (info.project.name === 'phone') {
      await page.keyboard.press('Escape');
      await expect(queue).toHaveCount(0);
    }
    await progress.focus();
    for (let index = 0; index < 3; index++)
      await page.keyboard.press('ArrowRight');
    await expect(progress).toHaveAttribute('aria-valuenow', '15');
    if (info.project.name === 'phone') {
      await player
        .getByRole('button', { name: '播放队列', exact: true })
        .click();
      await markRows();
    }
    await buttons.nth(1).hover();
    await page.waitForTimeout(250);
    await auditContrast(
      page,
      info,
      `${name}-queue-middle-hover`,
      Object.fromEntries(targets.map(({ id, locator }) => [id, locator])),
    );
    if (info.project.name === 'phone') {
      await page.keyboard.press('Escape');
      await expect(queue).toHaveCount(0);
    }
    const progressBox = await progress.boundingBox();
    expect(progressBox).not.toBeNull();
    await progress.click({
      position: { x: progressBox!.width * 0.97, y: progressBox!.height / 2 },
    });
    await expect(progress).toHaveAttribute('aria-valuenow', '29');
    if (info.project.name === 'phone') {
      await player
        .getByRole('button', { name: '播放队列', exact: true })
        .click();
      await markRows();
    }
    await buttons.nth(0).hover();
    await page.waitForTimeout(250);
    await auditContrast(
      page,
      info,
      `${name}-queue-end-hover`,
      Object.fromEntries(targets.map(({ id, locator }) => [id, locator])),
    );
    if (info.project.name === 'desktop') {
      await page.setViewportSize({ width: 1440, height: 330 });
      const scroller = queue.locator('.overflow-y-auto');
      await expect
        .poll(() =>
          scroller.evaluate((node) => node.scrollHeight - node.clientHeight),
        )
        .toBeGreaterThan(0);
      await scroller.evaluate((node) => {
        node.scrollTop = 24;
      });
      await page.waitForTimeout(250);
      await auditContrast(
        page,
        info,
        `${name}-queue-edge`,
        Object.fromEntries(edgeTargets.map(({ id, locator }) => [id, locator])),
      );
    }
  });
}
