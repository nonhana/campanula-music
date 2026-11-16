import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import process from 'node:process';

import { dailyPlan } from '../ci/plan.ts';
import { sourceSha } from '../suites.ts';

const sha = sourceSha();
const event = process.env.GITHUB_EVENT_PATH
  ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  : undefined;
const git = (...args: string[]) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
let base: string | undefined = process.argv[2];
if (event?.pull_request) base = event.pull_request.base.sha;
else if (event && process.env.GITHUB_EVENT_NAME === 'push') {
  // A failed or cancelled push may contain a change that still needs its specialist check.
  const branch = process.env.GITHUB_REF_NAME!;
  try {
    const runs = JSON.parse(
      execFileSync(
        'gh',
        [
          'api',
          '--method',
          'GET',
          `repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/ci.yml/runs`,
          '-f',
          `branch=${branch}`,
          '-f',
          'event=push',
          '-f',
          'status=success',
          '-F',
          'per_page=50',
        ],
        { encoding: 'utf8' },
      ),
    ).workflow_runs as {
      id: number;
      head_sha: string;
      head_repository: { full_name: string };
    }[];
    for (const run of runs) {
      if (
        run.id >= Number(process.env.GITHUB_RUN_ID) ||
        run.head_repository.full_name !== process.env.GITHUB_REPOSITORY
      )
        continue;
      try {
        git('merge-base', '--is-ancestor', run.head_sha, sha);
        base = run.head_sha;
        break;
      } catch {
        /* The branch may have been force-pushed. */
      }
    }
  } catch {
    console.log('无法查询同分支成功记录，执行全部专项');
  }
}
let changes: string[] | null = null;
if (base && /^[a-f\d]{40}$/.test(base)) {
  try {
    changes = git('diff', '--no-renames', '--name-only', '-z', base, sha)
      .split('\0')
      .filter(Boolean);
  } catch {
    console.log('无法读取基准提交，执行全部专项');
  }
}
const plan = dailyPlan(changes);
console.log(JSON.stringify({ sha, base, changes, plan }, null, 2));
if (process.env.GITHUB_OUTPUT)
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `matrix=${JSON.stringify({ include: plan })}\n`,
  );
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `比较基准 \`${base ?? '无可用成功提交'}\`，候选 \`${sha}\`。\n\n${plan.map((l) => `- ${l.name}${l.files.length ? ` · ${l.files.length} 个文件` : ''}`).join('\n')}\n`,
  );
