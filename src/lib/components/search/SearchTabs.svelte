<script lang="ts">
  import { resolve } from '$app/paths';

  import { getAppView } from '../shared/app-context.svelte';
  import Tabs from '../ui/Tabs.svelte';
  import { selectSearchTab } from './search-box.svelte';
  import type { SearchTab } from './view';
  import {
    SEARCH_PANEL_ID,
    SEARCH_TABS,
    searchPath,
    searchTabId,
  } from './view';

  interface Props {
    keyword: string;
    tab: SearchTab;
    phone?: boolean;
  }

  const { keyword, tab, phone = false }: Props = $props();
  const view = getAppView();
  const results = $derived(
    view.state.search.results?.keyword === keyword
      ? view.state.search.results
      : null,
  );

  const totalOf = (key: SearchTab): number | null | undefined => {
    if (key === 'all') return undefined;
    if (!results) return null;
    const list = results[key];
    if (list.status === 'loading') return null;
    return list.status === 'shown' ? (list.total ?? undefined) : undefined;
  };

  const tabs = $derived(
    SEARCH_TABS.map((item) => ({
      key: item.key,
      label: item.label,
      href: resolve(searchPath(keyword, item.key)),
      count: totalOf(item.key),
    })),
  );
</script>

<Tabs
  {tabs}
  selected={tab}
  onselect={(key) => selectSearchTab(keyword, key)}
  idOf={searchTabId}
  panel={SEARCH_PANEL_ID}
  label="搜索结果分类"
  class={phone ? 'px-2' : '-mx-3'}
/>
