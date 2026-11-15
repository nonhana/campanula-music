import { fixtureOutcome } from './mock/fixture-format.ts';
import { readFixture } from './mock/read-fixture.ts';
import type { Outcome } from './netease-sdk.ts';
import { validateResponse } from './sdk-contract.ts';

interface LoadedFixture {
  evidence: import('./sdk-contract.ts').ValidationKind;
  module: string;
  query: Record<string, unknown>;
  outcome: Outcome;
}

const load = async (path: string, base?: URL): Promise<LoadedFixture> => {
  const raw = await readFixture(path, base);
  const { module } = raw;
  const { rejected, response: recorded } = fixtureOutcome(
    module,
    raw.response,
    path,
  );
  const response = { ...recorded, body: structuredClone(recorded.body) };
  const evidence = await validateResponse(
    module,
    { ...response, cookie: [] },
    rejected,
    path,
    module === 'nos_upload'
      ? (raw.query as Record<string, unknown>)
      : undefined,
    false,
  );
  return {
    module,
    query: raw.query as Record<string, unknown>,
    evidence,
    outcome: { rejected, response: { ...response, cookie: [] } },
  };
};

const loaded = new Map<string, Promise<LoadedFixture>>();

export const loadFixture = (
  path: string,
  base?: URL,
): Promise<LoadedFixture> => {
  const key = `${base?.href ?? 'repository'}:${path}`;
  let fixture = loaded.get(key);
  if (!fixture) {
    fixture = load(path, base);
    loaded.set(key, fixture);
  }
  return fixture;
};
