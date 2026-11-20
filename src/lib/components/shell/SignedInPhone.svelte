<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { RouteId } from '$app/types';
  import { ArrowLeft, Calendar, Search, Settings } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  import Brand from '../boot/Brand.svelte';
  import DailyNumber from '../daily/DailyNumber.svelte';
  import { dailyCalendarDay } from '../daily/view.ts';
  import PhoneSelectionActionBar from '../library/PhoneSelectionActionBar.svelte';
  import PhoneSelectionTopBar from '../library/PhoneSelectionTopBar.svelte';
  import { getOverlays } from '../overlay/overlay-context.ts';
  import PhoneSearchBar from '../search/PhoneSearchBar.svelte';
  import { showingResults, shownKeyword } from '../search/search-box.svelte.ts';
  import SearchTabs from '../search/SearchTabs.svelte';
  import { searchTabOf } from '../search/view.ts';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import IconButton from '../ui/IconButton.svelte';
  import BackTitle from './BackTitle.svelte';
  import { backPage } from './page-history.ts';
  import PhoneShell from './PhoneShell.svelte';

  const { children }: { children: Snippet } = $props();
  const view = getAppView();
  const { multiSelect } = getOverlays();

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
</script>

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
