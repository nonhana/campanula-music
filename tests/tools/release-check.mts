import { globSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';

import { execa } from 'execa';

import { inspectCandidate } from '../delivery/candidate.ts';
import type { ReleaseJob, ReleaseRun } from '../delivery/release.ts';
import { acceptRelease, latestCandidateRun } from '../delivery/release.ts';
import { ROOT } from '../suites.ts';

const { values } = parseArgs({
  options: {
    sha: { type: 'string' },
    wait: { type: 'boolean', default: false },
    'prepare-image': { type: 'boolean', default: false },
  },
});
const sha = values.sha;
if (!sha || !/^[a-f\d]{40}$/.test(sha)) throw new Error('需要完整 --sha');
await mkdir(join(ROOT, '.reports/releases'), { recursive: true });
const report = await mkdtemp(join(ROOT, '.reports/releases/run-'));
const workspace = join(report, 'candidate');
const repo = 'nonhana/campanula-music';
const api = async (path: string) =>
  JSON.parse((await execa('gh', ['api', path])).stdout);
let evidence: unknown;
try {
  const deadline = Date.now() + (values.wait ? 80 * 60_000 : 0);
  let run: ReleaseRun & { id: number; html_url: string };
  while (true) {
    const response = await api(
      `repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=100`,
    );
    const runs = response.workflow_runs as (typeof run)[];
    const newest = latestCandidateRun(sha, runs);
    if (newest?.status === 'completed') {
      run = newest;
      break;
    }
    if (Date.now() >= deadline)
      throw new Error('同 SHA 的最新 CI 缺失或未完成');
    await delay(10_000);
  }
  const { stdout } = await execa('gh', [
    'api',
    '--paginate',
    '--slurp',
    `repos/${repo}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
  ]);
  const jobs = (JSON.parse(stdout) as { jobs: ReleaseJob[] }[]).flatMap(
    (page) => page.jobs,
  );
  const accepted = acceptRelease(sha, run, jobs);
  const artifact = join(report, 'artifact');
  await execa('gh', [
    'run',
    'download',
    String(run.id),
    '--repo',
    repo,
    '--name',
    `candidates-${sha}`,
    '--dir',
    artifact,
  ]);
  const archives = globSync('**/*.tar.gz', { cwd: artifact });
  if (archives.length !== 1) throw new Error('候选产物包缺失或重复');
  const archive = join(artifact, archives[0]);
  const entries = (await execa('tar', ['-tzf', archive])).stdout.split('\n');
  if (
    entries.some(
      (path) => path.startsWith('/') || path.split('/').includes('..'),
    )
  )
    throw new Error('候选归档路径越界');
  await mkdir(workspace);
  await execa('tar', ['-xzf', archive, '-C', workspace]);
  const verification = JSON.parse(
    await readFile(join(workspace, 'verification.json'), 'utf8'),
  );
  if (
    verification.sha !== sha ||
    verification.status !== 'passed' ||
    verification.results.length !== 7 ||
    verification.results.some(
      (step: { exitCode: number }) => step.exitCode !== 0,
    ) ||
    verification.pwa.sha !== sha ||
    verification.pwa.status !== 'passed' ||
    verification.pwa.stats.expected !== 8 ||
    verification.pwa.stats.skipped ||
    verification.pwa.stats.flaky ||
    verification.pwa.stats.unexpected
  )
    throw new Error('交付或生产 PWA 证据缺失/失败/不属于候选');
  const candidates = [];
  for (const [name, adapter] of [
    ['node', 'node'],
    ['vercel', 'vercel'],
    ['next', 'node'],
  ] as const) {
    const candidate = await inspectCandidate({
      candidate: join(workspace, name),
      sha,
      adapter,
    });
    if ((candidate.source as { dirty?: boolean })?.dirty !== false)
      throw new Error('发布不接受未提交的源码候选');
    candidates.push(candidate);
  }
  if (values['prepare-image']) {
    const image = join(ROOT, '.reports/release-image');
    await mkdir(image);
    await cp(join(workspace, 'node/output'), join(image, 'build'), {
      recursive: true,
    });
    await writeFile(join(image, 'package.json'), '{"type":"module"}');
    await writeFile(
      join(image, 'candidate.json'),
      JSON.stringify(candidates[0]),
    );
  }
  evidence = { ...accepted, run: run.html_url, candidates, verification };
  console.log(`只读发布判定通过：${sha}（未发布镜像/标签/域名）`);
} finally {
  await rm(workspace, { recursive: true, force: true });
  await writeFile(
    join(report, 'result.json'),
    JSON.stringify(
      { sha, status: evidence ? 'passed' : 'failed', evidence, cleaned: true },
      null,
      2,
    ),
  );
  console.log(`发布 dry-run 报告：${report}`);
}
