import { describe, expect, it } from 'vitest';

import { credentialsFrom } from '#lib/server/netease/cookies.ts';
import { NeteaseError } from '#lib/server/netease/failure.ts';

describe('credentialsFrom', () => {
  it('合并有效 Set-Cookie 并保留基础凭据', () => {
    const result = credentialsFrom(
      'login_qr_check',
      [
        'MUSIC_U=token=with=equals; Max-Age=3600; Path=/; HttpOnly',
        '__csrf=abc123; Path=/',
      ],
      { MUSIC_U: 'old', NMTID: 'keep' },
    );

    expect(result).toEqual({
      MUSIC_U: 'token=with=equals',
      NMTID: 'keep',
      __csrf: 'abc123',
    });
  });

  it('空值、Max-Age<=0 或已过期 Expires 删除旧键，且 Max-Age 优先于 Expires', () => {
    const result = credentialsFrom(
      'login_refresh',
      [
        'MUSIC_U=fresh; Max-Age=60; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'EMPTY=; Path=/',
        'ZERO=1; Max-Age=0; Expires=Fri, 01 Jan 2099 00:00:00 GMT',
        'NEG=1; Max-Age=-5; Expires=Fri, 01 Jan 2099 00:00:00 GMT',
        'PAST=1; Max-Age=not-a-number; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'FUTURE=ok; Max-Age=invalid; Expires=Fri, 01 Jan 2099 00:00:00 GMT',
        'malformed-no-equals',
        '=missing-name',
      ],
      {
        MUSIC_U: 'old',
        EMPTY: 'was-set',
        ZERO: 'was-set',
        NEG: 'was-set',
        PAST: 'was-set',
      },
    );

    expect(result).toEqual({
      MUSIC_U: 'fresh',
      FUTURE: 'ok',
    });
  });

  it('缺少或未更新 MUSIC_U 时抛出契约异常', () => {
    expect(() => credentialsFrom('login_refresh', ['__csrf=1'])).toThrow(
      NeteaseError,
    );
    expect(() =>
      credentialsFrom('login_refresh', ['MUSIC_U=same'], { MUSIC_U: 'same' }),
    ).toThrow(NeteaseError);
  });
});
