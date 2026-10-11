<!--
  未登录页（视觉原型方案 A 的 welcome 画面）：一句话讲清是什么，加上示例曲库。
  登录卡片（#19）放在桌面的右栏、手机的介绍下面；“不登录，听已下载的”入口在有下载时出现（#38）。
-->
<script lang='ts'>
  import Brand from '../Brand.svelte'
  import { desktopLayout } from '../layout'
  import WelcomeShowcase from './WelcomeShowcase.svelte'
</script>

{#if desktopLayout.current}
  <div class='bg-primary-50 min-h-dvh'>
    <header class='mx-auto h-16 max-w-[1280px] flex items-center px-8'>
      <Brand />
    </header>
    <!-- 1280px 及以上分两栏，右栏 420px 是登录卡片的位置 -->
    <main class='grid mx-auto max-w-[1280px] items-start gap-16 px-8 pb-16 pt-6 xl:grid-cols-[minmax(0,1fr)_420px]'>
      <div class='min-w-0'>
        <h1 class='text-display text-neutral-900 font-600'>纯粹的网易云音乐播放器</h1>
        <p class='mt-4 text-title-sm text-neutral-600 font-400 leading-7'>
          只有听歌、搜歌、收藏，没有广告和信息流。<br />用自己的网易云账号登录，打开就是自己的曲库。
        </p>
        <WelcomeShowcase phone={false} class='mt-8' />
      </div>
    </main>
  </div>
{:else}
  <div class='bg-primary-50 pb-[calc(32px+env(safe-area-inset-bottom))] min-h-dvh'>
    <header class='h-14 flex items-center px-4'>
      <Brand />
    </header>
    <main class='px-4'>
      <h1 class='pt-1 text-headline text-neutral-900 font-600'>纯粹的网易云音乐播放器</h1>
      <p class='mt-2 text-body text-neutral-600 leading-6'>只有听歌、搜歌、收藏，没有广告和信息流。用自己的网易云账号登录，打开就是自己的曲库。</p>
      <!-- 登录卡片的位置 -->
      <section class='mt-12' aria-labelledby='showcase-title'>
        <h2 id='showcase-title' class='px-1 text-title text-neutral-900 font-600'>打开就是自己的曲库</h2>
        <p class='mt-1 px-1 text-label text-neutral-600 font-400 leading-[22px]'>不用先刷推荐，点一首就开始放。</p>
        <WelcomeShowcase phone class='mt-4' />
      </section>
    </main>
  </div>
{/if}
