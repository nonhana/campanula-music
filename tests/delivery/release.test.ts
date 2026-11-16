import { expect, it } from 'vitest';

import { acceptRelease } from './release.ts';

const sha = 'a'.repeat(40);
const run = {
  head_sha: sha,
  status: 'completed',
  conclusion: 'success',
  run_attempt: 2,
};
const jobs = ['verify', 'https', 'delivery', 'sdk', 'ci'].map((name) => ({
  name,
  status: 'completed',
  conclusion: 'success',
  steps: [{ name: '实际执行', status: 'completed', conclusion: 'success' }],
}));

it('发布只接受候选 SHA 的全部必要 job 和步骤', () => {
  expect(acceptRelease(sha, run, jobs)).toEqual({
    sha,
    jobs: ['verify', 'https', 'delivery', 'sdk', 'ci'],
    attempt: 2,
  });
  expect(() => acceptRelease('b'.repeat(40), run, jobs)).toThrow(/SHA/);
  for (const conclusion of ['failure', 'cancelled', 'skipped', null]) {
    expect(() => acceptRelease(sha, { ...run, conclusion }, jobs)).toThrow();
    expect(() =>
      acceptRelease(
        sha,
        run,
        jobs.map((job, index) => (index ? job : { ...job, conclusion })),
      ),
    ).toThrow();
    expect(() =>
      acceptRelease(
        sha,
        run,
        jobs.map((job, index) =>
          index
            ? job
            : {
                ...job,
                steps: [{ name: '实际执行', status: 'completed', conclusion }],
              },
        ),
      ),
    ).toThrow();
  }
  expect(() =>
    acceptRelease(sha, { ...run, status: 'in_progress' }, jobs),
  ).toThrow();
  expect(() => acceptRelease(sha, run, jobs.slice(1))).toThrow(/verify/);
  expect(() => acceptRelease(sha, run, [])).toThrow();
  expect(() => acceptRelease(sha, run, [...jobs, jobs[0]])).toThrow(/verify/);
  expect(() =>
    acceptRelease(
      sha,
      run,
      jobs.map((job) => ({ ...job, steps: [] })),
    ),
  ).toThrow();
});

it('后一次失败、取消或运行中的 CI 不能借同 SHA 的旧绿灯放行', async () => {
  const { latestCandidateRun } = await import('./release.ts');
  const old = { ...run, id: 1 };
  for (const newer of [
    { ...run, id: 2, conclusion: 'failure' },
    { ...run, id: 2, conclusion: 'cancelled' },
    { ...run, id: 2, status: 'in_progress', conclusion: null },
  ]) {
    const selected = latestCandidateRun(sha, [
      old,
      newer,
      { ...run, id: 3, head_sha: 'b'.repeat(40) },
    ]);
    expect(selected).toEqual(newer);
    expect(() => acceptRelease(sha, selected!, jobs)).toThrow();
  }
});
