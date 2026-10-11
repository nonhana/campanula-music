<script lang='ts'>
  import Logo from '$lib/components/svg/Logo.svelte'

  const origin = window.location.origin
</script>

<!-- 字体文件（#18）落地之前不用加粗：现在只有 300/400 两档，600 会被浏览器模拟出来 -->
<main class='mx-auto max-w-xl px-6 py-12 text-[15px] text-neutral-700 leading-relaxed'>
  <Logo />
  <h1 class='mt-6 text-xl text-neutral-900'>需要用 HTTPS 打开</h1>
  <p class='mt-3'>这个页面是用 <code class='rounded bg-neutral-100 px-1'>{origin}</code> 打开的。Campanula 的登录、安装成 App、离线播放和后台下载，都要用到浏览器只在 HTTPS 下提供的功能，所以现在用不了。</p>
  <h2 class='mt-8 text-neutral-900'>站长可以这样解决</h2>
  <ul class='mt-2 list-disc pl-5 space-y-2'>
    <li>部署在自己的服务器上：在前面加一个反向代理（例如 Caddy 或 Nginx），配好 HTTPS 证书后用 https:// 地址打开。国内服务器的域名要先备案。</li>
    <li>部署在 Vercel 上：用绑定的自己的域名打开。<code class='rounded bg-neutral-100 px-1'>*.vercel.app</code> 在国内打不开。</li>
    <li>在本机试用或开发：用 <code class='rounded bg-neutral-100 px-1'>http://localhost</code> 打开，不需要 HTTPS。</li>
  </ul>
</main>
