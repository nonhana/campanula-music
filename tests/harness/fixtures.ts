import * as sdk from 'hana-music-api';

import { field, fixtureOutcome } from '#lib/server/mock/fixture-format.js';
import { readFixture } from '#lib/server/mock/read-fixture.js';

import type { Outcome } from './netease-sdk';

interface StandardSchema {
  '~standard': {
    validate: (value: unknown) => StandardResult | Promise<StandardResult>;
  };
}

type StandardResult =
  | { value: unknown; issues?: undefined }
  | {
      issues: readonly {
        message: string;
        path?: readonly (PropertyKey | { key: PropertyKey })[];
      }[];
    };

const REJECTION_SCHEMAS: Record<string, string> = {
  'login_cellphone:10004': 'LoginCellphoneRiskBody',
};

const isStandardSchema = (value: unknown): value is StandardSchema =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  '~standard' in value;

interface LoadedFixture {
  module: string;
  query: Record<string, unknown>;
  outcome: Outcome;
}

const load = async (path: string): Promise<LoadedFixture> => {
  const raw = await readFixture(path);
  const { module } = raw;
  const { rejected, response } = fixtureOutcome(module, raw.response, path);
  const code = field(response.body, 'code');
  const outcome = (body: unknown): LoadedFixture => ({
    module,
    query: raw.query as Record<string, unknown>,
    outcome: {
      rejected,
      response: { ...response, body, cookie: [] },
    },
  });

  if (response.retryAfter !== undefined) return outcome(response.body);
  const name = rejected
    ? REJECTION_SCHEMAS[`${module}:${String(code)}`]
    : `${module
        .split('_')
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join('')}Body`;
  if (!name) return outcome(response.body);

  const schema: unknown = (sdk as Record<string, unknown>)[name];
  if (!isStandardSchema(schema))
    throw new Error(
      `hana-music-api 没有导出 ${name}，录制数据 ${path}（${module}）没法校验`,
    );
  const result = await schema['~standard'].validate(response.body);
  if (result.issues) {
    const issues = result.issues.map(
      ({ message, path = [] }) =>
        `  ${path
          .map((key) => String(typeof key === 'object' ? key.key : key))
          .join('.')}: ${message}`,
    );
    throw new Error(
      `录制数据 ${path} 不符合 SDK 的结构定义 ${name}：\n${issues.join('\n')}`,
    );
  }
  return outcome(result.value);
};

const loaded = new Map<string, Promise<LoadedFixture>>();

export const loadFixture = (path: string): Promise<LoadedFixture> => {
  let fixture = loaded.get(path);
  if (!fixture) {
    fixture = load(path);
    loaded.set(path, fixture);
  }
  return fixture;
};
