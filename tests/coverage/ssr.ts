import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Profiler } from 'node:inspector';
import { Session } from 'node:inspector/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const MOCK = fileURLToPath(new URL('../_kit/mock/', import.meta.url));

export interface SsrScript {
  coverage: Profiler.ScriptCoverage;
  source: string;
}

export const isSsrScript = (url: string) =>
  url.startsWith(SRC) || url.startsWith(MOCK);

export const writeSsrCoverage = async (
  session: Session,
  entries: Profiler.ScriptCoverage[],
  reportsDirectory: string,
) => {
  const scripts: SsrScript[] = [];
  for (const coverage of entries) {
    const { scriptSource } = await session.post('Debugger.getScriptSource', {
      scriptId: coverage.scriptId,
    });
    scripts.push({ coverage, source: scriptSource });
  }
  const dir = join(reportsDirectory, 'ssr-raw');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${randomUUID()}.json`), JSON.stringify(scripts));
};

export const startSsrCoverage = async (reportsDirectory: string) => {
  const session = new Session();
  session.connect();
  await session.post('Debugger.enable');
  await session.post('Profiler.enable');
  await session.post('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true,
  });
  return async () => {
    const { result } = await session.post('Profiler.takePreciseCoverage');
    await writeSsrCoverage(
      session,
      result.filter(
        ({ url }) =>
          isSsrScript(url) || url.startsWith(pathToFileURL(MOCK).href),
      ),
      reportsDirectory,
    );
    await session.post('Profiler.stopPreciseCoverage');
    await session.post('Debugger.disable');
    session.disconnect();
  };
};
