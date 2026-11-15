import { spawn } from 'node:child_process';
import type { SpawnOptionsWithoutStdio } from 'node:child_process';
import process from 'node:process';

export const startCommand = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => {
  const child = spawn(command, args, {
    ...options,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    logs += chunk.toString();
  });
  const finished = new Promise<void>((resolve) => {
    child.once('error', resolve);
    child.once('close', () => resolve());
  });
  let closing: Promise<void> | undefined;
  return {
    child,
    finished,
    get logs() {
      return logs;
    },
    close: (grace = 5000) =>
      (closing ??= (async () => {
        const signal = (name: NodeJS.Signals) => {
          if (!child.pid) return;
          try {
            process.kill(-child.pid, name);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
          }
        };
        signal('SIGTERM');
        const force = setTimeout(signal, grace, 'SIGKILL');
        try {
          await finished;
        } finally {
          clearTimeout(force);
          signal('SIGKILL');
        }
      })()),
  };
};
