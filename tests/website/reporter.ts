import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
} from '@playwright/test/reporter';

import { sourceSha } from '../suites.ts';
import { artifact } from './artifact.ts';

export default class WebsiteReporter implements Reporter {
  private suite!: Suite;
  private candidate = artifact();
  constructor(private options: { report: string }) {}
  onBegin(_config: FullConfig, suite: Suite) {
    this.suite = suite;
  }
  async onEnd(result: FullResult) {
    const cases = this.suite.allTests().map((test) => ({
      title: test.titlePath(),
      status: test.outcome(),
      attempts: test.results.length,
    }));
    const passed =
      result.status === 'passed' &&
      cases.length > 0 &&
      cases.every(
        (test) => test.status === 'expected' && test.attempts === 1,
      ) &&
      artifact().digest === this.candidate.digest;
    writeFileSync(
      join(this.options.report, 'run.json'),
      JSON.stringify(
        {
          sha: sourceSha(),
          status: passed ? 'passed' : 'failed',
          cases,
          artifact: this.candidate,
        },
        null,
        2,
      ),
    );
    process.stdout.write(`官网候选报告：${this.options.report}\n`);
    return { status: passed ? ('passed' as const) : ('failed' as const) };
  }
}
