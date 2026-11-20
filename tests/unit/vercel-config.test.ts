import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { execa } from 'execa';
import { expect, it } from 'vitest';

import { ROOT } from '../suites.ts';

interface VercelConfig {
  framework?: string;
  installCommand?: string;
  buildCommand?: string;
  outputDirectory?: string;
  regions?: string[];
  fluid?: boolean;
  ignoreCommand?: string;
  headers?: {
    source: string;
    headers: { key: string; value: string }[];
  }[];
}

const scriptPath = join(ROOT, 'scripts/vercel-ignore.sh');

const runGit = (cwd: string, args: string[]) =>
  execa('git', args, {
    cwd,
    env: {
      ...globalThis.process.env,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });

const commitFile = async (cwd: string, file: string, content: string) => {
  const full = join(cwd, file);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content);
  await runGit(cwd, ['add', file]);
  await runGit(cwd, ['commit', '-m', `update ${file}`]);
  return (await runGit(cwd, ['rev-parse', 'HEAD'])).stdout.trim();
};

const runIgnore = (cwd: string, env: Record<string, string>) =>
  execa('sh', [scriptPath], {
    cwd,
    env: { PATH: globalThis.process.env.PATH ?? '', ...env },
    reject: false,
  });

it('vercel.json 锁定 SvelteKit 构建、香港区域、Fluid Compute 与安全/缓存响应头', async () => {
  const config = JSON.parse(
    await readFile(join(ROOT, 'vercel.json'), 'utf8'),
  ) as VercelConfig;

  expect(config.framework).toBe('sveltekit-1');
  expect(config.installCommand).toBe('pnpm install --frozen-lockfile');
  expect(config.buildCommand).toBe('pnpm build');
  expect(config.outputDirectory).toBeUndefined();
  expect(config.regions).toEqual(['hkg1']);
  expect(config.fluid).toBe(true);
  expect(config.ignoreCommand).toBe('sh scripts/vercel-ignore.sh');
  expect(config.ignoreCommand!.length).toBeLessThanOrEqual(256);

  const bySource = new Map(
    (config.headers ?? []).map((rule) => [
      rule.source,
      Object.fromEntries(rule.headers.map(({ key, value }) => [key, value])),
    ]),
  );

  expect(bySource.get('/(.*)')).toMatchObject({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
  });
  expect(bySource.get('/service-worker.js')?.['Cache-Control']).toBe(
    'public, max-age=0, must-revalidate',
  );
  expect(bySource.get('/manifest.webmanifest')?.['Cache-Control']).toBe(
    'public, max-age=0, must-revalidate',
  );
  expect(bySource.get('/api/(.*)')?.['Cache-Control']).toBe('no-store');
});

it('vercel-ignore.sh 跳过纯文档/官网/测试提交，并在首次部署、Redeploy、浅克隆或播放器改动时继续构建', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'campanula-vercel-ignore-'));
  try {
    await runGit(repo, ['init']);
    const initial = await commitFile(repo, 'src/app.html', '<html></html>');

    expect((await runIgnore(repo, {})).exitCode).toBe(1);
    expect(
      (
        await runIgnore(repo, {
          VERCEL_GIT_PREVIOUS_SHA: initial,
          VERCEL_GIT_COMMIT_SHA: initial,
        })
      ).exitCode,
    ).toBe(1);
    expect(
      (await runIgnore(repo, { VERCEL_GIT_PREVIOUS_SHA: initial })).exitCode,
    ).toBe(1);
    expect(
      (
        await runIgnore(repo, {
          VERCEL_GIT_PREVIOUS_SHA: '0'.repeat(40),
        })
      ).exitCode,
    ).toBe(1);

    const docsOnly = await commitFile(
      repo,
      'website/src/content/docs/guide/vercel.mdx',
      'docs',
    );
    expect(
      (await runIgnore(repo, { VERCEL_GIT_PREVIOUS_SHA: initial })).exitCode,
    ).toBe(0);

    const testsAndCi = await commitFile(repo, 'tests/unit/demo.test.ts', '');
    await commitFile(repo, 'docs/adr/0001.md', '');
    await commitFile(repo, 'netlify.toml', '');
    expect(
      (await runIgnore(repo, { VERCEL_GIT_PREVIOUS_SHA: docsOnly })).exitCode,
    ).toBe(0);

    const playerChange = await commitFile(repo, 'src/hooks.server.ts', '//');
    expect(
      (await runIgnore(repo, { VERCEL_GIT_PREVIOUS_SHA: testsAndCi })).exitCode,
    ).toBe(1);

    const vercelChange = await commitFile(repo, 'vercel.json', '{}');
    expect(
      (await runIgnore(repo, { VERCEL_GIT_PREVIOUS_SHA: playerChange }))
        .exitCode,
    ).toBe(1);

    await commitFile(repo, 'new-root-config.mjs', 'export default {}');
    expect(
      (await runIgnore(repo, { VERCEL_GIT_PREVIOUS_SHA: vercelChange }))
        .exitCode,
    ).toBe(1);
  } finally {
    await chmod(repo, 0o700).catch(() => {});
    await rm(repo, { recursive: true, force: true });
  }
});
