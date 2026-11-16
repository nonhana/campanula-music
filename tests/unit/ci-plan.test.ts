import { expect, it } from 'vitest';

import { dailyPlan, requireInventory } from '../ci/plan.ts';

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

it('按变更加上离线交接、SDK、开发环境及对比度；无法确定范围时全部验证', () => {
  const names = (paths: string[] | null) =>
    dailyPlan(paths).map((lane) => lane.name);
  expect(names(['src/service-worker/index.ts'])).toContain('delivery');
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
