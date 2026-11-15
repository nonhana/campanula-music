import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Profiler } from 'node:inspector';
import { Session } from 'node:inspector/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CoverageProviderModule } from 'vitest/node';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
// Vitest 在开测前清空本地模块缓存，采集器的会话必须跨两次加载保留。
const storage = globalThis as typeof globalThis & {
  __campanulaCoverage?: { session: Session; reportsDirectory: string };
};

export interface SsrScript {
  coverage: Profiler.ScriptCoverage;
  source: string;
}

export default {
  async getProvider() {
    const { SsrCoverageProvider } = await import('./provider.ts');
    return new SsrCoverageProvider();
  },
  async startCoverage(options) {
    const session = new Session();
    storage.__campanulaCoverage = {
      session,
      reportsDirectory: options.reportsDirectory,
    };
    session.connect();
    await session.post('Debugger.enable');
    await session.post('Profiler.enable');
    await session.post('Profiler.startPreciseCoverage', {
      callCount: true,
      detailed: true,
    });
  },
  async takeCoverage(options) {
    const { session, reportsDirectory } = storage.__campanulaCoverage!;
    if (!options) throw new Error('覆盖率缺少输出目录');
    const { result } = await session.post('Profiler.takePreciseCoverage');
    const ssr: SsrScript[] = [];
    const normal = [];
    for (const entry of result) {
      // 独立 Kit 的 module runner 使用绝对路径 sourceURL，Vitest 的 file:// 过滤会漏掉它。
      if (entry.url.startsWith(SRC)) {
        const { scriptSource } = await session.post(
          'Debugger.getScriptSource',
          { scriptId: entry.scriptId },
        );
        ssr.push({ coverage: entry, source: scriptSource });
      } else if (
        entry.url.startsWith('file://') &&
        !entry.url.includes('/node_modules/')
      ) {
        normal.push({
          ...entry,
          startOffset:
            options.moduleExecutionInfo?.get(fileURLToPath(entry.url))
              ?.startOffset ?? 0,
        });
      }
    }
    const id = randomUUID();
    const ssrDir = join(reportsDirectory, 'ssr-raw');
    await mkdir(ssrDir, { recursive: true });
    await writeFile(join(ssrDir, `${id}.json`), JSON.stringify(ssr));
    const output = join(options.coverageFilesDirectory, `coverage-${id}.json`);
    await writeFile(output, JSON.stringify({ result: normal }));
    return output;
  },
  async stopCoverage() {
    const { session } = storage.__campanulaCoverage!;
    await session.post('Profiler.stopPreciseCoverage');
    await session.post('Profiler.disable');
    await session.post('Debugger.disable');
    session.disconnect();
    delete storage.__campanulaCoverage;
  },
} satisfies CoverageProviderModule;
