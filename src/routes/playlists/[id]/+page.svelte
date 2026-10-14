<!--
  歌单页（我喜欢的音乐也是这一页）。桌面沿用原来的两栏：左边是曲库里的歌单，右边是 200px 大封面的头部和虚拟列表
  （窄于 1024px 时左栏收起，DESIGN.md Layout）；手机是二级页面：返回栏、居中的封面头部、歌单内搜索、歌曲行。
  打开时这张歌单还没同步全，就马上用前台请求拉它（App 的 openPlaylist），不等后台同步。
  返回这一页时，搜索词和滚动位置都回到原来的样子（存在 SvelteKit 的 snapshot 里，跟着浏览历史走）
-->
<script lang='ts'>
  import { afterNavigate, goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { getAppView } from '$lib/components/app-context.svelte'
  import { desktopLayout } from '$lib/components/layout'
  import Cover from '$lib/components/library/Cover.svelte'
  import PlaylistSongs from '$lib/components/library/PlaylistSongs.svelte'
  import { formatCount, langOf, playlistName, playlistView } from '$lib/components/library/view'
  import { scrollSnapshot } from '$lib/components/snapshot'
  import SearchField from '$lib/components/ui/SearchField.svelte'
  import StateBlock from '$lib/components/ui/StateBlock.svelte'
  import { ListMusic, Lock } from '@lucide/svelte'

  const view = getAppView()
  const library = $derived(view.state.library)
  const id = $derived(Number(page.params.id))
  const playlist = $derived(library?.songsOf(id) ?? null)
  const shown = $derived(library && playlistView(library, id))

  let query = $state('')
  export const snapshot = scrollSnapshot(() => query, (value) => {
    query = value
  })
  // 从左边换到另一张歌单：搜索词清空。前进、后退由 snapshot 恢复
  afterNavigate(({ type }) => {
    if (type !== 'popstate')
      query = ''
  })

  // 歌单列表到了（首次同步时要等它）、换了一张歌单：还没同步全就马上拉
  const listReady = $derived(library?.playlists != null)
  $effect(() => {
    if (listReady)
      void view.app.openPlaylist(id)
  })

  const name = $derived(playlist ? playlistName(playlist.playlist) : '')
  /**
   * 下面列表里的首数（同步完了是实际有的歌，还在同步时是一共几首）；列表还没出来时不写，
   * 头部和左栏当前这一项都用它，和列表对得上（DESIGN.md Do's）
   */
  const listedCount = $derived(shown?.kind === 'songs' ? shown.total : shown?.kind === 'empty' ? 0 : null)
  const meta = $derived.by(() => {
    if (!playlist)
      return []
    const { creator, kind } = playlist.playlist
    const count = shown?.kind === 'songs' && !shown.complete
      ? `已同步 ${formatCount(shown.songs.length)} / ${formatCount(shown.total)} 首`
      : listedCount === null ? '' : `${formatCount(listedCount)} 首`
    return [creator, kind === 'own' ? '自建歌单' : kind === 'collected' ? '收藏的歌单' : '', count].filter(Boolean)
  })

  // 桌面左栏：打开时、歌单列表到了时，把当前这张滚进左栏的视野里（只滚左栏，不动页面，免得打乱返回时恢复的滚动位置）
  let sideNav = $state<HTMLElement>()
  $effect(() => {
    void id
    void listReady
    const current = sideNav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!sideNav || !current)
      return
    if (current.offsetTop < sideNav.scrollTop || current.offsetTop + current.offsetHeight > sideNav.scrollTop + sideNav.clientHeight)
      sideNav.scrollTop = current.offsetTop - 8
  })
</script>

<svelte:head><title>{name || '歌单'} · Campanula</title></svelte:head>

{#snippet metaLine(phone: boolean)}
  <p class={['flex flex-wrap items-center gap-x-1.5 text-neutral-600', phone ? 'mt-1.5 justify-center text-caption' : 'mt-2 text-label']}>
    {#each meta as part, i (i)}
      {#if i > 0}<span aria-hidden='true'>·</span>{/if}
      <span class='tabular-nums' lang={i === 0 ? langOf(part) : undefined}>{part}</span>
    {/each}
    {#if playlist?.playlist.private}<span class='inline-flex items-center gap-1'><Lock size={13} aria-hidden='true' />隐私</span>{/if}
  </p>
{/snippet}

{#if library && shown?.kind === 'missing'}
  <StateBlock
    kind='empty'
    icon={ListMusic}
    title='曲库里没有这张歌单'
    body='它可能已经在网易云音乐里删掉了，或者取消了收藏。'
    action={{ label: '回到曲库', run: () => goto(resolve('/')) }}
  />
{:else if library && desktopLayout.current}
  <!-- 左栏在视觉上排在前面，但 Tab 先到这张歌单（搜索、列表），不用先走完几十张歌单 -->
  <div class='grid items-start gap-8 lg:grid-cols-[208px_minmax(0,1fr)]'>
    <div class='min-w-0 pt-2 lg:col-start-2 lg:row-start-1'>
      {#if playlist}
        <header class='flex gap-7'>
          <Cover url={playlist.playlist.coverUrl} size={200} eager class='rounded-xl shadow-ambient' />
          <div class='min-w-0 flex flex-1 flex-col pt-1'>
            <h1 class='line-clamp-2 break-words text-headline text-neutral-900 font-600' lang={langOf(name)}>{name}</h1>
            {@render metaLine(false)}
            <div class='mt-auto flex justify-end pt-4'>
              <SearchField label='在歌单里搜索' bind:value={query} class='max-w-full w-[280px]' disabled={shown?.kind !== 'songs'} />
            </div>
          </div>
        </header>
      {/if}
      <div class='mt-6'><PlaylistSongs {library} playlistId={id} bind:query /></div>
    </div>

    <nav bind:this={sideNav} class='side sticky top-20 hidden max-h-[calc(100dvh-112px)] overflow-y-auto pb-4 lg:col-start-1 lg:row-start-1 -ml-2 lg:block' aria-label='曲库里的歌单'>
      <ul class='flex flex-col gap-1 px-2'>
        {#each library.playlists ?? [] as item (item.id)}
          {@const current = item.id === id}
          {@const itemName = playlistName(item)}
          <li>
            <a
              href={resolve('/playlists/[id]', { id: String(item.id) })}
              class={['block rounded-xl p-4 transition-colors duration-feedback', current ? 'bg-primary-100' : 'mouse:hover:bg-white']}
              aria-current={current ? 'page' : undefined}
            >
              <Cover url={item.coverUrl} size={176} fluid class='rounded-lg' />
              <span class={['mt-2.5 block truncate text-label font-500', current ? 'text-primary-950' : 'text-neutral-900']} lang={langOf(itemName)}>{itemName}</span>
              <span class={['mt-0.5 block text-caption tabular-nums', current ? 'text-primary-900' : 'text-neutral-600']}>{formatCount(current ? listedCount ?? item.trackCount : item.trackCount)} 首</span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  </div>
{:else if library}
  {#if playlist}
    <header class='px-4 pt-2 text-center'>
      <Cover url={playlist.playlist.coverUrl} size={168} eager class='mx-auto rounded-xl shadow-ambient' />
      <h1 class='line-clamp-2 mt-4 text-headline-sm text-neutral-900 font-600' lang={langOf(name)}>{name}</h1>
      {@render metaLine(true)}
    </header>
  {/if}
  <PlaylistSongs {library} playlistId={id} bind:query phone />
{/if}

<style>
  .side {
    scrollbar-width: none;
  }
</style>
