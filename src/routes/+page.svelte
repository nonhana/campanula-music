<script lang='ts'>
  import { browser } from '$app/environment'
  import Logo from '$lib/components/svg/Logo.svelte'

  let needsHttps = $state(false)

  $effect(() => {
    if (browser) {
      const isHttps = window.location.protocol === 'https:'
      const isLocalhost = window.location.hostname === 'localhost'
        || window.location.hostname === '127.0.0.1'
      needsHttps = !isHttps && !isLocalhost
    }
  })
</script>

<div class='min-h-screen flex items-center justify-center bg-neutral-50'>
  {#if needsHttps}
    <div class='max-w-2xl rounded-lg bg-white p-8 shadow-md'>
      <h1 class='mb-4 text-2xl text-neutral-800 font-semibold'>需要配置 HTTPS</h1>
      <p class='mb-4 text-neutral-600'>
        Campanula Music 需要在 HTTPS 环境下运行，以便使用浏览器的安全功能（加密 Cookie、Service Worker、后台下载等）。
      </p>
      <div class='rounded bg-neutral-100 p-4'>
        <p class='mb-2 text-neutral-700 font-semibold'>配置方法：</p>
        <ul class='list-disc list-inside text-sm text-neutral-600 space-y-2'>
          <li>如果部署在 Vercel，绑定自己的域名即可自动启用 HTTPS</li>
          <li>如果部署在自己的服务器，请配置 Nginx 或 Caddy 反向代理并启用 HTTPS</li>
          <li>开发时可以使用 <code class='rounded bg-neutral-200 px-1'>localhost</code></li>
        </ul>
      </div>
    </div>
  {:else}
    <div class='text-center'>
      <div class='mb-4 flex justify-center'>
        <Logo />
      </div>
      <h1 class='text-2xl text-neutral-800 font-semibold'>Campanula Music</h1>
      <p class='mt-2 text-neutral-600'>清晨的风铃草</p>
    </div>
  {/if}
</div>
