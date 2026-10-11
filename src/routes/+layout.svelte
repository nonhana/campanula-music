<script lang='ts'>
  import { createApp } from '$lib/app/app'
  import { realBrowserCapabilities } from '$lib/app/browser'
  import { setAppView, viewOf } from '$lib/components/app-context.svelte'
  import AppOpenFailed from '$lib/components/AppOpenFailed.svelte'
  import AppOpening from '$lib/components/AppOpening.svelte'
  import CookieSecretRequired from '$lib/components/CookieSecretRequired.svelte'
  import HttpsRequired from '$lib/components/HttpsRequired.svelte'
  import LoginPage from '$lib/components/login/LoginPage.svelte'
  import SignedInFrame from '$lib/components/shell/SignedInFrame.svelte'
  // 字体随项目打包（Noto Sans 可变字体，拉丁 → SC → JP → TC），不从网络加载
  import '@fontsource-variable/noto-sans'
  import '@fontsource-variable/noto-sans-sc'
  import '@fontsource-variable/noto-sans-jp'
  import '@fontsource-variable/noto-sans-tc'
  // reset 必须先于 UnoCSS 加载，否则带 type="button" 的按钮会丢底色
  import '@unocss/reset/tailwind.css'
  import 'uno.css'

  const { children } = $props()

  // 页面关闭了服务端渲染，这里只在浏览器里运行。
  // 安全上下文 = HTTPS 或本机 localhost：Service Worker、Background Fetch、Storage API、
  // 带 Secure 的 Cookie 都只在这里可用（ADR-0009）。
  const app = window.isSecureContext ? createApp(realBrowserCapabilities()) : undefined
  const view = app && viewOf(app)
  if (view)
    setAppView(view)
  const session = $derived(view?.state.session)

  /** open() 没想到的错误是 App 自己的缺陷：不能让界面一直停在“正在打开”，说明是 Campanula 出错，能重试 */
  let failedUnexpectedly = $state(false)
  function open() {
    failedUnexpectedly = false
    app?.open().catch((error: unknown) => {
      console.error('打开 App 失败', error)
      failedUnexpectedly = true
    })
  }

  open()
</script>

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
{:else}
  <LoginPage expired={session.status === 'loginExpired'} />
{/if}
