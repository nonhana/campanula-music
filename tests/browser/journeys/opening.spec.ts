import { expect, test } from '../fixture.ts';

test('本体从打开中飞到品牌，起点 40px 与落点 28px 的位置和尺寸连续', async ({
  page,
  context,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/account', async (route) => {
    await waiting;
    await route.continue();
  });
  await context.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const plane = document.querySelector<SVGSVGElement>('body > svg');
      if (!plane) return;
      for (const animation of plane.getAnimations()) animation.pause();
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.goto('/mock/login?next=/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-opening] svg')).toBeVisible();
  release();
  const flight = page.locator('body > svg');
  await expect(flight).toBeVisible();
  await flight.evaluate((element) => {
    for (const animation of element.getAnimations()) animation.currentTime = 0;
  });
  const start = (await flight.boundingBox())!;
  expect(start.width).toBeCloseTo(40, 0);
  const end = (await page.locator('[data-brand] svg').boundingBox())!;
  expect(end.width).toBeCloseTo(28, 0);
  // 首页开场切入那一帧内容必须已同步挂载并起跑波纹动画，不能留空等懒加载
  const rippleDelays = await page.locator('main').evaluate((main) =>
    main
      .getAnimations({ subtree: true })
      .map((animation) => Number(animation.effect?.getTiming().delay ?? 0))
      .filter((delay) => delay > 0),
  );
  expect(rippleDelays.length).toBeGreaterThan(0);
  await flight.evaluate((element) => {
    for (const animation of element.getAnimations())
      animation.currentTime = 600;
  });
  const landed = (await flight.boundingBox())!;
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(landed[key]).toBeCloseTo(end[key], 0);
  await info.attach('app-opening-geometry', {
    body: JSON.stringify({ start, end, landed }),
    contentType: 'application/json',
  });
  await flight.evaluate((element) => {
    for (const animation of element.getAnimations()) animation.play();
  });
  await expect(flight).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
});
