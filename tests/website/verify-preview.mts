import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import { chromium, expect } from '@playwright/test';

import { controlNetwork } from '../_kit/browser-network.ts';
import { ROOT, sourceSha } from '../suites.ts';

const [manifestPath, suppliedURL] = process.argv.slice(2);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const url = new URL(suppliedURL);
if (
  url.protocol !== 'https:' ||
  manifest.sha !== sourceSha() ||
  manifest.status !== 'passed'
)
  throw new Error('必须使用当前 SHA 已通过的候选清单和 HTTPS 预览');
await mkdir(join(ROOT, '.reports/website'), { recursive: true });
const report = await mkdtemp(join(ROOT, '.reports/website/preview-'));
const files = manifest.artifact.files as { path: string; sha256: string }[];
const checked: { path: string; sha256: string; status: number }[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (next < files.length) {
      const file = files[next++];
      const response = await fetch(
        new URL(file.path.split('/').map(encodeURIComponent).join('/'), url),
      );
      const sha256 = createHash('sha256')
        .update(Buffer.from(await response.arrayBuffer()))
        .digest('hex');
      if (
        (!response.ok &&
          !(file.path === '404.html' && response.status === 404)) ||
        sha256 !== file.sha256
      )
        throw new Error(
          `预览文件不等于已验候选：${file.path} (${response.status})`,
        );
      checked.push({ path: file.path, sha256, status: response.status });
    }
  }),
);
const external: string[] = [];
const browser = await chromium.launch();
try {
  for (const [name, viewport] of Object.entries({
    desktop: { width: 1440, height: 900 },
    phone: { width: 390, height: 844 },
  })) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: 'reduce',
    });
    const contextExternal = await controlNetwork(
      context,
      new Set([url.origin]),
    );
    const page = await context.newPage();
    await page.goto(url.href);
    await expect(page.locator('.demo-window')).toHaveAttribute(
      'data-ready',
      '',
      { timeout: 20_000 },
    );
    const frame = page.frameLocator('#demo-frame');
    const player = frame.getByRole('region', { name: '正在播放', exact: true });
    await player.getByRole('button', { name: '播放', exact: true }).click();
    await expect(frame.getByRole('status', { name: '播放状态' })).toContainText(
      '正在播放',
    );
    await player.getByRole('button', { name: '下一首', exact: true }).click();
    await expect(frame.getByRole('status', { name: '播放状态' })).toContainText(
      'Tidal Steps',
    );
    await page.screenshot({
      path: join(report, `${name}-home.png`),
      fullPage: true,
    });
    await page.locator('#home-deploy').click();
    await page.locator('#deploy-vercel').click();
    await page.reload();
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(
      (await page.goto(new URL('/missing-article/', url).href))?.status(),
    ).toBe(404);
    await expect(page.locator('h1')).toContainText('找不到');
    await context.close();
    external.push(...contextExternal);
  }
  expect(external).toEqual([]);
} finally {
  await browser.close();
}
await writeFile(
  join(report, 'result.json'),
  JSON.stringify(
    {
      sha: manifest.sha,
      url: url.href,
      digest: manifest.artifact.digest,
      files: checked.sort((a, b) => a.path.localeCompare(b.path, 'en')),
      external,
      status: 'passed',
    },
    null,
    2,
  ),
);
process.stdout.write(`境外预览逐文件与浏览器核验：${report}\n`);
