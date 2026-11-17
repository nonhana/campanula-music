import { globSync } from 'node:fs';

import { dist } from './artifact.ts';
import { expect, test } from './fixture.ts';

test('同份静态产物的页面、锚点、图片、索引和隔离边界', async ({
  page,
  request,
  baseURL,
}) => {
  const html = globSync('**/*.html', { cwd: dist }).sort();
  const indexed: string[] = [];
  for (const file of html) {
    const path = `/${file.replace(/index\.html$/, '')}`;
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    const demo = path.startsWith('/demo/');
    if (demo || path === '/404.html') {
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        /noindex/,
      );
    }
    if (!demo) {
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://campanula.caelum.moe${path}`,
      );
      if (path !== '/404.html')
        indexed.push(`https://campanula.caelum.moe${path}`);
      const body = await response!.text();
      expect(
        body.match(/MUSIC_[UA]=[^\s<;]+|示例听众|"account"\s*:\s*\{/g),
      ).toBeNull();
      expect(
        await page
          .locator('[href*=".md"], [href*=".mdx"]')
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href'))),
      ).toEqual([]);
      if (path !== '/') {
        await expect(page.locator('iframe')).toHaveCount(0);
        expect(body).not.toMatch(/(?:src|href)=["'][^"']*(?:\/demo\/|\.mp3)/);
      }
    }
    const links = await page
      .locator('a[href], link[href], script[src], img[src], source[srcset]')
      .evaluateAll((nodes) =>
        nodes.flatMap((node) => {
          const raw =
            node.getAttribute('href') ??
            node.getAttribute('src') ??
            node.getAttribute('srcset');
          return raw
            ? raw.split(',').map((part) => ({
                raw: part.trim().split(/\s+/)[0],
                tag: node.tagName,
                target: node.getAttribute('target'),
                rel: node.getAttribute('rel'),
              }))
            : [];
        }),
      );
    for (const link of links) {
      const url = new URL(link.raw, page.url());
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      if (url.origin !== baseURL) {
        if (link.tag === 'A') {
          expect(link.target, link.raw).toBe('_blank');
          expect(link.rel?.split(' '), link.raw).toEqual(
            expect.arrayContaining(['external', 'noopener']),
          );
        }
        continue;
      }
      const target = await request.get(url.href);
      expect(target.status(), `${path} → ${link.raw}`).toBe(200);
      if (url.hash) {
        const found = await page.evaluate(
          async ({ href, hash }) => {
            const parsed = new DOMParser().parseFromString(
              await (await fetch(href)).text(),
              'text/html',
            );
            return Boolean(
              parsed.getElementById(decodeURIComponent(hash.slice(1))),
            );
          },
          { href: url.href, hash: url.hash },
        );
        expect(found, `${path} → ${link.raw}`).toBe(true);
      }
    }
    for (const img of await page.locator('img').all()) {
      expect(
        await img.evaluate(
          (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
        ),
        path,
      ).toBe(true);
    }
  }
  const index = await request.get('/sitemap-index.xml');
  expect(index.status()).toBe(200);
  expect(await index.text()).toContain(
    'https://campanula.caelum.moe/sitemap-0.xml',
  );
  const sitemap = await request.get('/sitemap-0.xml');
  const urls = [...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map(
    (match) => match[1],
  );
  expect(urls.sort()).toEqual(indexed.sort());
  expect(
    await (await request.get('/this-page-does-not-exist/')).text(),
  ).toContain('找不到');
  expect((await request.get('/this-page-does-not-exist/')).status()).toBe(404);
});
