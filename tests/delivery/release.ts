import { REQUIRED_JOBS } from '../suites.ts';

export interface ReleaseRun {
  head_sha: string;
  status: string;
  conclusion: string | null;
  run_attempt: number;
}
export interface ReleaseJob {
  name: string;
  status: string;
  conclusion: string | null;
  steps: { name: string; status: string; conclusion: string | null }[];
}

export const requireSuccessfulJobs = (
  required: string[],
  jobs: ReleaseJob[],
) => {
  for (const name of required) {
    const matches = jobs.filter((job) => job.name === name);
    if (matches.length !== 1) throw new Error(`必要检查 ${name} 缺失或重复`);
    const job = matches[0];
    if (
      job.status !== 'completed' ||
      job.conclusion !== 'success' ||
      !job.steps.length
    )
      throw new Error(`必要检查 ${name} 未完整成功`);
    for (const step of job.steps)
      if (step.status !== 'completed' || step.conclusion !== 'success')
        throw new Error(`${name} / ${step.name} 未成功：${step.conclusion}`);
  }
};

export const acceptRelease = (
  sha: string,
  run: ReleaseRun,
  jobs: ReleaseJob[],
  legacy = false,
) => {
  if (!/^[a-f\d]{40}$/.test(sha) || run.head_sha !== sha)
    throw new Error('发布候选 SHA 不符');
  if (run.status !== 'completed' || run.conclusion !== 'success')
    throw new Error(`候选 CI 未成功：${run.status}/${run.conclusion}`);
  const required = REQUIRED_JOBS.map((name) =>
    legacy && name === 'acceptance' ? 'ci' : name,
  );
  requireSuccessfulJobs(required, jobs);
  return { sha, jobs: required, attempt: run.run_attempt };
};

export const latestCandidateRun = <T extends ReleaseRun & { id: number }>(
  sha: string,
  runs: T[],
) =>
  runs.filter((run) => run.head_sha === sha).toSorted((a, b) => b.id - a.id)[0];
