<script lang="ts">
  import { page } from '$app/state';

  import type { SuggestionRow } from '#lib/components/search/search-box.svelte.js';
  import {
    pickSuggestion,
    showingResults,
  } from '#lib/components/search/search-box.svelte.js';
  import SearchKindResults from '#lib/components/search/SearchKindResults.svelte';
  import SearchOverview from '#lib/components/search/SearchOverview.svelte';
  import SearchSuggestions from '#lib/components/search/SearchSuggestions.svelte';
  import SearchTabs from '#lib/components/search/SearchTabs.svelte';
  import {
    SEARCH_PANEL_ID,
    searchTabId,
    searchTabOf,
  } from '#lib/components/search/view.js';
  import { getAppView } from '#lib/components/shared/app-context.svelte.js';
  import { desktopLayout } from '#lib/components/shared/layout.js';
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js';
  import { langOf } from '#lib/components/shared/text.js';

  const view = getAppView();
  const signedIn = $derived(view.state.library !== null);
  const keyword = $derived((page.url.searchParams.get('q') ?? '').trim());
  const tab = $derived(searchTabOf(page.url.searchParams.get('type')));

  scrollSnapshot(
    '/search',
    () =>
      Object.fromEntries(
        [...document.querySelectorAll<HTMLElement>('[data-shelf]')].map(
          (shelf) => [shelf.dataset.shelf, shelf.scrollLeft],
        ),
      ),
    (shelves) => {
      for (const shelf of document.querySelectorAll<HTMLElement>(
        '[data-shelf]',
      ))
        shelf.scrollLeft = shelves[shelf.dataset.shelf ?? ''] ?? 0;
    },
  );

  $effect(() => view.app.viewing({ kind: 'search', keyword }));

  let tabsHeight = $state(0);
  $effect(() => {
    const { style } = document.documentElement;
    style.setProperty('--sticky-below-header', `${tabsHeight}px`);
    return () => style.removeProperty('--sticky-below-header');
  });

  const pick = (row: SuggestionRow) => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    pickSuggestion(view.app, row);
  };
</script>

<svelte:head
  ><title>{keyword ? `“${keyword}”的搜索结果` : '搜索'} · Campanula</title
  ></svelte:head
>

{#snippet results(phone: boolean)}
  <div
    id={SEARCH_PANEL_ID}
    role="tabpanel"
    aria-labelledby={searchTabId(tab)}
    class={phone ? 'pt-1' : 'pt-5'}
  >
    {#if tab === 'all'}
      <SearchOverview {keyword} {phone} />
    {:else}
      <SearchKindResults {keyword} kind={tab} {phone} />
    {/if}
  </div>
{/snippet}

{#if signedIn}
  {#if desktopLayout.current}
    {#if keyword}
      <h1 class="pt-2 text-headline text-neutral-900 font-600">
        “<span lang={langOf(keyword)}>{keyword}</span>”<span class="sr-only"
          >的搜索结果</span
        >
      </h1>
      <div
        class="sticky z-10 mt-3 bg-primary-50 px-3 -mx-3"
        style:top="calc(4rem + var(--offline-bar-height, 0px))"
        bind:clientHeight={tabsHeight}
      >
        <SearchTabs {keyword} {tab} />
      </div>
      {@render results(false)}
    {:else}
      <h1 class="sr-only">搜索</h1>
    {/if}
  {:else}
    <h1 class="sr-only">{keyword ? `“${keyword}”的搜索结果` : '搜索'}</h1>
    {#if showingResults()}
      {@render results(true)}
    {:else}
      <SearchSuggestions phone onpick={pick} />
    {/if}
  {/if}
{/if}
