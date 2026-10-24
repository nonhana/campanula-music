<!--
  登录后的骨架：桌面是顶栏（菜单键、logo、正中的搜索框、头像菜单）、图标侧栏（曲库、每日推荐、已下载，设置在最下面）和底部播放条；
  手机是 logo 行（右边是搜索、每日推荐的日历按钮、设置），设置、每日推荐、已下载、歌单页、专辑页、歌手页这类二级页面换成返回栏：
  设置页的返回栏写“设置”，其余平时只有 ←，页头的大标题滚到返回栏下面以后淡入页名（BackTitle）；
  搜索页换成返回加搜索框；曲库（我喜欢、歌单、专辑、歌手）下面有文字标签，搜索结果下面是结果的标签（综合 / 单曲 / 歌单 / 歌手 / 专辑）；
  底部是迷你播放条。
  播放条在播放队列里有歌时才有，从它打开播放页（点开或往上拖；盖住整个骨架，开着时骨架不能操作）。
  播放的提示浮在最上面，播放页开着时也看得见；改曲库（红心、加入歌单、收藏、歌单的增删改）的提示同样浮着，两条都在时排在播放提示外侧。
  “更多”菜单、从它打开的加入歌单、歌单页的 ••• 盖在播放页上面；歌单编辑（PlaylistEditor）、退出登录的确认（LogoutConfirm）盖在所有东西上面，
  换封面的裁剪页（CoverEditor）再盖在编辑上面；开着时后面的都不能操作。
-->
<script lang='ts'>
  import { afterNavigate, goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import type { RouteId } from '$app/types'
  import type { LucideIcon } from '@lucide/svelte'
  import { ArrowLeft, Calendar, CalendarDays, CircleArrowDown, House, Menu, Search, Settings } from '@lucide/svelte'
  import type { Snippet } from 'svelte'

  import type { Account } from '#lib/api/account.js'

  import Brand from '../boot/Brand.svelte'
  import DailyNumber from '../daily/DailyNumber.svelte'
  import { dailyCalendarDay } from '../daily/view'
  import PhoneSelectionActionBar from '../library/PhoneSelectionActionBar.svelte'
  import PhoneSelectionTopBar from '../library/PhoneSelectionTopBar.svelte'
  import OperationNotice from '../notice/OperationNotice.svelte'
  import { setOverlays } from '../overlay/overlay-context'
  import OverlayHost from '../overlay/OverlayHost.svelte'
  import { createOverlays } from '../overlay/overlays.svelte'
  import PlayerLayer from '../player/PlayerLayer.svelte'
  import DesktopSearchBox from '../search/DesktopSearchBox.svelte'
  import PhoneSearchBar from '../search/PhoneSearchBar.svelte'
  import { resetSearchBox, showingResults, shownKeyword } from '../search/search-box.svelte'
  import SearchTabs from '../search/SearchTabs.svelte'
  import { searchTabOf } from '../search/view'
  import { getAppView } from '../shared/app-context.svelte'
  import { desktopLayout } from '../shared/layout'
  import IconButton from '../ui/IconButton.svelte'
  import AccountMenu from './AccountMenu.svelte'
  import BackTitle from './BackTitle.svelte'
  import DesktopShell from './DesktopShell.svelte'
  import { pageTransitions } from './page-transition'
  import PhoneShell from './PhoneShell.svelte'

  const { account, children }: { account: Account, children: Snippet } = $props()
  const view = getAppView()
  const overlays = setOverlays(createOverlays())
  const { playlistSelection } = overlays

  const route = $derived(page.route.id)
  /** 歌单页、专辑页、歌手页（属于曲库） */
  const libraryPage = $derived(route === '/playlists/[id=neteaseId]' || route === '/albums/[id=neteaseId]' || route === '/artists/[id=neteaseId]')
  /** 页面里有自己的标题（h1）的二级页面：返回栏平时只有 ←，h1 滚过去才淡入页名 */
  const detailPage = $derived(libraryPage || route === '/daily' || route === '/downloads')
  /** 设置页没有 h1：返回栏一直写“设置” */
  const settingsPage = $derived(route === '/settings')
  /** 手机搜索页：顶行是返回加搜索框 */
  const searching = $derived(route === '/search')
  /** 每日推荐的日期：手机日历按钮里的数字和它的名字 */
  const calendar = $derived(dailyCalendarDay(view.state.daily))
  /** 曲库的文字标签。换标签不留浏览记录：返回键离开曲库，不在标签之间来回 */
  const LIBRARY_TABS = [
    { route: '/', label: '我喜欢' },
    { route: '/playlists', label: '歌单' },
    { route: '/albums', label: '专辑' },
    { route: '/artists', label: '歌手' },
  ] as const satisfies readonly { route: RouteId, label: string }[]
  const onLibrary = $derived(LIBRARY_TABS.some(tab => tab.route === route))
  // 换页用 View Transitions：进入下一层、返回、标签之间各有方向（ADR-0011）
  pageTransitions(LIBRARY_TABS.map(tab => tab.route))
  /** 桌面侧栏的“曲库”：曲库的各个标签和歌单页、专辑页、歌手页都算 */
  const inLibrary = $derived(onLibrary || libraryPage)

  let railExpanded = $state(false)

  // 从 App 里别的页面进来的，返回就退回去；直接打开二级页面的，返回到曲库
  let cameFromApp = $state(false)
  afterNavigate(({ from, shallow, type }) => {
    // 打开播放页、歌曲菜单是浅路由（goto 的 shallow），没有换页
    if (shallow && type === 'goto')
      return
    cameFromApp = from !== null
    // 搜索框里换成这一页搜的词（搜索结果页）或空的
    resetSearchBox(view.app)
  })
  // 骨架在打开 App 问完账号后才挂上，那时第一次换页已经过去了：直接打开（刷新）搜索结果页时，搜索框里也要是这一页搜的词
  resetSearchBox(view.app)
  const back = () => {
    if (cameFromApp)
      history.back()
    else
      void goto(resolve('/'), { replace: true })
  }

  /** 侧栏的一项：当前项是薄荷玻璃底；收起时只有图标，名字给读屏和悬停提示 */
  const railItem = (id: RouteId, label: string, current = route === id) => ({
    'class': [
      'h-12 w-full flex items-center gap-3 rounded-lg px-3 text-left transition-colors duration-feedback',
      current ? 'bg-primary-200 text-primary-950' : 'text-neutral-600 mouse:hover:(bg-primary-100 text-primary-950)',
    ],
    'aria-current': current ? 'page' as const : undefined,
    'aria-label': railExpanded ? undefined : label,
    'title': railExpanded ? undefined : label,
  })
</script>

{#snippet railContent(label: string, Icon: LucideIcon)}
  <Icon size={22} class='flex-none' aria-hidden='true' />
  <!-- 展开时宽度开始变化一会儿以后文字才淡入；收起时文字先淡出，侧栏再变窄（DesktopShell）。收起时链接的名字在 aria-label 上 -->
  <span
    class={[
      'whitespace-nowrap text-label font-500 transition-opacity',
      railExpanded ? 'duration-rail-label delay-[var(--delay-rail-label)]' : 'opacity-0 duration-state-out ease-in-soft',
    ]}
  >{label}</span>
{/snippet}

{#snippet libraryTabs()}
  <nav class='flex px-2' aria-label='曲库'>
    {#each LIBRARY_TABS as tab (tab.route)}
      {@const current = tab.route === route}
      <a
        href={resolve(tab.route)}
        data-sveltekit-replacestate
        aria-current={current ? 'page' : undefined}
        class={[
          'relative h-11 flex flex-none items-center px-3 text-body',
          current ? 'text-neutral-900 font-600' : 'text-neutral-500 font-500',
        ]}
      >
        {tab.label}
        {#if current}
          <!-- 换标签时这条短线滑到新标签下面：换页的过渡把新旧两条叫同一个名字（uno.config.ts） -->
          <span class='absolute bottom-1 left-1/2 h-[3px] w-4 rounded-full bg-primary-800 -translate-x-1/2' style:view-transition-name='tab-line' aria-hidden='true'></span>
        {/if}
      </a>
    {/each}
  </nav>
{/snippet}

{#snippet searchTabs()}
  <SearchTabs keyword={shownKeyword()} tab={searchTabOf(page.url.searchParams.get('type'))} phone />
{/snippet}

{#snippet selectionBar()}
  <PhoneSelectionActionBar />
{/snippet}

<div class='contents' inert={overlays.stack.baseInert}>
  {#if desktopLayout.current}
    <DesktopShell {railExpanded}>
      {#snippet header()}
        <IconButton icon={Menu} label={railExpanded ? '收起导航' : '展开导航'} aria-expanded={railExpanded} onclick={() => (railExpanded = !railExpanded)} />
        <a href={resolve('/')} class='rounded-lg' aria-label='Campanula · 回到曲库'><Brand /></a>
        <DesktopSearchBox />
        <AccountMenu {account} />
      {/snippet}
      {#snippet rail()}
        <a href={resolve('/')} {...railItem('/', '曲库', inLibrary)}>{@render railContent('曲库', House)}</a>
        <a href={resolve('/daily')} {...railItem('/daily', '每日推荐')}>{@render railContent('每日推荐', CalendarDays)}</a>
        <a href={resolve('/downloads')} {...railItem('/downloads', '已下载')}>{@render railContent('已下载', CircleArrowDown)}</a>
      {/snippet}
      {#snippet railEnd()}
        <a href={resolve('/settings')} {...railItem('/settings', '设置')}>{@render railContent('设置', Settings)}</a>
      {/snippet}
      {@render children()}
    </DesktopShell>
  {:else}
    <PhoneShell
      tabs={onLibrary
        ? libraryTabs
        : searching && showingResults()
        ? searchTabs
        : undefined}
      replace={playlistSelection.mode ? selectionBar : undefined}
    >
      {#snippet header()}
        {#if playlistSelection.mode}
          <PhoneSelectionTopBar />
        {:else if searching}
          <PhoneSearchBar onback={back} />
        {:else if detailPage || settingsPage}
          <IconButton icon={ArrowLeft} label='返回' class='-ml-3' onclick={back} />
          {#if settingsPage}
            <h1 class='min-w-0 flex-1 truncate text-title-sm text-neutral-900 font-500'>设置</h1>
          {:else}
            <BackTitle />
          {/if}
        {:else}
          <a href={resolve('/')} class='rounded-lg' aria-label='Campanula · 回到曲库'><Brand /></a>
          <span class='flex-1'></span>
          <a href={resolve('/search')} class='grid size-11 place-items-center rounded-full text-neutral-700 active:bg-primary-100' aria-label='搜索'>
            <Search size={22} aria-hidden='true' />
          </a>
          <a href={resolve('/daily')} class='relative grid size-11 place-items-center rounded-full text-neutral-700 active:bg-primary-100' aria-label='每日推荐 · {calendar.month}月{calendar.day}日 {calendar.weekday}'>
            <Calendar size={24} strokeWidth={1.8} aria-hidden='true' />
            <DailyNumber day={calendar.day} size='icon' class='absolute inset-x-0 top-[19px] text-center' />
          </a>
          <a href={resolve('/settings')} class='grid size-11 place-items-center rounded-full text-neutral-700 active:bg-primary-100' aria-label='设置'>
            <Settings size={22} aria-hidden='true' />
          </a>
        {/if}
      {/snippet}
      {@render children()}
    </PhoneShell>
  {/if}
</div>

<PlayerLayer>
  <OperationNotice phone={!desktopLayout.current} />
</PlayerLayer>
<OverlayHost />
