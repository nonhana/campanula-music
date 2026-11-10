// 上千个编号的查询串在索引里换成摘要，免得索引涨到 MB 级；匹配时两边算同一个键
import { createHash } from 'node:crypto';

const LONG_VALUE = 256;

const digest = (value: string): string =>
  `#sha256:${createHash('sha256').update(value).digest('hex')}:${value.length}`;

const canonical = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.length > LONG_VALUE ? digest(value) : value;
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonical((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return value;
};

export const queryKey = (query: unknown): string =>
  JSON.stringify(canonical(query));
