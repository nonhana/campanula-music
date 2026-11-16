import { describe, expect, it } from 'vitest';

import inventory from '../baselines/contrast-audit.json' with { type: 'json' };
import type { ContrastReport } from '../tools/browser/contrast-report.ts';
import { summarizeContrast } from '../tools/browser/contrast-report.ts';

const report = () => {
  const reports = new Map<string, ContrastReport>();
  for (const group of inventory.groups)
    for (const key of group.requiredStates) {
      const [project, state] = key.split(':');
      if (!reports.has(key))
        reports.set(key, { project, state, visibility: 'visible', result: [] });
      reports
        .get(key)!
        .result.push({ id: group.id, samples: 1, painted: 1, minimum: 4.5 });
    }
  return [...reports.values()];
};

describe('对比度审计报告', () => {
  it('所有登记组有真实测量才完整通过，保留原观测与历史额外项', () => {
    const result = summarizeContrast(report(), true);
    expect(result.status).toBe('passed');
    expect(result.observations).toBe(329);
    expect(result.historicalOnly).toBe(13);
    expect(result.groups).toHaveLength(27);
    expect(result.missing).toEqual([]);
  });

  it('缺组件、未知组件、低比值、不可测都不能报完整通过', () => {
    const missing = report();
    missing.pop();
    expect(() => summarizeContrast(missing, true)).toThrow('not measured');
    const missingComponent = report();
    for (const state of missingComponent)
      state.result = state.result.filter(
        (result) => result.id !== 'daily-number.icon',
      );
    expect(() => summarizeContrast(missingComponent, true)).toThrow(
      'components not measured',
    );
    for (const mutation of [
      { id: 'unknown-component' },
      { minimum: 4.49 },
      { minimum: null },
      { painted: 0 },
      { samples: 0 },
    ]) {
      const invalid = report();
      Object.assign(invalid[0].result[0], mutation);
      expect(() => summarizeContrast(invalid, true)).toThrow();
    }
  });

  it('部分命令不冒充完整核验，完全裁切不能替代该组件的可见测量', () => {
    expect(summarizeContrast([], false).status).toBe('not-run');
    const clipped = report()[0];
    clipped.visibility = 'clipped';
    clipped.result = [
      { ...clipped.result[0], samples: 0, painted: 0, minimum: null },
    ];
    expect(summarizeContrast([clipped], false).status).toBe('partial');
    expect(() => summarizeContrast([clipped], true)).toThrow('not measured');
    expect(summarizeContrast([...report(), clipped], true).status).toBe(
      'passed',
    );
  });
});
