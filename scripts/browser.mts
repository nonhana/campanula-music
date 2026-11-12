import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import type { AxeResults } from 'axe-core';

const ROOT = join(import.meta.dirname, '..');
const AXI = join(ROOT, 'scripts/axi.sh');
const LOCK = join(homedir(), '.cache/campanula-axi/browser.lock');
const MOCK_ORIGIN = 'http://localhost:5174';
const REAL_ORIGIN = 'http://localhost:5173';
const MOCK_PROFILE = join(homedir(), '.cache/campanula-axi/mock-profile');

const args = process.argv.slice(2);
const real =
  args.includes('--real') || process.env.CAMPANULA_BROWSER === 'real';
const command = args.find((arg) => !arg.startsWith('--')) ?? 'check';
const rest = args.filter((arg) => arg !== command && arg !== '--real');
const origin = real ? REAL_ORIGIN : MOCK_ORIGIN;
const session = real ? 'campanula' : 'campanula-mock';

const lock = (): (() => void) => {
  mkdirSync(dirname(LOCK), { recursive: true });
  try {
    writeFileSync(
      LOCK,
      JSON.stringify({
        pid: process.pid,
        command,
        at: Date.now(),
      }),
      { flag: 'wx' },
    );
  } catch {
    const holder = (() => {
      try {
        return JSON.parse(readFileSync(LOCK, 'utf8')) as {
          pid: number;
          command: string;
        };
      } catch {
        return null;
      }
    })();
    if (holder) {
      try {
        process.kill(holder.pid, 0);
        throw new Error(
          `浏览器正被另一个 agent 操作（pid ${holder.pid}，${holder.command}）：等它做完，或确认它已经停了再删 ${LOCK}`,
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('浏览器正被'))
          throw error;
      }
    }
    rmSync(LOCK, { force: true });
    return lock();
  }
  return () => rmSync(LOCK, { force: true });
};

const envOf = (): NodeJS.ProcessEnv => {
  if (real) {
    return {
      ...process.env,
      CHROME_DEVTOOLS_AXI_SESSION: 'campanula',
      CHROME_DEVTOOLS_AXI_USER_DATA_DIR: join(
        homedir(),
        '.cache/campanula-axi/chrome-profile',
      ),
      CHROME_DEVTOOLS_AXI_HEADED: '1',
    };
  }
  return {
    ...process.env,
    CHROME_DEVTOOLS_AXI_SESSION: session,
    CHROME_DEVTOOLS_AXI_USER_DATA_DIR: MOCK_PROFILE,
    CHROME_DEVTOOLS_AXI_HEADED: '1',
    CHROME_DEVTOOLS_AXI_CHROME_ARGS: '--remote-debugging-port=0',
  };
};

const port = (): number => {
  const output = cli(['port']).trim();
  const value = Number(output);
  if (!Number.isInteger(value) || value <= 0 || value > 65535)
    throw new Error(`没读到 ${session} 桥接进程的端口：${output}`);
  return value;
};

const call = async (
  name: string,
  callArgs: Record<string, unknown>,
): Promise<string> => {
  const bridge = port();
  const response = await fetch(`http://127.0.0.1:${bridge}/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args: callArgs }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new Error(`DevTools ${name}：HTTP ${response.status}`);
  const reply = (await response.json()) as { result?: string; error?: string };
  if (reply.error !== undefined || reply.result === undefined)
    throw new Error(`DevTools ${name}：${reply.error ?? '没有结果'}`);
  return reply.result;
};

const pages = async (): Promise<string> => call('list_pages', {});

const pageIdOf = (text: string, target: string): number | null => {
  // 桥接进程的 list_pages 两种格式都见过：`1: title (url)` 和 `1: url`；CLI 的 pages 是 `1,url`
  for (const line of text.split('\n')) {
    const match = /^(\d+): (.*)$/.exec(line.trim());
    if (!match) continue;
    const rest = match[2]!.replace(/ \[selected\]$/, '');
    const url = /\(([^)]+)\)$/.exec(rest)?.[1] ?? rest;
    if (url === target || url.startsWith(`${target}/`)) return Number(match[1]);
  }
  return null;
};

const ensurePage = async (path = '/'): Promise<number> => {
  const text = await pages();
  const found = pageIdOf(text, origin);
  if (found !== null) return found;
  await call('new_page', { url: `${origin}${path}` });
  const after = await pages();
  const created = pageIdOf(after, origin);
  if (created === null) throw new Error(`打不开 ${origin}：开发服务器开着吗？`);
  await selectPage(created);
  return created;
};

const selectPage = async (pageId: number): Promise<void> => {
  // 用 CLI 的 selectpage：它会把选中的页写进 CLI 自己的状态，随后的 eval/screenshot 才认
  cli(['selectpage', String(pageId), '--no-snapshot']);
};

const cli = (args: string[]): string =>
  execFileSync(AXI, args, {
    env: envOf(),
    encoding: 'utf8',
  });

const playwright = (args: string[]): string =>
  execFileSync(
    'pnpm',
    ['exec', 'playwright-cli', '-s=campanula-mock', ...args],
    {
      cwd: ROOT,
      env: process.env,
      encoding: 'utf8',
    },
  );

const parseNested = (output: string): unknown => {
  let current: unknown = output;
  for (let depth = 0; depth < 4 && typeof current === 'string'; depth += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      break;
    }
  }
  return current;
};

const evaluate = async (
  pageId: number,
  expression: string,
): Promise<string> => {
  await selectPage(pageId);
  const output = cli(['eval', expression])
    .replace(/\nhelp\[[\s\S]*$/, '')
    .replace(/^result:\s*/, '')
    .trim();
  const parsed = parseNested(output);
  return typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
};

const navigate = async (pageId: number, url: string): Promise<void> => {
  await call('navigate_page', { type: 'url', url, pageId });
};

const mockStatus = async (): Promise<{
  enabled: boolean;
  scenario: string;
  seed: string;
  offline: boolean;
}> => {
  const response = await fetch(`${MOCK_ORIGIN}/api/mock/status`);
  if (!response.ok)
    throw new Error(`mock 开发服务器没开：先 pnpm dev:mock（${MOCK_ORIGIN}）`);
  return response.json() as Promise<{
    enabled: boolean;
    scenario: string;
    seed: string;
    offline: boolean;
  }>;
};

const postMock = async (path: string, body?: unknown): Promise<void> => {
  const response = await fetch(
    `${MOCK_ORIGIN}${path}`,
    body === undefined
      ? { method: 'POST' }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  if (!response.ok)
    throw new Error(
      `mock ${path} 失败：${response.status} ${await response.text()}`,
    );
};

const accountSignedIn = async (
  pageId: number,
): Promise<{ signedIn: boolean; text: string }> => {
  const output = await evaluate(
    pageId,
    `(async () => { const r = await fetch('/api/account', { cache: 'no-store' }); const b = await r.json(); return JSON.stringify({ status: r.status, account: b.account ? { id: b.account.id, nickname: b.account.nickname } : null }) })()`,
  );
  const state = JSON.parse(output) as {
    status: number;
    account: { id: number; nickname: string } | null;
  };
  return {
    signedIn: state.account !== null,
    text: JSON.stringify(state),
  };
};

const main = async (): Promise<void> => {
  const release = lock();
  try {
    switch (command) {
      case 'port':
        console.log(port());
        return;
      case 'stop':
        console.log(cli(['stop']));
        return;
      case 'playwright': {
        if (real) throw new Error('Playwright 只接 mock：请去掉 --real');
        const action = rest[0] ?? '--help';
        if (action === 'attach') {
          await mockStatus();
          const pageId = await ensurePage();
          const target = await evaluate(pageId, 'location.href');
          const file = join(MOCK_PROFILE, 'DevToolsActivePort');
          let endpointPort: string;
          try {
            endpointPort = readFileSync(file, 'utf8').split('\n')[0]!;
          } catch {
            throw new Error(
              'mock Chrome 还没有 CDP 端口：先 scripts/browser.sh stop，再 scripts/browser.sh open /',
            );
          }
          if (!/^\d+$/.test(endpointPort))
            throw new Error(`CDP 端口无效：${file}`);
          console.log(
            playwright([
              'attach',
              `--cdp=http://127.0.0.1:${endpointPort}`,
              '--config=.playwright/cli.config.json',
            ]),
          );
          const tabs = playwright(['tab-list']);
          const tab = tabs
            .split('\n')
            .find((line) => line.endsWith(`(${target})`))
            ?.match(/^- (\d+):/)?.[1];
          if (tab === undefined)
            throw new Error(`Playwright 没找到当前 mock 页面：${target}`);
          console.log(playwright(['tab-select', tab]));
        } else {
          if (
            ['open', 'close', 'close-all', 'kill-all', 'delete-data'].includes(
              action,
            )
          )
            throw new Error(
              'Playwright 复用 mock Chrome：用 attach 连接、detach 断开，用 scripts/browser.sh stop 关闭',
            );
          console.log(playwright(rest));
        }
        return;
      }
      case 'axe': {
        if (real) throw new Error('axe 只检查 mock：请去掉 --real');
        await mockStatus();
        const pageId = await ensurePage();
        const file = resolve(
          ROOT,
          rest[0] ?? `_notes/accessibility/axe-${Date.now()}.json`,
        );
        mkdirSync(dirname(file), { recursive: true });
        await call('evaluate_script', {
          pageId,
          sourcePath: fileURLToPath(import.meta.resolve('axe-core/axe.min.js')),
          format: 'script',
        });
        await call('evaluate_script', {
          pageId,
          function: `async () => {
            if (location.origin !== ${JSON.stringify(MOCK_ORIGIN)} || !document.querySelector('main'))
              throw new Error('先用 scripts/browser.sh open 打开要检查的 mock 页面，并等页面加载好');
            return await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
          }`,
          filePath: file,
        });
        const report = JSON.parse(readFileSync(file, 'utf8')) as AxeResults;
        console.log(
          JSON.stringify(
            {
              file,
              url: report.url,
              violations: report.violations.map(({ id, impact, nodes }) => ({
                id,
                impact,
                nodes: nodes.length,
              })),
              incomplete: report.incomplete.map(({ id, nodes }) => ({
                id,
                nodes: nodes.length,
              })),
              passes: report.passes.length,
            },
            null,
            2,
          ),
        );
        if (report.violations.length > 0) process.exitCode = 1;
        return;
      }
      case 'check':
        if (real) {
          try {
            await fetch(`${REAL_ORIGIN}/api/account`);
          } catch {
            throw new Error(
              `真账号开发服务器没开：先 pnpm dev（${REAL_ORIGIN}）`,
            );
          }
        }
        if (!real) {
          console.log(
            JSON.stringify({
              mode: 'mock',
              ...(await mockStatus()),
            }),
          );
          return;
        }
        {
          // 真账号：先开 /api/account 这一页查登录，不加载 App、不触发曲库同步
          const pageId = await ensurePage('/api/account');
          const account = await accountSignedIn(pageId);
          if (!account.signedIn) {
            console.error(
              `真账号没登录：请在专用窗口（scripts/axi.sh）里扫码一次，再跑 scripts/browser.sh check --real。${account.text}`,
            );
            process.exitCode = 1;
            return;
          }
          console.log(
            JSON.stringify({
              mode: 'real',
              ...JSON.parse(account.text),
            }),
          );
        }
        return;
      case 'open': {
        if (real) {
          try {
            await fetch(`${REAL_ORIGIN}/api/account`);
          } catch {
            throw new Error(
              `真账号开发服务器没开：先 pnpm dev（${REAL_ORIGIN}）`,
            );
          }
        }
        if (!real) await mockStatus();
        const pageId = await ensurePage(real ? '/api/account' : '/');
        if (real) {
          const account = await accountSignedIn(pageId);
          if (!account.signedIn) {
            console.error(
              `真账号没登录：请先在专用窗口（scripts/axi.sh）里扫码。没有继续打开页面。${account.text}`,
            );
            process.exitCode = 1;
            return;
          }
          await navigate(pageId, `${origin}${rest[0] ?? '/'}`);
          await selectPage(pageId);
          console.log(`real ${origin}${rest[0] ?? '/'}`);
          return;
        }
        const path = rest[0] ?? '/';
        await navigate(
          pageId,
          `${origin}/mock/login?next=${encodeURIComponent(path)}`,
        );
        await selectPage(pageId);
        console.log(`mock ${origin}${path}`);
        return;
      }
      case 'exec': {
        const pageId = await ensurePage();
        console.log(await evaluate(pageId, rest.join(' ')));
        return;
      }
      case 'screenshot': {
        const pageId = await ensurePage();
        const file = resolve(
          ROOT,
          rest[0] ?? `_notes/screenshots/mock-${Date.now()}.png`,
        );
        mkdirSync(dirname(file), { recursive: true });
        await selectPage(pageId);
        cli(['screenshot', file]);
        console.log(file);
        return;
      }
      case 'reset':
        if (real) {
          console.error('真账号没有 reset：mock 才可重置');
          process.exitCode = 1;
          return;
        }
        await postMock('/api/mock/reset');
        console.log('mock 已回到种子');
        return;
      case 'scenario': {
        if (real) {
          console.error('真账号没有 scenario：mock 才可换场景');
          process.exitCode = 1;
          return;
        }
        const name = rest[0] ?? 'default';
        await postMock('/api/mock/scenario', { name });
        console.log(JSON.stringify(await mockStatus()));
        return;
      }
      case 'coverage': {
        if (real) {
          console.error('真账号没有 coverage：mock 才有覆盖报告');
          process.exitCode = 1;
          return;
        }
        const response = await fetch(`${MOCK_ORIGIN}/api/mock/coverage`);
        console.log(JSON.stringify(await response.json(), null, 2));
        return;
      }
      case 'offline': {
        const pageId = await ensurePage();
        const on = rest[0] !== 'off';
        await call(
          'emulate',
          on ? { pageId, networkConditions: 'Offline' } : { pageId },
        );
        console.log(`offline ${on ? 'on' : 'off'}`);
        return;
      }
      default:
        throw new Error(
          `不认识的命令 ${command}：check|open|exec|screenshot|reset|scenario|coverage|offline|port|stop|playwright|axe`,
        );
    }
  } finally {
    release();
  }
};

await main();
