import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Song } from '#lib/api/library.ts';
import { consumeEarlyAccount } from '#lib/app/browser.ts';

vi.mock('@fontsource-variable/noto-sans-sc', () => ({}));
vi.mock('@fontsource-variable/noto-sans-jp', () => ({}));
vi.mock('@fontsource-variable/noto-sans-tc', () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('fonts 按需加载', () => {
  it('无 document 时安全空操作，有 document 时各语系仅触发一次加载', async () => {
    const fonts = await import('#lib/components/shared/fonts.ts');
    expect(() => {
      fonts.loadScFont();
      fonts.ensureScriptFont('ja');
      fonts.ensureScriptFont('zh-TW');
    }).not.toThrow();

    vi.stubGlobal('document', {});
    fonts.loadScFont();
    fonts.loadScFont();
    fonts.ensureScriptFont('ja');
    fonts.ensureScriptFont('ja');
    fonts.ensureScriptFont('zh-TW');
    fonts.ensureScriptFont('zh-TW');
  });
});

describe('text 语言识别与展示格式化', () => {
  it('按假名和繁体字符识别语系并跳过空文本', async () => {
    vi.stubGlobal('document', {});
    const { langOf } = await import('#lib/components/shared/text.ts');
    expect(langOf(null, '夏に溶ける')).toBe('ja');
    expect(langOf('晴天', '說好不哭')).toBe('zh-TW');
    expect(langOf(null, '晴天', 'Hello')).toBeUndefined();
  });

  it('格式化歌手、年份、曲数、播放量、时长与存储占用', async () => {
    const text = await import('#lib/components/shared/text.ts');
    const song = {
      id: 1,
      name: '示例',
      artists: [
        { id: 1, name: '歌手甲' },
        { id: 2, name: '歌手乙' },
      ],
    } as Song;
    expect(text.artistLine(song)).toBe('歌手甲 / 歌手乙');
    expect(text.yearOf(null)).toBeNull();
    expect(text.yearOf(0)).toBeNull();
    expect(text.yearOf(Date.UTC(2024, 5, 1))).toBe(2024);
    expect(text.formatSongCount(null)).toBeNull();
    expect(text.formatSongCount(1200)).toBe('1,200 首');
    expect(text.formatPlays(9999)).toBe('9,999');
    expect(text.formatPlays(12_300)).toBe('1.2 万');
    expect(text.formatPlays(1_250_000)).toBe('125 万');
    expect(text.formatPlays(230_000_000)).toBe('2.3 亿');
    expect(text.formatDuration(-500)).toBe('0:00');
    expect(text.formatDuration(65_000)).toBe('1:05');
    expect(text.formatStorageSize(0)).toBe('0 MB');
    expect(text.formatStorageSize(200)).toBe('1 KB');
    expect(text.formatStorageSize(512 * 1024)).toBe('512 KB');
    expect(text.formatStorageSize(12.5 * 1024 * 1024)).toBe('12.5 MB');
    expect(text.formatStorageSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    expect(text.formatMegabytes(5 * 1024 * 1024)).toBe('5.0');
  });
});

describe('consumeEarlyAccount', () => {
  it('首屏无头 GET /api/account 仅消费一次，带头、非 GET 或其他路径跳过', () => {
    const early = Promise.resolve(new Response('{}'));
    const win: { __campanulaEarlyAccount?: Promise<Response> } = {
      __campanulaEarlyAccount: early,
    };
    vi.stubGlobal('window', win);

    expect(consumeEarlyAccount('/api/daily')).toBeNull();
    expect(consumeEarlyAccount('/api/account', { method: 'POST' })).toBeNull();
    expect(
      consumeEarlyAccount('/api/account', { headers: { 'x-retry': '1' } }),
    ).toBeNull();
    expect(win.__campanulaEarlyAccount).toBe(early);

    expect(consumeEarlyAccount('/api/account')).toBe(early);
    expect(win.__campanulaEarlyAccount).toBeUndefined();
    expect(consumeEarlyAccount('/api/account')).toBeNull();
  });

  it('退出登录时主动废弃尚未消费的早期账号请求', () => {
    const early = Promise.resolve(new Response('{}'));
    const win: { __campanulaEarlyAccount?: Promise<Response> } = {
      __campanulaEarlyAccount: early,
    };
    vi.stubGlobal('window', win);

    expect(consumeEarlyAccount('/api/logout', { method: 'POST' })).toBeNull();
    expect(win.__campanulaEarlyAccount).toBeUndefined();
    expect(consumeEarlyAccount('/api/account')).toBeNull();
  });
});
