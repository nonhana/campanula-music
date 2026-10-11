<!-- 站长没配置加密 Cookie 的密钥：给站长看的配置说明（和 HttpsRequired 一样，是部署出了问题，不是听众能修的） -->
<script lang='ts'>
  import Brand from '$lib/components/Brand.svelte'
</script>

<main class='mx-auto max-w-xl px-6 py-12 text-body text-neutral-700 leading-relaxed'>
  <Brand />
  <h1 class='mt-8 text-headline text-neutral-900 font-600'>需要配置加密密钥</h1>
  <p class='mt-3'>Campanula 把听众的网易云登录凭据加密后放在听众自己的浏览器里，服务器不保存。加密要用站长配置的密钥，这个实例还没有配置，所以现在不能登录。</p>
  <h2 class='mt-8 text-title text-neutral-900 font-600'>站长可以这样解决</h2>
  <ol class='mt-2 list-decimal pl-5 space-y-2'>
    <li>生成一个至少 32 个字符的随机密钥，例如在终端里运行 <code class='rounded-sm bg-neutral-100 px-1'>openssl rand -base64 32</code>。</li>
    <li>把它设为环境变量 <code class='rounded-sm bg-neutral-100 px-1'>COOKIE_SECRET</code>：部署在 Vercel 上的，在项目的 Settings → Environment Variables 里添加，然后重新部署；部署在自己服务器上的，在启动 Node 或 Docker 时传入。</li>
    <li>密钥要一直保留，升级新版本时也用同一个。换了密钥，所有听众都要重新登录。</li>
  </ol>
</main>
