<script lang="ts">
  import '@fontsource-variable/noto-sans';

  import { page } from '$app/state';
  import type { Component, Snippet } from 'svelte';

  import type { Account } from '#lib/api/account.ts';
  import { createApp } from '#lib/app/app.ts';
  import { realBrowserCapabilities } from '#lib/app/browser.ts';
  import AppOpenFailed from '#lib/components/boot/AppOpenFailed.svelte';
  import AppOpening from '#lib/components/boot/AppOpening.svelte';
  import CookieSecretRequired from '#lib/components/boot/CookieSecretRequired.svelte';
  import HttpsRequired from '#lib/components/boot/HttpsRequired.svelte';
  import { arrival } from '#lib/components/boot/opening.ts';
  import {
    setAppView,
    viewOf,
  } from '#lib/components/shared/app-context.svelte.ts';
  import { loadScFont } from '#lib/components/shared/fonts.ts';
  import { ensureNeteaseImagePreconnect } from '#lib/components/shared/image-url.ts';
  import { desktopLayout } from '#lib/components/shared/layout.ts';
  import { DURATIONS } from '#lib/components/shared/motion-tokens.ts';
  import { fade, fadeAway } from '#lib/components/shared/motion.ts';
  // reset 必须先于 UnoCSS 加载，否则带 type="button" 的按钮会丢底色
  import '@unocss/reset/tailwind.css';
  import 'uno.css';

  const { children } = $props();

  document.getElementById('first-frame')?.remove();
  loadScFont();

  const app = window.isSecureContext
    ? createApp(realBrowserCapabilities())
    : undefined;
  const view = app && viewOf(app);
  if (view) setAppView(view);
  const session = $derived(view?.state.session);

  let failedUnexpectedly = $state(false);
  const open = () => {
    failedUnexpectedly = false;
    app?.open().catch((error: unknown) => {
      console.error('打开 App 失败', error);
      failedUnexpectedly = true;
    });
  };

  open();

  type DesktopShellComponent = Component<{
    account: Account;
    children: Snippet;
  }>;
  type PhoneShellComponent = Component<{ children: Snippet }>;

  let SignedInFrame = $state.raw<
    Component<{
      account: Account;
      initialDesktop?: DesktopShellComponent;
      initialPhone?: PhoneShellComponent;
      children: Snippet;
    }>
  >();
  let initialDesktop = $state.raw<DesktopShellComponent>();
  let initialPhone = $state.raw<PhoneShellComponent>();
  let SignedOutFrame = $state.raw<Component<{ children: Snippet }>>();
  let LoginPage = $state.raw<Component<{ expired: boolean }>>();
  let loadingSignedIn = false;
  let loadingSignedOut = false;
  let loadingLogin = false;

  const downloadsPage = $derived(page.route.id === '/downloads');

  const targetScreen = $derived(
    !session
      ? 'https'
      : failedUnexpectedly
        ? 'failed'
        : session.status === 'checking'
          ? 'opening'
          : session.status === 'checkFailed'
            ? 'checkFailed'
            : session.status === 'signedIn'
              ? 'signedIn'
              : downloadsPage
                ? 'signedOutDownloads'
                : 'login',
  );

  $effect(() => {
    if (session?.status === 'signedIn' && session.account.avatarUrl)
      ensureNeteaseImagePreconnect(session.account.avatarUrl);
  });

  $effect(() => {
    if (targetScreen === 'signedIn' && !SignedInFrame && !loadingSignedIn) {
      loadingSignedIn = true;
      const isDesktop = desktopLayout.current;
      void Promise.all([
        import('#lib/components/shell/SignedInFrame.svelte'),
        isDesktop
          ? import('#lib/components/shell/SignedInDesktop.svelte')
          : import('#lib/components/shell/SignedInPhone.svelte'),
      ])
        .then(([frame, shell]) => {
          if (isDesktop)
            initialDesktop = shell.default as DesktopShellComponent;
          else initialPhone = shell.default as PhoneShellComponent;
          SignedInFrame = frame.default;
        })
        .catch((error: unknown) => {
          loadingSignedIn = false;
          console.error('加载主界面失败', error);
          failedUnexpectedly = true;
        });
    } else if (
      targetScreen === 'signedOutDownloads' &&
      !SignedOutFrame &&
      !loadingSignedOut
    ) {
      loadingSignedOut = true;
      void import('#lib/components/shell/SignedOutFrame.svelte')
        .then((module) => {
          SignedOutFrame = module.default;
        })
        .catch((error: unknown) => {
          loadingSignedOut = false;
          console.error('加载已下载界面失败', error);
          failedUnexpectedly = true;
        });
    } else if (targetScreen === 'login' && !LoginPage && !loadingLogin) {
      loadingLogin = true;
      void import('#lib/components/login/LoginPage.svelte')
        .then((module) => {
          LoginPage = module.default;
        })
        .catch((error: unknown) => {
          loadingLogin = false;
          console.error('加载登录页失败', error);
          failedUnexpectedly = true;
        });
    }
  });

  // 目标屏代码就绪前保持 opening，让开场花朵直接飞向品牌落点、不出空帧
  const screen = $derived(
    (targetScreen === 'signedIn' && !SignedInFrame) ||
      (targetScreen === 'signedOutDownloads' && !SignedOutFrame) ||
      (targetScreen === 'login' && !LoginPage)
      ? 'opening'
      : targetScreen,
  );
</script>

{#key screen}
  <div
    in:fade={{ duration: DURATIONS.panel }}
    out:fadeAway={{ duration: DURATIONS['panel-out'] }}
    {@attach arrival}
  >
    {#if !session}
      <HttpsRequired />
    {:else if failedUnexpectedly}
      <AppOpenFailed failure={{ kind: 'appError' }} onretry={open} />
    {:else if screen === 'opening'}
      <AppOpening />
    {:else if session.status === 'checkFailed'}
      {#if session.failure.kind === 'cookieSecretMissing'}
        <CookieSecretRequired />
      {:else}
        <AppOpenFailed failure={session.failure} onretry={open} />
      {/if}
    {:else if session.status === 'signedIn' && SignedInFrame}
      <SignedInFrame account={session.account} {initialDesktop} {initialPhone}>
        {@render children()}
      </SignedInFrame>
    {:else if downloadsPage && SignedOutFrame}
      <SignedOutFrame>
        {@render children()}
      </SignedOutFrame>
    {:else if LoginPage}
      <LoginPage expired={session.status === 'loginExpired'} />
    {/if}
  </div>
{/key}
