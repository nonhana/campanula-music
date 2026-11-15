import { globSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { V8CoverageProvider } from '@vitest/coverage-v8/dist/provider.js';
import type {
  CoverageMap,
  CoverageSummaryData,
} from '@vitest/istanbul-lib-coverage';
import { createCoverageMap } from '@vitest/istanbul-lib-coverage';
import astV8ToIstanbul from 'ast-v8-to-istanbul';
import type { ReportContext, Vitest } from 'vitest/node';
import { parseAstAsync } from 'vitest/node';

import { ROOT } from '../suites.ts';
import baseline from '../baselines/coverage.json' with { type: 'json' };
import sourceMap from '../baselines/environment-source-map.json' with { type: 'json' };
import type { SsrScript } from './runtime.ts';

export class SsrCoverageProvider extends V8CoverageProvider {
  initialize(ctx: Vitest) {
    super.initialize(ctx);
    // 基类会把 provider 改回 v8；worker 仍需加载收集独立 SSR 的自定义采集器。
    this.options.provider = 'custom';
  }

  async generateCoverage(context: ReportContext) {
    const coverage = await super.generateCoverage(context);
    const dir = join(this.options.reportsDirectory, 'ssr-raw');
    const files = await readdir(dir);
    const ssr = createCoverageMap({});
    for (const file of files) {
      const scripts = JSON.parse(
        await readFile(join(dir, file), 'utf8'),
      ) as SsrScript[];
      for (const { coverage: script, source } of scripts) {
        const encoded =
          /sourceMappingURL=data:application\/json[^,]*;base64,([^\s]+)/.exec(
            source,
          )?.[1];
        if (!encoded) throw new Error(`SSR 执行缺少源码映射：${script.url}`);
        const sourceMap = JSON.parse(
          Buffer.from(encoded, 'base64').toString('utf8'),
        ) as NonNullable<Parameters<typeof astV8ToIstanbul>[0]['sourceMap']>;
        const scriptURL = script.url.startsWith('file://')
          ? script.url
          : pathToFileURL(script.url).href;
        sourceMap.sources = sourceMap.sources.map((source) => {
          if (source === null)
            throw new Error(`SSR 源码映射没有来源：${script.url}`);
          return new URL(source, scriptURL).href;
        });
        ssr.merge(
          await astV8ToIstanbul({
            code: source,
            sourceMap,
            ast: await parseAstAsync(source),
            coverage: { ...script, url: scriptURL },
            ignoreNode: (node, type) =>
              type === 'statement' &&
              node.type === 'VariableDeclarator' &&
              node.id.type === 'Identifier' &&
              node.id.name.startsWith('__vite_ssr_import_'),
          }),
        );
      }
    }
    coverage.merge(ssr);
    await writeFile(
      join(this.options.reportsDirectory, 'ssr.json'),
      JSON.stringify(ssr),
    );
    return coverage;
  }

  async generateReports(coverage: CoverageMap, allTestsRun?: boolean) {
    const missing = [
      ...globSync(['src/**/*.ts', 'src/**/*.svelte'], { cwd: ROOT }),
      ...Object.values(sourceMap.moved),
    ]
      .filter((file) => !file.endsWith('.d.ts'))
      .filter((file) => !coverage.files().includes(join(ROOT, file)));
    if (missing.length)
      throw new Error(
        `覆盖率遗漏源码或迁移文件（含未运行文件）：${missing.join(', ')}`,
      );
    await super.generateReports(coverage, allTestsRun);
    const partitions = {
      src: (file: string) => file.startsWith('src/'),
      sourceBeforeMove: (file: string) =>
        file.startsWith('src/') ||
        Object.values(sourceMap.moved).includes(file),
      product: (file: string) =>
        file.startsWith('src/') && !file.startsWith('src/lib/dev/'),
      app: (file: string) => file.startsWith('src/lib/app/'),
      server: (file: string) =>
        file.startsWith('src/lib/server/') ||
        file.startsWith('src/routes/api/'),
      routes: (file: string) => file.startsWith('src/routes/api/'),
      ui: (file: string) => file.endsWith('.svelte'),
      infrastructure: (file: string) =>
        file.startsWith('tests/') || file.startsWith('src/lib/dev/'),
    };
    const summary: Record<string, CoverageSummaryData & { files: number }> = {};
    for (const [name, includes] of Object.entries(partitions)) {
      const map = createCoverageMap({});
      for (const file of coverage.files()) {
        if (includes(relative(ROOT, file)))
          map.addFileCoverage(coverage.fileCoverageFor(file));
      }
      summary[name] = {
        files: map.files().length,
        ...map.getCoverageSummary().toJSON(),
      };
    }
    const evidence = {
      scope:
        process.env.CAMPANULA_TEST_FULL === '1'
          ? 'full'
          : 'selected files / cases',
      include: this.options.include,
      exclude: this.options.exclude,
      ssr: '独立 Vite module runner 的 V8 执行数据，按当次源码映射合并；原始数据见 ssr-raw，独立映射见 ssr.json',
      ui: '未采集：本套件没有启动浏览器，Svelte 的零值不代表界面已验证',
      infrastructure:
        '测试工具、替身已归 tests，src/lib/dev 不计入 product；src 的 mock 目录迁移单列，不当作新增行为覆盖，contract 录制自检不代表听众旅程',
      sourceBeforeMove:
        '保留 src 原阈值，按 environment-source-map.json 纳入原来在 src 的 mock 文件；当前 src 另列，不把迁移当作覆盖提升。',
      runtime: {
        node: process.version,
        v8: process.versions.v8,
        vitest: this.ctx.version,
      },
    };
    const rows = Object.entries(summary).map(
      ([name, item]) =>
        `| ${name} | ${item.files} | ${item.lines.pct}% (${item.lines.covered}/${item.lines.total}) | ${item.branches.pct}% (${item.branches.covered}/${item.branches.total}) |`,
    );
    const table = [
      '| 分区 | 文件 | 行 | 分支 |',
      '| --- | ---: | ---: | ---: |',
      ...rows,
    ].join('\n');
    await writeFile(
      join(this.options.reportsDirectory, 'partitions.json'),
      `${JSON.stringify({ ...summary, evidence }, null, 2)}\n`,
    );
    await writeFile(
      join(this.options.reportsDirectory, 'summary.md'),
      `${table}\n\n${evidence.ui}\n`,
    );
    this.ctx.logger.log(table);
    if (process.env.CAMPANULA_TEST_FULL === '1') {
      for (const [name, thresholds] of Object.entries(baseline.thresholds)) {
        const current = summary[name === 'src' ? 'sourceBeforeMove' : name];
        if (!current?.files || !current.lines.total || !current.branches.total)
          throw new Error(`分区覆盖率缺少数据：${name}`);
        for (const metric of ['lines', 'branches'] as const) {
          const percent = current[metric].pct;
          if (typeof percent !== 'number')
            throw new Error(`分区覆盖率缺少指标：${name} ${metric}`);
          if (percent < thresholds[metric])
            throw new Error(
              `${name} ${metric} ${current[metric].pct}% 低于校准基线阈值 ${thresholds[metric]}%`,
            );
        }
      }
    }
    if (process.env.CAMPANULA_COVERAGE_CALIBRATE === '1') {
      const account = coverage.fileCoverageFor(
        join(ROOT, 'src/routes/api/account/+server.ts'),
      );
      const unused = coverage.fileCoverageFor(
        join(ROOT, 'src/routes/api/playlists/[id=neteaseId]/name/+server.ts'),
      );
      const source = await readFile(account.path, 'utf8');
      const handlerLine =
        source
          .split('\n')
          .findIndex((line) => /^export const GET\b/.test(line)) + 1;
      const executed = Object.entries(account.fnMap).some(
        ([id, fn]) => fn.line === handlerLine && account.f[id] > 0,
      );
      const untouched = Object.values(unused.f).every((count) => count === 0);
      if (!executed || !untouched)
        throw new Error(
          `SSR 校准失败：账号 GET=${executed}，未请求路由为零=${untouched}`,
        );
      await writeFile(
        join(this.options.reportsDirectory, 'calibration.json'),
        JSON.stringify({
          accountGetExecuted: executed,
          unusedRouteUntouched: untouched,
        }),
      );
    }
    this.ctx.logger.log(
      `分区覆盖率：${join(this.options.reportsDirectory, 'partitions.json')}；Svelte UI 尚未运行浏览器采集`,
    );
  }
}
