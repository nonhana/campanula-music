import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  displayImageUrl,
  isNeteaseImageUrl,
  thumbnailUrl,
} from '#lib/api/library.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('displayImageUrl', () => {
  it('将网易云图床主机统一到 https://p1 并追加 WebP 缩略参数', () => {
    const raw =
      'http://p3.music.126.net/EYqCX6tr_7Yqj5rNOp27Sg==/109951170622514029.jpg';
    expect(isNeteaseImageUrl(raw)).toBe(true);
    expect(displayImageUrl(raw, 150)).toBe(
      'https://p1.music.126.net/EYqCX6tr_7Yqj5rNOp27Sg==/109951170622514029.jpg?imageView=1&thumbnail=150y150&type=webp',
    );
    expect(thumbnailUrl(raw, 512)).toBe(
      'https://p1.music.126.net/EYqCX6tr_7Yqj5rNOp27Sg==/109951170622514029.jpg?param=512y512',
    );
  });

  it('非网易云图床（如本地 mock 资源）退回普通 param 缩略参数', () => {
    const local = '/mock-assets/cover/2cb4e8f432b91dd1.svg';
    expect(isNeteaseImageUrl(local)).toBe(false);
    expect(displayImageUrl(local, 96)).toBe(
      '/mock-assets/cover/2cb4e8f432b91dd1.svg?param=96y96',
    );
  });
});

describe('image-url 运行时像素与 preconnect', () => {
  it('按设备像素比在 1x 到 2x 间计算展示尺寸，SSR 默认 2x', async () => {
    const mod = await import('#lib/components/shared/image-url.ts');
    expect(mod.displayPixels(150)).toBe(300);

    vi.stubGlobal('window', { devicePixelRatio: 1 });
    expect(mod.displayPixels(150)).toBe(150);

    vi.stubGlobal('window', { devicePixelRatio: 0 });
    expect(mod.displayPixels(150)).toBe(150);

    vi.stubGlobal('window', { devicePixelRatio: 1.5 });
    expect(mod.displayPixels(150)).toBe(300);

    vi.stubGlobal('window', { devicePixelRatio: 3 });
    expect(mod.displayPixels(150)).toBe(300);
  });

  it('仅在首次渲染真实网易云图片时注入一次 preconnect', async () => {
    const appended: { rel: string; href: string }[] = [];
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    vi.stubGlobal('document', {
      createElement: () => ({ rel: '', href: '' }),
      head: {
        append: (node: { rel: string; href: string }) => {
          appended.push(node);
        },
      },
    });

    const mod = await import('#lib/components/shared/image-url.ts');
    expect(mod.displayCoverSource('/mock-assets/cover/local.svg', 150)).toBe(
      '/mock-assets/cover/local.svg?param=150y150',
    );
    expect(appended).toEqual([]);

    const netease = 'https://p2.music.126.net/abc/123.jpg';
    expect(mod.displayCoverSource(netease, 150)).toBe(
      'https://p1.music.126.net/abc/123.jpg?imageView=1&thumbnail=150y150&type=webp',
    );
    expect(mod.displayCoverSource(netease, 200)).toBe(
      'https://p1.music.126.net/abc/123.jpg?imageView=1&thumbnail=200y200&type=webp',
    );
    expect(appended).toEqual([
      { rel: 'preconnect', href: 'https://p1.music.126.net' },
    ]);
  });

  it('无 document 环境不尝试注入 preconnect', async () => {
    const mod = await import('#lib/components/shared/image-url.ts');
    expect(() =>
      mod.ensureNeteaseImagePreconnect('https://p1.music.126.net/a/1.jpg'),
    ).not.toThrow();
  });
});
