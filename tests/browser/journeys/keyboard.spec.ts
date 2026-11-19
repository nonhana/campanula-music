import type { Locator, Page } from '@playwright/test';

import { audioResponse, audioWav } from '../../_kit/mock/assets.ts';
import { expect, login, test } from '../fixture.ts';

const tabTo = async (page: Page, target: Locator) => {
  await expect(target).toBeVisible();
  for (
    let step = 0;
    step < 60 &&
    !(await target.evaluate((node) => node === document.activeElement));
    step++
  )
    await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
};

test('键盘把歌曲加入歌单，关闭浮层返回原歌曲并刷新读回', async ({
  page,
  scan,
}) => {
  await login(page, '/playlists/900000024');
  const row = page.locator('main [data-song-id="3433267939"]');
  const more = row.getByRole('button', { name: /^更多操作/ });
  await tabTo(page, more);
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

test('编辑弹窗的 Tab 循环和 Escape 恢复焦点', async ({ page, scan }, info) => {
  await login(page, '/playlists/900000019');
  const trigger = page.getByRole('button', { name: '歌单操作：poems' });
  await tabTo(page, trigger);
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
  await page.keyboard.press('Tab');
  await expect(
    dialog.getByRole('textbox', { name: '简介', exact: true }),
  ).toBeFocused();
  await tabTo(page, dialog.getByRole('button', { name: '华语', exact: true }));
  await tabTo(page, dialog.getByRole('button', { name: '70后', exact: true }));
  await page.keyboard.press('Tab');
  const first = dialog.getByRole('button', {
    name: info.project.name === 'phone' ? '取消' : '关闭',
    exact: true,
  });
  if (info.project.name === 'desktop') {
    await expect(
      dialog.getByRole('button', { name: '取消', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      dialog.getByRole('button', { name: '保存', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
  }
  await expect(first).toBeFocused();
  const cover = dialog.getByRole('button', { name: '更换封面', exact: true });
  if (info.project.name === 'phone') {
    await page.keyboard.press('Tab');
    await expect(
      dialog.getByRole('button', { name: '保存', exact: true }),
    ).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expect(cover).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    dialog.getByRole('textbox', { name: '歌单名称', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(cover).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  if (info.project.name === 'phone') {
    await expect(
      dialog.getByRole('button', { name: '保存', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Shift+Tab');
  }
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  const last = dialog.getByRole('button', {
    name: info.project.name === 'phone' ? '70后' : '保存',
    exact: true,
  });
  await expect(last).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  const name = dialog.getByRole('textbox', { name: '歌单名称', exact: true });
  await name.fill('');
  await expect(
    dialog.getByRole('button', { name: '保存', exact: true }),
  ).toBeDisabled();
  await tabTo(page, first);
  await page.keyboard.press('Shift+Tab');
  await expect(
    dialog.getByRole('button', {
      name: info.project.name === 'phone' ? '70后' : '取消',
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  if (info.project.name === 'phone') {
    await page.keyboard.press('Tab');
    await expect(
      dialog.getByRole('button', { name: '更换封面', exact: true }),
    ).toBeFocused();
  }
  await name.fill('poems');
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

test('播放页和手机队列的首尾 Tab 循环，关闭后回到原入口', async ({
  page,
}, info) => {
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
  const song = page.locator(
    'main [data-song-id="3433267939"] [data-play-target]',
  );
  await tabTo(page, song);
  await page.keyboard.press('Enter');
  const open = page.getByRole('button', { name: /^打开播放页/ });
  await tabTo(page, open);
  await page.keyboard.press('Enter');
  const player = page.getByRole('dialog', { name: '正在播放', exact: true });
  const close = player.getByRole('button', { name: '收起播放页', exact: true });
  await expect(close).toBeFocused();
  const desktop = info.project.name === 'desktop';
  const pause = player.getByRole('button', { name: '暂停', exact: true });
  await expect(pause).toBeVisible();
  const lyricsTab = player.getByRole('tab', { name: '歌词', exact: true });
  const controls = [
    ...(desktop
      ? [lyricsTab]
      : [
          player.getByRole('button', { name: '歌词', exact: true }),
          player.getByRole('button', { name: '显示歌词', exact: true }),
        ]),
    player.getByRole('link', { name: '测试歌手', exact: true }).first(),
    player.getByRole('link', { name: '测试专辑', exact: true }).first(),
    player.getByRole('button', { name: /^红心《/ }),
    player.getByRole('button', { name: /^更多操作：/ }),
    player.getByRole('slider', { name: '播放进度', exact: true }),
    player.getByRole('button', {
      name: desktop ? '列表循环' : '播放模式：列表循环',
      exact: true,
    }),
    player.getByRole('button', { name: '上一首', exact: true }),
    pause,
    player.getByRole('button', { name: '下一首', exact: true }),
    ...(desktop
      ? [
          player.getByRole('button', { name: '随机播放', exact: true }),
          player.getByRole('button', { name: '静音', exact: true }),
          player.getByRole('slider', { name: '音量', exact: true }),
          player.getByRole('group', { name: '歌词', exact: true }),
          player.getByRole('button', { name: /^从 .* 开始播放：/ }),
          player.getByRole('button', { name: '翻译', exact: true }),
          player.getByRole('button', { name: '音译', exact: true }),
        ]
      : [player.getByRole('button', { name: '播放队列', exact: true })]),
  ];
  for (const control of controls) {
    await page.keyboard.press('Tab');
    await expect(control).toBeFocused();
    if (control === pause) await page.keyboard.press('Enter');
  }
  await expect(
    player.getByRole('button', { name: '播放', exact: true }),
  ).toBeVisible();
  if (info.project.name === 'desktop') {
    for (const control of [
      player.getByRole('button', { name: '翻译', exact: true }),
      player.getByRole('button', { name: /^从 .* 开始播放：/ }),
      player.getByRole('group', { name: '歌词', exact: true }),
    ]) {
      await page.keyboard.press('Shift+Tab');
      await expect(control).toBeFocused();
    }
    await tabTo(page, lyricsTab);
    await page.keyboard.press('ArrowRight');
    const queueTab = player.getByRole('tab', { name: '播放队列', exact: true });
    await expect(queueTab).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(close).toBeFocused();
    const last = player.getByRole('button', {
      name: '从播放队列移出：SO TIRED ROCK',
      exact: true,
    });
    await page.keyboard.press('Shift+Tab');
    await expect(last).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(queueTab).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(close).toBeFocused();
    const queue = player.getByRole('tabpanel', {
      name: '播放队列',
      exact: true,
    });
    await tabTo(page, queue.getByRole('button', { name: '清空', exact: true }));
    for (const control of [
      queue.getByRole('button', { name: /^夏に溶ける/ }),
      queue.getByRole('button', { name: /^Theme Of Laura II/ }),
      queue.getByRole('button', {
        name: '从播放队列移出：Theme Of Laura II',
        exact: true,
      }),
    ]) {
      await page.keyboard.press('Tab');
      await expect(control).toBeFocused();
    }
  } else {
    const entry = player.getByRole('button', { name: '播放队列', exact: true });
    await tabTo(page, close);
    await page.keyboard.press('Shift+Tab');
    await expect(entry).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      player.getByRole('button', { name: '歌词', exact: true }),
    ).toBeFocused();
    await tabTo(page, entry);
    await page.keyboard.press('Enter');
    const queue = page.getByRole('dialog', { name: '播放队列', exact: true });
    const closeQueue = queue.getByRole('button', {
      name: '收起播放队列',
      exact: true,
    });
    await expect(closeQueue).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(
      queue.getByRole('button', {
        name: '从播放队列移出：SO TIRED ROCK',
        exact: true,
      }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(closeQueue).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      queue.getByRole('button', { name: '清空', exact: true }),
    ).toBeFocused();
    for (const control of [
      queue.getByRole('button', { name: /^夏に溶ける/ }),
      queue.getByRole('button', { name: /^Theme Of Laura II/ }),
      queue.getByRole('button', {
        name: '从播放队列移出：Theme Of Laura II',
        exact: true,
      }),
    ]) {
      await page.keyboard.press('Tab');
      await expect(control).toBeFocused();
    }
    await page.keyboard.press('Escape');
    await expect(queue).toHaveCount(0);
    await expect(entry).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(player).toHaveCount(0);
  await expect(open).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(player).toHaveCount(0);
  await expect(open).toBeFocused();
});
