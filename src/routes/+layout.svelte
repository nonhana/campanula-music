<script lang='ts'>
  import HttpsRequired from '$lib/components/HttpsRequired.svelte'
  // reset 必须先于 UnoCSS 加载，否则带 type="button" 的按钮会丢底色
  import '@unocss/reset/tailwind.css'
  import 'uno.css'

  const { children } = $props()

  // 页面关闭了服务端渲染，这里只在浏览器里运行。
  // 安全上下文 = HTTPS 或本机 localhost：Service Worker、Background Fetch、Storage API、
  // 带 Secure 的 Cookie 都只在这里可用（ADR-0009）。
  const secure = window.isSecureContext
</script>

{#if secure}
  {@render children()}
{:else}
  <HttpsRequired />
{/if}
