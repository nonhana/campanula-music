import { controlled, expect, test } from './fixture.ts';

test('新外壳等待全部旧页关闭才激活，API 和外部媒体不进外壳缓存', async ({
  page,
  context,
  production,
}, info) => {
  await page.goto(production.baseURL);
  await controlled(page);
  const other = await context.newPage();
  await other.goto(production.baseURL);
  await controlled(other);
  await page.evaluate(() => {
    Object.assign(window, { oldDocument: 'still-here' });
    localStorage.setItem('delivery-local', 'kept');
  });
  const api = await page.evaluate(
    async (mediaURL) => ({
      get: (await fetch('/api/account')).status,
      post: (
        await fetch('/api/account', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
      ).status,
      failure: (await fetch('/api/delivery-not-present')).status,
      media: (await fetch(`${mediaURL}/external.wav`)).status,
    }),
    production.mediaURL,
  );
  expect(api).toEqual({ get: 200, post: 405, failure: 503, media: 200 });
  const accountRequests = production.requests.filter(
    (request) => request.path === '/api/account' && request.method === 'GET',
  );
  expect(accountRequests.length).toBeGreaterThan(0);
  expect(accountRequests.every((request) => request.status === 200)).toBe(true);
  expect(
    production.requests.findLast(
      (request) => request.path === '/api/delivery-not-present',
    )?.status,
  ).toBe(503);
  production.switchVersion();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          !!(await navigator.serviceWorker.getRegistration())?.waiting,
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => (window as Window & { oldDocument?: string }).oldDocument,
    ),
  ).toBe('still-here');
  const waiting = await controlled(page);
  const shellCaches = (
    caches: Awaited<ReturnType<typeof controlled>>['caches'],
  ) =>
    caches
      .map((cache) => cache.name)
      .filter((name) => name.startsWith('campanula-shell-'))
      .sort();
  expect(shellCaches(waiting.caches)).toEqual(
    [
      `campanula-shell-${production.version}`,
      `campanula-shell-${production.nextVersion}`,
    ].sort(),
  );
  expect(
    waiting.caches
      .filter((cache) => cache.name.startsWith('campanula-shell-'))
      .flatMap((cache) => cache.keys)
      .every((url) => !url.endsWith('.woff2')),
  ).toBe(true);
  expect(
    waiting.caches
      .filter((cache) => cache.name === 'campanula-fonts')
      .flatMap((cache) => cache.keys)
      .every((url) => url.endsWith('.woff2')),
  ).toBe(true);
  expect(
    waiting.caches
      .flatMap((cache) => cache.keys)
      .every(
        (url) => !url.includes('/api/') && !url.startsWith(production.mediaURL),
      ),
  ).toBe(true);
  await page.close();
  expect(
    await other.evaluate(
      async () => !!(await navigator.serviceWorker.getRegistration())?.waiting,
    ),
  ).toBe(true);
  await other.close();
  const next = await context.newPage();
  await next.goto(production.baseURL);
  await controlled(next);
  await expect
    .poll(async () => shellCaches((await controlled(next)).caches))
    .toEqual([`campanula-shell-${production.nextVersion}`]);
  expect(
    await next.evaluate(() => localStorage.getItem('delivery-local')),
  ).toBe('kept');
  await info.attach('waiting-and-active', {
    body: JSON.stringify({ waiting, active: await controlled(next), api }),
    contentType: 'application/json',
  });
  await next.screenshot({
    path: info.outputPath('activated.png'),
    fullPage: true,
  });
  await next.goto(`${production.baseURL}/design`);
  await expect(
    next.getByRole('heading', { name: '用网易云账号登录' }),
  ).toBeVisible();
  await expect(next.locator('[data-design-page]')).toHaveCount(0);
});

test('断网 API 导航也不能回退成缓存外壳', async ({
  page,
  context,
  production,
}) => {
  await page.goto(production.baseURL);
  await controlled(page);
  await context.setOffline(true);
  const apiPage = await context.newPage();
  const result = await apiPage.goto(`${production.baseURL}/api/account`).then(
    (response) => response?.status(),
    () => 'network-error',
  );
  expect(result).toBe('network-error');
});
