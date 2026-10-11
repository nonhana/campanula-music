<!--
  未登录页（视觉原型方案 A 的 welcome 画面）：一句话讲清是什么、登录卡片，加上示例曲库。
  桌面 1280px 及以上分两栏，登录卡片在右栏；窄一些的桌面和手机上，登录卡片紧跟在介绍下面。
  登录卡片只有一份，跨过 768px 时不重新挂载：听众选的登录方式、填了一半的手机号都还在。
  “不登录，听已下载的”入口在有下载时出现（#38）。
-->
<script lang='ts'>
  import Brand from '../Brand.svelte'
  import { desktopLayout } from '../layout'
  import LoginForm from '../login/LoginForm.svelte'
  import WelcomeShowcase from './WelcomeShowcase.svelte'

  interface Props {
    /** 浏览器里还有登录 Cookie，但网易云说登录已经失效 */
    expired: boolean
  }

  const { expired }: Props = $props()
</script>

<div class='bg-primary-50 pb-[calc(32px+env(safe-area-inset-bottom))] min-h-dvh md:pb-0'>
  <header class='mx-auto h-14 max-w-[1280px] flex items-center px-4 md:h-16 md:px-8'>
    <Brand />
  </header>
  <main class='grid mx-auto max-w-[1280px] items-start px-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-rows-[auto_1fr] md:gap-x-16 md:gap-y-10 md:px-8 md:pb-16 md:pt-6'>
    <div class='min-w-0'>
      <h1 class='pt-1 text-headline text-neutral-900 font-600 md:pt-0 md:text-display'>纯粹的网易云音乐播放器</h1>
      <p class='mt-2 text-body text-neutral-600 leading-6 md:mt-4 md:text-title-sm md:font-400 md:leading-7'>
        只有听歌、搜歌、收藏，没有广告和信息流。<br class='max-md:hidden' />用自己的网易云账号登录，打开就是自己的曲库。
      </p>
    </div>
    <section
      class='mt-5 w-full rounded-xl bg-white p-4 shadow-ambient xl:row-span-2 xl:col-start-2 xl:row-start-1 md:mt-0 md:max-w-[420px] md:p-7'
      aria-labelledby='login-title'
    >
      <h2 id='login-title' class='text-title text-neutral-900 font-600 max-md:sr-only'>用网易云账号登录</h2>
      <p class='mb-5 mt-1 text-label text-neutral-600 font-400 max-md:hidden'>登录后，曲库、歌单、红心都是你自己的</p>
      {#if expired}
        <p class='mb-5 rounded-lg bg-primary-100 px-3.5 py-2.5 text-caption text-primary-950' role='status'>登录已经失效，请重新登录。</p>
      {/if}
      <LoginForm phone={!desktopLayout.current} />
    </section>
    {#if desktopLayout.current}
      <WelcomeShowcase phone={false} class='min-w-0 xl:-mt-2' />
    {:else}
      <section class='mt-12' aria-labelledby='showcase-title'>
        <h2 id='showcase-title' class='px-1 text-title text-neutral-900 font-600'>打开就是自己的曲库</h2>
        <p class='mt-1 px-1 text-label text-neutral-600 font-400 leading-[22px]'>不用先刷推荐，点一首就开始放。</p>
        <WelcomeShowcase phone class='mt-4' />
      </section>
    {/if}
  </main>
</div>
