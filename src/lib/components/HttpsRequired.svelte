<script lang='ts'>
  import Brand from '#lib/components/Brand.svelte'
  import Scrollbar from '#lib/components/ui/Scrollbar.svelte'

  const origin = window.location.origin
</script>

<main class='mx-auto max-w-xl px-6 py-12 text-body text-neutral-700 leading-relaxed'>
  <Brand />
  <h1 class='mt-8 text-headline text-neutral-900 font-600'>需要用 HTTPS 打开</h1>
  <p class='mt-3'>当前地址是 <code class='rounded-sm bg-neutral-100 px-1'>{origin}</code>。登录、安装、离线播放和后台下载都只能在 HTTPS 下用。</p>
  <h2 class='mt-8 text-title text-neutral-900 font-600'>站长可以这样解决</h2>
  <ul class='mt-2 list-disc pl-5 space-y-2'>
    <li>部署在自己的服务器上：在前面加一个反向代理（例如 Caddy 或 Nginx），配好 HTTPS 证书后用 https:// 地址打开。国内服务器的域名要先备案。</li>
    <li>在本机试用或开发：用 <code class='rounded-sm bg-neutral-100 px-1'>http://localhost</code> 打开，不需要 HTTPS。</li>
  </ul>
</main>
<Scrollbar page={{ top: '0px', bottom: '0px' }} />
