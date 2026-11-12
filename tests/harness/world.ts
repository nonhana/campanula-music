import { AsyncLocalStorage } from 'node:async_hooks';
import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { format } from 'node:util';

import { withGlobal } from '@sinonjs/fake-timers';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Plugin, RunnableDevEnvironment } from 'vite';
import { createServer } from 'vite';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { clockOn } from './browser';
import type { Device, DeviceTraits } from './device';
import { createDevice, SENT_HEADER } from './device';
import { loadFixture } from './fixtures';
import type { Call, RequestSpan } from './netease-sdk';

const FAKE_SDK = fileURLToPath(new URL('./netease-sdk.ts', import.meta.url));
const START = new Date('2026-10-12T00:00:00Z');

export const REAL_IP = '203.0.113.7';

const SITE_ENV = {
  COOKIE_SECRET: 'campanula-test-secret-0123456789abcdefghijklmnopqrstuv',
  NETEASE_REAL_IP: REAL_IP,
};
export const TEST_OUT_DIR = '.svelte-kit-test';
const LOG_METHODS = ['debug', 'log', 'info', 'warn', 'error'] as const;

interface ServerLog {
  level: (typeof LOG_METHODS)[number];
  text: string;
}

export interface World {
  device: (traits?: DeviceTraits) => Device;
  netease: {
    readonly calls: readonly Call[];
    reply: (
      fixture: string,
      options?: {
        cookie?: string[];
        until?: Promise<void>;
        when?: Record<string, unknown>;
      },
    ) => Promise<void>;
    readonly held: number;
    anyOrder: () => void;
  };
  readonly serverLogs: readonly ServerLog[];
  clock: { advance: (ms: number) => Promise<void> };
  settle: () => Promise<void>;
}

const SDK_PROBE = 'virtual:campanula-sdk-probe';

const replaceSdk = (): Plugin => ({
  name: 'campanula:netease-fake',
  enforce: 'pre',
  config: () => ({
    ssr: {
      noExternal: ['hana-music-api'],
    },
  }),
  resolveId(id, importer) {
    if (id === 'hana-music-api' && importer === FAKE_SDK)
      return {
        id: fileURLToPath(import.meta.resolve('hana-music-api')),
        external: true,
      };
    if (id === 'hana-music-api') return FAKE_SDK;
    if (id === 'hana-music-api/watchman') return null;
    if (id.startsWith('hana-music-api/'))
      throw new Error(
        `网易云替身只替换了 hana-music-api 本身，服务端不能引用 ${id}`,
      );
    if (id === SDK_PROBE) return `\0${SDK_PROBE}`;
  },
  load(id) {
    if (id === `\0${SDK_PROBE}`) return `export * from 'hana-music-api'`;
  },
});

/* eslint-disable no-console -- 依赖库也可能用 console.log 打日志，都算服务器日志，所以接管全部方法 */
const captureServerLogs = (serving: AsyncLocalStorage<RequestSpan>) => {
  const logs: ServerLog[] = [];
  const originals = LOG_METHODS.map(
    (level) => [level, console[level]] as const,
  );
  for (const [level, original] of originals) {
    console[level] = (...args: unknown[]) => {
      if (serving.getStore()) {
        logs.push({
          level,
          text: format(...args),
        });
      }
      original.apply(console, args);
    };
  }
  return {
    logs,
    restore: () => {
      for (const [level, original] of originals) console[level] = original;
    },
  };
};
/* eslint-enable no-console */

interface WorldOptions {
  env?: Partial<typeof SITE_ENV>;
}

const startWorld = async (options: WorldOptions = {}) => {
  Object.assign(process.env, SITE_ENV, options.env);
  const vite = await createServer({
    configFile: false,
    logLevel: 'silent',
    server: {
      middlewareMode: true,
      hmr: false,
      ws: false,
      watch: null,
    },
    plugins: [replaceSdk(), sveltekit({ outDir: TEST_OUT_DIR })],
  });
  const { runner } = vite.environments.ssr as RunnableDevEnvironment;
  const fake = (await runner.import(
    FAKE_SDK,
  )) as typeof import('./netease-sdk');
  const probe = (await runner.import(
    SDK_PROBE,
  )) as typeof import('./netease-sdk');
  if (
    Object.entries(fake).some(
      ([name, value]) => probe[name as keyof typeof probe] !== value,
    )
  ) {
    await vite.close();
    throw new Error(
      '服务端代码 import 的 hana-music-api 不是网易云替身，测试可能连到真的网易云',
    );
  }

  const serving = new AsyncLocalStorage<RequestSpan>();
  const http = createHttpServer((req, res) => {
    const sent = Number(req.headers[SENT_HEADER]);
    serving.run(
      {
        start: Number.isInteger(sent) ? sent : fake.nextOrder(),
      },
      () => vite.middlewares(req, res),
    );
  });
  await new Promise<void>((resolve) => http.listen(0, 'localhost', resolve));
  const { port } = http.address() as AddressInfo;
  const closeServers = async () => {
    http.closeAllConnections();
    await new Promise((resolve) => http.close(resolve));
    await vite.close();
  };
  fake.trackRequests(() => serving.getStore());

  const serverLogs = captureServerLogs(serving);
  const timers = withGlobal(globalThis).install({
    now: START,
    toFake: ['Date'],
  });

  return {
    origin: `http://localhost:${port}`,
    fake,
    timers,
    serverLogs: serverLogs.logs,
    reset() {
      fake.reset();
      serverLogs.logs.length = 0;
      timers.reset();
    },
    async close() {
      timers.uninstall();
      serverLogs.restore();
      await closeServers();
    },
  };
};

export const useWorld = (options: WorldOptions = {}): World => {
  let started: Awaited<ReturnType<typeof startWorld>> | undefined;
  const current = () => {
    if (!started)
      throw new Error('世界还没启动：useWorld() 要在测试文件顶层调用');
    return started;
  };

  beforeAll(async () => {
    started = await startWorld(options);
  }, 30_000);
  afterAll(async () => {
    await started?.close();
  });
  let devices: Device[] = [];
  beforeEach(() => {
    current().reset();
    devices = [];
  });

  const settle = async (): Promise<void> => {
    for (let quiet = 0; quiet < 2;) {
      await new Promise((resolve) => setImmediate(resolve));
      const pending = devices.reduce(
        (sum, device) => sum + device.pending.length,
        0,
      );
      quiet =
        pending > current().fake.heldCalls() ||
        devices.some((device) => device.busy())
          ? 0
          : quiet + 1;
    }
  };
  afterEach(async () => {
    await settle();
    const ambiguous = current().fake.ambiguities();
    if (ambiguous.length > 0)
      throw new Error(
        `网易云替身：同一个模块被两个请求同时调用，给 world.netease.reply() 加 when 按查询参数对上：\n${ambiguous.join('\n')}`,
      );
  });

  return {
    device: (traits) => {
      const device = createDevice(
        current().origin,
        clockOn(current().timers),
        () => current().fake.nextOrder(),
        traits,
      );
      devices.push(device);
      return device;
    },
    netease: {
      get calls() {
        return current().fake.calls;
      },
      async reply(path, { cookie = [], until, when } = {}) {
        const { module, outcome } = await loadFixture(path);
        current().fake.queueReply(module, {
          ...outcome,
          response: { ...outcome.response, cookie },
          until,
          when,
          fixture: path,
        });
      },
      get held() {
        return current().fake.heldCalls();
      },
      anyOrder() {
        current().fake.allowAnyOrder();
      },
    },
    get serverLogs() {
      return current().serverLogs;
    },
    clock: {
      advance: async (ms) => {
        await current().timers.tickAsync(ms);
        await settle();
      },
    },
    settle,
  };
};
