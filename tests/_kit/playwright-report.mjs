import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const inputPath = process.env.CAMPANULA_PLAYWRIGHT_REPORT;
const report = process.env.CAMPANULA_BROWSER_REPORT;
const output = process.env.CAMPANULA_BROWSER_OUTPUT;
if (!inputPath || !report || !output)
  throw new Error('Playwright 报告替身缺少输入或输出路径');
/** @type {{cases: {file: string, name: string, project: string, status?: string}[], contrast: import('../tools/browser/contrast-report.ts').ContrastReport[]}} */
const input = JSON.parse(readFileSync(inputPath, 'utf8'));
mkdirSync(output, { recursive: true });
// Playwright's JSON reporter exposes each selected case under suites/specs/tests and aggregates its status in stats.
writeFileSync(
  join(report, 'tests.json'),
  JSON.stringify({
    suites: input.cases.map(({ file, name, project, status = 'expected' }) => ({
      file,
      specs: [
        {
          id: `${file}:${name}`,
          file,
          title: name,
          tests: [{ projectName: project, status }],
        },
      ],
    })),
    stats: {
      expected: input.cases.filter(
        (item) => !item.status || item.status === 'expected',
      ).length,
      skipped: input.cases.filter((item) => item.status === 'skipped').length,
      unexpected: 0,
      flaky: 0,
    },
  }),
);
writeFileSync(
  join(report, 'playwright-args.json'),
  JSON.stringify(process.argv.slice(2)),
);
for (const [index, contrast] of input.contrast.entries())
  writeFileSync(
    join(output, `contrast-${index}.json`),
    JSON.stringify(contrast),
  );
