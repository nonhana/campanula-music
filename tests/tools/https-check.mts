import assert from 'node:assert/strict';
import type { Buffer } from 'node:buffer';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { connect } from 'node:http2';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { CookieJar } from 'tough-cookie';
import WebSocket from 'ws';

import { startCommand } from '../_kit/command.ts';
import { requestURL } from '../_kit/http.ts';
import { createWorkspace, SOURCE } from '../_kit/workspace.ts';
import { createCertificate } from './https/certificate.mts';

const root = await mkdtemp(join(tmpdir(), 'campanula-https-'));
const reportDir = join(SOURCE, '.reports/https', basename(root));
await mkdir(reportDir, { recursive: true });
const commands: ReturnType<typeof startCommand>[] = [];
const sockets: WebSocket[] = [];
const sites: {
  origin: string;
  port: number;
  root: string;
  command: ReturnType<typeof startCommand>;
}[] = [];
const messages: { origin: string; event: unknown }[] = [];
const checks: string[] = [];
const interruption = new AbortController();
const interruptCheck = process.argv.includes('--interrupt-check');
let expectedInterruption = false;
let failure: unknown;
let trustedCa: Buffer | undefined;
let stage = 'certificate';
const stop = () => {
  interruption.abort(new Error('HTTPS 专项已中断'));
  for (const socket of sockets) socket.terminate();
  for (const command of commands) void command.close();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const files = await createCertificate(
    join(root, 'certificates'),
    interruption.signal,
  );
  checks.push(
    '真实 mkcert 复用 CA 和有效证书，临期自动续签，不执行系统信任安装',
  );
  const ca = await readFile(files.ca);
  trustedCa = ca;
  const source = join(root, 'source');
  await cp(join(SOURCE, 'src'), join(source, 'src'), { recursive: true });
  await symlink(join(SOURCE, 'static'), join(source, 'static'), 'dir');
  const probeFile = join(source, 'src/lib/dev/EnvironmentHmrProbe.svelte');
  await writeFile(
    probeFile,
    '<p>HMR probe</p><style>p { color: red; }</style>\n',
  );
  const snapshot = await createWorkspace({ root: source });
  await snapshot.close();
  stage = 'native HTTPS command startup';
  for (const mode of ['product', 'mock'] as const) {
    interruption.signal.throwIfAborted();
    const listener = createServer();
    await new Promise<void>((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', resolve);
    });
    const port = (listener.address() as { port: number }).port;
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    const origin = `https://${mode === 'product' ? 'local' : 'mock'}.campanula.test:${port}`;
    const workspace = await createWorkspace({ root: join(root, mode), source });
    await workspace.close();
    const command = startCommand(
      process.execPath,
      [
        '--import',
        import.meta.resolve('tsx'),
        join(SOURCE, 'scripts/dev.mts'),
        ...(mode === 'mock' ? ['--mock'] : []),
        '--port',
        String(port),
        '--cert',
        files.cert,
        '--key',
        files.key,
        '--ca',
        files.ca,
        '--skip-dns-check',
      ],
      {
        cwd: workspace.root,
        env: {
          PATH: process.env.PATH,
          TSX_DISABLE_CACHE: '1',
          NO_COLOR: '1',
          ...workspace.env,
          CAMPANULA_DEV_MOCK_ROOT: workspace.root,
          CAMPANULA_DEV_SOURCE: source,
        },
      },
    );
    commands.push(command);
    sites.push({ origin, port, root: workspace.root, command });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(command.logs)), 30_000);
      const capture = () => {
        if (command.logs.includes(`Ready: ${origin}`)) {
          clearTimeout(timeout);
          resolve();
        }
      };
      command.child.stdout.on('data', capture);
      command.child.stderr.on('data', capture);
      command.child.once('close', () => {
        clearTimeout(timeout);
        reject(new Error(command.logs));
      });
      command.child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  const [product, mock] = sites as [
    (typeof sites)[number],
    (typeof sites)[number],
  ];
  checks.push(
    '真实统一 CLI 分别启动普通 / mock 原生 HTTPS，无 Caddy 或共享代理',
  );
  stage = 'HTML, TLS, Cookie and origin';
  for (const site of sites) {
    const response = await requestURL(site.origin, { ca });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<!doctype html>/i);
    await assert.rejects(requestURL(site.origin));
    const session = connect(site.origin, {
      ca,
      servername: new URL(site.origin).hostname,
      lookup: (_host, options, callback) =>
        options.all
          ? callback(null, [{ address: '127.0.0.1', family: 4 }])
          : callback(null, '127.0.0.1', 4),
    });
    try {
      for (const [authority, expected] of [
        [new URL(site.origin).host, 200],
        ['unexpected.campanula.test', 421],
      ] as const) {
        const status = await new Promise<number>((resolve, reject) => {
          const stream = session.request({
            ':path': '/api/account',
            ':authority': authority,
          });
          const timeout = setTimeout(() => {
            stream.destroy();
            reject(new Error('HTTP/2 超时'));
          }, 10_000);
          const fail = (error: Error) => {
            clearTimeout(timeout);
            reject(error);
          };
          session.once('error', fail);
          stream.once('error', fail);
          stream.once('response', (headers) => {
            clearTimeout(timeout);
            session.removeListener('error', fail);
            resolve(Number(headers[':status']));
          });
          stream.resume();
          stream.end();
        });
        assert.equal(status, expected, 'HTTP/2 使用 :authority 检查域名');
      }
    } finally {
      session.destroy();
    }
  }
  const jar = new CookieJar();
  const request = async (origin: string, path: string, method = 'GET') => {
    const response = await requestURL(origin + path, {
      ca,
      method,
      headers: { cookie: await jar.getCookieString(origin), origin },
    });
    for (const cookie of response.headers.getSetCookie())
      await jar.setCookie(cookie, origin);
    return response;
  };
  const login = await request(mock.origin, '/mock/login');
  assert.equal(login.status, 303);
  const cookie = login.headers.get('set-cookie')!;
  for (const attribute of ['Secure', 'HttpOnly', 'SameSite=Strict'])
    assert.ok(cookie.toLowerCase().includes(attribute.toLowerCase()));
  assert.ok(!/domain=/i.test(cookie));
  assert.equal(
    (await request(mock.origin, '/api/account').then((r) => r.json())).account
      .id,
    10000001,
  );
  assert.deepEqual(
    await request(product.origin, '/api/account').then((r) => r.json()),
    { account: null },
  );
  assert.equal(await jar.getCookieString(product.origin), '');
  await requestURL(`${mock.origin}/api/mock/scenario`, {
    ca,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'after' }),
  });
  assert.equal(
    (
      await requestURL(`${mock.origin}/api/mock/status`, { ca }).then((r) =>
        r.json(),
      )
    ).seed,
    'after',
  );
  assert.equal(
    (await request(mock.origin, '/api/mock/reset', 'POST')).status,
    200,
  );
  assert.equal(
    (
      await requestURL(`${mock.origin}/api/mock/status`, { ca }).then((r) =>
        r.json(),
      )
    ).seed,
    'before',
  );
  assert.equal(
    (await request(mock.origin, '/api/account').then((r) => r.json())).account
      .id,
    10000001,
  );
  assert.equal((await request(mock.origin, '/api/logout', 'POST')).status, 200);
  assert.deepEqual(
    await request(mock.origin, '/api/account').then((r) => r.json()),
    { account: null },
  );
  for (const site of sites)
    for (const path of ['/mock/login', '/api/playlists/900000019/name']) {
      const rejected = await requestURL(site.origin + path, {
        ca,
        method: 'POST',
        headers: { host: 'localhost:5174' },
      });
      assert.equal(rejected.status, 421);
      assert.equal(rejected.headers.get('set-cookie'), null);
      assert.match(await rejected.text(), /https:\/\//);
    }
  const wrong = await requestURL(`${product.origin}/api/login/qr/key`, {
    ca,
    headers: { host: 'unknown.campanula.test' },
  });
  assert.equal(wrong.status, 421);
  assert.equal(wrong.headers.get('set-cookie'), null);
  await assert.rejects(
    requestURL(`https://unknown.campanula.test:${product.port}`, { ca }),
  );
  checks.push(
    '双站 HTML / 缺 CA 拒绝 / 同 jar host-only Secure Cookie / 登录账号 reset 退出 / 错误 Host 写入前拒绝',
  );
  stage = 'WSS and HMR';
  const updates: Promise<unknown>[] = [];
  for (const origin of [product.origin, mock.origin]) {
    const client = await requestURL(`${origin}/@vite/client`, { ca }).then(
      (r) => r.text(),
    );
    const token = /(?:wsToken|__WS_TOKEN__)\s*=\s*["']([^"']+)/.exec(
      client,
    )?.[1];
    assert.ok(token, 'Vite client 缺少 WSS token');
    const ws = new WebSocket(
      `${origin.replace('https:', 'wss:')}/?token=${token}`,
      'vite-hmr',
      {
        ca,
        origin,
        family: 4,
        lookup: (_name, _options, callback) => callback(null, '127.0.0.1', 4),
      },
    );
    sockets.push(ws);
    ws.on('message', (data) =>
      messages.push({ origin, event: JSON.parse(data.toString()) }),
    );
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('WSS 连接超时')),
        10_000,
      );
      ws.once('error', reject);
      ws.on('message', (data) => {
        if (JSON.parse(data.toString()).type === 'connected') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    const module = await requestURL(
      `${origin}/src/lib/dev/EnvironmentHmrProbe.svelte`,
      { ca },
    );
    assert.equal(module.status, 200);
    await writeFile(
      join(
        reportDir,
        origin === product.origin ? 'product-probe.js' : 'mock-probe.js',
      ),
      await module.text(),
    );
    updates.push(
      new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`没有收到 HMR：${origin}`)),
          15_000,
        );
        ws.on('message', (data) => {
          const event = JSON.parse(data.toString()) as {
            type: string;
            updates?: { path: string }[];
          };
          if (
            event.type === 'update' &&
            event.updates?.some(({ path }) =>
              path.includes('EnvironmentHmrProbe.svelte'),
            )
          ) {
            clearTimeout(timeout);
            resolve(event);
          }
        });
        ws.once('error', reject);
      }),
    );
  }
  const page = probeFile;
  const original = await readFile(page, 'utf8');
  try {
    await writeFile(
      page,
      original.replace('red', 'blue').replace('HMR probe', 'HMR changed'),
    );
    await Promise.all(updates);
  } finally {
    await writeFile(page, original);
  }

  checks.push(
    '双原生 WSS 连接正确站点，修改同一临时 Svelte 后均收到实际 update',
  );
  stage = 'tool request';
  for (const site of sites) {
    const tool = startCommand(
      process.execPath,
      [
        '--import',
        import.meta.resolve('tsx'),
        '--input-type=module',
        '-e',
        `
    import { requestDevelopment } from ${JSON.stringify(pathToFileURL(join(SOURCE, 'scripts/dev.mts')).href)};
    const response = await requestDevelopment(${JSON.stringify(`${site.origin}/api/account`)});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    console.log(await response.text());
  `,
      ],
      {
        env: {
          PATH: process.env.PATH,
          TSX_DISABLE_CACHE: '1',
          CAMPANULA_DEV_TLS_DIR: join(root, 'certificates/tls'),
          CAMPANULA_DEV_ORIGIN: site.origin,
        },
      },
    );
    commands.push(tool);
    await tool.finished;
    assert.equal(tool.child.exitCode, 0, tool.logs);
    assert.deepEqual(JSON.parse(tool.logs), { account: null });
  }
  checks.push('浏览器工具通过 SSOT 的作用域 CA / 解析连接正确 HTTPS 站点');
  if (interruptCheck) {
    stage = 'real SIGTERM interruption';
    expectedInterruption = true;
    await new Promise<void>((resolve) => {
      process.once('SIGTERM', resolve);
      process.kill(process.pid, 'SIGTERM');
    });
    interruption.signal.throwIfAborted();
    throw new Error('未收到中断信号');
  }
  stage = 'one mode exits';
  product.command.child.kill('SIGINT');
  await product.command.finished;
  assert.ok(product.command.logs.includes('Stopped'));
  await assert.rejects(requestURL(product.origin, { ca }));
  assert.equal(
    (await requestURL(`${mock.origin}/api/mock/status`, { ca })).status,
    200,
  );
  assert.equal(
    (await readFile(join(mock.root, 'identity.json'), 'utf8')).length > 0,
    true,
  );
  checks.push(
    '普通入口 Ctrl+C 释放端口，mock 保持响应与身份；两个模式无共享进程',
  );
} catch (error) {
  if (
    expectedInterruption &&
    interruption.signal.aborted &&
    error === interruption.signal.reason
  )
    checks.push('真实 SIGTERM 后等待统一入口与其子进程清理');
  else failure = error;
} finally {
  for (const socket of sockets) socket.terminate();
  for (const command of [...commands].reverse()) await command.close();
  for (const site of sites) {
    await assert.rejects(requestURL(site.origin, { ca: trustedCa }));
    if (site.command.child.exitCode === 130)
      assert.ok(site.command.logs.includes('Stopped'));
  }
  await rm(root, { recursive: true, force: true });
  await assert.rejects(access(root));
  const report = {
    passed: !failure,
    interruptCheck,
    stage,
    checks,
    messages,
    cleaned: true,
    root,
    reportDir,
    sites: sites.map(({ origin, port }) => ({ origin, port })),
    commands: commands.map((c) => ({ pid: c.child.pid, logs: c.logs })),
    ...(failure ? { error: String(failure) } : {}),
  };
  await writeFile(
    join(reportDir, 'result.json'),
    JSON.stringify(report, null, 2),
  );
  const pointer = join(SOURCE, '.reports', `${basename(root)}.json`);
  await writeFile(pointer, JSON.stringify({ reportDir, passed: !failure }));
  await rename(pointer, join(SOURCE, '.reports/latest-https.json'));
  console.log(JSON.stringify(report, null, 2));
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
if (failure) throw failure;
