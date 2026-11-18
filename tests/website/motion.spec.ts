import { expect, test } from './fixture.ts';

interface MotionSample {
  path: string;
  opening: boolean;
  phase: string;
  transition: boolean;
  types: string[];
  logo: string;
  name: string;
  github: string;
  githubPath: { x: number; y: number }[];
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
          const animations = document.getAnimations();
          const githubGroup = animations.find(
            ({ effect }) =>
              effect instanceof KeyframeEffect &&
              effect.pseudoElement ===
                '::view-transition-group(website-github)',
          )?.effect;
          const value = {
            path: location.pathname,
            opening: document.documentElement.hasAttribute('data-home-opening'),
            phase: document.documentElement.dataset.homeOpening ?? '',
            transition: Boolean(transition),
            types: transition ? [...transition.types] : [],
            logo: named('[data-brand] svg'),
            name: named('[data-brand-name]'),
            github: named('.source-link > svg'),
            githubPath:
              githubGroup instanceof KeyframeEffect
                ? githubGroup.getKeyframes().map(({ transform }) => {
                    const matrix = new DOMMatrixReadOnly(String(transform));
                    return { x: matrix.e, y: matrix.f };
                  })
                : [],
            animations: animations.map((animation) => ({
              name:
                animation instanceof CSSAnimation
                  ? animation.animationName
                  : 'arrival',
              duration: Number(animation.effect?.getComputedTiming().duration),
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
        new MutationObserver(() =>
          requestAnimationFrame(() => sample()),
        ).observe(document, {
          subtree: true,
          attributes: true,
          attributeFilter: ['data-home-opening'],
        });
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
              sample.phase ===
                (reducedMotion === 'reduce' ? 'reduced' : 'spreading') &&
              sample.animations.length > 0,
          ),
        )
        .toBe(true);
      const opening = samples.find(
        (sample) =>
          sample.phase ===
          (reducedMotion === 'reduce' ? 'reduced' : 'spreading'),
      )!;
      const animations = opening.animations;
      expect(animations.some((animation) => animation.displaced)).toBe(
        reducedMotion === 'no-preference',
      );
      if (reducedMotion === 'reduce')
        expect(animations.every((animation) => animation.duration <= 150)).toBe(
          true,
        );
      else
        expect(
          samples.some(
            (sample) =>
              sample.phase === 'flying' &&
              sample.animations.some(
                (animation) =>
                  animation.duration === 600 && animation.displaced,
              ),
          ),
        ).toBe(true);
      await expect(page.locator('html')).not.toHaveAttribute(
        'data-home-opening',
      );
      const github = page.locator('.source-link > svg');
      const homeIcon = (await github.boundingBox())!;
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
      if (reducedMotion === 'reduce')
        expect(
          forward.animations.every((animation) => !animation.displaced),
        ).toBe(true);
      const guideIcon = (await github.boundingBox())!;
      await page.locator('#reading-back').click();
      await expect
        .poll(() =>
          samples.some((sample) => sample.path === '/' && sample.transition),
        )
        .toBe(true);
      const back = samples.findLast(
        (sample) => sample.path === '/' && sample.transition,
      )!;
      for (const [sample, start, end] of [
        [forward, homeIcon, guideIcon],
        [back, guideIcon, homeIcon],
      ] as const) {
        expect([sample.logo, sample.name, sample.github]).toEqual(
          reducedMotion === 'reduce'
            ? ['none', 'none', 'none']
            : ['website-logo', 'website-name', 'website-github'],
        );
        expect(
          sample.animations.some(
            (animation) =>
              animation.name.endsWith('website-github') &&
              animation.duration === 480 &&
              animation.displaced,
          ),
        ).toBe(reducedMotion === 'no-preference');
        if (reducedMotion === 'reduce') expect(sample.githubPath).toEqual([]);
        else
          for (const axis of ['x', 'y'] as const) {
            // 转场快照取整到像素，布局坐标可以落在半像素处。
            expect(
              Math.abs(sample.githubPath[0][axis] - start[axis]),
            ).toBeLessThanOrEqual(1);
            expect(
              Math.abs(sample.githubPath.at(-1)![axis] - end[axis]),
            ).toBeLessThanOrEqual(1);
          }
      }
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

test('Tab 按从上到下的顺序经过首页链接，反向也能返回', async ({ page }) => {
  await page.goto('/');
  const links = [
    'home-deploy',
    'home-listen',
    'home-source',
    'home-upgrade',
    'home-development',
  ];
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '跳到正文' })).toBeFocused();
  for (const id of links) {
    await page.keyboard.press('Tab');
    await expect(page.locator(`#${id}`)).toBeFocused();
  }
  for (const id of links.slice(0, -1).reverse()) {
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator(`#${id}`)).toBeFocused();
  }
});
