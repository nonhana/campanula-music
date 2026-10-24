<script lang='ts'>
  import { page } from '$app/state'
  import { createApp } from '#lib/app/app.js'
  import { realBrowserCapabilities } from '#lib/app/browser.js'
  import AppOpenFailed from '#lib/components/boot/AppOpenFailed.svelte'
  import AppOpening from '#lib/components/boot/AppOpening.svelte'
  import CookieSecretRequired from '#lib/components/boot/CookieSecretRequired.svelte'
  import HttpsRequired from '#lib/components/boot/HttpsRequired.svelte'
  import LoginPage from '#lib/components/login/LoginPage.svelte'
  import { setAppView, viewOf } from '#lib/components/shared/app-context.svelte.js'
  import { DURATIONS } from '#lib/components/shared/motion-tokens.js'
  import { fade, fadeAway } from '#lib/components/shared/motion.js'
  import SignedInFrame from '#lib/components/shell/SignedInFrame.svelte'
  import SignedOutFrame from '#lib/components/shell/SignedOutFrame.svelte'
  import { mock } from '#lib/mock-flag.js'
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
  const app = window.isSecureContext
    ? createApp(realBrowserCapabilities())
    : undefined
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

  /** 没登录、登录失效时打开的是已下载页（#38，ADR-0006：下载属于设备）：不换成登录页 */
  const downloadsPage = $derived(page.route.id === '/downloads')

  /** 整个 App 现在是哪一屏：换屏时交叉淡化（打开中 → 曲库 / 登录页、登录 → 曲库、退出登录、登录失效、登录页 ↔ 没登录时的已下载页） */
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
      : downloadsPage ? 'signedOutDownloads' : 'login',
  )
</script>

<!--
  换屏时新的一屏淡入（面板 360ms），旧的一屏原地淡出（200ms）、马上不占高度，新的一屏从窗口顶上开始（motion.ts 的 fadeAway）。
  旧的在下面、新的盖在上面
-->
{#key screen}
  <div in:fade={{ duration: DURATIONS.panel }} out:fadeAway={{ duration: DURATIONS['panel-out'] }}>
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
  <div class='fixed bottom-3 left-3 z-50 rounded-full bg-neutral-900 px-3 py-1 text-caption text-white shadow-lg' aria-label='Mock 测试数据'>Mock · 测试数据</div>
{/if}
