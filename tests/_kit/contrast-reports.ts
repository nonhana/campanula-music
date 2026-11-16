import inventory from '../baselines/contrast-audit.json' with { type: 'json' };
import type { ContrastReport } from '../tools/browser/contrast-report.ts';

export const contrastReports = () => {
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
