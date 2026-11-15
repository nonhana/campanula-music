import { expect, login, test } from '../fixture.ts';

test('下载可取消，重试完成后刷新仍在，并从页面导出', async ({ page, scan }) => {
  await page.addInitScript(() => {
    // 选择器按标准抛取消/权限错误；写入复用 Chromium 的 OPFS handle。
    const pickerState = { mode: 'success' };
    Object.assign(window, {
      pickerState,
      showDirectoryPicker: async () => {
        if (
          pickerState.mode === 'AbortError' ||
          pickerState.mode === 'NotAllowedError'
        )
          throw new DOMException('受控取消或拒绝', pickerState.mode);
        const root = await navigator.storage.getDirectory();
        if (pickerState.mode !== 'QuotaExceededError') return root;
        return {
          name: '受控文件夹',
          getFileHandle: async (
            name: string,
            options?: FileSystemGetFileOptions,
          ) => {
            const handle = await root.getFileHandle(name, options);
            return {
              name: handle.name,
              createWritable: async () => {
                throw new DOMException('受控磁盘写满', 'QuotaExceededError');
              },
            };
          },
          removeEntry: (name: string) => root.removeEntry(name),
        };
      },
    });
  });
  await login(page, '/playlists/900000024');
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/mock-assets/audio/**', async (route) => {
    await held;
    if (!route.request().failure()) await route.continue().catch(() => {});
  });
  const row = page.locator('main [data-song-id="3433267939"]');
  await row.getByRole('button', { name: /^更多操作/ }).click();
  await page.getByRole('menuitem', { name: '下载', exact: true }).click();
  const cancel = page.getByRole('button', { name: /^取消下载：/ });
  await expect(cancel).toBeVisible();
  await scan('download-active');
  await cancel.click();
  release();
  await page.unroute('**/mock-assets/audio/**');
  await expect(cancel).toHaveCount(0);
  await row.getByRole('button', { name: /^更多操作/ }).click();
  await page.getByRole('menuitem', { name: '下载', exact: true }).click();
  await expect(row.getByTitle('已下载', { exact: true })).toBeVisible();
  await page.goto('/downloads');
  const downloaded = page.locator('main [data-song-id="3433267939"]');
  await expect(downloaded).toBeVisible();
  await page.reload();
  await expect(downloaded).toBeVisible();
  await scan('downloads-ready');
  await downloaded.getByRole('button', { name: /^更多操作/ }).click();
  await page.getByRole('menuitem', { name: '导出', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择文件夹' })).toBeFocused();
  await scan('export-confirm');
  for (const name of ['AbortError', 'NotAllowedError']) {
    await page.evaluate((name) => {
      (
        window as Window & { pickerState?: { mode: string } }
      ).pickerState!.mode = name;
    }, name);
    await page.getByRole('button', { name: '选择文件夹' }).click();
    await expect(
      page.getByRole('button', { name: '选择文件夹' }),
    ).toBeVisible();
  }
  await page.evaluate(() => {
    (window as Window & { pickerState?: { mode: string } }).pickerState!.mode =
      'QuotaExceededError';
  });
  await page.getByRole('button', { name: '选择文件夹' }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('没能导出');
  await scan('export-failed');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await downloaded.getByRole('button', { name: /^更多操作/ }).click();
  await page.getByRole('menuitem', { name: '导出', exact: true }).click();
  await page.evaluate(() => {
    (window as Window & { pickerState?: { mode: string } }).pickerState!.mode =
      'success';
  });
  await page.getByRole('button', { name: '选择文件夹' }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName(/已导出 1 首/);
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await expect(downloaded).toBeVisible();
  const files = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const entries: { name: string; size: number }[] = [];
    for await (const handle of root.values())
      if (handle.kind === 'file')
        entries.push({
          name: handle.name,
          size: (await handle.getFile()).size,
        });
    return entries;
  });
  expect(files).toHaveLength(1);
  expect(files[0].size).toBeGreaterThan(1000);
});
