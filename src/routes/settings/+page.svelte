<!--
  设置：账号和退出登录（#57，先确认）、在线播放音质、已下载（#38；手机上只有这一个入口，作者 2026-10-21 定）。
  已下载那一行自己写着“已下载”，上面不另加区块标题（读屏靠 aria-label）。音质是 ui/Segmented 的单选组。
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { ChevronRight, CircleArrowDown, LogOut } from '@lucide/svelte'

  import type { Quality } from '#lib/api/playback.js'
  import { QUALITIES } from '#lib/api/playback.js'
  import Avatar from '#lib/components/account/Avatar.svelte'
  import { getOverlays } from '#lib/components/overlay/overlay-context.js'
  import { getAppView } from '#lib/components/shared/app-context.svelte.js'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import { formatCount } from '#lib/components/shared/text.js'
  import Button from '#lib/components/ui/Button.svelte'
  import IconButton from '#lib/components/ui/IconButton.svelte'
  import Segmented from '#lib/components/ui/Segmented.svelte'

  const QUALITY_LABELS: Record<Quality, string> = {
    standard: '标准',
    higher: '较高',
    exhigh: '极高',
    lossless: '无损',
    hires: 'Hi-Res',
  }
  const QUALITY_OPTIONS = QUALITIES.map(key => ({ key, label: QUALITY_LABELS[key] }))

  const view = getAppView()
  const { logoutConfirm } = getOverlays()
  const account = $derived(view.state.session.status === 'signedIn'
    ? view.state.session.account
    : null)
  const quality = $derived(view.state.player.quality)
  /** 这台设备上下载了几首；还没从本机读出来时是 null */
  const downloaded = $derived(view.state.downloads.songs?.length ?? null)

  const confirmLogout = (event: MouseEvent) => {
    logoutConfirm.open({ from: event.currentTarget as HTMLElement })
  }
</script>

<div class='max-w-[640px] px-4 pt-2 md:px-0 md:pt-6'>
  {#if desktopLayout.current}
    <h1 class='text-headline text-neutral-900 font-600'>设置</h1>
  {/if}
  <section class='mt-0 md:mt-8' aria-labelledby='settings-account'>
    <h2 id='settings-account' class='px-1 text-title-sm text-neutral-900 font-600'>账号</h2>
    {#if account}
      <div class='mt-3 rounded-xl bg-white p-5 shadow-ambient'>
        <div class='flex items-center gap-4'>
          <Avatar url={account.avatarUrl} size={56} />
          <p class='min-w-0 flex-1 truncate text-title-sm text-neutral-900 font-500'>{account.nickname}</p>
          {#if !desktopLayout.current}
            <IconButton icon={LogOut} label='退出登录' title='退出登录' class='-mr-2' onclick={confirmLogout} />
          {/if}
        </div>
        {#if desktopLayout.current}
          <div class='mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-neutral-100 pt-5'>
            <Button variant='outline' icon={LogOut} onclick={confirmLogout}>退出登录</Button>
            <p class='min-w-0 flex-1 basis-56 text-caption text-neutral-600'>退出后，这个浏览器里不再保存你的网易云登录、曲库和播放队列。</p>
          </div>
        {/if}
      </div>
    {/if}
  </section>
  <section class='mt-8' aria-labelledby='settings-playback'>
    <h2 id='settings-playback' class='px-1 text-title-sm text-neutral-900 font-600'>播放</h2>
    <div class='mt-3 rounded-xl bg-white p-5 shadow-ambient'>
      <p id='settings-quality' class='text-body text-neutral-900 font-500'>在线播放音质</p>
      <Segmented
        options={QUALITY_OPTIONS}
        value={quality}
        onchange={(next: Quality) => view.app.setPlayQuality(next)}
        role='radio'
        id='settings-quality-options'
        labelledby='settings-quality'
        describedby='settings-quality-hint'
        class='mt-3 h-10 md:max-w-[400px]'
      />
      <p id='settings-quality-hint' class='mt-3 text-caption text-neutral-600'>从下一首开始生效</p>
    </div>
  </section>
  <section class='mt-8' aria-label='下载'>
    <a
      href={resolve('/downloads')}
      class='min-h-14 flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-ambient transition-colors duration-feedback active:bg-neutral-50 mouse:hover:bg-neutral-50'
    >
      <CircleArrowDown size={20} class='flex-none text-secondary-800' aria-hidden='true' />
      <span class='min-w-0 flex-1 text-body text-neutral-900 font-500'>已下载</span>
      {#if downloaded !== null}<span class='text-caption text-neutral-600 tabular-nums'>{formatCount(downloaded)} 首</span>{/if}
      <ChevronRight size={18} class='flex-none text-neutral-500' aria-hidden='true' />
    </a>
  </section>
</div>
