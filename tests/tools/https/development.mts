import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { connect } from 'node:tls';

import { requestURL } from '../../_kit/http.ts';
import { SOURCE } from '../../_kit/workspace.ts';

export const developmentSettings = (mode: 'product' | 'mock') => {
  const port = Number(process.env.CAMPANULA_HTTPS_PORT ?? 443);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('CAMPANULA_HTTPS_PORT 需要 1–65535');
  const host = mode === 'product' ? 'local' : 'mock';
  const origin = new URL(
    process.env.CAMPANULA_DEV_ORIGIN ??
      `https://${host}.campanula.test${port === 443 ? '' : `:${port}`}`,
  );
  if (origin.protocol !== 'https:')
    throw new Error(
      '默认开发入口需要 HTTPS；HTTP 请用 dev:http / dev:mock:http',
    );
  const tlsDir = resolve(
    SOURCE,
    process.env.CAMPANULA_DEV_TLS_DIR ?? '.campanula/tls',
  );
  return {
    origin: origin.origin,
    port: Number(origin.port || 443),
    tlsDir,
    ca: join(tlsDir, 'ca.crt'),
    cert: join(tlsDir, 'site.crt'),
    key: join(tlsDir, 'site.key'),
  };
};

export const requireDevelopmentProxy = async (
  settings: ReturnType<typeof developmentSettings>,
) => {
  let ca: Awaited<ReturnType<typeof readFile>>;
  try {
    ca = await readFile(settings.ca);
  } catch (cause) {
    throw new Error(
      'HTTPS 证书尚未准备。先运行 pnpm dev:setup，显式完成域名解析与证书信任，再运行 pnpm dev:proxy。临时 HTTP 可用 pnpm dev:http / pnpm dev:mock:http。',
      { cause },
    );
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const socket = connect(
        {
          host: '127.0.0.1',
          port: settings.port,
          servername: new URL(settings.origin).hostname,
          ca,
        },
        () => {
          socket.end();
          resolve();
        },
      );
      socket.once('error', reject);
      socket.setTimeout(3000, () =>
        socket.destroy(new Error('HTTPS 代理连接超时')),
      );
    });
  } catch (cause) {
    throw new Error(
      `HTTPS 代理未就绪或证书不匹配（${settings.origin}）。另开终端运行 pnpm dev:proxy；更新证书后需重启代理。HTTP 入口为 dev:http / dev:mock:http。`,
      { cause },
    );
  }
};

export const requestDevelopment = async (
  url: string,
  options: Parameters<typeof requestURL>[1] = {},
) => {
  const address = new URL(url);
  if (
    address.protocol !== 'https:' ||
    !['local.campanula.test', 'mock.campanula.test'].includes(address.hostname)
  )
    return fetch(url, options);
  const settings = developmentSettings(
    address.hostname.startsWith('mock.') ? 'mock' : 'product',
  );
  return requestURL(url, { ...options, ca: await readFile(settings.ca) });
};
