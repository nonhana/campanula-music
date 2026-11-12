import { describe, expect, it } from 'vitest';

import type { App } from '#lib/app/app.js';

import { held, never } from './harness/hold';
import { current, DAILY, listener } from './harness/listener';
import {
  RECORDED_ACCOUNT as ACCOUNT,
  ANOTHER_ACCOUNT,
  MUSIC_U,
  renewCookies,
  RENEWED_MUSIC_U,
  signIn,
  signInCookies,
} from './harness/sign-in';
import { useWorld } from './harness/world';

const world = useWorld();
const { sessionCalls, sessionModules } = listener(world);

const PHONE = '13800138000';
const CAPTCHA = '2468';

const dailyIdentity = async (app: App) => {
  await world.netease.reply(DAILY);
  await app.openDaily();
  const sent = world.netease.calls.findLast(
    (call) => call.module === 'recommend_songs',
  );
  expect(sent).toBeDefined();
  const credentials = sent!.config.cookie as Record<string, string>;
  return credentials.MUSIC_U === MUSIC_U
    ? '短信账号'
    : credentials.MUSIC_U === RENEWED_MUSIC_U
      ? '扫码账号'
      : '未知';
};

describe('短信验证码登录', () => {
  it('发验证码，填验证码登录，显示账号的头像和昵称', async () => {
    const device = world.device();
    const { app } = await device.open();

    await world.netease.reply('login/captcha_sent.json');
    await app.sendCaptcha(PHONE);

    expect(app.state.login.sms.captcha).toEqual({
      status: 'sent',
      resendAt: Date.now() + 60_000,
    });

    await world.netease.reply('login/login_cellphone.200.json', {
      cookie: signInCookies(),
    });
    await app.loginWithCaptcha(PHONE, CAPTCHA);

    expect(app.state.session).toEqual({ status: 'signedIn', account: ACCOUNT });
    expect(
      sessionCalls().map(({ module, query }) => ({ module, query })),
    ).toEqual([
      {
        module: 'captcha_sent',
        query: { phone: PHONE, ctcode: 86 },
      },
      {
        module: 'login_cellphone',
        query: { phone: PHONE, captcha: CAPTCHA, countrycode: 86 },
      },
    ]);
  });

  it('网易云因为风控拒绝登录：原样说明，仍是未登录，重新打开也不是已登录', async () => {
    const device = world.device();
    const { app } = await device.open();
    await world.netease.reply('login/captcha_sent.json');
    await app.sendCaptcha(PHONE);

    await world.netease.reply('login/login_cellphone.10004-risk.json');
    await app.loginWithCaptcha(PHONE, CAPTCHA);

    expect(app.state.session).toEqual({ status: 'signedOut' });
    expect(app.state.login.sms.submit).toEqual({
      status: 'failed',
      failure: {
        kind: 'rejected',
        code: 10004,
        message: '当前登录存在安全风险，请稍后再试',
      },
    });
    const { app: reopened } = await device.open();
    expect(reopened.state.session).toEqual({ status: 'signedOut' });
    expect(sessionCalls().map((call) => call.module)).toEqual([
      'captcha_sent',
      'login_cellphone',
    ]);
  });

  it('匿名注册失败、验证码没发出去：说明是网易云暂时没回应，重试就发出去了', async () => {
    const { app } = await world.device().open();

    await world.netease.reply(
      'login/captcha_sent.502-anonymous-registration.json',
    );
    await app.sendCaptcha(PHONE);

    expect(app.state.login.sms.captcha).toEqual({
      status: 'failed',
      failure: { kind: 'neteaseUnavailable' },
    });

    await world.netease.reply('login/captcha_sent.json');
    await app.sendCaptcha(PHONE);

    expect(app.state.login.sms.captcha).toEqual({
      status: 'sent',
      resendAt: Date.now() + 60_000,
    });
  });

  it.each(['短信提交', '验证码发送'])(
    '%s没返回时切扫码，再切回来可以重新操作',
    async (method) => {
      const device = world.device();
      const { app } = await device.open();
      const old = held();
      await world.netease.reply(
        method === '短信提交'
          ? 'login/login_cellphone.200.json'
          : 'login/captcha_sent.json',
        {
          cookie: method === '短信提交' ? signInCookies() : [],
          until: old.until,
        },
      );
      const sending =
        method === '短信提交'
          ? app.loginWithCaptcha(PHONE, CAPTCHA)
          : app.sendCaptcha(PHONE);
      await world.settle();
      await world.netease.reply('login/logout.json');
      await world.netease.reply('login/login_qr_key.json');
      await world.netease.reply('login/login_qr_create.json');
      const starting = app.startQrLogin();
      old.release();
      await sending;
      await starting;
      app.stopQrLogin();

      expect(app.state.session).toEqual({ status: 'signedOut' });
      expect(app.state.login.sms.submit).toEqual({ status: 'idle' });
      expect(app.state.login.sms.captcha).toEqual({ status: 'idle' });
      expect((await device.open()).app.state.session).toEqual({
        status: 'signedOut',
      });
      await world.netease.reply('login/captcha_sent.json');
      await app.sendCaptcha(PHONE);
      await world.netease.reply('login/login_cellphone.200.json', {
        cookie: signInCookies(),
      });
      await app.loginWithCaptcha(PHONE, CAPTCHA);
      expect(app.state.session).toEqual({
        status: 'signedIn',
        account: ACCOUNT,
      });
    },
  );

  it('离线退出后重登：失败时不发新登录，恢复网络后等补发退出完成再登录', async () => {
    const device = world.device();
    const { app } = await device.open();
    await signIn(world, app);
    device.setOnline(false);
    await app.logout();
    await app.loginWithCaptcha(PHONE, CAPTCHA);
    expect(app.state.session).toEqual({ status: 'signedOut' });
    expect(app.state.login.sms.submit).toEqual({
      status: 'failed',
      failure: { kind: 'offline' },
    });
    expect(
      sessionModules().filter((module) => module === 'login_cellphone'),
    ).toHaveLength(1);

    const clearing = held();
    await world.netease.reply('login/logout.json', { until: clearing.until });
    device.setOnline(true);
    await world.netease.reply(
      'login/login_cellphone.200.another-account.constructed.json',
      { cookie: signInCookies() },
    );
    const signingIn = app.loginWithCaptcha(PHONE, CAPTCHA);
    await world.settle();
    expect(sessionModules().at(-1)).toBe('logout');
    expect(
      sessionModules().filter((module) => module === 'login_cellphone'),
    ).toHaveLength(1);
    clearing.release();
    await signingIn;
    expect(app.state.session).toEqual({
      status: 'signedIn',
      account: ANOTHER_ACCOUNT,
    });
    expect(await dailyIdentity(app)).toBe('短信账号');
  });
});

describe('扫码登录', () => {
  const KEY = 'f124a8be-db3f-42f9-a236-30cc4130ed2c';

  const showQr = async () => {
    const device = world.device();
    const { app } = await device.open();
    await world.netease.reply('login/login_qr_key.json');
    await world.netease.reply('login/login_qr_create.json');
    await app.startQrLogin();
    const qr = app.state.login.qr;
    if (qr?.step !== 'waiting')
      throw new Error(`没显示出二维码：${JSON.stringify(qr)}`);
    return { device, app, image: qr.image };
  };

  it('成功响应已接纳：先离开登录页再恢复队列，表单卸载停轮询不撤销登录', async () => {
    const device = world.device();
    const tab = await listener(world).signInWithLiked(device);
    await world.netease.reply('playback/liked/001-song_url_v1.json.gz');
    tab.app.play({ kind: 'playlist', id: 900000001 }, 3433267939);
    await world.settle();
    tab.close();
    await world.netease.reply('login/user_account.invalid.json');
    await world.netease.reply('login/login_refresh.301-invalid.json');
    const { app } = await device.open();
    expect(app.state.session).toEqual({ status: 'loginExpired' });
    expect(app.state.player.current).toBeNull();
    await world.netease.reply('login/login_qr_key.json');
    await world.netease.reply('login/login_qr_create.json');
    await app.startQrLogin();
    let restored = false;
    const unsubscribe = app.subscribe(() => {
      if (!restored && app.state.player.current !== null) {
        restored = true;
        expect(app.state.session).toEqual({ status: 'checking' });
        app.stopQrLogin();
      }
    });
    await world.netease.reply('login/login_qr_check.803-success.json', {
      cookie: renewCookies(),
    });
    await world.netease.reply('login/user_account.vip.json');
    await world.netease.reply('library/likelist.json', { until: never() });
    await world.clock.advance(2000);
    unsubscribe();

    expect(restored).toBe(true);
    expect(app.state.session).toEqual({ status: 'signedIn', account: ACCOUNT });
    expect(current(app)).toBe(3433267939);
    expect(sessionModules()).not.toContain('logout');
    expect((await device.cookies()).map((cookie) => cookie.key)).toEqual([
      'campanula_login',
    ]);
  });

  it('等待扫码 → 已扫码（显示扫码的账号）→ 在手机上确认后登录，之后不再查', async () => {
    const { app, image } = await showQr();

    expect(image).toMatch(/^data:image\/png;base64,/);

    await world.netease.reply('login/login_qr_check.801-waiting.json');
    await world.clock.advance(2000);
    expect(app.state.login.qr).toEqual({ step: 'waiting', image });

    await world.netease.reply('login/login_qr_check.802-scanned.json');
    await world.clock.advance(2000);
    expect(app.state.login.qr).toEqual({
      step: 'scanned',
      image,
      nickname: ACCOUNT.nickname,
      avatarUrl: ACCOUNT.avatarUrl,
    });

    await world.netease.reply('login/login_qr_check.803-success.json', {
      cookie: signInCookies(),
    });
    await world.netease.reply('login/user_account.vip.json');
    await world.clock.advance(2000);
    expect(app.state.session).toEqual({ status: 'signedIn', account: ACCOUNT });
    expect(app.state.login.qr).toBeNull();

    await world.clock.advance(10_000);
    expect(sessionModules()).toEqual([
      'login_qr_key',
      'login_qr_create',
      'login_qr_check',
      'login_qr_check',
      'login_qr_check',
      'user_account',
    ]);
    expect(
      world.netease.calls
        .filter((call) => call.module === 'login_qr_check')
        .map((call) => call.query),
    ).toEqual([{ key: KEY }, { key: KEY }, { key: KEY }]);
  });

  it('二维码过期：停在“已过期”不再查，刷新后换一张新的接着查', async () => {
    const { app, image } = await showQr();

    await world.netease.reply('login/login_qr_check.800-expired.json');
    await world.clock.advance(2000);
    expect(app.state.login.qr).toEqual({ step: 'expired', image });

    await world.clock.advance(10_000);
    expect(sessionModules()).toEqual([
      'login_qr_key',
      'login_qr_create',
      'login_qr_check',
    ]);

    await world.netease.reply('login/login_qr_key.json');
    await world.netease.reply('login/login_qr_create.json');
    await app.startQrLogin();
    expect(app.state.login.qr).toEqual({ step: 'waiting', image });

    await world.netease.reply('login/login_qr_check.801-waiting.json');
    await world.clock.advance(2000);
    expect(sessionModules()).toEqual([
      'login_qr_key',
      'login_qr_create',
      'login_qr_check',
      'login_qr_key',
      'login_qr_create',
      'login_qr_check',
    ]);
  });

  it('换成短信验证码后不再查扫码状态', async () => {
    const { app } = await showQr();

    app.stopQrLogin();
    await world.clock.advance(10_000);

    expect(app.state.login.qr).toBeNull();
    expect(sessionModules()).toEqual(['login_qr_key', 'login_qr_create']);
  });

  it.each(['轮询', '行为验证后继续'])(
    '旧扫码响应晚到（%s）：页面和下一次每日推荐都使用短信账号',
    async (from) => {
      const { app } = await showQr();
      if (from === '行为验证后继续') {
        await world.netease.reply(
          'login/login_qr_check.8821-verify.constructed.json',
        );
        await world.netease.reply('login/verify_getQr.constructed.json');
        await world.clock.advance(2000);
        expect(app.state.login.qr).toMatchObject({ step: 'verifying' });
      }
      const accepted: number[] = [];
      const unsubscribe = app.subscribe(() => {
        if (app.state.session.status === 'signedIn')
          accepted.push(app.state.session.account.id);
      });
      const old = held();
      await world.netease.reply('login/login_qr_check.803-success.json', {
        cookie: renewCookies(),
        until: old.until,
      });
      await world.netease.reply('login/user_account.vip.json');
      const continuing =
        from === '行为验证后继续' ? app.continueQrLogin() : undefined;
      if (continuing) await world.settle();
      else await world.clock.advance(2000);
      app.stopQrLogin();

      const clearing = held();
      await world.netease.reply('login/logout.json', { until: clearing.until });
      await world.netease.reply('library/likelist.json', { until: never() });
      await world.netease.reply(
        'login/login_cellphone.200.another-account.constructed.json',
        { cookie: signInCookies() },
      );
      const sms = app.loginWithCaptcha(PHONE, CAPTCHA);
      await world.settle();
      expect(sessionModules()).not.toContain('login_cellphone');
      old.release();
      await world.settle();
      expect(app.state.session).toEqual({ status: 'signedOut' });
      expect(sessionModules().at(-1)).toBe('logout');
      expect(sessionModules()).not.toContain('login_cellphone');
      clearing.release();
      await sms;
      await continuing;
      await world.settle();

      expect(app.state.session).toEqual({
        status: 'signedIn',
        account: ANOTHER_ACCOUNT,
      });
      expect(accepted).not.toContain(ACCOUNT.id);
      expect(await dailyIdentity(app)).toBe('短信账号');
      unsubscribe();
    },
  );

  it('取消已发出的扫码：清理完成后排队的账号检查和重开都保持未登录', async () => {
    const { device, app } = await showQr();
    const old = held();
    await world.netease.reply('login/login_qr_check.803-success.json', {
      cookie: renewCookies(),
      until: old.until,
    });
    await world.netease.reply('login/user_account.vip.json');
    await world.clock.advance(2000);
    app.stopQrLogin();
    const requests = device.requests.length;
    const opening = device.open();
    await world.settle();
    expect(device.requests).toHaveLength(requests);

    await world.netease.reply('login/logout.json');
    old.release();
    const other = await opening;
    await world.settle();
    expect(app.state.session).toEqual({ status: 'signedOut' });
    expect(other.app.state.session).toEqual({ status: 'signedOut' });
    expect(await device.cookies()).toEqual([]);
    const reopened = await device.open();
    expect(reopened.app.state.session).toEqual({ status: 'signedOut' });
  });

  it('取消旧扫码后另一标签页登录：清理先完成，新账号在推荐和重开时都保留', async () => {
    const { device, app } = await showQr();
    const { app: other } = await device.open();
    const old = held();
    await world.netease.reply('login/login_qr_check.803-success.json', {
      cookie: renewCookies(),
      until: old.until,
    });
    await world.netease.reply('login/user_account.vip.json');
    await world.clock.advance(2000);
    app.stopQrLogin();

    await world.netease.reply('login/logout.json');
    await world.netease.reply('library/likelist.json', { until: never() });
    await world.netease.reply(
      'login/login_cellphone.200.another-account.constructed.json',
      {
        cookie: signInCookies(),
      },
    );
    const signingIn = other.loginWithCaptcha(PHONE, CAPTCHA);
    await world.settle();
    expect(sessionModules()).not.toContain('login_cellphone');
    old.release();
    await signingIn;
    expect(app.state.session).toEqual({ status: 'signedOut' });
    expect(other.state.session).toEqual({
      status: 'signedIn',
      account: ANOTHER_ACCOUNT,
    });
    expect(sessionModules().indexOf('logout')).toBeLessThan(
      sessionModules().indexOf('login_cellphone'),
    );
    expect(await dailyIdentity(other)).toBe('短信账号');

    await world.netease.reply(
      'login/user_account.another-account.constructed.json',
    );
    const reopened = await device.open();
    expect(reopened.app.state.session).toEqual({
      status: 'signedIn',
      account: ANOTHER_ACCOUNT,
    });
    expect(await dailyIdentity(reopened.app)).toBe('短信账号');
  });

  it('扫码查询还在等另一页的登录，取消后排到也不再发送，不清掉另一页的新账号', async () => {
    const { device, app } = await showQr();
    const { app: other } = await device.open();
    const signingIn = held();
    await world.netease.reply(
      'login/login_cellphone.200.another-account.constructed.json',
      {
        cookie: signInCookies(),
        until: signingIn.until,
      },
    );
    await world.netease.reply('library/likelist.json', { until: never() });
    const sms = other.loginWithCaptcha(PHONE, CAPTCHA);
    await world.settle();
    await world.clock.advance(2000);
    app.stopQrLogin();
    signingIn.release();
    await sms;
    await world.settle();

    expect(sessionModules()).not.toContain('login_qr_check');
    expect(sessionModules()).not.toContain('logout');
    expect(other.state.session).toEqual({
      status: 'signedIn',
      account: ANOTHER_ACCOUNT,
    });
    expect(await dailyIdentity(other)).toBe('短信账号');
  });

  it.each(['扫码', '短信'])(
    '另一标签页退出后才收到旧%s成功响应：不恢复登录',
    async (method) => {
      const { device, app } = await showQr();
      const { app: other } = await device.open();
      const old = held();
      let signingIn: Promise<void> | undefined;
      if (method === '扫码') {
        await world.netease.reply('login/login_qr_check.803-success.json', {
          cookie: renewCookies(),
          until: old.until,
        });
        await world.netease.reply('login/user_account.vip.json');
        await world.clock.advance(2000);
      } else {
        app.stopQrLogin();
        await world.netease.reply('login/login_cellphone.200.json', {
          cookie: signInCookies(),
          until: old.until,
        });
        signingIn = app.loginWithCaptcha(PHONE, CAPTCHA);
        await world.settle();
      }
      await world.netease.reply('login/logout.json');
      const loggingOut = other.logout();
      await world.settle();
      expect(app.state.session).toEqual({ status: 'signedOut' });
      old.release();
      await signingIn;
      await loggingOut;
      await world.settle();

      expect(app.state.session).toEqual({ status: 'signedOut' });
      expect(other.state.session).toEqual({ status: 'signedOut' });
      expect(await device.cookies()).toEqual([]);
      expect((await device.open()).app.state.session).toEqual({
        status: 'signedOut',
      });
    },
  );

  it('另一页排队的短信登录在退出后作废：排到也不发送', async () => {
    const { device, app } = await showQr();
    const { app: other } = await device.open();
    const old = held();
    await world.netease.reply('login/login_qr_check.803-success.json', {
      cookie: renewCookies(),
      until: old.until,
    });
    await world.netease.reply('login/user_account.vip.json');
    await world.clock.advance(2000);
    await world.netease.reply(
      'login/login_cellphone.200.another-account.constructed.json',
      { cookie: signInCookies() },
    );
    const signingIn = other.loginWithCaptcha(PHONE, CAPTCHA);
    await world.settle();
    await world.netease.reply('login/logout.json');
    const loggingOut = app.logout();
    await world.settle();
    old.release();
    await loggingOut;
    await signingIn;
    await world.settle();

    expect(sessionModules()).not.toContain('login_cellphone');
    expect(other.state.session).toEqual({ status: 'signedOut' });
    expect(await device.cookies()).toEqual([]);
  });

  it('取消的成功响应在离线时到达：重开不恢复旧账号，联网清理后可以重新登录', async () => {
    const { device, app } = await showQr();
    const old = held();
    await world.netease.reply('login/login_qr_check.803-success.json', {
      cookie: renewCookies(),
      until: old.until,
    });
    await world.netease.reply('login/user_account.vip.json');
    await world.clock.advance(2000);
    app.stopQrLogin();
    device.setOnline(false);
    old.release();
    await world.settle();
    expect((await device.cookies()).map((cookie) => cookie.key)).toEqual([
      'campanula_login',
    ]);
    expect((await device.open()).app.state.session).toEqual({
      status: 'signedOut',
    });

    await world.netease.reply('login/logout.json');
    device.setOnline(true);
    await world.settle();
    expect(await device.cookies()).toEqual([]);
    await signIn(world, app, { another: true });
    expect(app.state.session).toEqual({
      status: 'signedIn',
      account: ANOTHER_ACCOUNT,
    });
    expect(await dailyIdentity(app)).toBe('短信账号');
  });

  it('两次轮询之间另一页能检查账号并退出，不被扫码一直占住', async () => {
    const { device, app } = await showQr();
    await world.netease.reply('login/login_qr_check.801-waiting.json');
    await world.clock.advance(2000);
    const { app: other } = await device.open();
    expect(other.state.session).toEqual({ status: 'signedOut' });
    expect(device.requests.at(-1)?.path).toBe('/api/account');
    await other.logout();
    await world.settle();
    await world.clock.advance(10_000);
    expect(app.state.login.qr).toBeNull();
    expect(
      sessionModules().filter((module) => module === 'login_qr_check'),
    ).toHaveLength(1);
  });

  it('取消清理断网失败，排队的账号检查前刚恢复网络：先清理旧登录，不接受旧 Cookie', async () => {
    const { device, app } = await showQr();
    const { app: other } = await device.open();
    const old = held();
    await world.netease.reply('login/login_qr_check.803-success.json', {
      cookie: renewCookies(),
      until: old.until,
    });
    await world.netease.reply('login/user_account.vip.json');
    await world.clock.advance(2000);
    app.stopQrLogin();
    const unsubscribe = other.subscribe(() => {
      const captcha = other.state.login.sms.captcha;
      if (captcha.status === 'failed' && captcha.failure.kind === 'offline')
        device.setOnline(true);
    });
    const sending = other.sendCaptcha(PHONE);
    const opening = device.open();
    await world.settle();
    device.setOnline(false);
    await world.netease.reply('login/logout.json');
    await world.netease.reply('login/user_account.vip.json');
    old.release();
    await sending;
    const reopened = await opening;
    await world.settle();
    unsubscribe();

    expect(reopened.app.state.session).toEqual({ status: 'signedOut' });
    expect(await device.cookies()).toEqual([]);
  });

  it('页面在后台时不查扫码状态，回到前台接着查', async () => {
    const device = world.device();
    const tab = await device.open();
    await world.netease.reply('login/login_qr_key.json');
    await world.netease.reply('login/login_qr_create.json');
    await tab.app.startQrLogin();

    tab.hide();
    await world.clock.advance(10_000);
    expect(sessionModules()).toEqual(['login_qr_key', 'login_qr_create']);

    tab.show();
    await world.netease.reply('login/login_qr_check.802-scanned.json');
    await world.clock.advance(2000);
    expect(tab.app.state.login.qr).toMatchObject({ step: 'scanned' });
  });

  it('取二维码时断网：说明是断网，联网后重试就显示出来', async () => {
    const device = world.device();
    const { app } = await device.open();

    device.setOnline(false);
    await app.startQrLogin();
    expect(app.state.login.qr).toEqual({
      step: 'failed',
      failure: { kind: 'offline' },
    });

    device.setOnline(true);
    await world.netease.reply('login/login_qr_key.json');
    await world.netease.reply('login/login_qr_create.json');
    await app.startQrLogin();
    expect(app.state.login.qr).toMatchObject({ step: 'waiting' });
  });

  describe('网易云要求行为验证（8821）', () => {
    it('显示验证用的二维码、不再自动查；没验证完点继续，换一张并说明还没通过；验证完点继续就登录', async () => {
      const { app } = await showQr();

      await world.netease.reply(
        'login/login_qr_check.8821-verify.constructed.json',
      );
      await world.netease.reply('login/verify_getQr.constructed.json');
      await world.clock.advance(2000);

      const verifying = app.state.login.qr;
      expect(verifying).toEqual({
        step: 'verifying',
        image: expect.stringMatching(/^data:image\/png;base64,/),
        checking: false,
        unverified: false,
      });
      expect(sessionCalls().at(-1)).toMatchObject({
        module: 'verify_getQr',
        query: {
          vid: '61',
          type: 2,
          token: '00.verify-token.placeholder',
          evid: 'risk-event-placeholder',
          sign: 'risk-sign-placeholder',
        },
      });
      await world.clock.advance(10_000);
      expect(sessionModules()).toEqual([
        'login_qr_key',
        'login_qr_create',
        'login_qr_check',
        'verify_getQr',
      ]);

      await world.netease.reply(
        'login/login_qr_check.8821-verify.constructed.json',
      );
      await world.netease.reply('login/verify_getQr.constructed.json');
      await app.continueQrLogin();
      expect(app.state.login.qr).toEqual({ ...verifying, unverified: true });

      await world.netease.reply('login/login_qr_check.803-success.json', {
        cookie: signInCookies(),
      });
      await world.netease.reply('login/user_account.vip.json');
      await app.continueQrLogin();
      expect(app.state.session).toEqual({
        status: 'signedIn',
        account: ACCOUNT,
      });
      expect(
        world.netease.calls
          .filter((call) => call.module === 'login_qr_check')
          .map((call) => call.query),
      ).toEqual([{ key: KEY }, { key: KEY }, { key: KEY }]);
    });

    it('网易云没给验证的办法：原样说明网易云的拒绝，不再查', async () => {
      const { app } = await showQr();

      await world.netease.reply(
        'login/login_qr_check.8821-no-params.constructed.json',
      );
      await world.clock.advance(2000);

      expect(app.state.login.qr).toEqual({
        step: 'failed',
        failure: {
          kind: 'rejected',
          code: 8821,
          message: '需要行为验证码验证',
        },
      });
      await world.clock.advance(10_000);
      expect(sessionModules()).toEqual([
        'login_qr_key',
        'login_qr_create',
        'login_qr_check',
      ]);
    });
  });
});
