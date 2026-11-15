import process from 'node:process';

import { execa } from 'execa';
import pidtree from 'pidtree';

export const runTerminalCommand = async (
  file: string,
  args: string[],
  { signal, input }: { signal: AbortSignal; input?: string },
) => {
  signal.throwIfAborted();
  const cancellation = new AbortController();
  const child = execa(file, args, {
    cancelSignal: cancellation.signal,
    // Unix 的整组终止会分离控制终端；需要密码的命令必须留在前台。
    killDescendants: process.platform === 'win32',
    ...(input === undefined
      ? { stdio: 'inherit' as const }
      : {
          input,
          stdout: 'ignore' as const,
          stderr: 'inherit' as const,
        }),
  });
  let stopping: Promise<void> | undefined;
  const stop = () => {
    stopping ??= (async () => {
      try {
        if (
          process.platform !== 'win32' &&
          child.pid &&
          child.nodeChildProcess.exitCode === null &&
          child.nodeChildProcess.signalCode === null
        ) {
          let descendants: number[];
          try {
            descendants = await pidtree(child.pid);
          } catch (error) {
            try {
              process.kill(child.pid, 0);
            } catch (gone) {
              if ((gone as NodeJS.ErrnoException).code === 'ESRCH') return;
              throw gone;
            }
            throw error;
          }
          const failures: unknown[] = [];
          for (const pid of descendants.reverse()) {
            try {
              process.kill(pid, 'SIGINT');
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
                failures.push(error);
            }
          }
          if (failures.length)
            throw new AggregateError(
              failures,
              '部分系统授权进程拒绝取消信号；若仍有授权提示，请在本终端按 Ctrl+C',
            );
        }
      } finally {
        cancellation.abort();
      }
    })();
    // finally 会等候并重新抛出；先订阅，避免子进程退出前出现未处理拒绝。
    void stopping.catch(() => {});
  };
  signal.addEventListener('abort', stop, { once: true });
  if (signal.aborted) stop();
  try {
    const result = await child;
    signal.throwIfAborted();
    return result;
  } finally {
    signal.removeEventListener('abort', stop);
    await stopping;
  }
};
