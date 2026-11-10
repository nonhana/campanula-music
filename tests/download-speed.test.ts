import { describe, expect, it } from 'vitest';

import {
  bytesPerSecond,
  formatSpeed,
} from '#lib/components/downloads/speed.js';

describe('下载速率', () => {
  it('最近窗口里两个样本才算出速率；样本太老、时间没走、字节没涨都是 0', () => {
    expect(bytesPerSecond([], 10_000)).toBe(0);
    expect(bytesPerSecond([{ at: 9000, received: 500 }], 10_000)).toBe(0);

    expect(
      bytesPerSecond(
        [
          { at: 9000, received: 0 },
          { at: 10_000, received: 1024 },
        ],
        10_000,
      ),
    ).toBe(1024);

    expect(
      bytesPerSecond(
        [
          { at: 10_000, received: 0 },
          { at: 10_000, received: 1024 },
        ],
        10_000,
      ),
    ).toBe(0);
    expect(
      bytesPerSecond(
        [
          { at: 10_000, received: 0 },
          { at: 9000, received: 1024 },
        ],
        10_000,
      ),
    ).toBe(0);

    expect(
      bytesPerSecond(
        [
          { at: 9000, received: 1024 },
          { at: 10_000, received: 0 },
        ],
        10_000,
      ),
    ).toBe(0);
  });

  it('只看最近 3 秒：更早的样本不算进去，窗口边界算', () => {
    expect(
      bytesPerSecond(
        [
          { at: 2000, received: 1000 },
          { at: 5000, received: 4000 },
        ],
        5000,
        3000,
      ),
    ).toBe(1000);

    expect(
      bytesPerSecond(
        [
          { at: 1000, received: 1000 },
          { at: 5000, received: 4000 },
        ],
        5000,
        3000,
      ),
    ).toBe(0);
  });

  it('写成 B/s、KB/s、MB/s 的边界：整数不带 .0，小数一位', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
    expect(formatSpeed(1023)).toBe('1023 B/s');
    expect(formatSpeed(1024)).toBe('1 KB/s');
    expect(formatSpeed(1536)).toBe('1.5 KB/s');
    expect(formatSpeed(1024 * 1024)).toBe('1 MB/s');
    expect(formatSpeed(1.5 * 1024 * 1024)).toBe('1.5 MB/s');
  });
});
