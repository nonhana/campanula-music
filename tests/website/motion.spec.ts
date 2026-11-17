import { expect, test } from './fixture.ts';

interface MotionSample {
  path: string;
  opening: boolean;
  transition: boolean;
  types: string[];
  logo: string;
  name: string;
  animations: { name: string; duration: number; displaced: boolean }[];
}

declare global {
  interface Window {
    websiteMotion: (value: MotionSample) => Promise<void>;
  }
}

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test.describe(reducedMotion, () => {
    test.use({ reducedMotion });
    test('入场与真实跨文档转场期间记录品牌、动态策略和返回不重播', async ({
      page,
      context,
    }, info) => {
      const samples: MotionSample[] = [];
      await context.exposeBinding('websiteMotion', (_source, value) =>
        samples.push(value),
      );
      await context.addInitScript(() => {
        const sample = (transition?: ViewTransition) => {
          const named = (selector: string) => {
            const element = document.querySelector(selector);
            return element ? getComputedStyle(element).viewTransitionName : '';
          };
          const value = {
            path: location.pathname,
            opening: document.documentElement.hasAttribute('data-home-enter'),
            transition: Boolean(transition),
            types: transition ? [...transition.types] : [],
            logo: named('[data-brand] svg'),
            name: named('[data-brand-name]'),
            animations: document
              .getAnimations()
              .filter((animation) => animation instanceof CSSAnimation)
              .map((animation) => ({
                name: animation.animationName,
                duration: Number(
                  animation.effect?.getComputedTiming().duration,
                ),
                displaced:
                  animation.effect instanceof KeyframeEffect &&
                  animation.effect
                    .getKeyframes()
                    .some(
                      (frame) =>
                        (typeof frame.translate === 'string' &&
                          frame.translate !== 'none' &&
                          frame.translate
                            .split(' ')
                            .some((part) => Number.parseFloat(part) !== 0)) ||
                        (typeof frame.transform === 'string' &&
                          !new DOMMatrixReadOnly(frame.transform).isIdentity),
                    ),
              })),
          };
          void window.websiteMotion(value);
        };
        addEventListener('pagereveal', (event) => {
          const transition = event.viewTransition;
          if (transition) void transition.ready.then(() => sample(transition));
          else requestAnimationFrame(() => sample());
        });
      });
      await page.goto('/');
      await expect
        .poll(() =>
          samples.some(
            (sample) =>
              sample.opening &&
              !sample.transition &&
              sample.animations.some(
                (animation) => animation.name === 'home-flower-in',
              ),
          ),
        )
        .toBe(true);
      const opening = samples.find(
        (sample) => sample.opening && !sample.transition,
      )!;
      const animations = opening.animations.filter((animation) =>
        animation.name.startsWith('home-'),
      );
      expect(animations).toHaveLength(4);
      expect(animations.some((animation) => animation.displaced)).toBe(
        reducedMotion === 'no-preference',
      );
      if (reducedMotion === 'reduce')
        expect(animations.every((animation) => animation.duration <= 150)).toBe(
          true,
        );
      await expect(page.locator('.demo-window')).toHaveAttribute(
        'data-ready',
        '',
      );
      await expect(page.locator('#demo-frame')).toHaveCSS('opacity', '1');
      await expect(page.locator('.demo-still')).toHaveCSS(
        'visibility',
        'hidden',
      );
      await page.locator('#home-deploy').click();
      await expect
        .poll(() =>
          samples.some(
            (sample) => sample.path === '/guide/' && sample.transition,
          ),
        )
        .toBe(true);
      const forward = samples.find(
        (sample) => sample.path === '/guide/' && sample.transition,
      )!;
      expect(forward.types).toContain(
        reducedMotion === 'reduce' ? 'fade' : 'up',
      );
      expect([forward.logo, forward.name]).toEqual(
        reducedMotion === 'reduce'
          ? ['none', 'none']
          : ['website-logo', 'website-name'],
      );
      if (reducedMotion === 'reduce')
        expect(
          forward.animations.every((animation) => !animation.displaced),
        ).toBe(true);
      await page.locator('#reading-back').click();
      await expect
        .poll(() =>
          samples.some((sample) => sample.path === '/' && sample.transition),
        )
        .toBe(true);
      const back = samples.findLast(
        (sample) => sample.path === '/' && sample.transition,
      )!;
      expect(back.opening).toBe(false);
      expect(back.types).toContain(
        reducedMotion === 'reduce' ? 'fade' : 'down',
      );
      expect(
        back.animations.filter((animation) =>
          animation.name.startsWith('home-'),
        ),
      ).toEqual([]);
      await expect(page.locator('.home-brand')).toBeVisible();
      await expect(page.locator('#home-deploy')).toBeFocused();
      await info.attach('motion-during-navigation', {
        body: JSON.stringify(samples),
        contentType: 'application/json',
      });
    });
  });
}

test('Tab 可以从官网进入试听，再正向和反向离开 iframe', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.demo-window')).toHaveAttribute('data-ready', '');
  await page.locator('.home-actions .source-link').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#demo-frame')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>('#demo-frame')!;
      return frame.contentDocument?.activeElement?.tagName;
    }),
  ).not.toBe('BODY');
  let escaped = false;
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press('Tab');
    if (
      await page.evaluate(() => document.activeElement?.id !== 'demo-frame')
    ) {
      escaped = true;
      break;
    }
  }
  expect(escaped, '试听不能把 Tab 困在内部').toBe(true);
  await page.locator('.home-actions .source-link').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press('Shift+Tab');
    if (
      await page
        .locator('.home-actions .source-link')
        .evaluate((element) => element === document.activeElement)
    )
      return;
  }
  throw new Error('反向 Tab 没能回到官网入口');
});
