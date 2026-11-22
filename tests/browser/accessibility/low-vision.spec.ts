import type { Locator, Page } from '@playwright/test';

import { held } from '../../_kit/hold.ts';
import { audioResponse, audioWav } from '../../_kit/mock/assets.ts';
import { expect, login, test } from '../fixture.ts';

const enlargeText = async (page: Page) => {
  await page.evaluate(() => {
    document.querySelector('#a11y-text-size')?.remove();
    for (const node of document.querySelectorAll('[data-a11y-text]'))
      node.removeAttribute('data-a11y-text');
    const texts = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter(
        (node) =>
          node.checkVisibility() &&
          !node.closest('[aria-label="Mock 测试数据"]') &&
          !['SCRIPT', 'STYLE', 'SVG'].includes(node.tagName) &&
          (node.matches('input,textarea') ||
            [...node.childNodes].some(
              (child) =>
                child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
            )),
      )
      .map((node, index) => {
        const css = getComputedStyle(node);
        return {
          node,
          index,
          size: Number.parseFloat(css.fontSize) * 2,
          height:
            css.lineHeight === 'normal'
              ? 'normal'
              : `${Number.parseFloat(css.lineHeight) * 2}px`,
        };
      });
    const style = document.createElement('style');
    style.id = 'a11y-text-size';
    style.textContent = texts
      .map(({ node, index, size, height }) => {
        node.dataset.a11yText = String(index);
        return `[data-a11y-text="${index}"] { font-size:${size}px!important;line-height:${height}!important; }`;
      })
      .join('\n');
    document.head.append(style);
  });
};

const labelFits = async (control: Locator) => {
  await expect(control).toBeVisible();
  await control.scrollIntoViewIfNeeded();
  const clipped = await control.evaluate((root) => {
    const box = root.getBoundingClientRect();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const clipped: string[] = [];
    while (walker.nextNode()) {
      const text = walker.currentNode as Text;
      if (!text.textContent?.trim() || text.parentElement?.closest('.sr-only'))
        continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      if (
        [...range.getClientRects()].some(
          (rect) =>
            rect.left < box.left - 1 ||
            rect.right > box.right + 1 ||
            rect.top < box.top - 1 ||
            rect.bottom > box.bottom + 1,
        )
      )
        clipped.push(text.textContent.trim());
    }
    return clipped;
  });
  expect.soft(clipped, '必要操作的可见文字应完整留在控件里').toEqual([]);
};

const rowsFit = async (rows: Locator) => {
  await expect.poll(() => rows.count()).toBeGreaterThan(0);
  const clipped = () =>
    rows.evaluateAll((rows) =>
      rows.flatMap((root) => {
        const box = root.getBoundingClientRect();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const failures: string[] = [];
        while (walker.nextNode()) {
          const text = walker.currentNode as Text;
          if (
            !text.textContent?.trim() ||
            text.parentElement?.closest('.sr-only')
          )
            continue;
          const range = document.createRange();
          range.selectNodeContents(text);
          if (
            [...range.getClientRects()].some(
              (rect) => rect.top < box.top - 1 || rect.bottom > box.bottom + 1,
            )
          )
            failures.push(text.textContent.trim());
        }
        return failures;
      }),
    );
  await expect
    .configure({ soft: true })
    .poll(clipped, { message: '每首歌的文字应留在自己的行内，不与相邻行重叠' })
    .toEqual([]);
};

const railCoverage = async (rail: Locator) => {
  await rail.page().evaluate(() => document.fonts.ready);
  await rail.page().waitForTimeout(250);
  const screenshot = await rail.screenshot({ scale: 'css' });
  return rail.evaluate(async (_, encoded) => {
    const bitmap = await createImageBitmap(
      new Blob([Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))], {
        type: 'image/png',
      }),
    );
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const luminance = (x: number, y: number) => {
      const offset = (y * pixels.width + x) * 4;
      return [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) => {
        const value = pixels.data[offset + index] / 255;
        return (
          sum +
          weight *
            (value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4)
        );
      }, 0);
    };
    let visible = 0;
    let samples = 0;
    for (let x = Math.ceil(pixels.width * 0.15); x < pixels.width * 0.85; x++) {
      const background = luminance(x, 1);
      const center = Math.floor(pixels.height / 2);
      const ratios = [-2, -1, 0, 1, 2].map((offset) => {
        const foreground = luminance(x, center + offset);
        return (
          (Math.max(background, foreground) + 0.05) /
          (Math.min(background, foreground) + 0.05)
        );
      });
      if (Math.max(...ratios) >= 3) visible++;
      samples++;
    }
    return visible / samples;
  }, screenshot.toString('base64'));
};

const selectedMarker = async (control: Locator) => {
  await control.page().evaluate(() => document.fonts.ready);
  await control.page().waitForTimeout(250);
  const marker = await control.evaluate((node) => {
    const css = getComputedStyle(node);
    return {
      border:
        css.borderStyle !== 'none' && Number.parseFloat(css.borderWidth) > 0,
      outline:
        css.outlineStyle !== 'none' && Number.parseFloat(css.outlineWidth) > 0,
    };
  });
  expect
    .soft(
      marker.border || marker.outline,
      '选中状态在强制颜色下应保留独立于焦点的轮廓',
    )
    .toBe(true);
};

test('滑轨绘制检查能分辨完整、缺失和低对比轨道', async ({ page }) => {
  await page.setContent(
    '<style>body{margin:0;background:white}.rail{width:160px;height:20px;background:white;display:flex;align-items:center}.rail::after{content:"";width:100%;height:3px}#visible::after{background:black}#low::after{background:#ccc}</style><div class="rail" id="visible"></div><div class="rail" id="missing"></div><div class="rail" id="low"></div>',
  );
  await expect(railCoverage(page.locator('#visible'))).resolves.toBeGreaterThan(
    0.95,
  );
  await expect(railCoverage(page.locator('#missing'))).resolves.toBe(0);
  await expect(railCoverage(page.locator('#low'))).resolves.toBe(0);
});

for (const mode of ['320px', 'text-spacing', 'text-200%'] as const) {
  test(`${mode} 下登录、编辑和播放操作不丢失`, async ({ page }, info) => {
    test.setTimeout(90_000);
    if (mode !== 'text-200%')
      await page.setViewportSize({ width: 320, height: 700 });
    const prepare = async () => {
      await page.evaluate(() => document.fonts.ready);
      if (mode === 'text-200%') await enlargeText(page);
      else if (
        mode === 'text-spacing' &&
        !(await page.locator('#a11y-text-spacing').count())
      )
        await page
          .addStyleTag({
            content:
              '* { line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important; } p { margin-bottom:2em!important; }',
          })
          .then((style) =>
            style.evaluate((node) => {
              if (!(node instanceof HTMLStyleElement))
                throw new TypeError('expected style element');
              node.id = 'a11y-text-spacing';
            }),
          );
      await page.waitForTimeout(250);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        )
        .toBe(true);
    };
    await page.goto('/');
    await page.getByRole('tab', { name: '短信验证码', exact: true }).click();
    await prepare();
    await labelFits(page.getByRole('tab', { name: '短信验证码', exact: true }));
    await labelFits(
      page.getByRole('button', { name: '获取验证码', exact: true }),
    );
    await page
      .getByRole('textbox', { name: '手机号', exact: true })
      .fill('13800000000');
    await page.getByRole('button', { name: '获取验证码', exact: true }).click();
    await expect(
      page.getByRole('textbox', { name: '验证码', exact: true }),
    ).toBeFocused();
    await page.screenshot({
      path: info.outputPath(`${mode}-login.png`),
      fullPage: true,
    });

    await login(
      page,
      mode === 'text-200%' ? '/search' : '/playlists/900000019',
    );
    if (mode === 'text-200%') {
      await prepare();
      const search = page.getByRole('combobox', { name: '搜索', exact: true });
      await search.fill('夏に');
      await search.press('Enter');
      const playlistTab = page.getByRole('tab', { name: /^歌单/ });
      await playlistTab.click();
      await expect(playlistTab).toHaveAttribute('aria-selected', 'true');
      const results = page.getByRole('list', { name: '歌单', exact: true });
      await expect(results.getByRole('link').first()).toBeVisible();
      await prepare();
      await rowsFit(results.locator(':scope > li'));
      await page.goto('/playlists/900000019');
    }
    await prepare();
    if (mode === 'text-200%' && info.project.name === 'desktop') {
      const playlists = page
        .getByRole('navigation', { name: '曲库里的歌单', exact: true })
        .getByRole('link');
      await expect(playlists.first()).toBeVisible();
      await prepare();
      await rowsFit(playlists);
    }
    if (mode === 'text-200%' && info.project.name === 'phone') {
      await page.goto('/playlists');
      await page
        .getByRole('button', { name: '排序自建歌单', exact: true })
        .click();
      await prepare();
      await rowsFit(page.locator('[data-playlist-sort] [data-playlist-id]'));
      await page.getByRole('button', { name: '完成', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '排序自建歌单', exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(250);
      await page.goto('/playlists/900000019');
      await prepare();
    }
    await labelFits(
      page.getByRole('button', { name: '播放全部', exact: true }),
    );
    await page
      .getByRole('button', { name: '歌单操作：poems', exact: true })
      .click();
    await page
      .getByRole('menuitem', { name: '编辑歌单信息', exact: true })
      .click();
    const editor = page.getByRole('dialog', {
      name: '编辑歌单信息',
      exact: true,
    });
    await expect(
      editor.getByRole('textbox', { name: '歌单名称', exact: true }),
    ).toBeFocused();
    await prepare();
    const save = editor.getByRole('button', { name: '保存', exact: true });
    await labelFits(save);
    await editor
      .getByRole('textbox', { name: '歌单名称', exact: true })
      .fill('低视力回归');
    await save.click();
    await expect(editor).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: '低视力回归', exact: true }).first(),
    ).toBeVisible();
    if (mode === 'text-200%') {
      await page.getByRole('button', { name: '添加歌曲', exact: true }).click();
      const add = page.getByRole('dialog', { name: '添加歌曲', exact: true });
      await expect(add.getByRole('checkbox').first()).toBeVisible();
      await prepare();
      await rowsFit(add.getByRole('checkbox'));
      const song = add.getByRole('checkbox').first();
      await expect(song).toHaveAttribute('aria-checked', 'false');
      await song.click();
      await expect(song).toHaveAttribute('aria-checked', 'true');
      await labelFits(
        add.getByRole('button', { name: '加入歌单', exact: true }),
      );
      await page.keyboard.press('Escape');
      await expect(add).toHaveCount(0);
    }

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
    await page.goto('/playlists/900000024');
    await prepare();
    if (mode === 'text-200%') {
      await page.getByRole('button', { name: '下载', exact: true }).click();
      const picker = page.getByRole('dialog', {
        name: '下载歌曲',
        exact: true,
      });
      await expect(picker.getByRole('checkbox').first()).toBeVisible();
      await prepare();
      await rowsFit(picker.getByRole('checkbox'));
      const song = picker.getByRole('checkbox').first();
      await expect(song).toHaveAttribute('aria-checked', 'true');
      await song.click();
      await expect(song).toHaveAttribute('aria-checked', 'false');
      await page.keyboard.press('Escape');
      await expect(picker).toHaveCount(0);
    }
    await page.getByRole('button', { name: '播放全部', exact: true }).click();
    const open = page.getByRole('button', { name: /^打开播放页/ });
    await prepare();
    await rowsFit(page.locator('[data-player-bar]'));
    await open.click();
    const player = page.getByRole('dialog', { name: '正在播放', exact: true });
    await player.getByRole('button', { name: /^暂停/ }).click();
    await prepare();
    const progress = player.getByRole('slider', {
      name: '播放进度',
      exact: true,
    });
    await expect(progress).toBeInViewport({ ratio: 1 });
    await progress.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await expect(progress).toHaveAttribute('aria-valuenow', '5');
    const phone = mode !== 'text-200%' || info.project.name === 'phone';
    if (phone) {
      await player
        .getByRole('button', { name: '播放队列', exact: true })
        .click();
      const queue = page.getByRole('dialog', { name: '播放队列', exact: true });
      await prepare();
      await rowsFit(queue.locator('[data-play-target]').locator('xpath=../..'));
      await labelFits(queue.getByRole('button', { name: '清空', exact: true }));
      await queue
        .getByRole('button', { name: /^从播放队列移出：/ })
        .last()
        .click();
      await expect(queue.getByText('3 首', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(
        player.getByRole('button', { name: '播放队列', exact: true }),
      ).toBeFocused();
    } else {
      await labelFits(player.getByRole('tab', { name: '歌词', exact: true }));
      await labelFits(
        player.getByRole('tab', { name: '播放队列', exact: true }),
      );
      await player.getByRole('tab', { name: '播放队列', exact: true }).click();
      await prepare();
      await rowsFit(
        player
          .locator('[role="tabpanel"]:not([inert]) [data-play-target]')
          .locator('xpath=../..'),
      );
      await labelFits(
        player.getByRole('button', { name: '清空', exact: true }),
      );
    }
    await page.screenshot({
      path: info.outputPath(`${mode}-player.png`),
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(open).toBeFocused();
    await rowsFit(page.locator('main [data-song-id]'));
    if (mode === 'text-200%') {
      await page
        .getByRole('button', { name: '多选和排序', exact: true })
        .click();
      const moved = page.locator(
        'main [data-song-id="3433267939"] [data-play-target]',
      );
      await expect(moved).toBeFocused();
      const saved = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/playlists/900000024/order') &&
          response.request().method() === 'POST',
      );
      await page.keyboard.press('Alt+ArrowDown');
      await info.attach('keyboard-sort-focus', {
        body: JSON.stringify(
          await page.evaluate(() => ({
            active: {
              tag: document.activeElement?.tagName,
              role: document.activeElement?.getAttribute('role'),
              name: document.activeElement?.getAttribute('aria-label'),
            },
            checkboxes: document.querySelectorAll('main [role="checkbox"]')
              .length,
            rows: [...document.querySelectorAll('main [data-song-id]')].map(
              (node) => node.getAttribute('data-song-id'),
            ),
          })),
        ),
        contentType: 'application/json',
      });
      await expect(moved).toBeFocused();
      await expect(moved).toBeInViewport({ ratio: 1 });
      await rowsFit(page.locator('main [data-song-id]'));
      expect((await saved).status()).toBe(200);
      await page.keyboard.press('Escape');
      await page.reload();
      await expect
        .poll(() =>
          page
            .locator('main [data-song-id]')
            .evaluateAll((rows) =>
              rows.map((row) => row.getAttribute('data-song-id')),
            ),
        )
        .toEqual(['2662577181', '3433267939', '4208408', '2092188841']);
      await prepare();
      await rowsFit(page.locator('main [data-song-id]'));
      await page.locator('#a11y-text-size').evaluate((node) => node.remove());
      await expect
        .poll(
          async () =>
            (await page.locator('main [data-song-id]').first().boundingBox())
              ?.height,
        )
        .toBe(56);
      await rowsFit(page.locator('main [data-song-id]'));
    }
  });
}

test('200%文字下下载任务的进行、失败和重试仍可操作', async ({ page }, info) => {
  test.setTimeout(60_000);
  const initial = held();
  const retried = held();
  let media = initial.until;
  await page.route('**/mock-assets/audio/**', async (route) => {
    await media;
    if (!route.request().failure())
      await route
        .fulfill({ status: 503, body: 'controlled media failure' })
        .catch(() => {});
  });
  try {
    await login(page, '/playlists/900000024');
    for (const id of [3433267939, 2662577181]) {
      await page
        .locator(`main [data-song-id="${id}"]`)
        .getByRole('button', { name: /^更多操作/ })
        .click();
      await page.getByRole('menuitem', { name: '下载', exact: true }).click();
    }
    const panel = page.getByRole('region', { name: '下载', exact: true });
    await expect(panel).toBeVisible();
    const expand = panel.getByRole('button', {
      name: '展开下载面板',
      exact: true,
    });
    if (await expand.count()) await expand.click();
    await expect(
      panel.getByRole('button', { name: /^取消下载：/ }),
    ).toHaveCount(2);
    await panel.getByRole('link', { name: '查看已下载', exact: true }).click();
    await expect(page).toHaveURL(/\/downloads$/);
    const tasks = page.getByRole('group', {
      name: '正在下载的歌曲',
      exact: true,
    });
    const taskRows = tasks.locator('div.grid.h-full');
    const cancel = tasks.getByRole('button', { name: /^取消下载：/ });
    const retry = tasks.getByRole('button', { name: /^重试下载/ });
    await tasks.scrollIntoViewIfNeeded();
    await expect(cancel).toHaveCount(2);
    await page.evaluate(() => document.fonts.ready);
    await enlargeText(page);
    await page.waitForTimeout(250);
    await expect(taskRows).toHaveCount(2);
    await rowsFit(taskRows);
    await expect(cancel.first()).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: info.outputPath('text-200-download-active.png'),
      fullPage: true,
    });

    initial.release();
    await expect(retry).toHaveCount(2);
    await expect(
      tasks.getByText('连接断了', { exact: true }).first(),
    ).toBeVisible();
    await enlargeText(page);
    await page.waitForTimeout(250);
    await rowsFit(taskRows);
    await labelFits(retry.first());
    await page.screenshot({
      path: info.outputPath('text-200-download-failed.png'),
      fullPage: true,
    });

    media = retried.until;
    await retry.first().click();
    await expect(retry).toHaveCount(1);
    await expect(cancel).toHaveCount(1);
    await enlargeText(page);
    await page.waitForTimeout(250);
    await rowsFit(taskRows);
    await cancel.click();
    await expect(cancel).toHaveCount(0);
    await expect(retry).toHaveCount(1);
    await tasks.getByRole('button', { name: /^不再下载：/ }).click();
    await expect(tasks).toHaveCount(0);
  } finally {
    initial.release();
    retried.release();
  }
});

test('队列滚开后增大和恢复文字不会跳回当前歌曲', async ({ page }, info) => {
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
  await page.getByRole('button', { name: '播放全部', exact: true }).click();
  await page.getByRole('button', { name: /^打开播放页/ }).click();
  const player = page.getByRole('dialog', { name: '正在播放', exact: true });
  await player.getByRole('button', { name: /^暂停/ }).click();
  let queue = player;
  if (info.project.name === 'phone') {
    await player.getByRole('button', { name: '播放队列', exact: true }).click();
    queue = page.getByRole('dialog', { name: '播放队列', exact: true });
  } else {
    await player.getByRole('tab', { name: '播放队列', exact: true }).click();
    queue = player.getByRole('tabpanel', { name: '播放队列', exact: true });
  }
  await expect(queue).toBeVisible();
  const scroller = queue.locator('div.overflow-y-auto').first();
  await scroller.evaluate((node) => {
    node.style.maxHeight = '100px';
  });
  await scroller.hover();
  await page.mouse.wheel(0, 60);
  await expect
    .poll(() => scroller.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  const away = await scroller.evaluate((node) => node.scrollTop);
  const row = queue
    .locator('[data-play-target]')
    .first()
    .locator('xpath=../..');
  await enlargeText(page);
  await expect
    .poll(async () => (await row.boundingBox())?.height)
    .toBeGreaterThan(56);
  await page.waitForTimeout(250);
  const enlarged = await scroller.evaluate((node) => node.scrollTop);
  await info.attach('queue-scroll-enlarged', {
    body: JSON.stringify({ before: away, enlarged }),
    contentType: 'application/json',
  });
  await expect
    .poll(() => scroller.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(away / 2);
  await page.locator('#a11y-text-size').evaluate((node) => node.remove());
  await expect.poll(async () => (await row.boundingBox())?.height).toBe(56);
  await page.waitForTimeout(250);
  const restored = await scroller.evaluate((node) => node.scrollTop);
  await info.attach('queue-scroll-restored', {
    body: JSON.stringify({ before: away, enlarged, restored }),
    contentType: 'application/json',
  });
  await expect
    .poll(() => scroller.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(away / 2);
});

test('强制颜色下选中状态、焦点与音量轨道仍可辨认', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  const sms = page.getByRole('tab', { name: '短信验证码', exact: true });
  const qr = page.getByRole('tab', { name: '扫码', exact: true });
  await sms.click();
  await page.getByRole('textbox', { name: '手机号', exact: true }).focus();
  await selectedMarker(sms);
  await qr.click();
  await page.keyboard.press('ArrowRight');
  await expect(sms).toBeFocused();
  await expect(sms).toHaveCSS('outline-style', 'solid');

  await login(page, '/settings');
  const quality = page
    .getByRole('radiogroup', { name: '在线播放音质', exact: true })
    .getByRole('radio')
    .nth(1);
  await quality.click();
  await page
    .getByRole('radiogroup', { name: '下载音质', exact: true })
    .getByRole('radio')
    .first()
    .focus();
  await expect(quality).toHaveAttribute('aria-checked', 'true');
  await selectedMarker(quality);

  await page.goto('/playlists/900000019');
  await page
    .getByRole('button', { name: '歌单操作：poems', exact: true })
    .click();
  await page
    .getByRole('menuitem', { name: '编辑歌单信息', exact: true })
    .click();
  const editor = page.getByRole('dialog', {
    name: '编辑歌单信息',
    exact: true,
  });
  const tag = editor.getByRole('button', { name: '华语', exact: true });
  await tag.click();
  await editor.getByRole('textbox', { name: '歌单名称', exact: true }).focus();
  await expect(tag).toHaveAttribute('aria-pressed', 'true');
  await selectedMarker(tag);
  await page.screenshot({
    path: info.outputPath('forced-colors-editor.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');

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
  await page.goto('/playlists/900000024');
  await page.getByRole('button', { name: '播放全部', exact: true }).click();
  await page.getByRole('button', { name: /^打开播放页/ }).click();
  const player = page.getByRole('dialog', { name: '正在播放', exact: true });
  await player.getByRole('button', { name: /^暂停/ }).click();
  if (info.project.name === 'desktop') {
    const lyrics = player.getByRole('group', { name: '歌词', exact: true });
    await expect(lyrics).toBeVisible();
    await expect(lyrics).toHaveCSS('mask-image', 'none');
  }
  const progress = player.getByRole('slider', {
    name: '播放进度',
    exact: true,
  });
  await progress.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
  await expect(progress).toHaveCSS('outline-style', 'solid');
  expect
    .soft(await railCoverage(progress), '强制颜色下播放进度的整条滑轨仍可辨认')
    .toBeGreaterThanOrEqual(0.9);
  if (info.project.name === 'desktop') {
    const volume = player.getByRole('slider', { name: '音量', exact: true });
    await volume.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await expect(volume).toHaveValue('0.01');
    const coverage = await railCoverage(volume);
    await info.attach('forced-colors-volume-rail', {
      body: JSON.stringify({ coverage, threshold: 3 }),
      contentType: 'application/json',
    });
    expect
      .soft(coverage, '强制颜色下至少九成滑轨与相邻背景达到3:1')
      .toBeGreaterThanOrEqual(0.9);
  }
  await page.screenshot({
    path: info.outputPath('forced-colors-player.png'),
    fullPage: true,
  });
});
