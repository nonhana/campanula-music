import { describe, expect, it } from 'vitest';

import { useWorld } from './harness/world';

const world = useWorld({
  env: {
    COOKIE_SECRET: '',
  },
});

describe('站长没配加密密钥', () => {
  it('打开 App 停在需要配置密钥，只问了服务端一次账号', async () => {
    const device = world.device();

    const { app } = await device.open();

    expect(app.state.session).toEqual({
      status: 'checkFailed',
      failure: { kind: 'cookieSecretMissing' },
    });
    expect(device.requests).toEqual([{ method: 'GET', path: '/api/account' }]);
  });
});
