import { expect, it, vi } from 'vitest';

import { dailyPlan, requireInventory } from '../ci/plan.ts';
import * as suites from '../suites.ts';

it('普通业务更改完整分摊规则、行为和契约，每份文件只执行一次', () => {
  const plan = dailyPlan(['src/lib/app/search.ts']);
  const shards = plan.filter((lane) => lane.name.startsWith('product-'));
  expect(shards).toHaveLength(5);
  const files = shards.flatMap((lane) => lane.files);
  expect(new Set(files).size).toBe(files.length);
  expect(files).toContain('tests/behavior/library.test.ts');
  expect(files).toContain('tests/contract/sdk-contract.test.ts');
  expect(plan.map((lane) => lane.name)).not.toContain('sdk');
});

it('完整清单拒绝漏掉、重复和多跑的项', () => {
  for (const ids of [['a'], ['a', 'a'], ['a', 'b', 'c']])
    expect(() => requireInventory(['a', 'b'], ids)).toThrow();
  expect(() => requireInventory(['a', 'b'], ['b', 'a'])).not.toThrow();
});

it('新增的浏览器旅程在归入领域前随界面改动执行', () => {
  const current = suites.discoverTests();
  const file = 'tests/browser/journeys/new-journey.spec.ts';
  using inventory = vi.spyOn(suites, 'discoverTests');
  inventory.mockReturnValue({
    ...current,
    browser: [...current.browser, file],
  });
  for (const lane of dailyPlan([
    'src/lib/components/player/Lyrics.svelte',
  ]).filter((lane) => lane.name.startsWith('browser-')))
    expect(lane.files).toContain(file);
});

it('按变更加上离线交接、SDK、开发环境及对比度；无法确定范围时全部验证', () => {
  const names = (paths: string[] | null) =>
    dailyPlan(paths).map((lane) => lane.name);
  expect(names(['src/service-worker/index.ts'])).toContain('delivery');
  expect(names(['vercel.json'])).toContain('delivery');
  expect(names(['scripts/vercel-ignore.sh'])).toContain('delivery');
  expect(names(['src/lib/app/browser.ts'])).toEqual(
    expect.arrayContaining(['sdk', 'delivery']),
  );
  expect(names(['src/lib/app/app.ts'])).toContain('delivery');
  expect(names(['src/lib/server/netease/search.ts'])).toContain('sdk');
  expect(names(['scripts/dev/environment.mts'])).toContain('environment');
  expect(names(['src/lib/components/player/Lyrics.svelte'])).toContain(
    'contrast-phone',
  );
  expect(names(['README.md'])).not.toContain('diagnostics');
  expect(names(null)).toEqual(
    expect.arrayContaining([
      'environment',
      'sdk',
      'delivery',
      'diagnostics',
      'coverage',
      'contrast-desktop',
    ]),
  );
});

it('修改交付自检时，计划实际包含该文件；修改隔离执行器时覆盖所有专项', () => {
  for (const file of [
    'tests/delivery/release.test.ts',
    'tests/delivery/mock-server.test.ts',
  ]) {
    expect(dailyPlan([file]).flatMap((lane) => lane.files)).toContain(file);
  }
  expect(dailyPlan(['tests/tools/offline.sh'])).toEqual(dailyPlan(null));
});

it('官网及其真实依赖改动触发独立网站分片，保留播放器候选门禁', () => {
  for (const file of [
    'website/content-links.mts',
    'tests/website/reading.spec.ts',
    'tests/_kit/browser-network.ts',
    'netlify.toml',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.node-version',
    'vite.config.mts',
    'svelte.config.mts',
    'tsconfig.json',
    'eslint.config.mts',
    'oxfmt.config.mts',
    'uno.config.mts',
    'src/lib/components/boot/Brand.svelte',
    'src/lib/components/shared/motion.ts',
    'src/lib/components/player/Lyrics.svelte',
    'src/lib/app/player.ts',
    'src/lib/api/library.ts',
    'src/routes/+layout.svelte',
    'src/params.ts',
    'static/favicon.svg',
  ]) {
    expect(
      dailyPlan([file]).map((lane) => lane.name),
      file,
    ).toContain('website');
  }
  expect(dailyPlan(null).map((lane) => lane.name)).toEqual(
    expect.arrayContaining(['website', 'static', 'delivery']),
  );
  expect(dailyPlan(['README.md']).map((lane) => lane.name)).not.toContain(
    'website',
  );
});

it('官网 spec 仅归独立套件，不混进 Vitest 或原播放器 browser 项目', () => {
  const selected = suites.selectTests([
    ...Object.values(suites.discoverTests()).flat(),
    'tests/website/new.spec.ts',
  ]);
  expect(selected.website).toContain('tests/website/new.spec.ts');
  for (const [name, files] of Object.entries(selected))
    if (name !== 'website')
      expect(files).not.toContain('tests/website/new.spec.ts');
  expect(
    dailyPlan(null).find((lane) => lane.name === 'website')?.chromium,
  ).toBe(true);
});
