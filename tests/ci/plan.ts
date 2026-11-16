import { basename } from 'node:path';

import { discoverTests } from '../suites.ts';

export interface Lane {
  name: string;
  files: string[];
  project?: 'desktop' | 'phone';
  chromium?: boolean;
}

// Seconds per file on GitHub Linux; smaller and newly discovered files share the remaining capacity.
const seconds: Record<string, number> = {
  playback: 52,
  downloads: 39,
  library: 32,
  'playlist-page': 18,
  'sdk-contract': 14,
  export: 11,
  'playlist-tracks': 10,
  'add-to-playlist': 9,
  'mock-index': 7,
  'session-round': 6,
  session: 6,
  'song-playability': 6,
  'local-upgrade': 6,
  login: 5,
  'netease-playlist': 4,
  'heart-collect': 4,
  'playlist-order': 3,
  'mock-store': 3,
  search: 3,
  'playlist-edit': 3,
  'album-artist': 3,
  cover: 3,
};

export const requireInventory = (expected: string[], actual: string[]) => {
  const wanted = new Set(expected);
  if (wanted.size !== expected.length) throw new Error('计划包含重复项');
  const seen = new Set<string>();
  for (const id of actual) {
    if (!wanted.has(id) || seen.has(id))
      throw new Error(`意外或重复执行：${id}`);
    seen.add(id);
  }
  for (const id of wanted) if (!seen.has(id)) throw new Error(`缺少：${id}`);
};

export const dailyPlan = (changes: string[] | null): Lane[] => {
  const suites = discoverTests();
  const shards = Array.from({ length: 5 }, (_, i) => ({
    name: `product-${i + 1}`,
    files: [] as string[],
    seconds: 0,
  }));
  const files = [...suites.unit, ...suites.behavior, ...suites.contract];
  const cost = (file: string) =>
    file.startsWith('tests/unit/')
      ? 1
      : (seconds[basename(file, '.test.ts')] ?? 2);
  for (const file of files.sort(
    (a, b) => cost(b) - cost(a) || a.localeCompare(b, 'en'),
  )) {
    const shard = shards.reduce((a, b) => (a.seconds <= b.seconds ? a : b));
    shard.files.push(file);
    shard.seconds += cost(file);
  }
  const lanes: Lane[] = [
    { name: 'static', files: [] },
    ...shards.map(({ name, files }) => ({ name, files })),
  ];
  const touched = (pattern: RegExp) =>
    changes === null || changes.some((file) => pattern.test(file));
  const infrastructure = touched(
    /^(?:\.github\/|tests\/(?:ci\/|suites\.ts|tools\/(?:(?:daily|ci)[^/]*\.mts|offline\.sh)))/,
  );
  const toolchain = touched(
    /^(?:package\.json|pnpm-(?:lock|workspace)\.yaml|\.node-version|vite\.config\.mts|svelte\.config\.|tsconfig\.json)/,
  );
  const broad = infrastructure || toolchain;
  const environment =
    broad ||
    touched(
      /^(?:scripts\/dev|tests\/(?:browser\/journeys\/environment\.spec\.ts|_kit\/(?:environment|workspace|terminal)|delivery\/(?:dev-|environment|runner-isolation|command-cleanup)|tools\/https))/,
    );
  const sdk =
    broad ||
    touched(
      /^(?:src\/lib\/(?:server\/|app\/browser\.ts)|tests\/(?:fixtures\/|contract\/|_kit\/(?:sdk-|schemas|netease-sdk|mock\/)|tools\/(?:sdk-|fixture-)))/,
    );
  const delivery =
    broad ||
    touched(
      /^(?:Dockerfile|\.dockerignore|src\/(?:service-worker|app\.html|lib\/app\/(?:download|local|browser\.ts|app\.ts|pacing\.ts|api-client\.ts)|routes\/\+layout)|static\/|tests\/(?:delivery\/(?:pwa\/|node\.|candidate\.|release\.|Dockerfile)|tools\/(?:pwa|build-candidate|delivery|release-check)))/,
    );
  const browserTools =
    broad ||
    touched(
      /^tests\/(?:browser\/(?:fixture|playwright\.config)|_kit\/mock\/|tools\/browser|baselines\/(?:browser-|a11y-|contrast-))/,
    );
  const sharedUI =
    browserTools ||
    touched(
      /^(?:uno\.|static\/|src\/(?:app\.|routes\/\+|lib\/components\/(?:shell|shared|ui|overlay|svg)\/))/,
    );
  const ui = touched(/^src\/(?:routes\/(?!api\/)|lib\/components\/)/);
  const contrast =
    sharedUI ||
    touched(/\.svelte$|\.css$|^tests\/browser\/accessibility\/contrast/);
  const pageFiles = [...suites.browser, ...suites.a11y].filter(
    (file) =>
      !file.includes('/contrast') &&
      !file.endsWith('/diagnostics.spec.ts') &&
      !file.endsWith('/environment.spec.ts'),
  );
  const extra = new Set<string>();
  for (const file of pageFiles) {
    if (sharedUI || changes?.includes(file)) extra.add(file);
  }
  if (ui) {
    const controls = ['controls', 'pages'];
    const domains: [RegExp, string[]][] = [
      [/player|songs/, ['player', 'keyboard']],
      [/login|account/, ['login', 'core']],
      [/downloads/, ['downloads']],
      [/playlist|library|menu/, ['save', 'keyboard', 'core', 'states']],
      [/daily|search|albums|artists/, ['core', 'states']],
    ];
    const matched = domains
      .filter(([pattern]) => touched(pattern))
      .flatMap(([, names]) => names);
    for (const file of pageFiles)
      if (
        !matched.length ||
        [...controls, ...matched].includes(basename(file, '.spec.ts'))
      )
        extra.add(file);
  }
  for (const project of ['desktop', 'phone'] as const) {
    const smoke = project === 'desktop' ? ['save', 'keyboard'] : ['player'];
    lanes.push({
      name: `browser-${project}`,
      project,
      chromium: true,
      files: pageFiles.filter(
        (file) => extra.has(file) || smoke.includes(basename(file, '.spec.ts')),
      ),
    });
    if (contrast)
      lanes.push({
        name: `contrast-${project}`,
        project,
        chromium: true,
        files: suites.a11y.filter((file) => file.includes('/contrast')),
      });
  }
  if (environment)
    lanes.push({ name: 'environment', files: [], chromium: true });
  else {
    const affected = suites.delivery.filter(
      (file) =>
        changes?.includes(file) ||
        (delivery && /(?:candidate|release)\.test\.ts$/.test(file)) ||
        (sdk && file.endsWith('/mock-server.test.ts')),
    );
    if (affected.length)
      lanes.push({ name: 'delivery-tests', files: affected });
  }
  if (sdk) lanes.push({ name: 'sdk', files: [], chromium: true });
  if (delivery) lanes.push({ name: 'delivery', files: [], chromium: true });
  if (
    browserTools ||
    touched(/tests\/browser\/journeys\/diagnostics\.spec\.ts/)
  )
    lanes.push({ name: 'diagnostics', files: [], chromium: true });
  if (
    broad ||
    touched(
      /^tests\/(?:coverage\/|vitest\.config|tools\/run\.mts|baselines\/coverage)/,
    )
  )
    lanes.push({ name: 'coverage', files: [] });
  return lanes;
};
