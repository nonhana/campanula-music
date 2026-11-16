import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { inspectCandidate } from '../delivery/candidate.ts';
import { startProduction } from '../delivery/node.ts';
import { ROOT } from '../suites.ts';

const { values } = parseArgs({
  options: {
    sha: { type: 'string' },
    adapter: { type: 'string' },
    candidate: { type: 'string' },
  },
});
if (
  !values.sha ||
  !values.candidate ||
  !['node', 'vercel'].includes(values.adapter ?? '')
)
  throw new Error('需要 --sha、--adapter node|vercel、--candidate');
const input = {
  sha: values.sha,
  adapter: values.adapter as 'node' | 'vercel',
  candidate: resolve(values.candidate),
};
await mkdir(join(ROOT, '.reports/delivery'), { recursive: true });
const report = await mkdtemp(join(ROOT, '.reports/delivery/run-'));
let result: unknown;
let failure: string | undefined;
try {
  result = await inspectCandidate(input);
  if (input.adapter === 'node') {
    const server = await startProduction(input.candidate);
    try {
      for (const path of [
        '/api/mock/reset',
        '/mock/login',
        '/mock-assets/audio/test.wav',
        '/tests/tools/browser.mts',
      ]) {
        const response = await fetch(`${server.baseURL}${path}`);
        if (response.status !== 404)
          throw new Error(`Node 不应提供 ${path}：${response.status}`);
      }
      const account = await fetch(`${server.baseURL}/api/account`);
      if (!account.ok || (await account.json()).account !== null)
        throw new Error('Node 真实 API 匿名合同不符');
    } finally {
      await server.close();
    }
    if (
      await fetch(server.baseURL).then(
        () => true,
        () => false,
      )
    )
      throw new Error('Node 端口未清理');
    result = {
      ...(result as object),
      http: 'passed',
      processExited: server.child.exitCode !== null,
      portClosed: true,
    };
  }
} catch (error) {
  failure = String(error);
  throw error;
} finally {
  await writeFile(
    join(report, 'result.json'),
    JSON.stringify(
      {
        ...input,
        status: failure ? 'failed' : 'passed',
        result,
        failure,
        rerun: `pnpm test:delivery --sha ${input.sha} --adapter ${input.adapter} --candidate ${input.candidate}`,
      },
      null,
      2,
    ),
  );
  console.log(`产物检查报告：${report}`);
}
