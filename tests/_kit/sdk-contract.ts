import { createHash } from 'node:crypto';
import { inspect, types } from 'node:util';
import { deserialize, serialize } from 'node:v8';

import * as sdk from 'hana-music-api';
import type { NcmApiFailure, NcmApiResponse } from 'hana-music-api';

import { field, fixtureOutcome } from './mock/fixture-format.ts';

const validated = new WeakMap<object, Set<string>>();

// 只为普通数据复用完整内容的证据；getter、特殊原型等仍逐次交给 SDK。
const dataOnly = (value: unknown, seen = new Set<object>()): boolean => {
  if (value === null || typeof value !== 'object')
    return typeof value !== 'function' && typeof value !== 'symbol';
  if (types.isProxy(value) || seen.has(value)) return false;
  seen.add(value);
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (
    prototype !== null &&
    prototype !== (array ? Array.prototype : Object.prototype)
  )
    return false;
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === 'length') continue;
    if (typeof key !== 'string') return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (
      !descriptor.enumerable ||
      !('value' in descriptor) ||
      !dataOnly(descriptor.value, seen)
    )
      return false;
  }
  seen.delete(value);
  return true;
};

const fingerprint = (
  body: unknown,
): { key: string; bytes: ReturnType<typeof serialize> } | undefined => {
  if (!dataOnly(body)) return;
  // V8 保留 null / undefined / NaN，不能用 JSON 文本把不同输入合成同一证据。
  const bytes = serialize(body);
  return { key: createHash('sha256').update(bytes).digest('hex'), bytes };
};

export const schemaName = (module: string): string =>
  `${module
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')}Body`;

export const sdkSchema = (name: string, context = name) => {
  const schema = (sdk as Record<string, unknown>)[name] as
    | {
        '~standard'?: {
          validate: (
            value: unknown,
          ) =>
            | { issues?: readonly unknown[] }
            | Promise<{ issues?: readonly unknown[] }>;
        };
      }
    | undefined;
  const standard = schema?.['~standard'];
  if (!schema || !standard) throw new Error(`${context}：没有导出 ${name}`);
  return { schema, standard };
};

export const validateSchema = async (
  name: string,
  body: unknown,
  context: string,
): Promise<void> => {
  const { schema, standard } = sdkSchema(name, context);
  const snapshot = fingerprint(body);
  if (snapshot && validated.get(schema)?.has(snapshot.key)) return;
  // 异步 schema 也只能观察这份独立快照，成功证据不会记给中途改变的原对象。
  const result = await standard.validate(
    snapshot ? deserialize(snapshot.bytes) : body,
  );
  if (result.issues)
    throw new Error(
      `${context}：期望 ${name}，实际 ${inspect(result.issues, { depth: 3, maxArrayLength: 3, maxStringLength: 120 }).slice(0, 1200)}`,
    );
  if (snapshot) {
    const cache = validated.get(schema) ?? new Set<string>();
    if (cache.size >= 512) cache.delete(cache.values().next().value!);
    cache.add(snapshot.key);
    validated.set(schema, cache);
  }
};

export type ValidationKind =
  | 'success-schema'
  | 'error-schema'
  | 'normalized-failure'
  | 'direct-upload';

export const validateResponse = async (
  module: string,
  response: NcmApiResponse<unknown> | NcmApiFailure<unknown>,
  rejected: boolean,
  scenario: string,
  query?: Record<string, unknown>,
  final = true,
): Promise<ValidationKind> => {
  const context = `${scenario} / ${module}`;
  const fail = (expected: string, actual: unknown = response): never => {
    throw new Error(
      `${context}：期望 ${expected}，实际 ${inspect(actual, { depth: 3, maxArrayLength: 3, maxStringLength: 120 }).slice(0, 1200)}`,
    );
  };
  if (
    !Number.isInteger(response.status) ||
    response.status < 100 ||
    response.status > 599
  )
    fail('HTTP status');
  if (
    !Array.isArray(response.cookie) ||
    response.cookie.some((cookie) => typeof cookie !== 'string')
  )
    fail('cookie 字符串数组');
  if (module === 'nos_upload') {
    if (rejected) {
      if (response.status < 300) fail('直传失败 HTTP status');
    } else {
      const offset = field(response.body, 'offset');
      if (response.status >= 300) fail('直传成功 HTTP status');
      if (
        typeof offset !== 'number' ||
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        typeof field(response.body, 'requestId') !== 'string'
      )
        fail('直传 offset / requestId');
      if (query?.bytes !== undefined && query.bytes !== offset)
        fail(`上传 bytes=${query.bytes}`);
    }
    return 'direct-upload';
  }
  if (rejected) {
    if (response.status < 300) fail('失败 HTTP status');
    const failure = 'failure' in response ? response.failure : undefined;
    if (!failure || !sdk.getNcmFailureInfo(response)) fail('failure 元数据');
    switch (failure!.kind) {
      case 'business':
        if (
          typeof field(response.body, 'code') === 'number' &&
          !fixtureOutcome(module, {
            status: response.status,
            body: response.body,
          }).rejected
        )
          fail('失败业务 code');
        if (failure!.code !== null && typeof failure!.code !== 'number')
          fail('business code');
        if (
          typeof field(response.body, 'code') === 'number' &&
          failure!.code !== field(response.body, 'code')
        )
          fail('body / failure code 一致');
        break;
      case 'rateLimited':
        if (
          !(failure!.retryAfter > 0) ||
          ('retryAfter' in response ? response.retryAfter : undefined) !==
            failure!.retryAfter
        )
          fail('retryAfter');
        break;
      case 'upstreamShape':
        if (
          ![
            failure!.module,
            failure!.path,
            failure!.expected,
            failure!.actual,
          ].every((value) => typeof value === 'string')
        )
          fail('upstreamShape');
        break;
      case 'timeout':
      case 'cancelled':
      case 'invalidRequest':
      case 'transport':
      case 'unknown':
        break;
      default:
        fail('已知 failure kind');
    }
    if (
      module === 'login_cellphone' &&
      field(response.body, 'code') === 10004
    ) {
      await validateSchema('LoginCellphoneRiskBody', response.body, context);
      return 'error-schema';
    }
    return 'normalized-failure';
  }
  if ('failure' in response && response.failure) fail('成功不含 failure');
  if (fixtureOutcome(module, response).rejected) fail('成功 code');
  if (response.status >= 300) fail('成功 HTTP status');
  const entity =
    module === 'playlist_detail'
      ? field(response.body, 'playlist')
      : module === 'album'
        ? field(response.body, 'album')
        : undefined;
  if (query?.id !== undefined && entity && field(entity, 'id') !== query.id)
    fail(`实体 id=${query.id}`, { id: field(entity, 'id') });
  await validateSchema(schemaName(module), response.body, context);
  if (
    final &&
    (['login_cellphone', 'login_refresh'].includes(module) ||
      (module === 'login_qr_check' && field(response.body, 'code') === 803)) &&
    !response.cookie.some((cookie) => /^MUSIC_U=[^;]+/.test(cookie))
  )
    fail('新的 MUSIC_U cookie');
  return 'success-schema';
};
