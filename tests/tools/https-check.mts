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
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

import { CookieJar } from 'tough-cookie';
import WebSocket from 'ws';

import { startCommand } from '../_kit/command.ts';
import { startEnvironment } from '../_kit/environment.ts';
import { requestURL } from '../_kit/http.ts';
import { createWorkspace, SOURCE } from '../_kit/workspace.ts';
import { createCertificate } from './https/certificate.mts';

const interrupted = new AbortController();
const interruptCheck = process.argv.includes('--interrupt-check');
let expectedInterruption = false;
const root = await mkdtemp(join(tmpdir(), 'campanula-https-'));
const environments: Awaited<ReturnType<typeof startEnvironment>>[] = [];
const sockets: WebSocket[] = [];
const commands: ReturnType<typeof startCommand>[] = [];
let cliWorkspace: Awaited<ReturnType<typeof createWorkspace>> | undefined;
let proxyCommand: ReturnType<typeof startCommand> | undefined;
let logs = '';
const checks: string[] = [];
const messages: { origin: string; event: unknown }[] = [];
let stage = 'certificate';
let failure: unknown;
let port = 0;
const reportDir = join(SOURCE, '.reports/https', basename(root));
const stop = () => {
  interrupted.abort(new Error('HTTPS 专项已中断'));
  for (const socket of sockets) socket.terminate();
  for (const command of commands) void command.close();
  void proxyCommand?.close();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
await mkdir(reportDir, { recursive: true });
await rm(join(reportDir, 'result.json'), { force: true });
try {
  const files = await createCertificate(join(root, 'tls'));
  const ca = await readFile(files.ca);
  interrupted.signal.throwIfAborted();
  stage = 'source snapshot';
  const source = join(root, 'source');
  await cp(join(SOURCE, 'src'), join(source, 'src'), { recursive: true });
  await symlink(join(SOURCE, 'static'), join(source, 'static'), 'dir');
  const probeFile = join(source, 'src/lib/dev/EnvironmentHmrProbe.svelte');
  const probeSource = '<p>HMR probe</p><style>p { color: red; }</style>\n';
  await writeFile(probeFile, probeSource);
  const snapshot = await createWorkspace({ root: source });
  await snapshot.close();
  const listener = createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  port = (listener.address() as { port: number }).port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const productOrigin = `https://local.campanula.test:${port}`;
  const mockOrigin = `https://mock.campanula.test:${port}`;
  stage = 'backends';
  const product = await startEnvironment({
    mode: 'product',
    signal: interrupted.signal,
    source,
    origin: productOrigin,
  });
  environments.push(product);
  const mock = await startEnvironment({
    mode: 'mock',
    signal: interrupted.signal,
    source,
    origin: mockOrigin,
    request: (url, init) => requestURL(url, { ca, method: init?.method }),
  });
  environments.push(mock);
  interrupted.signal.throwIfAborted();
  stage = 'proxy';
  proxyCommand = startCommand(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      join(SOURCE, 'tests/tools/dev-proxy.mts'),
    ],
    {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        TSX_DISABLE_CACHE: '1',
        CAMPANULA_DEV_TLS_DIR: join(root, 'tls'),
        CAMPANULA_DEV_PROXY_ROOT: join(root, 'proxy'),
        CAMPANULA_HTTPS_PORT: String(port),
        CAMPANULA_TLS_CERT: files.cert,
        CAMPANULA_TLS_KEY: files.key,
        CAMPANULA_PRODUCT_UPSTREAM: new URL(product.internalURL).host,
        CAMPANULA_MOCK_UPSTREAM: new URL(mock.internalURL).host,
      },
    },
  );
  const proxy = proxyCommand.child;
  proxy.stdout?.on('data', (data: Buffer) => {
    logs += data.toString();
  });
  proxy.stderr?.on('data', (data: Buffer) => {
    logs += data.toString();
  });
  let spawnError: Error | undefined;
  proxy.once('error', (error) => {
    spawnError = error;
  });
  for (let attempt = 0; ; attempt++) {
    interrupted.signal.throwIfAborted();
    if (spawnError) throw spawnError;
    try {
      assert.equal((await requestURL(productOrigin, { ca })).status, 200);
      break;
    } catch (error) {
      if (attempt >= 50 || proxy.exitCode !== null) throw error;
      await delay(100);
    }
  }
  stage = 'TLS and HTML';
  for (const origin of [productOrigin, mockOrigin]) {
    const response = await requestURL(origin, { ca });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<!doctype html>/i);
    await assert.rejects(requestURL(origin));
  }
  checks.push('两站 HTML；指定 CA 正常校验；缺 CA 失败');
  stage = 'cookies and origins';
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
  const login = await request(mockOrigin, '/mock/login');
  assert.equal(login.status, 303);
  const scenario = await requestURL(`${mockOrigin}/api/mock/scenario`, {
    ca,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'after' }),
  });
  assert.equal(scenario.status, 200);
  await mock.reset();
  assert.equal(
    (
      await requestURL(`${mockOrigin}/api/mock/status`, { ca }).then((r) =>
        r.json(),
      )
    ).seed,
    'before',
  );
  const cookie = login.headers.get('set-cookie')!;
  for (const attribute of ['Secure', 'HttpOnly', 'SameSite=Strict'])
    assert.ok(cookie.toLowerCase().includes(attribute.toLowerCase()));
  assert.ok(!/domain=/i.test(cookie));
  assert.equal(
    (await request(mockOrigin, '/api/account').then((r) => r.json())).account
      .id,
    10000001,
  );
  assert.deepEqual(
    await request(productOrigin, '/api/account').then((r) => r.json()),
    { account: null },
  );
  assert.equal(await jar.getCookieString(productOrigin), '');
  assert.equal((await request(mockOrigin, '/api/logout', 'POST')).status, 200);
  assert.deepEqual(
    await request(mockOrigin, '/api/account').then((r) => r.json()),
    { account: null },
  );
  for (const backend of [product, mock]) {
    for (const path of ['/mock/login', '/api/playlists/900000019/name']) {
      const rejected = await requestURL(backend.internalURL + path, {
        method: 'POST',
        headers: { host: 'localhost:5174' },
      });
      assert.equal(rejected.status, 421);
      assert.equal(rejected.headers.get('set-cookie'), null);
      assert.match(await rejected.text(), /https:\/\//);
    }
  }
  checks.push(
    '同 jar host-only Secure Cookie；mock 登录/账号/退出；普通匿名；旧 Host 写入前拒绝',
  );
  const unknownHost = await requestURL(`${productOrigin}/api/login/qr/key`, {
    ca,
    headers: { host: 'unknown.campanula.test' },
  });
  assert.ok(unknownHost.status >= 400);
  assert.equal(unknownHost.headers.get('set-cookie'), null);
  await assert.rejects(
    requestURL(`https://unknown.campanula.test:${port}/`, { ca }),
  );
  stage = 'WSS and HMR';
  const updates: Promise<unknown>[] = [];
  for (const origin of [productOrigin, mockOrigin]) {
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
        origin === productOrigin ? 'product-probe.js' : 'mock-probe.js',
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
  checks.push('双站点 WSS 经 Caddy，修改同一临时 Svelte 后双端收到 update');
  stage = 'default development commands';
  await product.close();
  await mock.close();
  cliWorkspace = await createWorkspace({ root: join(root, 'cli-product') });
  for (const command of [
    {
      file: 'dev-product.mts',
      cwd: cliWorkspace.root,
      env: cliWorkspace.env,
      origin: productOrigin,
      backend: product.internalURL,
    },
    {
      file: 'dev-mock.mts',
      cwd: SOURCE,
      env: { CAMPANULA_DEV_MOCK_ROOT: join(root, 'cli-mock') },
      origin: mockOrigin,
      backend: mock.internalURL,
    },
  ]) {
    interrupted.signal.throwIfAborted();
    const started = startCommand(
      process.execPath,
      [
        '--import',
        import.meta.resolve('tsx'),
        join(SOURCE, 'tests/tools', command.file),
        '--port',
        new URL(command.backend).port,
      ],
      {
        cwd: command.cwd,
        env: {
          PATH: process.env.PATH,
          TSX_DISABLE_CACHE: '1',
          ...command.env,
          CAMPANULA_DEV_TLS_DIR: join(root, 'tls'),
          CAMPANULA_HTTPS_PORT: String(port),
        },
      },
    );
    const child = started.child;
    commands.push(started);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(new Error(`默认命令未就绪：${command.file}\n${started.logs}`)),
        30_000,
      );
      const capture = () => {
        const marker =
          command.file === 'dev-product.mts' ? 'Local:   ' : 'Mock ready: ';
        if (started.logs.includes(`${marker}${command.origin}`)) {
          clearTimeout(timeout);
          resolve();
        }
      };
      child.stdout.on('data', capture);
      child.stderr.on('data', capture);
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('close', () => {
        clearTimeout(timeout);
        reject(new Error(started.logs));
      });
    });
    assert.ok(started.logs.includes(command.origin));
    assert.ok(!started.logs.includes('Local:   http://'));
  }
  assert.deepEqual(
    await requestURL(`${productOrigin}/api/account`, { ca }).then((r) =>
      r.json(),
    ),
    { account: null },
  );
  const commandLogin = await requestURL(`${mockOrigin}/mock/login`, { ca });
  assert.equal(commandLogin.status, 303);
  const signedIn = await requestURL(`${mockOrigin}/api/account`, {
    ca,
    headers: { cookie: commandLogin.headers.get('set-cookie')!.split(';')[0] },
  }).then((r) => r.json());
  assert.equal(signedIn.account.id, 10000001);
  checks.push(
    '真实 dev / dev:mock 默认入口显示 HTTPS；普通匿名，mock 可登录；代理由 dev:proxy 实际入口启动',
  );
  stage = 'browser tool HTTPS requests';
  interrupted.signal.throwIfAborted();
  const toolRequest = startCommand(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      '--input-type=module',
      '-e',
      `import { requestDevelopment } from ${JSON.stringify(pathToFileURL(join(SOURCE, 'tests/tools/https/development.mts')).href)};
     const response = await requestDevelopment(${JSON.stringify(`${mockOrigin}/api/mock/status`)});
     if (!response.ok) throw new Error('HTTP ' + response.status);
     console.log(await response.text());`,
    ],
    {
      env: {
        PATH: process.env.PATH,
        TSX_DISABLE_CACHE: '1',
        CAMPANULA_DEV_TLS_DIR: join(root, 'tls'),
      },
    },
  );
  commands.push(toolRequest);
  await toolRequest.finished;
  assert.equal(toolRequest.child.exitCode, 0, toolRequest.logs);
  assert.equal(JSON.parse(toolRequest.logs).enabled, true);
  checks.push(
    '浏览器工具的 Node 请求仅为开发域名解析回环并正常信任项目 CA，不依赖系统 DNS / CA',
  );
  if (interruptCheck) {
    interrupted.signal.throwIfAborted();
    expectedInterruption = true;
    await new Promise<void>((resolve) => {
      process.once('SIGTERM', resolve);
      process.kill(process.pid, 'SIGTERM');
    });
    interrupted.signal.throwIfAborted();
    throw new Error('没有收到专项 SIGTERM');
  }
  interrupted.signal.throwIfAborted();
  stage = 'missing proxy guidance';
  await proxyCommand.close();
  interrupted.signal.throwIfAborted();
  const missingCommand = startCommand(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      join(SOURCE, 'tests/tools/dev-product.mts'),
      '--port',
      new URL(product.internalURL).port,
    ],
    {
      cwd: cliWorkspace.root,
      env: {
        PATH: process.env.PATH,
        TSX_DISABLE_CACHE: '1',
        CAMPANULA_DEV_TLS_DIR: join(root, 'tls'),
        CAMPANULA_HTTPS_PORT: String(port),
      },
    },
  );
  const missingProxy = missingCommand.child;
  let guidance = '';
  commands.push(missingCommand);
  missingProxy.stdout.on('data', (chunk: Buffer) => {
    guidance += chunk.toString();
  });
  missingProxy.stderr.on('data', (chunk: Buffer) => {
    guidance += chunk.toString();
  });
  const missingTimeout = setTimeout(() => missingProxy.kill('SIGTERM'), 15_000);
  const missingCode = await new Promise((resolve, reject) => {
    missingProxy.once('error', reject);
    missingProxy.once('close', resolve);
  });
  clearTimeout(missingTimeout);
  assert.equal(missingCode, 1);
  assert.ok(guidance.includes('pnpm dev:proxy'));
  checks.push('证书已准备但代理未启动时明确退出并提示 dev:proxy，不退回 HTTP');
} catch (error) {
  if (
    expectedInterruption &&
    interrupted.signal.aborted &&
    error === interrupted.signal.reason
  )
    checks.push('真实 SIGTERM 中断：退出并清理命令进程组、端口和临时根');
  else failure = error;
} finally {
  for (const socket of sockets) socket.terminate();
  for (const command of commands.reverse()) await command.close();
  await cliWorkspace?.close();
  await proxyCommand?.close();
  for (const environment of environments.reverse()) await environment.close();
  await rm(root, { recursive: true, force: true });
  await assert.rejects(access(root));
  for (const environment of environments)
    await assert.rejects(requestURL(environment.internalURL));
  const report = {
    passed: !failure,
    interruptCheck,
    stage,
    port,
    checks,
    messages,
    cleaned: true,
    root,
    commands: commands.map(({ child, logs }) => ({ pid: child.pid, logs })),
    proxyPid: proxyCommand?.child.pid,
    reportDir,
    ...(failure
      ? {
          error: String(failure),
          logs,
          backends: environments.map((e) => ({ root: e.root, logs: e.logs })),
        }
      : {}),
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
