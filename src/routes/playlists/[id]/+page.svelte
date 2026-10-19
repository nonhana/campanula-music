<!--
  歌单页（我喜欢的音乐也是这一页）。桌面上曲库里的歌单沿用原来的两栏：左边是曲库里的歌单，右边是 200px 大封面的头部和虚拟列表
  （窄于 1024px 时左栏收起，DESIGN.md Layout）；不在曲库里的歌单和专辑页一样是一栏，不显示左栏，和自己的歌单区分开。
  手机是二级页面：返回栏、居中的封面头部、简介卡片、歌单内搜索、歌曲行。
  每张歌单都在信息行下面显示标签，在头部下面显示简介（和专辑页共用的 Description，截断后可以展开），手机也一样。
  打开时这张歌单还没同步全，就马上用前台请求拉它（App 的 openPlaylist），不等后台同步。
  不在曲库里的歌单不存进本机，每次打开都用 App 的 openPlaylist 联网取，页头分类写“网易云歌单”；
  已删除、不存在、别人的隐私歌单打不开时说明原因。
  头部播放全部旁边是收藏开关：不在曲库里的写“收藏”，收藏的写“已收藏”（点了直接取消收藏、不确认）；我喜欢的音乐、自建歌单没有。
  自建歌单在那里是 •••（PlaylistMenu）：编辑歌单信息、改为公开（隐私歌单才有）、删除歌单（#33）；我喜欢的音乐不能改名、不能删，没有它。
  返回这一页时，搜索词和滚动位置都回到原来的样子（存在 SvelteKit 的 snapshot 里，跟着浏览历史走）
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { PlaylistUnavailable } from '#lib/api/library.js'
  import type { LibraryState } from '#lib/app/library.js'
  import { afterNavigate, goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { Ellipsis, ListX, Lock, SearchX } from '@lucide/svelte'
  import { getAppView } from '#lib/components/app-context.svelte.js'
  import { failureText } from '#lib/components/failure.js'
  import { desktopLayout } from '#lib/components/layout.js'
  import CollectButton from '#lib/components/library/CollectButton.svelte'
  import Cover from '#lib/components/library/Cover.svelte'
  import Description from '#lib/components/library/Description.svelte'
  import PlayAllButton from '#lib/components/library/PlayAllButton.svelte'
  import PlaylistSongs from '#lib/components/library/PlaylistSongs.svelte'
  import { FLIGHT_COVER_SIZE, formatCount, langOf, playlistHeader, playlistName, playlistView } from '#lib/components/library/view.js'
  import { atOnce, fadeAway, reveal, scrollBehavior, stagger } from '#lib/components/motion.js'
  import { anchorBelow } from '#lib/components/overlay-layer.svelte.js'
  import { playlistMenu } from '#lib/components/playlist-edit.svelte.js'
  import { scrollSnapshot } from '#lib/components/snapshot.js'
  import IconButton from '#lib/components/ui/IconButton.svelte'
  import Scrollbar from '#lib/components/ui/Scrollbar.svelte'
  import SearchField from '#lib/components/ui/SearchField.svelte'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'
  import Tag from '#lib/components/ui/Tag.svelte'

  const view = getAppView()
  const library = $derived(view.state.library)
  const id = $derived(Number(page.params.id))
  const shown = $derived(library && playlistView(library, id))
  /** 不在曲库里的歌单（歌单列表已经拿到、里面没有它） */
  const outside = $derived(library?.playlists != null && !library.songsOf(id))
  const header = $derived(library && shown ? playlistHeader(library, id, shown) : null)
  /** 页头大封面代表这一页：从格子点进来时，格子的封面飞到这里（Cover 的 flight） */
  const here = $derived(resolve('/playlists/[id]', { id: String(id) }))

  let query = $state('')
  export const snapshot = scrollSnapshot(() => query, (value) => {
    query = value
  })
  // 从左边换到另一张歌单：搜索词清空，直接到位（新的这一页里不再淡一次）。前进、后退由 snapshot 恢复
  afterNavigate(({ type, shallow }) => {
    // 打开播放页、歌曲菜单是浅路由（goto 的 shallow），还在这一张歌单上，搜索词不清
    if (shallow && type === 'goto')
      return
    if (type !== 'popstate')
      atOnce(() => (query = ''))
  })

  // 歌单列表到了（首次同步时要等它）、换了一张歌单：还没同步全就马上拉。
  // 打开着的时候同步发现它不在曲库里了（取消了收藏、删掉了），改成联网取，已删除的就说明原因
  const listReady = $derived(library?.playlists != null)
  $effect(() => {
    void outside
    if (listReady)
      void view.app.openPlaylist(id)
  })

  const name = $derived(header?.name ?? '')
  /**
   * 下面列表里的首数（同步完了是实际有的歌，还在同步时是一共几首）；列表还没出来时不写，
   * 头部和左栏当前这一项都用它，和列表对得上（DESIGN.md Do's）
   */
  const listedCount = $derived(shown?.kind === 'songs' ? shown.total : shown?.kind === 'empty' ? 0 : null)
  /** 自建歌单：有 •••，能编辑、删除 */
  const own = $derived(library?.songsOf(id)?.playlist.kind === 'own')

  /** 打开 •••：触屏是底部弹层，鼠标贴着按钮；已经从这个按钮打开着就关上 */
  function openMenu(event: MouseEvent) {
    const button = event.currentTarget as HTMLElement
    if (playlistMenu.request?.from === button)
      return playlistMenu.close()
    playlistMenu.open({ playlistId: id, from: button, anchor: anchorBelow(event) })
  }

  /** 打不开的歌单：说明为什么 */
  const UNAVAILABLE = {
    deleted: { icon: ListX, title: '这张歌单已被删除', body: '创建者在网易云音乐里删掉了它，打不开了。' },
    missing: { icon: SearchX, title: '没有这张歌单', body: '网易云音乐里找不到这张歌单，可能是地址不对。' },
    private: { icon: Lock, title: '这是别人的隐私歌单', body: '创建者把它设成了隐私歌单，只有创建者自己能打开。' },
  } satisfies Record<PlaylistUnavailable, { icon: LucideIcon, title: string, body: string }>

  // 桌面左栏：打开时、歌单列表到了时、换了一张歌单时，把当前这张滚进左栏的视野里（只滚左栏，不动页面，免得打乱返回时恢复的滚动位置）。
  // 刚打开时直接定位过去；之后（前进、后退到别的歌单）平滑地滚过去，减少动态效果时直接跳
  let sideNav = $state<HTMLElement>()
  let sidePlaced = false
  $effect(() => {
    void id
    void listReady
    const current = sideNav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!sideNav || !current)
      return
    if (current.offsetTop < sideNav.scrollTop || current.offsetTop + current.offsetHeight > sideNav.scrollTop + sideNav.clientHeight)
      sideNav.scrollTo({ top: current.offsetTop - 8, behavior: sidePlaced ? scrollBehavior() : 'auto' })
    sidePlaced = true
  })
</script>

<svelte:head><title>{name || '歌单'} · Campanula</title></svelte:head>

{#snippet metaLine(phone: boolean)}
  {#if header}
    <p class={['flex flex-wrap items-center gap-x-1.5 text-neutral-600', phone ? 'mt-1.5 justify-center text-caption' : 'mt-2 text-label']}>
      {#each header.meta as part, i (i)}
        {#if i > 0}<span aria-hidden='true'>·</span>{/if}
        <span class='tabular-nums' lang={i === 0 ? langOf(part) : undefined}>{part}</span>
      {/each}
      {#if header.private}<span class='inline-flex items-center gap-1'><Lock size={13} aria-hidden='true' />隐私</span>{/if}
    </p>
  {/if}
{/snippet}

{#snippet actions()}
  <div class='flex items-center gap-2'>
    <PlayAllButton songs={shown?.kind === 'songs' ? shown.songs : null} source={{ kind: 'playlist', id }} />
    <CollectButton target={{ kind: 'playlist', id }} {name} look='pill' />
    {#if own}
      <IconButton icon={Ellipsis} label='歌单操作：{name}' aria-haspopup='menu' aria-expanded={playlistMenu.request?.playlistId === id} onclick={openMenu} />
    {/if}
  </div>
{/snippet}

{#snippet mainColumn(library: LibraryState)}
  <!-- 首次同步时歌单列表到了才有页头：飘进来，不一下冒出来；带着页头打开这一页时不飘 -->
  {#if header}
    <header class='flex gap-7' in:reveal>
      <Cover url={header.coverUrl} size={FLIGHT_COVER_SIZE} eager flight={here} class='rounded-xl shadow-ambient' />
      <div class='min-w-0 flex flex-1 flex-col pt-1'>
        <h1 class='line-clamp-2 break-words text-headline text-neutral-900 font-600' lang={langOf(name)}>{name}</h1>
        {@render metaLine(false)}
        {#if header.tags.length > 0}<p class='mt-2.5 flex flex-wrap gap-1.5'>{#each header.tags as tag (tag)}<Tag>{tag}</Tag>{/each}</p>{/if}
        <div class='mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-3 pt-4'>
          {@render actions()}
          <SearchField label='在歌单里搜索' bind:value={query} class='max-w-full w-[280px]' disabled={shown?.kind !== 'songs'} />
        </div>
      </div>
    </header>
  {:else if outside}
    <div class='flex gap-7' aria-hidden='true' out:fadeAway>
      <span class='bone size-[200px] flex-none rounded-xl'></span>
      <div class='min-w-0 flex flex-1 flex-col pt-2'>
        <span class='bone h-7 w-2/5 rounded-full'></span>
        <span class='bone mt-4 h-3.5 w-1/4 rounded-full'></span>
      </div>
    </div>
  {/if}
  <!-- 从左栏换到另一张歌单时简介重新来过：上一张展开过的，这一张还是截断着 -->
  {#if header?.description}<div in:reveal>{#key id}<Description text={header.description} />{/key}</div>{/if}
  <div class='mt-6'><PlaylistSongs {library} playlistId={id} bind:query /></div>
{/snippet}

{#if library && shown?.kind === 'unavailable'}
  {@const why = UNAVAILABLE[shown.reason]}
  <div in:reveal>
    <StateBlock
      kind='empty'
      icon={why.icon}
      title={why.title}
      body={why.body}
      action={{ label: '回到曲库', run: () => goto(resolve('/')) }}
    />
  </div>
{:else if library && outside && shown?.kind === 'failed'}
  <!-- 第一次打开就什么都没取到 -->
  <div in:reveal>
    <StateBlock
      kind='error'
      title='这张歌单没能打开'
      body={shown.failure.kind === 'offline' ? '这张歌单不在你的曲库里，要联网才能打开。连上网络后再试。' : failureText(shown.failure)}
      action={{ label: '重试', run: () => void view.app.openPlaylist(id) }}
    />
  </div>
{:else if library && desktopLayout.current && outside}
  <!-- 不在曲库里的歌单：和专辑页一样一栏，不显示左栏 -->
  <div class='pt-2'>{@render mainColumn(library)}</div>
{:else if library && desktopLayout.current}
  <!-- 左栏在视觉上排在前面，但 Tab 先到这张歌单（搜索、列表），不用先走完几十张歌单 -->
  <div class='grid items-start gap-8 lg:grid-cols-[208px_minmax(0,1fr)]'>
    <div class='min-w-0 pt-2 lg:col-start-2 lg:row-start-1'>{@render mainColumn(library)}</div>

    <nav bind:this={sideNav} class='sticky top-20 hidden max-h-[calc(100dvh-112px)] overflow-y-auto pb-4 lg:col-start-1 lg:row-start-1 -ml-2 lg:block' aria-label='曲库里的歌单'>
      <Scrollbar />
      <ul class='flex flex-col gap-1 px-2'>
        {#each library.playlists ?? [] as item, i (item.id)}
          {@const current = item.id === id}
          {@const itemName = playlistName(item)}
          {@const itemPage = resolve('/playlists/[id]', { id: String(item.id) })}
          <!-- 首次同步时歌单列表到了，左栏的歌单依次飘入；之后同步来的新歌单也飘进来 -->
          <li in:stagger={{ order: i }}>
            <a
              href={itemPage}
              class={['block rounded-xl p-4 transition-colors duration-feedback', current ? 'bg-primary-100' : 'mouse:hover:bg-white']}
              aria-current={current ? 'page' : undefined}
            >
              <!-- 左栏的封面也是格子：点了飞到右边页头，返回时飞回这里（Cover 的 flight） -->
              <Cover url={item.coverUrl} size={FLIGHT_COVER_SIZE} fluid flight={itemPage} class='rounded-lg' />
              <span class={['mt-2.5 block truncate text-label font-500', current ? 'text-primary-950' : 'text-neutral-900']} lang={langOf(itemName)}>{itemName}</span>
              <span class={['mt-0.5 block text-caption tabular-nums', current ? 'text-primary-900' : 'text-neutral-600']}>{formatCount(current ? listedCount ?? item.trackCount : item.trackCount)} 首</span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  </div>
{:else if library}
  {#if header}
    <header class='px-4 pt-2 text-center' in:reveal>
      <Cover url={header.coverUrl} size={FLIGHT_COVER_SIZE} fluid eager flight={here} class='mx-auto max-w-[168px] rounded-xl shadow-ambient' />
      <h1 class='line-clamp-2 mt-4 text-headline-sm text-neutral-900 font-600' lang={langOf(name)}>{name}</h1>
      {@render metaLine(true)}
      {#if header.tags.length > 0}<p class='mt-2.5 flex flex-wrap justify-center gap-1.5'>{#each header.tags as tag (tag)}<Tag>{tag}</Tag>{/each}</p>{/if}
      <div class='mt-4 flex justify-center'>{@render actions()}</div>
    </header>
  {:else if outside}
    <div class='px-4 pt-2' aria-hidden='true' out:fadeAway>
      <span class='bone mx-auto size-[168px] rounded-xl'></span>
      <span class='bone mx-auto mt-5 h-6 w-1/2 rounded-full'></span>
      <span class='bone mx-auto mt-3 h-3 w-1/3 rounded-full'></span>
    </div>
  {/if}
  <!-- 换到另一张歌单时简介重新来过：上一张展开过的，这一张还是截断着 -->
  {#if header?.description}<div in:reveal>{#key id}<Description text={header.description} phone />{/key}</div>{/if}
  <PlaylistSongs {library} playlistId={id} bind:query phone />
{/if}
