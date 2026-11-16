import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

import { execa } from 'execa';

import { createWorkspace } from '../_kit/workspace.ts';
import { sourceSha } from '../suites.ts';

const ROOT = join(import.meta.dirname, '../..');
const sha = sourceSha();
const candidateAt = process.argv.indexOf('--candidate');
const candidate = await realpath(
  candidateAt < 0
    ? join(ROOT, 'node_modules/hana-music-api')
    : resolve(process.argv[candidateAt + 1]),
);
const pkg = JSON.parse(
  await readFile(join(candidate, 'package.json'), 'utf8'),
) as { name: string; version: string };
if (
  pkg.name !== 'hana-music-api' ||
  typeof pkg.version !== 'string' ||
  !pkg.version
)
  throw new Error('候选目录必须是已安装依赖、可离线导入的 hana-music-api 包');
await mkdir(join(ROOT, '.reports'), { recursive: true });
const output = await mkdtemp(join(ROOT, '.reports/sdk-upgrade-'));
const workspace = await mkdtemp(join(tmpdir(), 'campanula-sdk-'));
let close: (() => Promise<void>) | undefined;
const baseline = JSON.parse(
  await readFile(join(ROOT, 'tests/fixtures/netease/index.json'), 'utf8'),
) as import('./fixture-index.mts').FixtureIndex;
let differences: unknown = null;
const results: { command: string[]; exitCode: number }[] = [];
try {
  const { stdout } = await execa('git', ['ls-files', '--cached', '-z'], {
    cwd: ROOT,
  });
  for (const path of stdout.split('\0').filter(Boolean)) {
    if (/^(?:_notes|\.env|\.campanula|\.reports)(?:\/|$)/.test(path)) continue;
    await mkdir(dirname(join(workspace, path)), { recursive: true });
    await cp(join(ROOT, path), join(workspace, path)).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      },
    );
  }
  const environment = await createWorkspace({
    root: workspace,
    source: workspace,
  });
  close = environment.close;
  const modules = join(workspace, 'node_modules');
  await rm(join(modules, 'hana-music-api'));
  await symlink(candidate, join(modules, 'hana-music-api'));
  const commands = [
    ['pnpm', 'fixtures:index'],
    ['pnpm', 'tsx', 'tests/tools/sdk-report.mts'],
    ['pnpm', 'check'],
    ['pnpm', 'test:contract'],
    [
      'pnpm',
      'test:behavior',
      'tests/behavior/session.test.ts',
      'tests/behavior/playlist-tracks.test.ts',
      'tests/behavior/search.test.ts',
    ],
    [
      'pnpm',
      'test:browser',
      'tests/browser/journeys/save.spec.ts',
      '--project',
      'desktop',
    ],
  ];
  for (const [command, ...args] of commands) {
    const result = await execa(command, args, {
      cwd: workspace,
      reject: false,
      env: { CI: '1', CAMPANULA_TEST_SHA: sha },
    });
    results.push({
      command: [command, ...args],
      exitCode: result.exitCode ?? 1,
    });
    await writeFile(
      join(output, `step-${results.length}.log`),
      `${result.stdout}\n${result.stderr}`,
    );
    console.log(`${command} ${args.join(' ')}：${result.exitCode}`);
    if (result.exitCode !== 0) {
      process.exitCode = 1;
      break;
    }
  }
  if (results[0]?.exitCode === 0) {
    const measured = JSON.parse(
      await readFile(
        join(workspace, 'tests/fixtures/netease/index.json'),
        'utf8',
      ),
    ) as typeof baseline;
    const before = new Map(
      baseline.entries.map((entry) => [entry.path, entry]),
    );
    const contract = (entry: (typeof baseline.entries)[number]) => ({
      module: entry.module,
      queryKey: entry.queryKey,
      outcome: entry.outcome,
      validation: entry.validation,
    });
    differences = {
      baselineSdk: baseline.checkedWith,
      measuredSdk: measured.checkedWith,
      samples: measured.entries
        .filter((entry) => {
          const old = before.get(entry.path);
          return (
            !old ||
            JSON.stringify(contract(old)) !== JSON.stringify(contract(entry))
          );
        })
        .map((entry) => ({
          path: entry.path,
          expected: before.get(entry.path)
            ? contract(before.get(entry.path)!)
            : null,
          actual: contract(entry),
        })),
      removed: baseline.entries
        .filter(
          (entry) =>
            !measured.entries.some((current) => current.path === entry.path),
        )
        .map((entry) => entry.path),
    };
  }
  await cp(join(workspace, '.reports'), join(output, 'reports'), {
    recursive: true,
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
} finally {
  await close?.();
  await rm(workspace, { recursive: true, force: true });
  await writeFile(
    join(output, 'result.json'),
    `${JSON.stringify({ sdk: pkg.version, candidate, results, differences, sha, status: results.length === 6 && results.every((step) => step.exitCode === 0) ? 'passed' : 'failed', cleaned: true }, null, 2)}\n`,
  );
  console.log(`离线候选 SDK 报告：${output}`);
}
