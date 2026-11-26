import { access, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { expect, it } from 'vitest';

import {
  checkDevelopmentDns,
  detectLanAddresses,
  developmentSettings,
} from '../../scripts/dev.mts';
import { startCommand } from '../_kit/command.ts';
import { requestURL } from '../_kit/http.ts';
import { createWorkspace, SOURCE } from '../_kit/workspace.ts';

const waitForLog = (command: ReturnType<typeof startCommand>, text: string) =>
  new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(command.logs)), 20_000);
    const capture = () => {
      if (command.logs.includes(text)) {
        clearTimeout(timeout);
        resolve();
      }
    };
    command.child.stdout.on('data', capture);
    command.child.once('close', () => {
      clearTimeout(timeout);
      reject(new Error(command.logs));
    });
    capture();
  });

it.each([
  { mode: 'product', args: [], origin: 'https://local.campanula.test:8443' },
  {
    mode: 'mock',
    args: ['--mock'],
    origin: 'https://mock.campanula.test:8444',
  },
  {
    mode: 'mock',
    args: ['--mock', '--port=9444'],
    origin: 'https://mock.campanula.test:9444',
  },
])(
  '$mode 的统一入口报告 $origin，不依赖代理',
  async ({ mode, args, origin }) => {
    const command = startCommand(
      process.execPath,
      [
        '--import',
        import.meta.resolve('tsx'),
        join(SOURCE, 'scripts/dev.mts'),
        '--print-config',
        ...args,
      ],
      {
        env: { PATH: process.env.PATH, TSX_DISABLE_CACHE: '1', NO_COLOR: '1' },
      },
    );
    try {
      await command.finished;
      expect(command.child.exitCode, command.logs).toBe(0);
      expect(JSON.parse(command.logs)).toMatchObject({ mode, origin });
    } finally {
      await command.close();
    }
  },
);

it('统一入口启动普通 HTTP，SIGINT 后释放端口并保留工作根', async () => {
  const workspace = await createWorkspace();
  const occupied = createServer();
  await new Promise<void>((resolve) =>
    occupied.listen(0, 'localhost', resolve),
  );
  const port = (occupied.address() as { port: number }).port;
  await new Promise<void>((resolve) => occupied.close(() => resolve()));
  const launch = () =>
    startCommand(
      process.execPath,
      [
        '--import',
        import.meta.resolve('tsx'),
        join(SOURCE, 'scripts/dev.mts'),
        '--http',
        '--port',
        String(port),
      ],
      {
        cwd: workspace.root,
        env: {
          PATH: process.env.PATH,
          TSX_DISABLE_CACHE: '1',
          NO_COLOR: '1',
          ...workspace.env,
        },
      },
    );
  let command: ReturnType<typeof startCommand> | undefined;
  try {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      command = launch();
      await waitForLog(command, '正在启动开发服务器');
      command.child.kill(signal);
      await command.finished;
      expect(command.logs).toContain('Stopped');
      expect(command.child.exitCode).toBe(130);
      await expect(
        requestURL(`http://localhost:${port}/api/account`),
      ).rejects.toThrow();
    }
    command = launch();
    await waitForLog(command, 'Ready:');
    const duplicate = launch();
    try {
      await duplicate.finished;
      expect(duplicate.child.exitCode, duplicate.logs).toBe(1);
      expect(duplicate.logs).toContain('工作根已占用');
    } finally {
      await duplicate.close();
    }
    expect(
      await requestURL(`http://localhost:${port}/api/account`).then((r) =>
        r.json(),
      ),
    ).toEqual({ account: null });
    command.child.kill('SIGINT');
    await command.finished;
    await expect(
      requestURL(`http://localhost:${port}/api/account`),
    ).rejects.toThrow();
    expect(command.logs).toContain('Stopped');
  } finally {
    await command?.close();
    await workspace.close();
  }
}, 30_000);

it('非交互首次引导明确退出，不安装系统 CA、不留下信任记录', async () => {
  const root = await mkdtemp(join(tmpdir(), 'campanula-first-run-'));
  const command = startCommand(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      join(SOURCE, 'scripts/dev.mts'),
      '--setup',
    ],
    {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        NO_COLOR: '1',
        TSX_DISABLE_CACHE: '1',
        CAMPANULA_DEV_TLS_DIR: join(root, 'tls'),
      },
    },
  );
  try {
    await command.finished;
    expect(command.child.exitCode, command.logs).toBe(1);
    expect(command.logs).toContain('交互终端');
    expect(command.logs).toContain('pnpm dev:setup');
    expect(command.logs).not.toContain(`${String.fromCharCode(27)}[`);
    await expect(access(join(root, 'tls/trusted.json'))).rejects.toThrow();
  } finally {
    await command.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('启动前发现 Fake-IP 时指出实际地址，回环解析正常时允许继续', async () => {
  await expect(
    checkDevelopmentDns('localhost', async () => [
      { address: '198.18.42.1', family: 4 },
    ]),
  ).rejects.toThrow('198.18.42.1');
  await expect(
    checkDevelopmentDns('localhost', async () => [
      { address: '127.0.0.1', family: 4 },
    ]),
  ).resolves.toBeUndefined();
  await expect(
    checkDevelopmentDns(
      ['local.campanula.test', 'mock.campanula.test'],
      async (hostname) => [
        {
          address: hostname.startsWith('local.') ? '127.0.0.1' : '198.18.42.1',
          family: 4,
        },
      ],
    ),
  ).rejects.toThrow('mock.campanula.test');
});

it('detectLanAddresses 优先返回主网卡私网 IPv4，忽略回环、链路本地与 Fake-IP', () => {
  const entry = (
    address: string,
    family: 'IPv4' | 'IPv6' = 'IPv4',
    internal = false,
  ) => ({ address, family, internal });
  expect(
    detectLanAddresses({
      lo0: [entry('127.0.0.1', 'IPv4', true)],
      bridge100: [entry('192.168.139.3')],
      docker0: [entry('172.17.0.1')],
      utun0: [entry('198.18.0.1'), entry('100.64.0.9')],
      awdl0: [entry('169.254.12.34')],
      en0: [entry('fe80::1', 'IPv6'), entry('192.168.3.42')],
      en1: [entry('192.168.3.42'), entry('10.0.0.8')],
    }),
  ).toEqual(['10.0.0.8', '192.168.3.42', '100.64.0.9']);
});

it('局域网 --host 仅允许 HTTPS，并生成正确的监听地址与 origin', async () => {
  expect(
    developmentSettings('product', {
      host: '0.0.0.0',
      lanAddresses: ['192.168.3.42'],
    }),
  ).toMatchObject({
    mode: 'product',
    listenHost: '0.0.0.0',
    origin: 'https://local.campanula.test:8443',
    extraOrigins: ['https://192.168.3.42:8443'],
    lanAddresses: ['192.168.3.42'],
  });
  expect(
    developmentSettings('mock', { host: '192.168.3.42', port: 9444 }),
  ).toMatchObject({
    mode: 'mock',
    listenHost: '192.168.3.42',
    origin: 'https://192.168.3.42:9444',
    lanAddresses: ['192.168.3.42'],
  });
  expect(() =>
    developmentSettings('product', { http: true, host: '0.0.0.0' }),
  ).toThrow('HTTPS');
  expect(() =>
    developmentSettings('product', { host: 'evil.example' }),
  ).toThrow('无效的 --host');
  expect(() =>
    developmentSettings('product', { host: '0.0.0.0', lanAddresses: [] }),
  ).toThrow('未检测到可用的局域网 IPv4 地址');

  const ok = startCommand(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      join(SOURCE, 'scripts/dev.mts'),
      '--print-config',
      '--host',
      '192.168.3.42',
      '--port',
      '9443',
    ],
    {
      env: { PATH: process.env.PATH, TSX_DISABLE_CACHE: '1', NO_COLOR: '1' },
    },
  );
  const rejected = startCommand(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      join(SOURCE, 'scripts/dev.mts'),
      '--http',
      '--host',
      '0.0.0.0',
    ],
    {
      env: { PATH: process.env.PATH, TSX_DISABLE_CACHE: '1', NO_COLOR: '1' },
    },
  );
  try {
    await Promise.all([ok.finished, rejected.finished]);
    expect(ok.child.exitCode, ok.logs).toBe(0);
    expect(JSON.parse(ok.logs)).toMatchObject({
      mode: 'product',
      listenHost: '192.168.3.42',
      origin: 'https://192.168.3.42:9443',
    });
    expect(rejected.child.exitCode, rejected.logs).toBe(1);
    expect(rejected.logs).toContain('HTTPS');
  } finally {
    await Promise.all([ok.close(), rejected.close()]);
  }
});
