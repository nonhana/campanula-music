import { readFile } from 'node:fs/promises';

import type { Locator, Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';

export const install = async (
  page: Page,
  options: {
    rules?: {
      path: string;
      after?: number;
      reply: 'hold' | { status?: number; body: unknown };
    }[];
    replay?: Record<string, unknown>;
    freshImages?: boolean;
  } = {},
) => {
  const sources = await Promise.all(
    [
      'watch.js.txt',
      'intercept.js.txt',
      'freeze.js.txt',
      'clock.js.txt',
      ...(options.freshImages ? ['fresh-images.js.txt'] : []),
    ].map((file) => readFile(new URL(file, import.meta.url), 'utf8')),
  );
  const setup = `window.__campanulaReplay = ${JSON.stringify({ delay: 600, max: 300_000, store: options.replay ?? {}, recorded: {} })};${options.rules ? `localStorage.setItem('campanula-intercept', ${JSON.stringify(JSON.stringify({ rules: options.rules }))});` : ''}`;
  await page.addInitScript({ content: `${setup}\n${sources.join('\n')}` });
};

export const shoot = async (page: Page, info: TestInfo, name: string) => {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.locator('main [aria-busy=true]')).toHaveCount(0);
  await page.waitForTimeout(250);
  const report = await page.evaluate<{ moves: unknown[]; errors: string[] }>(
    'window.__campanulaWatch',
  );
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  const file = info.outputPath(`${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await info.attach(name, { path: file, contentType: 'image/png' });
  await info.attach(`${name}-replay`, {
    body: JSON.stringify(
      await page.evaluate('window.__campanulaReplay?.recorded'),
    ),
    contentType: 'application/json',
  });
  await info.attach(`${name}-layout`, {
    body: JSON.stringify({
      ...report,
      overflow,
      viewport: page.viewportSize(),
    }),
    contentType: 'application/json',
  });
  expect(report.errors).toEqual([]);
  expect(overflow).toBe(false);
  return { file, ...report };
};

export const keys = async (page: Page, sequence: string[], focus: Locator) => {
  await focus.focus();
  const steps = [];
  for (const key of sequence) {
    await page.keyboard.press(key);
    steps.push(
      await page.evaluate(
        (key) => ({
          key,
          url: location.pathname + location.search,
          role: document.activeElement?.getAttribute('role'),
          selected: document.activeElement?.getAttribute('aria-selected'),
          name:
            document.activeElement?.getAttribute('aria-label') ??
            document.activeElement?.textContent,
          ring: document.activeElement?.matches(':focus-visible'),
        }),
        key,
      ),
    );
  }
  return steps;
};

export const roundtrip = async (
  page: Page,
  link: Locator,
  shelf?: { locator: Locator; left: number },
) => {
  await page.evaluate('document.activeViewTransition?.finished');
  if (shelf)
    await shelf.locator.evaluate((node, left) => {
      node.scrollLeft = left;
    }, shelf.left);
  await expect(page.locator('main [aria-busy=true]')).toHaveCount(0);
  await expect(async () => {
    await link.scrollIntoViewIfNeeded();
  }).toPass({ timeout: 8_000 });
  const url = page.url();
  const destination = await link.getAttribute('href');
  const capture = () => ({
    url: location.pathname + location.search,
    x: Math.round(scrollX),
    y: Math.round(scrollY),
    shelves: Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>('[data-shelf]')].map(
        (node) => [node.dataset.shelf, Math.round(node.scrollLeft)],
      ),
    ),
    tab: [...document.querySelectorAll('[role=tab][aria-selected=true]')].map(
      (node) => node.textContent?.trim(),
    ),
  });
  const before = await page.evaluate(capture);
  await link.click();
  await expect(page).toHaveURL(new URL(destination!, url).href);
  await page.goBack();
  await expect(page).toHaveURL(url);
  await expect.poll(() => page.evaluate(capture)).toEqual(before);
};

export const motion = async (
  page: Page,
  info: TestInfo,
  name: string,
  selector: string | undefined,
  trigger: () => Promise<unknown>,
  times: number[],
) => {
  await page.evaluate(
    await readFile(new URL('freeze.js.txt', import.meta.url), 'utf8'),
  );
  const pending = page.evaluate<{ anims: string[] } | null>(
    selector
      ? `window.__campanulaFreeze.waitAndGrab(${JSON.stringify(selector)}, ${JSON.stringify(selector)}, 5000)`
      : 'window.__campanulaFreeze.waitTurn(5000)',
  );
  await trigger();
  const captured = await pending;
  expect(captured, '触发后必须捕获实际动画').not.toBeNull();
  const files = [];
  try {
    for (const at of times) {
      await page.evaluate(`window.__campanulaFreeze.frame(${at})`);
      const file = info.outputPath(`${name}-f${at}.png`);
      await page.screenshot({ path: file });
      files.push(file);
    }
  } finally {
    await page.evaluate('window.__campanulaFreeze.release()');
  }
  await info.attach(`${name}-animations`, {
    body: JSON.stringify(captured),
    contentType: 'application/json',
  });
  return { files, anims: captured!.anims };
};

export const tween = async (
  page: Page,
  info: TestInfo,
  name: string,
  trigger: () => Promise<unknown>,
  reset: () => Promise<unknown>,
  times: number[],
) => {
  await page.evaluate(
    await readFile(new URL('clock.js.txt', import.meta.url), 'utf8'),
  );
  const files = [];
  const samples = [];
  try {
    for (const at of times) {
      await page.evaluate('window.__campanulaClock.set(0.1)');
      const start = await page.evaluate<number>(
        'window.__campanulaClock.now()',
      );
      await trigger();
      await page.waitForFunction(
        ({ start, at }) => performance.now() - start >= at,
        { start, at },
      );
      const actual = await page.evaluate<number>(
        `(() => { const clock = window.__campanulaClock; clock.set(0); return clock.now() - ${start}; })()`,
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      const file = info.outputPath(`${name}-f${at}.png`);
      await page.screenshot({ path: file });
      files.push(file);
      samples.push({
        requestedMs: at,
        actualVirtualMs: actual,
        file,
        song: await page
          .locator('[aria-label^="打开播放页"]')
          .getAttribute('aria-label'),
      });
      await page.evaluate('window.__campanulaClock.set(1)');
      await page.waitForTimeout(700);
      await reset();
      await page.waitForTimeout(700);
    }
  } finally {
    await page.evaluate('window.__campanulaClock.set(1)');
  }
  await info.attach(`${name}-timing`, {
    body: JSON.stringify({ viewport: page.viewportSize(), samples }),
    contentType: 'application/json',
  });
  expect(
    new Set(samples.map((sample) => sample.song)).size,
    '同一组抽屉帧必须保持同一首歌',
  ).toBe(1);
  return files;
};

export const slow = async (page: Page, actions: (() => Promise<unknown>)[]) => {
  await page.evaluate(
    await readFile(new URL('clock.js.txt', import.meta.url), 'utf8'),
  );
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Animation.enable');
    await session.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
    await page.evaluate('window.__campanulaClock.set(0.1)');
    for (const action of actions) await action();
  } finally {
    await page.evaluate('window.__campanulaClock.set(1)');
    await session.send('Animation.setPlaybackRate', { playbackRate: 1 });
    await session.detach();
  }
};

export const hidden = async (
  page: Page,
  action: () => Promise<unknown>,
  selector = '[role=dialog] .disc, [role=dialog] .slot',
) => {
  await page.evaluate((selector) => {
    const target = window as Window & {
      hiddenProbe?: { selector: string; started: number };
    };
    if (!target.hiddenProbe) {
      const probe = { selector, started: 0 };
      target.hiddenProbe = probe;
      const original = Element.prototype.animate;
      Element.prototype.animate = function (keyframes, options) {
        const animation = original.call(this, keyframes, options);
        if (
          this.matches(probe.selector) &&
          Number(animation.effect?.getTiming().duration) > 0
        )
          probe.started++;
        return animation;
      };
      for (const type of ['transitionrun', 'animationstart'])
        document.addEventListener(
          type,
          (event) => {
            if (
              event.target instanceof Element &&
              event.target.matches(probe.selector)
            )
              probe.started++;
          },
          true,
        );
    }
    target.hiddenProbe!.selector = selector;
    target.hiddenProbe!.started = 0;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, selector);
  let during = 0;
  try {
    await action();
    during = await page.evaluate(() => {
      const probe = (window as Window & { hiddenProbe?: { started: number } })
        .hiddenProbe!;
      const count = probe.started;
      probe.started = 0;
      return count;
    });
  } finally {
    await page.evaluate(() => {
      Reflect.deleteProperty(document, 'visibilityState');
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }
  await page.waitForTimeout(300);
  return {
    startedWhileHidden: during,
    ...(await page.evaluate(
      (selector) => ({
        startedAfterShow: (
          window as Window & { hiddenProbe?: { started: number } }
        ).hiddenProbe!.started,
        counts: Object.fromEntries(
          selector
            .split(',')
            .map((part) => [
              part.trim(),
              document.querySelectorAll(part.trim()).length,
            ]),
        ),
      }),
      selector,
    )),
  };
};

export const sheet = async (
  page: Page,
  info: TestInfo,
  name: string,
  files: string[],
  height = 240,
) => {
  const thumbnails = await Promise.all(
    files.map(
      async (file) =>
        `data:image/png;base64,${(await readFile(file)).toString('base64')}`,
    ),
  );
  const contact = await page.context().newPage();
  try {
    await contact.setContent('<canvas></canvas>');
    await contact.evaluate(
      async ({ thumbnails, height }) => {
        const images = await Promise.all(
          thumbnails.map(
            (src) =>
              new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = src;
              }),
          ),
        );
        const canvas = document.querySelector('canvas')!;
        canvas.width = images.reduce(
          (width, image) =>
            width + Math.round((image.width / image.height) * height),
          0,
        );
        canvas.height = height;
        const context = canvas.getContext('2d')!;
        let left = 0;
        for (const image of images) {
          const width = Math.round((image.width / image.height) * height);
          context.drawImage(image, left, 0, width, height);
          left += width;
        }
      },
      { thumbnails, height },
    );
    const file = info.outputPath(`${name}-sheet.png`);
    await contact.locator('canvas').screenshot({ path: file });
    await info.attach(name, { path: file, contentType: 'image/png' });
    return file;
  } finally {
    await contact.close();
  }
};
