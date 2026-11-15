import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';

import { SOURCE } from '../_kit/workspace.ts';
import { developmentSettings } from './https/development.mts';

const settings = developmentSettings('product');
try {
  await Promise.all([
    access(settings.cert),
    access(settings.key),
    access(settings.ca),
  ]);
} catch (cause) {
  throw new Error('HTTPS 证书尚未准备，请先运行 pnpm dev:setup', { cause });
}
const parent = resolve(
  SOURCE,
  process.env.CAMPANULA_DEV_PROXY_ROOT ?? '.campanula/proxy',
);
await mkdir(parent, { recursive: true });
const root = await mkdtemp(join(parent, 'run-'));
try {
  const child = spawn(
    'caddy',
    [
      'run',
      '--config',
      join(SOURCE, 'tests/tools/https/Caddyfile'),
      '--adapter',
      'caddyfile',
    ],
    {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        XDG_DATA_HOME: join(root, 'data'),
        XDG_CONFIG_HOME: join(root, 'config'),
        CAMPANULA_TLS_CERT: settings.cert,
        CAMPANULA_TLS_KEY: settings.key,
        CAMPANULA_HTTPS_PORT: String(settings.port),
        CAMPANULA_PRODUCT_UPSTREAM:
          process.env.CAMPANULA_PRODUCT_UPSTREAM ?? 'localhost:5173',
        CAMPANULA_MOCK_UPSTREAM:
          process.env.CAMPANULA_MOCK_UPSTREAM ?? '127.0.0.1:5174',
      },
      stdio: ['inherit', 'inherit', 'pipe'],
    },
  );
  let errors = '';
  child.stderr.on('data', (chunk) => {
    errors += chunk.toString();
    process.stderr.write(chunk);
  });
  process.once('SIGINT', () => child.kill('SIGINT'));
  process.once('SIGTERM', () => child.kill('SIGTERM'));
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  });
  if (process.exitCode !== 0 && errors.includes('bind: permission denied')) {
    console.error(
      `没有权限绑定 HTTPS 端口 ${settings.port}。请在三个终端统一改用高位端口，浏览器地址也加 :8443：\nCAMPANULA_HTTPS_PORT=8443 pnpm dev:proxy\nCAMPANULA_HTTPS_PORT=8443 pnpm dev\nCAMPANULA_HTTPS_PORT=8443 pnpm dev:mock`,
    );
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
