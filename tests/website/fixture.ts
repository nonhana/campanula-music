import { writeFile } from 'node:fs/promises';

import AxeBuilder from '@axe-core/playwright';
import { test as base, expect } from '@playwright/test';

import { controlNetwork } from '../_kit/browser-network.ts';
import manual from './a11y-manual.json' with { type: 'json' };

export const test = base.extend<{ scan: (scenario: string) => Promise<void> }>({
  context: async ({ context, baseURL }, use, info) => {
    const external = await controlNetwork(context, new Set([baseURL!]));
    const errors: string[] = [];
    context.on('page', (page) =>
      page.on('pageerror', (error) => errors.push(error.message)),
    );
    context.on('serviceworker', (worker) =>
      errors.push(`意外注册 Service Worker：${worker.url()}`),
    );
    await context.routeWebSocket('**/*', (socket) => {
      const url = new URL(socket.url());
      if (
        baseURL === 'http://127.0.0.1:4388' &&
        url.origin === 'ws://127.0.0.1:4388' &&
        url.pathname === '/website-hmr' &&
        url.searchParams.has('token')
      ) {
        socket.connectToServer();
        return;
      }
      external.push(socket.url());
      socket.close();
    });
    try {
      await use(context);
    } finally {
      await context.close();
      await info.attach('isolation', {
        body: JSON.stringify({ external, errors }),
        contentType: 'application/json',
      });
      expect(external, '执行阶段禁止任何第三方业务请求').toEqual([]);
      expect(errors, '页面不能有未处理异常').toEqual([]);
    }
  },
  scan: async ({ page }, use, info) =>
    use(async (scenario) => {
      await page.mouse.move(0, 0);
      await Promise.all(
        page.frames().map((frame) =>
          frame.evaluate(async () => {
            await document.fonts.ready;
            for (let pass = 0; pass < 5; pass += 1) {
              const finite = document
                .getAnimations()
                .filter(
                  (animation) =>
                    animation.effect?.getComputedTiming().iterations !==
                    Infinity,
                );
              if (!finite.length) break;
              await Promise.allSettled(
                finite.map((animation) => animation.finished),
              );
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
            }
          }),
        ),
      );
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
      const path = info.outputPath(`axe-${scenario}.json`);
      await writeFile(
        path,
        JSON.stringify(
          { scenario, project: info.project.name, ...results },
          null,
          2,
        ),
      );
      await info.attach(`axe-${scenario}`, {
        path,
        contentType: 'application/json',
      });
      expect(
        results.violations.map(({ id, nodes }) => ({
          id,
          targets: nodes.map((node) => node.target),
        })),
      ).toEqual([]);
      const known = manual.nodes;
      expect
        .soft(
          results.incomplete.flatMap((rule) =>
            rule.nodes
              .filter(
                (node) =>
                  !known.some(
                    (item) =>
                      item.project === info.project.name &&
                      item.scenario === scenario &&
                      item.rule === rule.id &&
                      item.reason === node.failureSummary &&
                      JSON.stringify(item.target) ===
                        JSON.stringify(node.target),
                  ),
              )
              .map((node) => ({ rule: rule.id, target: node.target })),
          ),
          '新增 incomplete 必须逐节点调查，人工边界不算通过对比度验收',
        )
        .toEqual([]);
    }),
});
export { expect };
