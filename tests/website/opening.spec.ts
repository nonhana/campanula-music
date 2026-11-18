import { expect, test } from './fixture.ts';

test('主脚本未到时第一帧只有中心花；脚本失败后正文自行恢复', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route('**/_astro/*.js', (route) => route.abort());
  await page.goto('/', { waitUntil: 'commit' });
  const flower = page.locator('#home-opening svg');
  await expect(flower).toBeVisible();
  const rect = await flower.boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.abs(rect!.x + rect!.width / 2 - viewport.width / 2)).toBeLessThan(
    2,
  );
  expect(
    Math.abs(rect!.y + rect!.height / 2 - viewport.height / 2),
  ).toBeLessThan(2);
  await expect(page.locator('#main')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('#main')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#home-deploy')).toBeVisible();
  await expect(page.locator('#home-source')).toBeVisible();
});

test('小花先在中心旋转，再沿弧线归位，文案与链接按距离展开', async ({
  page,
  context,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await context.addInitScript(() => {
    new MutationObserver(() => {
      const stage = document.documentElement.dataset.homeOpening;
      if (stage === 'loading') performance.mark('center-spin-start');
      if (stage === 'flying')
        performance.measure('center-spin', 'center-spin-start');
      if (stage === 'flying' || stage === 'spreading')
        for (const animation of document.getAnimations()) animation.pause();
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-home-opening'],
    });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute(
    'data-home-opening',
    'flying',
  );
  const flight = page.locator('body > svg');
  await flight.evaluate((element) => {
    for (const animation of element.getAnimations({ subtree: true }))
      animation.currentTime = 0;
  });
  const start = (await flight.boundingBox())!;
  const end = (await page.locator('.home-brand svg').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.abs(start.x + start.width / 2 - viewport.width / 2)).toBeLessThan(
    2,
  );
  expect(
    Math.abs(start.y + start.height / 2 - viewport.height / 2),
  ).toBeLessThan(2);
  await expect(page.locator('.home-copy')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('.more-guides')).toHaveCSS('visibility', 'hidden');
  const centered = await page.evaluate(
    () => performance.getEntriesByName('center-spin')[0].duration,
  );
  expect(centered).toBeGreaterThanOrEqual(700);
  await page.screenshot({ path: info.outputPath('flight-start.png') });
  await flight.evaluate((element) => {
    // out-soft 在前段经过弧线中部，半程时间时已经接近落点。
    for (const animation of element.getAnimations({ subtree: true }))
      animation.currentTime = 90;
  });
  const middle = (await flight.boundingBox())!;
  expect(Math.hypot(middle.x - start.x, middle.y - start.y)).toBeGreaterThan(
    10,
  );
  expect(Math.hypot(middle.x - end.x, middle.y - end.y)).toBeGreaterThan(1);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distanceFromLine =
    Math.abs(dx * (middle.y - start.y) - dy * (middle.x - start.x)) /
    Math.hypot(dx, dy);
  expect(distanceFromLine).toBeGreaterThan(1);
  await page.screenshot({ path: info.outputPath('flight-middle.png') });
  await flight.evaluate((element) => {
    for (const animation of element.getAnimations({ subtree: true }))
      animation.currentTime = 599.99;
  });
  const landed = (await flight.boundingBox())!;
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(landed[key]).toBeCloseTo(end[key], 0);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.play();
  });
  await expect(page.locator('html')).toHaveAttribute(
    'data-home-opening',
    'spreading',
  );
  const waves = await page.evaluate(() =>
    document
      .querySelector('#main')!
      .getAnimations({ subtree: true })
      .map((animation) => {
        const effect = animation.effect as KeyframeEffect;
        const target = effect.target as HTMLElement;
        const { delay, duration } = effect.getTiming();
        return {
          target: target.id || target.className,
          delay: Number(delay),
          duration: Number(duration),
        };
      }),
  );
  expect(waves.length).toBeGreaterThanOrEqual(6);
  expect(new Set(waves.map((wave) => wave.delay)).size).toBeGreaterThanOrEqual(
    5,
  );
  expect(waves.every((wave) => wave.duration === 360)).toBe(true);
  const delay = (target: string) =>
    waves.find((wave) => wave.target === target)!.delay;
  expect(delay('identity')).toBeLessThan(delay('home-deploy'));
  expect(delay('home-deploy')).toBeLessThan(delay('home-upgrade'));
  await page.screenshot({ path: info.outputPath('ripple-start.png') });
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.play();
  });
  await expect(page.locator('html')).not.toHaveAttribute('data-home-opening');
  await expect(flight).toHaveCount(0);
  await expect(page.locator('#home-source')).toBeVisible();
  await info.attach('opening-stages', {
    body: JSON.stringify({ centered, start, middle, end, landed, waves }),
    contentType: 'application/json',
  });
});

test('开场时按 Tab 可以直接使用文档，首页不请求示例和媒体', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const demoRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/demo\/|\.mp3(?:\?|$)/.test(request.url()))
      demoRequests.push(request.url());
  });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#home-opening svg')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '跳到正文' })).toBeFocused();
  await expect(page.locator('html')).not.toHaveAttribute('data-home-opening');
  await page.keyboard.press('Tab');
  await expect(page.locator('#home-deploy')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/guide\/$/);
  expect(demoRequests).toEqual([]);
});
