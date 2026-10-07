<!--
  PROTOTYPE：桌面未登录。介绍页：左边一句话讲清是什么 + 用真实界面拼出的曲库一角，右边就是能用的登录表单（默认扫码），
  下面是“不登录，听已下载的”入口。?screen=downloads 是未登录时的已下载页：极简顶栏 + 列表 + 底部播放条。
-->
<script lang='ts'>
  import type { PageScreen } from '$lib/prototype/nav.svelte'
  import { downloadedSongs } from '$lib/prototype/catalog'
  import { formatCount } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { ChevronRight, CircleArrowDown, Flower } from '@lucide/svelte'
  import DesktopBar from './DesktopBar.svelte'
  import DesktopDownloads from './DesktopDownloads.svelte'
  import LoginForm from './LoginForm.svelte'
  import OfflineBanner from './OfflineBanner.svelte'
  import { ui } from './state.svelte'
  import WelcomeProof from './WelcomeProof.svelte'

  /** 播放页下面露出的那一页 */
  let lastPage: PageScreen = nav.screen === 'player' || nav.screen === 'search' ? 'welcome' : nav.screen
  const underlying = $derived.by(() => {
    if (nav.screen !== 'player' && nav.screen !== 'search')
      lastPage = nav.screen
    return lastPage
  })

  const localCount = $derived(downloadedSongs.filter(s => !ui.removed.has(s.id)).length)
</script>

{#if underlying === 'downloads'}
  <div class='min-h-dvh bg-primary-50' inert={nav.screen === 'player'}>
    <header class='fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 bg-primary-50 pl-6 pr-6'>
      <button class='flex h-10 items-center gap-2 rounded-lg pr-1' aria-label='Campanula · 回到介绍页' onclick={() => nav.goLibrary()}>
        <Flower size={28} color='#37BE8C' strokeWidth={1.8} aria-hidden='true' />
        <span class='text-[18px] font-500 tracking-[-0.01em] text-neutral-900'>Campanula</span>
      </button>
      <button class='filled ml-auto inline-flex h-10 items-center rounded-full bg-primary-900 px-5 text-[14px] font-500 text-white' onclick={() => nav.goLibrary()}>登录</button>
    </header>
    <main class='pb-28 pt-16'>
      <div class='mx-auto max-w-[1200px] px-8 pt-4'>
        {#if nav.offline}<OfflineBanner class='mb-4' />{/if}
        <DesktopDownloads />
      </div>
    </main>
    <DesktopBar />
  </div>
{:else}
  <div class='welcome min-h-dvh bg-primary-50'>
    <header class='mx-auto flex h-16 max-w-[1280px] items-center px-8'>
      <span class='flex items-center gap-2'>
        <Flower size={28} color='#37BE8C' strokeWidth={1.8} aria-hidden='true' />
        <span class='text-[18px] font-500 tracking-[-0.01em] text-neutral-900'>Campanula</span>
      </span>
    </header>

    <main class='mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)_420px] items-start gap-16 px-8 pb-16 pt-6'>
      <div class='min-w-0'>
        <h1 class='text-[44px] leading-[52px] font-600 tracking-[-0.025em] text-neutral-900'>纯粹的网易云音乐播放器</h1>
        <p class='mt-4 text-[17px] leading-7 text-neutral-600'>
          只有听歌、搜歌、收藏歌，没有广告和信息流。<br />用自己的网易云账号登录，打开就是自己的曲库。
        </p>
        <div class='mt-8'>
          <WelcomeProof phone={false} />
        </div>
      </div>

      <div class='pt-1'>
        <section class='rounded-2xl bg-white p-7 shadow-ambient' aria-labelledby='login-title'>
          <h2 id='login-title' class='text-[20px] leading-7 font-600 text-neutral-900'>用网易云账号登录</h2>
          <p class='mb-5 mt-1 text-[14px] text-neutral-600'>登录后，曲库、歌单、红心都是你自己的</p>
          <LoginForm phone={false} />
        </section>

        {#if localCount > 0}
          <button
            class='local mt-4 flex h-12 w-full items-center gap-2.5 rounded-full bg-secondary-100 pl-4 pr-3 text-left text-[15px] font-500 text-secondary-900'
            onclick={() => nav.openDownloads()}
          >
            <CircleArrowDown size={18} class='flex-none text-secondary-800' aria-hidden='true' />
            <span class='flex-1'>不登录，听已下载的 <span class='tnum'>{formatCount(localCount)}</span> 首</span>
            <ChevronRight size={18} class='flex-none' aria-hidden='true' />
          </button>
          <p class='mt-2 px-4 text-[13px] leading-5 text-neutral-600'>下载的歌保存在这台设备上，不登录也能听。</p>
        {/if}
      </div>
    </main>
  </div>
{/if}

<style>
  @media (hover: hover) and (pointer: fine) {
    .filled:hover {
      background: #1a5b43;
    }

    .local:hover {
      background: #ffe1cc;
    }
  }
</style>
