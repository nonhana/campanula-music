import type { App } from '#lib/app/app.js';

import type { World } from './world';

export const MUSIC_U = `00B4F1${'9C2E7A1D5F'.repeat(32)}`;

export const RECORDED_ACCOUNT = {
  id: 10000001,
  nickname: '测试听众',
  avatarUrl: 'https://p1.music.126.net/placeholder/avatar.jpg',
};

export const ANOTHER_ACCOUNT = {
  ...RECORDED_ACCOUNT,
  id: 10000002,
  nickname: '另一位听众',
};

export const LIBRARY_SYNC_MODULES: ReadonlySet<string> = new Set([
  'likelist',
  'user_playlist',
  'album_sublist',
  'artist_sublist',
  'playlist_detail',
  'song_detail',
]);

const expires = (days: number): string =>
  `Max-Age=${days * 86400}; Expires=${new Date(Date.now() + days * 86400_000).toUTCString()}`;

export const signInCookies = (): string[] => {
  const logPaths = [
    '/api/clientlog',
    '/eapi/clientlog',
    '/neapi/clientlog',
    '/openapi/clientlog',
    '/weapi/clientlog',
    '/wapi/clientlog',
    '/api/feedback',
    '/eapi/feedback',
    '/neapi/feedback',
    '/openapi/feedback',
    '/weapi/feedback',
    '/wapi/feedback',
  ];
  return [
    `MUSIC_U=${MUSIC_U}; ${expires(180)}; Path=/; HTTPOnly`,
    `__csrf=6f1d0c9b8a7e6d5c4b3a29180f1e2d3c; ${expires(15)}; Path=/`,
    `NMTID=00OAbCdEfGhIjKlMnOpQrStUvWxYz0123456789; ${expires(3650)}; Path=/`,
    `__remember_me=true; ${expires(180)}; Path=/; HTTPOnly`,
    ...logPaths.flatMap((path) => [
      `MUSIC_R_T=1572000000000; ${expires(400)}; Path=${path}; HTTPOnly`,
      `MUSIC_A_T=1572000000123; ${expires(400)}; Path=${path}; HTTPOnly`,
    ]),
  ];
};

export const RENEWED_MUSIC_U = `00C7A2${'5E1B8D3F6A'.repeat(32)}`;

export const renewCookies = (): string[] => [
  `MUSIC_U=${RENEWED_MUSIC_U}; ${expires(180)}; Path=/; HTTPOnly`,
  `__csrf=0a1b2c3d4e5f60718293a4b5c6d7e8f9; ${expires(15)}; Path=/`,
];

export const signIn = async (
  world: World,
  app: App,
  { another = false } = {},
): Promise<void> => {
  await world.netease.reply('login/captcha_sent.json');
  await app.sendCaptcha('13800138000');
  await world.netease.reply(
    another
      ? 'login/login_cellphone.200.another-account.constructed.json'
      : 'login/login_cellphone.200.json',
    {
      cookie: signInCookies(),
    },
  );
  await app.loginWithCaptcha('13800138000', '2468');
  if (app.state.session.status !== 'signedIn')
    throw new Error(`没登录上：${JSON.stringify(app.state)}`);
};
