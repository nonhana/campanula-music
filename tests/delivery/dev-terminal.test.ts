import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { stripVTControlCharacters } from 'node:util';

import { expect, it } from 'vitest';

import { SOURCE } from '../_kit/workspace.ts';

const signalProcess = (pid: number, signal: NodeJS.Signals | 0) => {
  try {
    process.kill(pid, signal);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
};

const startTerminal = (args: string[], env: NodeJS.ProcessEnv) => {
  // 断言前保留会话，避免挂断终端替启动器清理子进程而造成假阳性。
  const child = spawn(
    'python3',
    [join(SOURCE, 'tests/_kit/terminal.py'), JSON.stringify(args)],
    {
      cwd: SOURCE,
      env,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let logs = '';
  const listeners = new Set<() => void>();
  const capture = (chunk: string) => {
    logs += chunk;
    for (const listener of listeners) listener();
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  let ended = false;
  const finished = new Promise<void>((resolve) =>
    child.once('close', () => {
      ended = true;
      for (const listener of listeners) listener();
      resolve();
    }),
  );
  return {
    get logs() {
      return stripVTControlCharacters(logs);
    },
    write: (value: string) => {
      child.stdin.write(value);
    },
    waitFor: (text: string) =>
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => complete(new Error(logs)), 10_000);
        const complete = (error?: Error) => {
          clearTimeout(timeout);
          listeners.delete(check);
          child.removeListener('error', complete);
          if (error) reject(error);
          else resolve();
        };
        const check = () => {
          const plain = stripVTControlCharacters(logs);
          if (plain.includes(text)) complete();
          else if (ended || plain.includes('__CLI_EXIT__'))
            complete(new Error(plain));
        };
        child.once('error', complete);
        listeners.add(check);
        check();
      }),
    close: async () => {
      const session = /__SESSION__(\d+)/.exec(logs)?.[1];
      if (session) signalProcess(-Number(session), 'SIGKILL');
      const force = setTimeout(() => {
        if (child.pid) signalProcess(-child.pid, 'SIGKILL');
      }, 1000);
      try {
        await finished;
      } finally {
        clearTimeout(force);
      }
    },
  };
};

it.each([
  'approve',
  'decline',
  'interrupt',
  'terminate',
  'stubborn',
  'pnpm',
] as const)(
  '首次交互授权 %s：保留控制终端、清理自有进程且不写系统信任',
  async (action) => {
    const root = await mkdtemp(join(tmpdir(), 'campanula-terminal-'));
    const registry = join(root, 'pids.json');
    const prompt = join(root, 'prompt.mjs');
    const provider = join(root, 'mkcert.mjs');
    await writeFile(
      prompt,
      `
import { openSync, closeSync, readSync, writeSync } from 'node:fs';
if (${action === 'stubborn'}) {
  process.on('SIGINT', () => {});
  setInterval(() => {}, 1000);
  console.log('CAMPANULA_PASSWORD: ');
} else {
const terminal = openSync('/dev/tty', 'r+');
writeSync(terminal, 'CAMPANULA_PASSWORD: ');
let input = ''; const byte = Buffer.alloc(1);
while (readSync(terminal, byte, 0, 1, null) && byte[0] !== 10) input += byte.toString();
closeSync(terminal);
console.log(input.trim() === 'test-approval' ? 'AUTH_ACCEPTED' : 'AUTH_DENIED');
}
`,
    );
    // mkcert 的系统命令捕获输出且不传 stdin，sudo 只能从控制终端读取授权。
    await writeFile(
      provider,
      `#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
if (process.argv.includes('-version')) { console.log('v1.4.4'); process.exit(0); }
if (!process.argv.includes('-install')) throw new Error('unexpected command');
const child = spawn(process.execPath, [${JSON.stringify(prompt)}], { stdio: ['ignore', 'pipe', 'pipe'] });
writeFileSync(${JSON.stringify(registry)}, JSON.stringify({ launcher: process.ppid, provider: process.pid, prompt: child.pid }));
console.log('PROVIDER_STARTED');
child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
child.once('close', (code) => process.exit(code === 0 ? 42 : 1));
`,
      { mode: 0o755 },
    );
    const terminal = startTerminal(
      action === 'pnpm'
        ? ['pnpm', 'dev']
        : [
            process.execPath,
            '--import',
            import.meta.resolve('tsx'),
            join(SOURCE, 'scripts/dev.mts'),
            '--setup',
            '--skip-dns-check',
          ],
      {
        PATH: process.env.PATH,
        TERM: 'xterm-256color',
        NO_COLOR: '1',
        TSX_DISABLE_CACHE: '1',
        CAMPANULA_MKCERT: provider,
        CAMPANULA_DEV_TLS_DIR: join(root, 'tls'),
        CAROOT: join(root, 'authority'),
      },
    );
    let pids: Record<string, number> = {};
    try {
      await terminal.waitFor('是否继续');
      terminal.write(action === 'decline' ? '\r' : '\x1B[D\r');
      if (action !== 'decline') {
        await terminal.waitFor('PROVIDER_STARTED');
        pids = JSON.parse(await readFile(registry, 'utf8'));
        await terminal.waitFor('CAMPANULA_PASSWORD:');
        if (action === 'approve' || action === 'pnpm')
          terminal.write('test-approval\n');
        if (action === 'interrupt') terminal.write('\x03');
        if (action === 'terminate' || action === 'stubborn')
          process.kill(pids.launcher, 'SIGTERM');
      }
      await terminal.waitFor('__CLI_EXIT__');
      if (action === 'approve' || action === 'pnpm') {
        expect(terminal.logs).toContain('AUTH_ACCEPTED');
        expect(terminal.logs).toContain('__CLI_EXIT__1');
      } else expect(terminal.logs).toContain('__CLI_EXIT__130');
      await expect(access(join(root, 'tls/trusted.json'))).rejects.toThrow();
      await expect(
        access(join(root, 'tls/.preparation/.owner')),
      ).rejects.toThrow();
      for (const pid of Object.values(pids)) {
        let alive = true;
        for (let attempt = 0; alive && attempt < 50; attempt++) {
          alive = signalProcess(pid, 0);
          if (alive) await delay(20);
        }
        expect(alive, `owned PID ${pid} is still running`).toBe(false);
      }
    } finally {
      for (const pid of Object.values(pids)) {
        signalProcess(pid, 'SIGKILL');
      }
      await terminal.close();
      await rm(root, { recursive: true, force: true });
    }
  },
  20_000,
);
