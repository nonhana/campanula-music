<!--
  搜索（#31、#32，Spec #11“搜索”）。搜的词在地址的 q 里，选中的标签在 type 里（综合不写）：返回、刷新时照样打开这次搜索、停在这个标签
  （不再记进搜索历史）。
  桌面：搜索框在顶栏（DesktopSearchBox），这一页是内容区里的结果页：标题是“…”（读屏读“…”的搜索结果），下面是吸在顶栏下面的标签（SearchTabs），
  再下面是综合（SearchOverview）或一类的全部（SearchKindResults）。
  手机：从 logo 行的搜索按钮进来的整页，顶行是搜索框（PhoneSearchBar）；框空着时是搜索历史（没有就空着），打字时是建议，
  框里是这一页搜的词时是结果，标签在骨架的标签行里（SignedInFrame）。返回这一页时滚动位置回到原来的样子
-->
<script lang='ts'>
  import { page } from '$app/state'
  import { Search } from '@lucide/svelte'

  import type { SuggestionRow } from '#lib/components/search/search-box.svelte.js'
  import { pickSuggestion, showingResults } from '#lib/components/search/search-box.svelte.js'
  import SearchKindResults from '#lib/components/search/SearchKindResults.svelte'
  import SearchOverview from '#lib/components/search/SearchOverview.svelte'
  import SearchSuggestions from '#lib/components/search/SearchSuggestions.svelte'
  import SearchTabs from '#lib/components/search/SearchTabs.svelte'
  import { SEARCH_PANEL_ID, searchTabId, searchTabOf } from '#lib/components/search/view.js'
  import { getAppView } from '#lib/components/shared/app-context.svelte.js'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js'
  import { langOf } from '#lib/components/shared/text.js'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'

  const view = getAppView()
  const signedIn = $derived(view.state.library !== null)
  /** 这一页搜的词 */
  const keyword = $derived((page.url.searchParams.get('q') ?? '').trim())
  const tab = $derived(searchTabOf(page.url.searchParams.get('type')))

  // 返回这一页时窗口和综合里横向架子的滚动位置都回到原来的样子（架子按 Shelf 的 data-shelf 对上）
  scrollSnapshot(
    '/search',
    () => Object.fromEntries([
      ...document.querySelectorAll<HTMLElement>('[data-shelf]'),
    ].map(shelf => [shelf.dataset.shelf, shelf.scrollLeft])),
    (shelves) => {
      for (const shelf of document.querySelectorAll<HTMLElement>('[data-shelf]'))
        shelf.scrollLeft = shelves[shelf.dataset.shelf ?? ''] ?? 0
    },
  )

  // 听众在看这个词的结果：什么时候拉（登录后才拉）由 App 决定；换词、从别处回来都会重新报告
  $effect(() => view.app.viewing({ kind: 'search', keyword }))

  /** 桌面吸在顶栏下面的标签行有多高 */
  let tabsHeight = $state(0)
  // 桌面：Tab 到、定位到的东西不藏在顶栏和标签行底下（DesktopShell 的 scroll-padding-top，DESIGN.md Layout · 滚动）
  $effect(() => {
    const { style } = document.documentElement
    style.setProperty('--sticky-below-header', `${tabsHeight}px`)
    return () => style.removeProperty('--sticky-below-header')
  })

  /** 手机上点了搜索历史里的词、建议：收起键盘，搜它或打开歌手、专辑、歌单的页面 */
  const pick = (row: SuggestionRow) => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
    pickSuggestion(view.app, row)
  }
</script>

<svelte:head><title>{keyword
  ? `“${keyword}”的搜索结果`
  : '搜索'} · Campanula</title></svelte:head>

{#snippet results(phone: boolean)}
  <div id={SEARCH_PANEL_ID} role='tabpanel' aria-labelledby={searchTabId(tab)} class={phone ? 'pt-1' : 'pt-5'}>
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
      <h1 class='pt-2 text-headline text-neutral-900 font-600'>“<span lang={langOf(keyword)}>{keyword}</span>”<span class='sr-only'>的搜索结果</span></h1>
      <!-- 底色比内容区两边各宽 12px：架子伸出去的格子、阴影滚到它底下时也盖得住 -->
      <div class='sticky top-16 z-10 mt-3 bg-primary-50 px-3 -mx-3' bind:clientHeight={tabsHeight}>
        <SearchTabs {keyword} {tab} />
      </div>
      {@render results(false)}
    {:else}
      <h1 class='sr-only'>搜索</h1>
      <StateBlock kind='empty' icon={Search} title='在顶栏的搜索框里输入' />
    {/if}
  {:else}
    <h1 class='sr-only'>{keyword
      ? `“${keyword}”的搜索结果`
      : '搜索'}</h1>
    {#if showingResults()}
      {@render results(true)}
    {:else}
      <SearchSuggestions phone onpick={pick} />
    {/if}
  {/if}
{/if}
