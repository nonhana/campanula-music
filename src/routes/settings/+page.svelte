<!--
  设置：账号和退出登录（桌面在头像菜单里也有）、在线播放音质、下载（#38：进已下载页；手机上只有这一个入口，作者 2026-10-21 定）。
  退出登录先确认（LogoutConfirm，#57）。手机上账号卡只有头像、名字和右边的退出图标；桌面卡片下半是“退出登录”胶囊和说明。
  音质是一行 5 格的分段条（样子照登录方式切换条）：语义是单选组，方向键切换并选中，Tab 只停在选中的那一格
-->
<script lang='ts'>
  import type { Quality } from '#lib/api/playback.js'
  import { resolve } from '$app/paths'
  import { ChevronRight, CircleArrowDown, LogOut } from '@lucide/svelte'
  import { tick } from 'svelte'
  import { QUALITIES } from '#lib/api/playback.js'
  import { getAppView } from '#lib/components/app-context.svelte.js'
  import Avatar from '#lib/components/Avatar.svelte'
  import { desktopLayout } from '#lib/components/layout.js'
  import { formatCount } from '#lib/components/library/view.js'
  import { logoutConfirm } from '#lib/components/logout-confirm.js'
  import Button from '#lib/components/ui/Button.svelte'
  import IconButton from '#lib/components/ui/IconButton.svelte'

  /** 在线播放音质的叫法：照网易云 */
  const QUALITY_LABELS: Record<Quality, string> = { standard: '标准', higher: '较高', exhigh: '极高', lossless: '无损', hires: 'Hi-Res' }

  const view = getAppView()
  const account = $derived(view.state.session.status === 'signedIn' ? view.state.session.account : null)
  const quality = $derived(view.state.player.quality)
  /** 这台设备上下载了几首；还没从本机读出来时是 null */
  const downloaded = $derived(view.state.downloads.songs?.length ?? null)

  function confirmLogout(event: MouseEvent) {
    logoutConfirm.open({ from: event.currentTarget as HTMLElement })
  }

  let qualityGroup = $state<HTMLElement>()
  /** 方向键换到前一格、后一格（到头了绕回去），选中它，焦点跟着走（WAI-ARIA Radio Group） */
  async function onQualityKey(event: KeyboardEvent) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step === 0)
      return
    event.preventDefault()
    const next = QUALITIES[(QUALITIES.indexOf(quality) + step + QUALITIES.length) % QUALITIES.length]!
    view.app.setPlayQuality(next)
    await tick()
    qualityGroup?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
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
          <div class='min-w-0 flex-1'>
            <p class='truncate text-title-sm text-neutral-900 font-500'>{account.nickname}</p>
            <p class='mt-0.5 text-caption text-neutral-600'>网易云账号</p>
          </div>
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
      <div
        bind:this={qualityGroup}
        class='mt-3 h-10 flex rounded-full bg-primary-50 p-1 md:max-w-[400px]'
        role='radiogroup'
        aria-labelledby='settings-quality'
        aria-describedby='settings-quality-hint'
        tabindex='-1'
        onkeydown={onQualityKey}
      >
        {#each QUALITIES as option (option)}
          {@const checked = quality === option}
          <button
            type='button'
            role='radio'
            aria-checked={checked}
            tabindex={checked ? 0 : -1}
            class={[
              'min-w-0 flex-1 whitespace-nowrap rounded-full text-label font-500 transition-colors duration-feedback',
              checked ? 'bg-primary-200 text-primary-950' : 'text-neutral-600 mouse:hover:text-neutral-900',
            ]}
            onclick={() => view.app.setPlayQuality(option)}
          >{QUALITY_LABELS[option]}</button>
        {/each}
      </div>
      <p id='settings-quality-hint' class='mt-3 text-caption text-neutral-600'>从下一首开始生效</p>
    </div>
  </section>
  <section class='mt-8' aria-labelledby='settings-downloads'>
    <h2 id='settings-downloads' class='px-1 text-title-sm text-neutral-900 font-600'>下载</h2>
    <a
      href={resolve('/downloads')}
      class='mt-3 min-h-14 flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-ambient transition-colors duration-feedback active:bg-neutral-50 mouse:hover:bg-neutral-50'
    >
      <CircleArrowDown size={20} class='flex-none text-secondary-800' aria-hidden='true' />
      <span class='min-w-0 flex-1 text-body text-neutral-900 font-500'>已下载</span>
      {#if downloaded !== null}<span class='text-caption text-neutral-600 tabular-nums'>{formatCount(downloaded)} 首</span>{/if}
      <ChevronRight size={18} class='flex-none text-neutral-500' aria-hidden='true' />
    </a>
  </section>
</div>
