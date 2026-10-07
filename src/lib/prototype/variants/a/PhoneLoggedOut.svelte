<!--
  PROTOTYPE：手机未登录。第一屏：一句话讲清是什么 + 能用的登录表单（默认短信验证码）+ “不登录，听已下载的”入口；
  往下是用真实歌曲行拼出的曲库一角。?screen=downloads 是未登录时的已下载页：logo 顶栏 + 列表 + 迷你播放条。
-->
<script lang='ts'>
  import type { PageScreen } from '$lib/prototype/nav.svelte'
  import { downloadedSongs } from '$lib/prototype/catalog'
  import { formatCount } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { ChevronRight, CircleArrowDown, Flower } from '@lucide/svelte'
  import LoginForm from './LoginForm.svelte'
  import MiniPlayer from './MiniPlayer.svelte'
  import OfflineBanner from './OfflineBanner.svelte'
  import PhoneDownloads from './PhoneDownloads.svelte'
  import { ui } from './state.svelte'
  import WelcomeProof from './WelcomeProof.svelte'

  let lastPage: PageScreen = nav.screen === 'player' || nav.screen === 'search' ? 'welcome' : nav.screen
  const underlying = $derived.by(() => {
    if (nav.screen !== 'player' && nav.screen !== 'search')
      lastPage = nav.screen
    return lastPage
  })

  $effect(() => {
    void underlying
    window.scrollTo({ top: 0 })
  })

  const localCount = $derived(downloadedSongs.filter(s => !ui.removed.has(s.id)).length)
</script>

{#if underlying === 'downloads'}
  <div class='min-h-dvh bg-primary-50 pb-[calc(96px+env(safe-area-inset-bottom))]' inert={nav.screen === 'player'}>
    <div class='sticky top-0 z-20 flex h-14 items-center bg-primary-50 pl-4 pr-3'>
      <button class='flex h-11 items-center gap-2' aria-label='Campanula · 回到介绍页' onclick={() => nav.goLibrary()}>
        <Flower size={26} color='#37BE8C' strokeWidth={1.8} aria-hidden='true' />
        <span class='text-[18px] font-500 tracking-[-0.01em] text-neutral-900'>Campanula</span>
      </button>
      <button class='ml-auto inline-flex h-10 items-center rounded-full bg-primary-900 px-5 text-[15px] font-500 text-white active:bg-primary-950' onclick={() => nav.goLibrary()}>登录</button>
    </div>

    <PhoneDownloads />

    {#if nav.offline}
      <div class='fixed inset-x-2 bottom-[calc(80px+env(safe-area-inset-bottom))] z-30'>
        <OfflineBanner class='shadow-float' />
      </div>
    {/if}
    <MiniPlayer />
  </div>
{:else}
  <div class='min-h-dvh bg-primary-50 pb-[calc(32px+env(safe-area-inset-bottom))]'>
    <header class='flex h-14 items-center gap-2 px-4'>
      <Flower size={26} color='#37BE8C' strokeWidth={1.8} aria-hidden='true' />
      <span class='text-[18px] font-500 tracking-[-0.01em] text-neutral-900'>Campanula</span>
    </header>

    <main class='px-4'>
      <h1 class='pt-1 text-[28px] leading-9 font-600 tracking-[-0.02em] text-neutral-900'>纯粹的网易云音乐播放器</h1>
      <p class='mt-2 text-[15px] leading-6 text-neutral-600'>只有听歌、搜歌、收藏歌，没有广告和信息流。用自己的网易云账号登录，打开就是自己的曲库。</p>

      <section class='mt-5 rounded-2xl bg-white p-4 shadow-ambient' aria-label='用网易云账号登录'>
        <LoginForm phone />
      </section>

      {#if localCount > 0}
        <button
          class='mt-3 flex h-12 w-full items-center gap-2.5 rounded-full bg-secondary-100 pl-4 pr-3 text-left text-[15px] font-500 text-secondary-900 active:bg-secondary-200'
          onclick={() => nav.openDownloads()}
        >
          <CircleArrowDown size={18} class='flex-none text-secondary-800' aria-hidden='true' />
          <span class='flex-1'>不登录，听已下载的 <span class='tnum'>{formatCount(localCount)}</span> 首</span>
          <ChevronRight size={18} class='flex-none' aria-hidden='true' />
        </button>
      {/if}

      <section class='mt-12' aria-labelledby='proof-title'>
        <h2 id='proof-title' class='px-1 text-[20px] leading-7 font-600 text-neutral-900'>打开就是自己的曲库</h2>
        <p class='mb-4 mt-1 px-1 text-[14px] leading-[22px] text-neutral-600'>不用先刷推荐，点一首就开始放。</p>
        <WelcomeProof phone />
      </section>
    </main>
  </div>
{/if}
