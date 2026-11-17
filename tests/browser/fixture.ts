import { access, writeFile } from 'node:fs/promises';
import process from 'node:process';

import AxeBuilder from '@axe-core/playwright';
import { test as base, expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

import { controlNetwork } from '../_kit/browser-network.ts';
import { startEnvironment } from '../_kit/environment.ts';
import manual from '../baselines/a11y-manual.json' with { type: 'json' };

export const test = base.extend<{
  environment: Awaited<ReturnType<typeof startEnvironment>>;
  scan: (scenario: string) => Promise<void>;
  localOrigins: Set<string>;
  failureEvidence: void;
}>({
  // eslint-disable-next-line no-empty-pattern -- Playwright 的无依赖 fixture 必须使用解构参数
  environment: async ({}, use, info) => {
    const environment = await startEnvironment({
      mode: 'mock',
      source: process.env.CAMPANULA_BROWSER_SOURCE,
    });
    try {
      await use(environment);
    } finally {
      await environment.close();
      const rootGone = await access(environment.root).then(
        () => false,
        () => true,
      );
      let processGone = false;
      try {
        process.kill(environment.pid, 0);
      } catch (error) {
        expect((error as NodeJS.ErrnoException).code).toBe('ESRCH');
        processGone = true;
      }
      const portGone = await fetch(environment.baseURL).then(
        () => false,
        () => true,
      );
      await info.attach('environment', {
        body: JSON.stringify({
          root: environment.root,
          pid: environment.pid,
          baseURL: environment.baseURL,
          rootGone,
          processGone,
          portGone,
          logs: environment.logs,
        }),
        contentType: 'application/json',
      });
      expect({ rootGone, processGone, portGone }).toEqual({
        rootGone: true,
        processGone: true,
        portGone: true,
      });
    }
  },
  baseURL: async ({ environment }, use) => use(environment.baseURL),
  localOrigins: async ({ baseURL }, use) => use(new Set([baseURL!])),
  context: async ({ context, localOrigins }, use, info) => {
    const external = await controlNetwork(context, localOrigins);
    try {
      await use(context);
    } finally {
      await context.close();
    }
    await info.attach('network', {
      body: JSON.stringify({ external }),
      contentType: 'application/json',
    });
    expect(external, '执行阶段只能访问本实例的本机数据与媒体').toEqual([]);
  },
  scan: async ({ page }, use, info) =>
    use(async (scenario) => {
      const results = await scanPage(page, info, scenario);
      expect(
        results.violations.map(({ id, nodes }) => ({
          id,
          targets: nodes.map((node) => node.target),
        })),
      ).toEqual([]);
      const added = results.incomplete.flatMap((rule) =>
        rule.nodes
          .filter(
            (node) =>
              !manual.nodes.some(
                (known) =>
                  known.project === info.project.name &&
                  known.scenario === scenario &&
                  known.rule === rule.id &&
                  JSON.stringify(known.target) === JSON.stringify(node.target),
              ),
          )
          .map((node) => ({ rule: rule.id, target: node.target })),
      );
      expect(
        added,
        '新增 incomplete 必须逐节点判断；不能自动放宽人工清单',
      ).toEqual([]);
    }),
  failureEvidence: [
    async ({ page }, use, info) => {
      const online = await page.evaluate(() => navigator.onLine);
      await info.attach('browser-network', {
        body: JSON.stringify({ online }),
        contentType: 'application/json',
      });
      expect(online, '浏览器须连接本机链路；无外网出口不等于设备离线').toBe(
        true,
      );
      await use();
      if (info.status !== info.expectedStatus && !page.isClosed())
        await scanPage(page, info, 'failure');
    },
    { auto: true },
  ],
});
export { expect };
export const login = async (page: Page, next = '/') => {
  await page.goto(`/mock/login?next=${encodeURIComponent(next)}`);
  await expect(page.getByLabel('Mock 测试数据')).toBeVisible();
  await expect(page.locator('main')).toBeAttached();
};

export { controlNetwork } from '../_kit/browser-network.ts';

const scanPage = async (page: Page, info: TestInfo, scenario: string) => {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(250);
  const results = await new AxeBuilder({ page })
    .withTags([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
      'wcag22a',
      'wcag22aa',
      'best-practice',
    ])
    .analyze();
  const output = info.outputPath(`axe-${scenario}.json`);
  await writeFile(
    output,
    JSON.stringify(
      {
        scenario,
        project: info.project.name,
        test: info.title,
        attempt: info.retry,
        viewport: page.viewportSize(),
        ...results,
      },
      null,
      2,
    ),
  );
  await info.attach(`axe-${scenario}`, {
    path: output,
    contentType: 'application/json',
  });
  await page.screenshot({
    path: info.outputPath(`${scenario}.png`),
    fullPage: true,
  });
  return results;
};
