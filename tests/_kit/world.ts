import { AsyncLocalStorage } from 'node:async_hooks';
import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { format } from 'node:util';

import { withGlobal } from '@sinonjs/fake-timers';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Plugin, RunnableDevEnvironment } from 'vite';
import { createServer } from 'vite';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { clockOn } from './browser.ts';
import type { Device, DeviceTraits } from './device.ts';
import { createDevice, SENT_HEADER } from './device.ts';
import { loadFixture } from './fixtures.ts';
import type { Call, RequestSpan } from './netease-sdk.ts';
import { createWorkspace } from './workspace.ts';

const FAKE_SDK = fileURLToPath(new URL('./netease-sdk.ts', import.meta.url));
const START = new Date('2026-10-12T00:00:00Z');

export const REAL_IP = '203.0.113.7';

const SITE_ENV = {
  NETEASE_REAL_IP: REAL_IP,
};
const LOG_METHODS = ['debug', 'log', 'info', 'warn', 'error'] as const;

interface ServerLog {
  level: (typeof LOG_METHODS)[number];
  text: string;
}

export interface World {
  device: (traits?: DeviceTraits) => Device;
  netease: {
    readonly calls: readonly Call[];
    pauseSync: () => Promise<void>;
    rejectUnprepared: (
      module: string,
      reason: string,
      when?: Record<string, unknown>,
      exception?: string,
    ) => Promise<void>;
    reply: (
      fixture: string,
      options?: {
        expectedMissingLoginCookie?: boolean;
        exception?: string;
        required?: boolean;
        ordered?: boolean;
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
    if (
      id === 'hana-music-api' &&
      (importer === FAKE_SDK || importer?.endsWith('/sdk-contract.ts'))
    )
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
  env?: { COOKIE_SECRET?: string; NETEASE_REAL_IP?: string };
}

const startWorld = async (options: WorldOptions = {}) => {
  const workspace = await createWorkspace({
    env: { ...SITE_ENV, ...options.env },
  });
  const cleanup: (() => Promise<unknown>)[] = [workspace.close];
  try {
    const vite = await createServer({
      configFile: false,
      root: workspace.root,
      envDir: workspace.root,
      cacheDir: 'node_modules/.vite',
      logLevel: 'silent',
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      plugins: [replaceSdk(), sveltekit()],
    });
    cleanup.unshift(() => vite.close());
    const { runner } = vite.environments.ssr as RunnableDevEnvironment;
    const fake = (await runner.import(
      FAKE_SDK,
    )) as typeof import('./netease-sdk.ts');
    const probe = (await runner.import(
      SDK_PROBE,
    )) as typeof import('./netease-sdk.ts');
    if (
      Object.entries(fake).some(
        ([name, value]) => probe[name as keyof typeof probe] !== value,
      )
    ) {
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
    cleanup.unshift(async () => {
      http.closeAllConnections();
      await new Promise((resolve) => http.close(resolve));
    });
    await new Promise<void>((resolve, reject) => {
      http.once('error', reject);
      http.listen(0, 'localhost', resolve);
    });
    const { port } = http.address() as AddressInfo;
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
        for (const close of cleanup) await close();
      },
    };
  } catch (error) {
    for (const close of cleanup) await close();
    throw error;
  }
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
    current().fake.assertComplete();
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
      async rejectUnprepared(module, reason, when, exception) {
        const { outcome } = await loadFixture(
          'library/likelist.500-synthetic.constructed.json',
        );
        current().fake.queueReply(module, {
          ...outcome,
          when,
          exception,
          repeat: true,
          required: false,
          ordered: false,
          fixture: reason,
        });
      },
      async pauseSync() {
        await this.rejectUnprepared('likelist', '暂停后台同步');
      },
      get calls() {
        return current().fake.calls;
      },
      async reply(
        path,
        {
          cookie = [],
          until,
          when,
          required = true,
          ordered = false,
          expectedMissingLoginCookie,
          exception,
        } = {},
      ) {
        const { module, outcome } = await loadFixture(path);
        current().fake.queueReply(module, {
          ...outcome,
          response: { ...outcome.response, cookie },
          until,
          when,
          expectedMissingLoginCookie,
          exception,
          fixture: path,
          required,
          ordered,
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
