import { expect, test } from '../fixture.ts';

test('扫码等待、手机确认、成功进入曲库', async ({ page, scan }) => {
  await page.request.post('/api/mock/scenario', {
    data: { name: 'qr-confirm' },
  });
  await page.goto('/');
  await page.getByRole('tab', { name: /扫码/ }).click();
  await expect(page.getByText('等待扫码', { exact: true })).toBeAttached();
  await scan('login-qr-waiting');
  await expect(page.getByText('在手机上确认', { exact: true })).toBeVisible();
  await scan('login-qr-scanned');
  await expect(
    page.getByRole('heading', { name: '用网易云账号登录' }),
  ).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
});

test('过期二维码可刷新，短信发送失败可重试', async ({ page, scan }) => {
  await page.request.post('/api/mock/scenario', {
    data: { name: 'qr-expired' },
  });
  await page.goto('/');
  await page.getByRole('tab', { name: /扫码/ }).click();
  await expect(page.getByText('二维码已过期', { exact: true })).toBeVisible();
  await scan('login-qr-expired');
  await page.getByRole('button', { name: '刷新二维码' }).click();
  await expect(page.getByText('等待扫码', { exact: true })).toBeAttached();
  await page.getByRole('tab', { name: '短信验证码' }).click();
  await page.getByRole('textbox', { name: '手机号' }).fill('13800000000');
  await page.route('**/api/login/captcha', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { kind: 'neteaseUnavailable' } },
    }),
  );
  await page.getByRole('button', { name: '获取验证码' }).click();
  await expect(page.getByRole('alert')).toContainText('验证码没发出去');
  await scan('login-sms-failed');
  await page.unroute('**/api/login/captcha');
  await page.getByRole('button', { name: /重新获取|获取验证码/ }).click();
  await expect(page.getByRole('textbox', { name: '验证码' })).toBeFocused();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
