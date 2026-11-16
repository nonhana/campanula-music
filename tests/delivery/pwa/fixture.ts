import { writeFile } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import process from 'node:process';

import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { audioResponse, audioWav } from '../../_kit/mock/assets.ts';
import { inspectCandidate } from '../candidate.ts';
import { startProduction } from '../node.ts';

export const test = base.extend<{
  production: {
    baseURL: string;
    mediaURL: string;
    version: string;
    nextVersion: string;
    switchVersion: () => void;
    requests: {
      path: string;
      method: string;
      backend: string;
      status?: number;
    }[];
  };
}>({
  // eslint-disable-next-line no-empty-pattern -- 无依赖 fixture 使用 Playwright 规定的解构参数
  production: async ({}, use, info) => {
    const candidate = process.env.CAMPANULA_PWA_CANDIDATE!;
    const next = process.env.CAMPANULA_PWA_NEXT!;
    const sha = process.env.CAMPANULA_PWA_SHA!;
    const first = await inspectCandidate({ candidate, sha, adapter: 'node' });
    const second = await inspectCandidate({
      candidate: next,
      sha,
      adapter: 'node',
    });
    expect(first.version).not.toBe(second.version);
    const servers: Awaited<ReturnType<typeof startProduction>>[] = [];
    let backend = '';
    const requests: {
      path: string;
      method: string;
      backend: string;
      status?: number;
    }[] = [];
    const proxy = createServer((req, res) => {
      const record: (typeof requests)[number] = {
        path: req.url!,
        method: req.method!,
        backend,
      };
      requests.push(record);
      // 匿名 QR 等请求会访问真实上游；在产品进程外拒绝，账号 API 仍经过实际生产入口。
      if (req.url?.startsWith('/api/') && req.url !== '/api/account') {
        record.status = 503;
        res.writeHead(503).end('受控生产测试不连接真实网易云');
        return;
      }
      const upstream = request(
        new URL(req.url!, backend),
        { method: req.method, headers: req.headers },
        (reply) => {
          record.status = reply.statusCode;
          res.writeHead(reply.statusCode!, reply.headers);
          reply.pipe(res);
        },
      );
      upstream.on('error', () => {
        record.status = 502;
        res.writeHead(502).end();
      });
      req.pipe(upstream);
    });
    const media = createServer((req, res) => {
      const reply = audioResponse(audioWav(1), req.method!, req.headers.range);
      res
        .writeHead(reply.status, {
          ...reply.headers,
          'access-control-allow-origin': '*',
        })
        .end(reply.body);
    });
    const listen = (server: ReturnType<typeof createServer>) =>
      new Promise<string>((resolve) =>
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          if (!address || typeof address === 'string')
            throw new Error('未取得端口');
          resolve(`http://127.0.0.1:${address.port}`);
        }),
      );
    const close = (server: ReturnType<typeof createServer>) =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    let baseURL = '';
    let mediaURL = '';
    try {
      servers.push(await startProduction(candidate));
      servers.push(await startProduction(next));
      backend = servers[0].baseURL;
      baseURL = await listen(proxy);
      mediaURL = await listen(media);
      await use({
        baseURL,
        mediaURL,
        version: first.version,
        nextVersion: second.version,
        requests,
        switchVersion: () => {
          backend = servers[1].baseURL;
        },
      });
    } finally {
      if (proxy.listening) await close(proxy);
      if (media.listening) await close(media);
      await Promise.all(servers.map((server) => server.close()));
      const cleaned =
        servers.every((server) => server.child.exitCode !== null) &&
        !proxy.listening &&
        !media.listening;
      await writeFile(
        info.outputPath('production.json'),
        JSON.stringify(
          {
            sha,
            candidate,
            next,
            requests,
            cleaned,
            pids: servers.map((server) => server.child.pid),
            baseURL,
            mediaURL,
          },
          null,
          2,
        ),
      );
      expect(cleaned).toBe(true);
    }
  },
  context: async ({ context, production }, use, info) => {
    const origins = [production.baseURL, production.mediaURL];
    const external: string[] = [];
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (
        origins.includes(url.origin) ||
        ['blob:', 'data:'].includes(url.protocol)
      )
        await route.continue();
      else {
        external.push(url.href);
        await route.abort('blockedbyclient');
      }
    });
    await use(context);
    await context.close();
    await info.attach('external-network', {
      body: JSON.stringify(external),
      contentType: 'application/json',
    });
    expect(external).toEqual([]);
  },
});
export { expect };

export const controlled = async (page: Page) => {
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  return page.evaluate(async () => ({
    controller: navigator.serviceWorker.controller?.scriptURL,
    caches: await Promise.all(
      (await caches.keys()).map(async (name) => ({
        name,
        keys: (await (await caches.open(name)).keys()).map(
          (request) => request.url,
        ),
      })),
    ),
  }));
};
