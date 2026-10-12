<!--
  登录后的骨架：桌面是顶栏（菜单键、logo、头像菜单）和图标侧栏（曲库，设置在最下面）；
  手机是 logo 行（右边是设置），设置、我喜欢的音乐这类二级页面换成返回栏；曲库首页下面有文字标签。曲库、搜索、每日推荐、已下载由之后的票放进来。
-->
<script lang='ts'>
  import type { Account } from '$lib/api/account'
  import type { LucideIcon } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import { afterNavigate, goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { ArrowLeft, House, Menu, Settings } from '@lucide/svelte'
  import Brand from '../Brand.svelte'
  import { desktopLayout } from '../layout'
  import IconButton from '../ui/IconButton.svelte'
  import AccountMenu from './AccountMenu.svelte'
  import DesktopShell from './DesktopShell.svelte'
  import PhoneShell from './PhoneShell.svelte'

  const { account, children }: { account: Account, children: Snippet } = $props()

  /** 二级页面：手机上顶行换成返回栏 */
  const secondary = $derived(page.url.pathname === resolve('/settings') ? '设置' : page.url.pathname === resolve('/liked') ? '我喜欢的音乐' : undefined)
  /** 曲库首页在手机上有文字标签；其他标签（歌单、专辑、歌手）由之后的票加 */
  const onLibrary = $derived(page.url.pathname === resolve('/'))

  let railExpanded = $state(false)

  // 从 App 里别的页面进来的，返回就退回去；直接打开二级页面的，返回到曲库
  let cameFromApp = $state(false)
  afterNavigate(({ from }) => {
    cameFromApp = from !== null
  })
  function back() {
    if (cameFromApp)
      history.back()
    else
      void goto(resolve('/'), { replaceState: true })
  }

  /** 侧栏的一项：当前项是薄荷玻璃底；收起时只有图标，名字给读屏和悬停提示 */
  function railItem(href: string, label: string) {
    const current = page.url.pathname === href
    return {
      'class': [
        'h-12 w-full flex items-center gap-3 rounded-lg px-3 text-left transition-colors duration-150',
        current ? 'bg-primary-200 text-primary-950' : 'text-neutral-600 mouse:hover:(bg-primary-100 text-primary-950)',
      ],
      'aria-current': current ? 'page' as const : undefined,
      'aria-label': railExpanded ? undefined : label,
      'title': railExpanded ? undefined : label,
    }
  }
</script>

{#snippet railContent(label: string, Icon: LucideIcon)}
  <Icon size={22} class='flex-none' aria-hidden='true' />
  <span class={['whitespace-nowrap text-label font-500', !railExpanded && 'sr-only']}>{label}</span>
{/snippet}

{#snippet libraryTabs()}
  <nav class='flex px-2' aria-label='曲库'>
    <a href={resolve('/')} aria-current='page' class='relative h-11 flex flex-none items-center px-3 text-body text-neutral-900 font-600'>
      我喜欢
      <span class='absolute bottom-1 left-1/2 h-[3px] w-4 rounded-full bg-primary-800 -translate-x-1/2' aria-hidden='true'></span>
    </a>
  </nav>
{/snippet}

{#if desktopLayout.current}
  <DesktopShell {railExpanded}>
    {#snippet header()}
      <IconButton icon={Menu} label={railExpanded ? '收起导航' : '展开导航'} aria-expanded={railExpanded} onclick={() => (railExpanded = !railExpanded)} />
      <a href={resolve('/')} class='rounded-lg' aria-label='Campanula · 回到曲库'><Brand /></a>
      <span class='flex-1'></span>
      <AccountMenu {account} />
    {/snippet}
    {#snippet rail()}
      <a href={resolve('/')} {...railItem(resolve('/'), '曲库')}>{@render railContent('曲库', House)}</a>
      <div class='mt-auto'>
        <a href={resolve('/settings')} {...railItem(resolve('/settings'), '设置')}>{@render railContent('设置', Settings)}</a>
      </div>
    {/snippet}
    {@render children()}
  </DesktopShell>
{:else}
  <PhoneShell tabs={onLibrary ? libraryTabs : undefined}>
    {#snippet header()}
      {#if secondary}
        <IconButton icon={ArrowLeft} label='返回' class='-ml-3' onclick={back} />
        <h1 class='min-w-0 flex-1 truncate text-title-sm text-neutral-900 font-500'>{secondary}</h1>
      {:else}
        <a href={resolve('/')} class='rounded-lg' aria-label='Campanula · 回到曲库'><Brand /></a>
        <span class='flex-1'></span>
        <a href={resolve('/settings')} class='grid size-11 place-items-center rounded-full text-neutral-700 active:bg-primary-100' aria-label='设置'>
          <Settings size={22} aria-hidden='true' />
        </a>
      {/if}
    {/snippet}
    {@render children()}
  </PhoneShell>
{/if}
