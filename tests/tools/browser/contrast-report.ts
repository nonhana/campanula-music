import { globSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import manual from '../../baselines/a11y-manual.json' with { type: 'json' };
import inventory from '../../baselines/contrast-audit.json' with { type: 'json' };

export interface ContrastReport {
  state: string;
  project: string;
  visibility: 'visible' | 'clipped';
  result: {
    id: string;
    samples: number;
    painted: number;
    minimum: number | null;
  }[];
}

export const readContrastReports = (dir: string): Promise<ContrastReport[]> =>
  Promise.all(
    globSync('results/**/contrast-*.json', { cwd: dir })
      .filter((file) => !file.includes('/attachments/'))
      .map(async (file) => JSON.parse(await readFile(join(dir, file), 'utf8'))),
  );

export const summarizeContrast = (
  reports: ContrastReport[],
  complete: boolean,
) => {
  const keyOf = (node: {
    project: string;
    scenario: string;
    rule: string;
    target: string[];
    sourceTarget?: string[];
  }) =>
    JSON.stringify([
      node.project,
      node.scenario,
      node.rule,
      node.sourceTarget ?? node.target,
    ]);
  const keys = inventory.observations.map(keyOf);
  if (keys.length !== 342 || new Set(keys).size !== 342)
    throw new Error(
      'contrast source inventory must preserve 342 unique observations',
    );
  for (const observation of inventory.observations) {
    const matches = manual.nodes.filter(
      (node) => keyOf(node) === keyOf(observation),
    );
    if (matches.length !== 1 || matches[0].contrastGroup !== observation.group)
      throw new Error(`contrast source mapping changed: ${keyOf(observation)}`);
  }
  const groups = inventory.groups.map((group) => ({
    ...group,
    states: [] as { project: string; state: string; minimum: number }[],
  }));
  for (const report of reports)
    for (const result of report.result) {
      const group = groups.find(
        (group) =>
          result.id === group.id || result.id.startsWith(`${group.id}.`),
      );
      if (!group) throw new Error(`unknown contrast component: ${result.id}`);
      if (
        report.visibility === 'visible' &&
        (!result.samples || !result.painted)
      )
        throw new Error(`contrast measurement missing: ${result.id}`);
      if (result.painted) {
        if (
          result.minimum === null ||
          !Number.isFinite(result.minimum) ||
          result.minimum < 4.5
        )
          throw new Error(`contrast below 4.5: ${result.id}`);
        group.states.push({
          project: report.project,
          state: report.state,
          minimum: result.minimum,
        });
      }
    }
  const missing = groups
    .filter((group) => !group.states.length)
    .map((group) => group.id);
  if (complete && missing.length)
    throw new Error(`contrast components not measured: ${missing.join(', ')}`);
  if (complete)
    for (const group of groups)
      for (const required of group.requiredStates) {
        if (
          !group.states.some(
            (state) => `${state.project}:${state.state}` === required,
          )
        )
          throw new Error(
            `contrast state not measured: ${group.id}/${required}`,
          );
      }
  return {
    status: complete ? 'passed' : reports.length ? 'partial' : 'not-run',
    sourceCommit: inventory.sourceCommit,
    observations: 329,
    historicalOnly: 13,
    groups: groups.map((group) => {
      const states = new Map<string, (typeof group.states)[number]>();
      for (const state of group.states) {
        const key = `${state.project}:${state.state}`;
        if (!states.has(key) || states.get(key)!.minimum > state.minimum)
          states.set(key, state);
      }
      return {
        ...group,
        states: [...states.values()],
        minimum: group.states.length
          ? Math.min(...group.states.map((state) => state.minimum))
          : null,
      };
    }),
    missing,
  };
};
