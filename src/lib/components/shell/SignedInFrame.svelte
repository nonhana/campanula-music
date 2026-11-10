<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { RouteId } from '$app/types';
  import type { LucideIcon } from '@lucide/svelte';
  import {
    ArrowLeft,
    Calendar,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    CircleArrowDown,
    House,
    Menu,
    Search,
    Settings,
  } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  import type { Account } from '#lib/api/account.js';

  import Brand from '../boot/Brand.svelte';
  import DailyNumber from '../daily/DailyNumber.svelte';
  import { dailyCalendarDay } from '../daily/view';
  import DownloadPanel from '../downloads/DownloadPanel.svelte';
  import PhoneSelectionActionBar from '../library/PhoneSelectionActionBar.svelte';
  import PhoneSelectionTopBar from '../library/PhoneSelectionTopBar.svelte';
  import { setOverlays } from '../overlay/overlay-context';
  import OverlayHost from '../overlay/OverlayHost.svelte';
  import { createOverlays } from '../overlay/overlays.svelte';
  import PlayerLayer from '../player/PlayerLayer.svelte';
  import DesktopSearchBox from '../search/DesktopSearchBox.svelte';
  import PhoneSearchBar from '../search/PhoneSearchBar.svelte';
  import {
    resetSearchBox,
    showingResults,
    shownKeyword,
  } from '../search/search-box.svelte';
  import SearchTabs from '../search/SearchTabs.svelte';
  import { searchTabOf } from '../search/view';
  import { getAppView } from '../shared/app-context.svelte';
  import { desktopLayout } from '../shared/layout';
  import IconButton from '../ui/IconButton.svelte';
  import AccountMenu from './AccountMenu.svelte';
  import BackTitle from './BackTitle.svelte';
  import DesktopShell from './DesktopShell.svelte';
  import { backPage, forwardPage, pageHistory } from './page-history';
  import { pageTransitions } from './page-transition';
  import PhoneShell from './PhoneShell.svelte';

  const { account, children }: { account: Account; children: Snippet } =
    $props();
  const view = getAppView();
  const overlays = setOverlays(createOverlays());
  const { multiSelect } = overlays;

  const route = $derived(page.route.id);
  const libraryPage = $derived(
    route === '/playlists/[id=neteaseId]' ||
      route === '/albums/[id=neteaseId]' ||
      route === '/artists/[id=neteaseId]',
  );
  const detailPage = $derived(
    libraryPage || route === '/daily' || route === '/downloads',
  );
  const settingsPage = $derived(route === '/settings');
  const searching = $derived(route === '/search');
  const calendar = $derived(dailyCalendarDay(view.state.daily));
  const LIBRARY_TABS = [
    { route: '/', label: '我喜欢' },
    { route: '/playlists', label: '歌单' },
    { route: '/albums', label: '专辑' },
    { route: '/artists', label: '歌手' },
  ] as const satisfies readonly { route: RouteId; label: string }[];
  const onLibrary = $derived(LIBRARY_TABS.some((tab) => tab.route === route));
  pageTransitions(() =>
    desktopLayout.current ? ['/'] : LIBRARY_TABS.map((tab) => tab.route),
  );
  const inLibrary = $derived(onLibrary || libraryPage);

  let railExpanded = $state(false);

  afterNavigate(({ shallow, type }) => {
    if (shallow && type === 'goto') return;
    resetSearchBox(view.app);
  });
  resetSearchBox(view.app);
  const keys = /Mac|iPhone|iPad/.test(navigator.platform)
    ? {
        back: '⌘ [',
        forward: '⌘ ]',
        backAria: 'Meta+[',
        forwardAria: 'Meta+]',
      }
    : {
        back: 'Alt ←',
        forward: 'Alt →',
        backAria: 'Alt+ArrowLeft',
        forwardAria: 'Alt+ArrowRight',
      };

  const railItem = (id: RouteId, label: string, current = route === id) => ({
    class: [
      'h-12 w-full flex items-center gap-3 rounded-lg px-3 text-left transition-colors duration-feedback',
      current
        ? 'bg-primary-200 text-primary-950'
        : 'text-neutral-600 mouse:hover:(bg-primary-100 text-primary-950)',
    ],
    'aria-current': current ? ('page' as const) : undefined,
    'aria-label': railExpanded ? undefined : label,
    title: railExpanded ? undefined : label,
  });
</script>

{#snippet railContent(label: string, Icon: LucideIcon)}
  <Icon size={22} class="flex-none" aria-hidden="true" />
  <span
    class={[
      'whitespace-nowrap text-label font-500 transition-opacity',
      railExpanded
        ? 'duration-rail-label delay-[var(--delay-rail-label)]'
        : 'opacity-0 duration-state-out ease-in-soft',
    ]}>{label}</span
  >
{/snippet}

{#snippet libraryTabs()}
  <nav class="flex px-2" aria-label="曲库">
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
          <span
            class="absolute bottom-1 left-1/2 h-[3px] w-4 rounded-full bg-primary-800 -translate-x-1/2"
            style:view-transition-name="tab-line"
            aria-hidden="true"
          ></span>
        {/if}
      </a>
    {/each}
  </nav>
{/snippet}

{#snippet searchTabs()}
  <SearchTabs
    keyword={shownKeyword()}
    tab={searchTabOf(page.url.searchParams.get('type'))}
    phone
  />
{/snippet}

{#snippet selectionBar()}
  <PhoneSelectionActionBar />
{/snippet}

<div class="contents" inert={overlays.stack.baseInert}>
  {#if desktopLayout.current}
    <DesktopShell {railExpanded} offline={!view.state.online}>
      {#snippet header()}
        <div
          class="grid grid-cols-[1fr_minmax(0,560px)_1fr] flex-1 items-center gap-3"
        >
          <div class="flex items-center gap-3">
            <IconButton
              icon={Menu}
              label={railExpanded ? '收起导航' : '展开导航'}
              aria-expanded={railExpanded}
              onclick={() => (railExpanded = !railExpanded)}
            />
            <a
              href={resolve('/')}
              class="rounded-lg"
              aria-label="Campanula · 回到曲库"><Brand /></a
            >
            <div class="flex">
              <IconButton
                icon={ChevronLeft}
                label="返回"
                title="返回（{keys.back}）"
                aria-keyshortcuts={keys.backAria}
                disabled={route === '/' && !pageHistory.canBack}
                onclick={backPage}
              />
              <IconButton
                icon={ChevronRight}
                label="前进"
                title="前进（{keys.forward}）"
                aria-keyshortcuts={keys.forwardAria}
                disabled={!pageHistory.canForward}
                onclick={forwardPage}
              />
            </div>
          </div>
          <DesktopSearchBox />
          <div class="mr-2 justify-self-end">
            <AccountMenu {account} />
          </div>
        </div>
      {/snippet}
      {#snippet rail()}
        <a href={resolve('/')} {...railItem('/', '曲库', inLibrary)}
          >{@render railContent('曲库', House)}</a
        >
        <a href={resolve('/daily')} {...railItem('/daily', '每日推荐')}
          >{@render railContent('每日推荐', CalendarDays)}</a
        >
        <a href={resolve('/downloads')} {...railItem('/downloads', '已下载')}
          >{@render railContent('已下载', CircleArrowDown)}</a
        >
      {/snippet}
      {#snippet railEnd()}
        <a href={resolve('/settings')} {...railItem('/settings', '设置')}
          >{@render railContent('设置', Settings)}</a
        >
      {/snippet}
      {@render children()}
    </DesktopShell>
  {:else}
    <PhoneShell
      offline={!view.state.online}
      tabs={onLibrary
        ? libraryTabs
        : searching && showingResults()
          ? searchTabs
          : undefined}
      replace={multiSelect.mode ? selectionBar : undefined}
    >
      {#snippet header()}
        {#if multiSelect.mode}
          <PhoneSelectionTopBar />
        {:else if searching}
          <PhoneSearchBar onback={backPage} />
        {:else if detailPage || settingsPage}
          <IconButton
            icon={ArrowLeft}
            label="返回"
            class="-ml-3"
            onclick={backPage}
          />
          {#if settingsPage}
            <h1
              class="min-w-0 flex-1 truncate text-title-sm text-neutral-900 font-500"
            >
              设置
            </h1>
          {:else}
            <BackTitle />
          {/if}
        {:else}
          <a
            href={resolve('/')}
            class="rounded-lg"
            aria-label="Campanula · 回到曲库"><Brand /></a
          >
          <span class="flex-1"></span>
          <a
            href={resolve('/search')}
            class="grid size-11 place-items-center rounded-full text-neutral-700 active:bg-primary-100"
            aria-label="搜索"
          >
            <Search size={22} aria-hidden="true" />
          </a>
          <a
            href={resolve('/daily')}
            class="relative grid size-11 place-items-center rounded-full text-neutral-700 active:bg-primary-100"
            aria-label="每日推荐 · {calendar.month}月{calendar.day}日 {calendar.weekday}"
          >
            <Calendar size={24} strokeWidth={1.8} aria-hidden="true" />
            <DailyNumber
              day={calendar.day}
              size="icon"
              class="absolute inset-x-0 top-[19px] text-center"
            />
          </a>
          <a
            href={resolve('/settings')}
            class="grid size-11 place-items-center rounded-full text-neutral-700 active:bg-primary-100"
            aria-label="设置"
          >
            <Settings size={22} aria-hidden="true" />
          </a>
        {/if}
      {/snippet}
      {@render children()}
    </PhoneShell>
  {/if}
  <DownloadPanel />
</div>

<PlayerLayer />
<OverlayHost />
