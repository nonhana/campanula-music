import type { App } from '#lib/app/app.js'

import type { World } from './world'

/** 假的网易云登录凭据（录制数据去掉了 Cookie） */
export const MUSIC_U = `00B4F1${'9C2E7A1D5F'.repeat(32)}`

/** 录下的账号（脱敏后的 uid、昵称和头像）：登录、问当前账号时界面上显示的 */
export const RECORDED_ACCOUNT = { id: 10000001, nickname: '测试听众', avatarUrl: 'https://p1.music.126.net/placeholder/avatar.jpg' }

/** 同一台设备上换的另一个网易云账号：录下的短信登录只换了 uid 和昵称（构造的数据，见 tests/fixtures/netease/README.md） */
export const ANOTHER_ACCOUNT = { ...RECORDED_ACCOUNT, id: 10000002, nickname: '另一位听众' }

/** 登录后 App 在后台同步曲库时调的网易云模块（tests/library.test.ts 专门测）：只看登录会话的测试把它们去掉 */
export const LIBRARY_SYNC_MODULES: ReadonlySet<string> = new Set([
  'likelist',
  'user_playlist',
  'album_sublist',
  'artist_sublist',
  'playlist_detail',
  'song_detail',
])

/** Set-Cookie 的有效期属性：Max-Age 和 Expires 都写，和网易云下发的一样 */
const expires = (days: number): string => `Max-Age=${days * 86400}; Expires=${new Date(Date.now() + days * 86400_000).toUTCString()}`

/**
 * 网易云登录成功时下发的 Set-Cookie：写法照真的（同名的按不同路径下发好几条，验证关卡①一次登录约 28 条），
 * 值是假的。只存名字和值时加密后约 2 KB；连属性一起存会超过浏览器 4 KB 的上限
 */
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
  ]
  return [
    `MUSIC_U=${MUSIC_U}; ${expires(180)}; Path=/; HTTPOnly`,
    `__csrf=6f1d0c9b8a7e6d5c4b3a29180f1e2d3c; ${expires(15)}; Path=/`,
    `NMTID=00OAbCdEfGhIjKlMnOpQrStUvWxYz0123456789; ${expires(3650)}; Path=/`,
    `__remember_me=true; ${expires(180)}; Path=/; HTTPOnly`,
    ...logPaths.flatMap(path => [
      `MUSIC_R_T=1572000000000; ${expires(400)}; Path=${path}; HTTPOnly`,
      `MUSIC_A_T=1572000000123; ${expires(400)}; Path=${path}; HTTPOnly`,
    ]),
  ]
}

/** 续期后网易云下发的新凭据（假的） */
export const RENEWED_MUSIC_U = `00C7A2${'5E1B8D3F6A'.repeat(32)}`

/** 续期时网易云下发的 Set-Cookie：新的 MUSIC_U（重新算 180 天）和新的 __csrf（验证关卡①），值是假的 */
export const renewCookies = (): string[] => [
  `MUSIC_U=${RENEWED_MUSIC_U}; ${expires(180)}; Path=/; HTTPOnly`,
  `__csrf=0a1b2c3d4e5f60718293a4b5c6d7e8f9; ${expires(15)}; Path=/`,
]

/** 用短信验证码登录这个标签页的 App（网易云回录制数据）；another：登录的是另一个账号 */
export const signIn = async (world: World, app: App, { another = false } = {}): Promise<void> => {
  await world.netease.reply('login/captcha_sent.json')
  await app.sendCaptcha('13800138000')
  await world.netease.reply(another ? 'login/login_cellphone.200.another-account.constructed.json' : 'login/login_cellphone.200.json', {
    cookie: signInCookies(),
  })
  await app.loginWithCaptcha('13800138000', '2468')
  if (app.state.session.status !== 'signedIn')
    throw new Error(`没登录上：${JSON.stringify(app.state)}`)
}
