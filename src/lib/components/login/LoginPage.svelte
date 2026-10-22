<!--
  登录页（未登录时看到的页面）：只有登录，没有介绍和示例曲库（作者 2026-10-11 定）。
  登录卡片只有一份，跨过 768px 时不重新挂载：听众选的登录方式、填了一半的手机号都还在。
  “登录已失效”的提示条跟着登录页出现时从上面飘进来（DESIGN.md Overlays）。
  这台设备上有下载时（#38），卡片下面是蜜桃色的“不登录，听已下载的 N 首”，进已下载页（ADR-0006：下载属于设备，不登录也能听）
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { ChevronRight, CircleArrowDown } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import Brand from '../Brand.svelte'
  import { desktopLayout } from '../layout'
  import { formatCount } from '../library/view'
  import { float } from '../motion'
  import { FLOAT_IN_DELAY } from '../motion-tokens'
  import Scrollbar from '../ui/Scrollbar.svelte'
  import LoginForm from './LoginForm.svelte'

  interface Props {
    /** 浏览器里还有登录 Cookie，但网易云说登录已经失效 */
    expired: boolean
  }

  const { expired }: Props = $props()
  const view = getAppView()
  const downloaded = $derived(view.state.downloads.songs?.length ?? 0)
</script>

<div class='bg-primary-50 pb-[calc(32px+env(safe-area-inset-bottom))] min-h-dvh md:pb-16'>
  <header class='mx-auto h-14 max-w-[1280px] flex items-center px-4 md:h-16 md:px-8'>
    <Brand />
  </header>
  <main class='px-4 pt-2 md:px-8 md:pt-[8vh]'>
    <section class='mx-auto max-w-[420px] w-full rounded-xl bg-white p-4 shadow-ambient md:p-7' aria-labelledby='login-title'>
      <h1 id='login-title' class='mb-5 text-title text-neutral-900 font-600'>用网易云账号登录</h1>
      {#if expired}
        <!-- global：它跟着整个登录页一起出现（登录失效时从曲库换过来），也要飘进来 -->
        <p class='mb-5 rounded-lg bg-primary-100 px-3.5 py-2.5 text-caption text-primary-950' role='status' in:float|global={{ toward: 'down', delay: FLOAT_IN_DELAY }}>登录已失效</p>
      {/if}
      <LoginForm phone={!desktopLayout.current} />
    </section>
    {#if downloaded > 0}
      <div class='mx-auto mt-3 max-w-[420px] w-full md:mt-4'>
        <a
          href={resolve('/downloads')}
          class='h-12 flex items-center gap-2.5 rounded-full bg-secondary-100 pl-4 pr-3 text-body text-secondary-900 font-500 transition-colors duration-feedback active:bg-secondary-200 mouse:hover:bg-secondary-200'
        >
          <CircleArrowDown size={18} class='flex-none text-secondary-800' aria-hidden='true' />
          <span class='min-w-0 flex-1'>不登录，听已下载的 <span class='tabular-nums'>{formatCount(downloaded)}</span> 首</span>
          <ChevronRight size={18} class='flex-none' aria-hidden='true' />
        </a>
      </div>
    {/if}
  </main>
  <!-- 窗口矮时登录卡片要滚：没有顶栏、底栏挡着，滚动条从窗口顶贴到底 -->
  <Scrollbar page={{ top: '0px', bottom: '0px' }} />
</div>
