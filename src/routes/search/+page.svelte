<!--
  搜索（#31，Spec #11“搜索”）。搜的词在地址的 q 里：返回、刷新时照样打开这次搜索的结果（不再记进搜索历史）。
  桌面：搜索框在顶栏（DesktopSearchBox），这一页是内容区里的结果页：“…”的搜索结果，下面是单曲结果。
  手机：从 logo 行的搜索按钮进来的整页，顶行是搜索框（PhoneSearchBar）；框空着时是搜索历史，打字时是建议，
  框里是这一页搜的词时是结果。返回这一页时滚动位置回到原来的样子
-->
<script lang='ts'>
  import { page } from '$app/state'
  import { Search } from '@lucide/svelte'
  import { getAppView } from '#lib/components/app-context.svelte.js'
  import { desktopLayout } from '#lib/components/layout.js'
  import { langOf } from '#lib/components/library/view.js'
  import { searchBox, submitSearch } from '#lib/components/search/search-box.svelte.js'
  import SearchSuggestions from '#lib/components/search/SearchSuggestions.svelte'
  import SongResults from '#lib/components/search/SongResults.svelte'
  import { scrollSnapshot } from '#lib/components/snapshot.js'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'

  const view = getAppView()
  const signedIn = $derived(view.state.library !== null)
  /** 这一页搜的词 */
  const keyword = $derived((page.url.searchParams.get('q') ?? '').trim())
  /** 手机上框里正是这一页搜的词：显示结果；改了框里的字就换成建议、搜索历史 */
  const showingResults = $derived(keyword !== '' && searchBox.draft.trim() === keyword)

  export const snapshot = scrollSnapshot(() => null, () => {})

  // 登录了（本机副本到了）就交给 App：这个词的结果显示着、正在拉就不再拉
  $effect(() => {
    if (signedIn && keyword)
      void view.app.openSearch(keyword)
  })

  /** 手机上点了搜索历史里的词、建议：搜它，收起键盘 */
  function pick(word: string) {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
    submitSearch(view.app, word)
  }
</script>

<svelte:head><title>{keyword ? `“${keyword}”的搜索结果` : '搜索'} · Campanula</title></svelte:head>

{#if signedIn}
  {#if desktopLayout.current}
    {#if keyword}
      <h1 class='pt-2 text-headline text-neutral-900 font-600'>“<span lang={langOf(keyword)}>{keyword}</span>”的搜索结果</h1>
      <div class='mt-6'><SongResults {keyword} /></div>
    {:else}
      <h1 class='sr-only'>搜索</h1>
      <StateBlock kind='empty' icon={Search} title='在顶栏的搜索框里输入' body='可以搜歌名、歌手或专辑名，回车就搜。' />
    {/if}
  {:else}
    <h1 class='sr-only'>{keyword ? `“${keyword}”的搜索结果` : '搜索'}</h1>
    {#if showingResults}
      <div class='pt-1'><SongResults {keyword} phone /></div>
    {:else}
      <SearchSuggestions phone onpick={pick} />
    {/if}
  {/if}
{/if}
