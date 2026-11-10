<script lang="ts">
  import '@fontsource-variable/noto-sans';
  import '@fontsource-variable/noto-sans-sc';
  import '@fontsource-variable/noto-sans-jp';
  import '@fontsource-variable/noto-sans-tc';

  import { page } from '$app/state';

  import { createApp } from '#lib/app/app.js';
  import { realBrowserCapabilities } from '#lib/app/browser.js';
  import AppOpenFailed from '#lib/components/boot/AppOpenFailed.svelte';
  import AppOpening from '#lib/components/boot/AppOpening.svelte';
  import CookieSecretRequired from '#lib/components/boot/CookieSecretRequired.svelte';
  import HttpsRequired from '#lib/components/boot/HttpsRequired.svelte';
  import { arrival } from '#lib/components/boot/opening.js';
  import LoginPage from '#lib/components/login/LoginPage.svelte';
  import {
    setAppView,
    viewOf,
  } from '#lib/components/shared/app-context.svelte.js';
  import { DURATIONS } from '#lib/components/shared/motion-tokens.js';
  import { fade, fadeAway } from '#lib/components/shared/motion.js';
  import SignedInFrame from '#lib/components/shell/SignedInFrame.svelte';
  import SignedOutFrame from '#lib/components/shell/SignedOutFrame.svelte';
  import { mock } from '#lib/mock-flag.js';
  // reset 必须先于 UnoCSS 加载，否则带 type="button" 的按钮会丢底色
  import '@unocss/reset/tailwind.css';
  import 'uno.css';

  const { children } = $props();

  document.getElementById('first-frame')?.remove();

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

  const downloadsPage = $derived(page.route.id === '/downloads');

  const screen = $derived(
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
    {:else if session.status === 'checking'}
      <AppOpening />
    {:else if session.status === 'checkFailed'}
      {#if session.failure.kind === 'cookieSecretMissing'}
        <CookieSecretRequired />
      {:else}
        <AppOpenFailed failure={session.failure} onretry={open} />
      {/if}
    {:else if session.status === 'signedIn'}
      <SignedInFrame account={session.account}>
        {@render children()}
      </SignedInFrame>
    {:else if downloadsPage}
      <SignedOutFrame>
        {@render children()}
      </SignedOutFrame>
    {:else}
      <LoginPage expired={session.status === 'loginExpired'} />
    {/if}
  </div>
{/key}

{#if mock}
  <div
    class="fixed bottom-3 left-3 z-50 rounded-full bg-neutral-900 px-3 py-1 text-caption text-white shadow-lg"
    aria-label="Mock 测试数据"
  >
    Mock · 测试数据
  </div>
{/if}
