<!--
  歌单页（我喜欢的音乐也是这一页）。桌面上曲库里的歌单沿用原来的两栏：左边是曲库里的歌单，右边是 200px 大封面的头部和虚拟列表
  （窄于 1024px 时左栏收起，DESIGN.md Layout）；不在曲库里的歌单和专辑页一样是一栏，不显示左栏，和自己的歌单区分开。
  手机是二级页面：返回栏、居中的封面头部、简介卡片、歌单内搜索、歌曲行。
  每张歌单都在信息行下面显示标签，在头部下面显示简介（和专辑页共用的 Description，截断后可以展开），手机也一样。
  头部交给 DetailHeader（#75：封面、标题、信息行、标签、动作、尾部搜索、骨架、淡入、pageHeading、封面飞行终点都在模块里）；
  左栏的每一项用 PlaylistTile 的 nav 画法，不再另画一张歌单卡。
  打开时这张歌单还没同步全，App 就马上用前台请求拉它（viewing 之后由 App 决定），不等后台同步；
  不在曲库里的歌单不存进本机，每次打开都由 App 联网取。页面只读 App 给的答案（state.library.playlistPage）。
  页头信息行不写类别（方封面和旁边的按钮已经说明是歌单）。
  已删除、不存在、别人的隐私歌单打不开时，标题说清是哪一种。
  头部播放全部旁边是收藏开关（桌面是“收藏 / 已收藏”胶囊，手机只留图标；点了已收藏直接取消收藏、不确认）：不在曲库里的和收藏的歌单有，我喜欢的音乐、自建歌单没有。
  自建歌单在那里是“添加歌曲”（手机只留图标）和 •••（PlaylistMenu）：编辑歌单信息、改为公开（隐私歌单才有）、删除歌单（#33）；我喜欢的音乐不能改名、不能删，没有它们。
  返回这一页时，搜索词和滚动位置都回到原来的样子（存在 SvelteKit 的 snapshot 里，跟着浏览历史走）
-->
<script lang='ts'>
  import { afterNavigate, goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import type { LucideIcon } from '@lucide/svelte'
  import { Ellipsis, ListChecks, ListMusic, ListPlus, Lock, SearchX } from '@lucide/svelte'

  import type { PlaylistUnavailable } from '#lib/api/library.js'
  import type { LibraryState } from '#lib/app/library.js'
  import CollectButton from '#lib/components/library/CollectButton.svelte'
  import Description from '#lib/components/library/Description.svelte'
  import DetailHeader from '#lib/components/library/DetailHeader.svelte'
  import PlaylistSongs from '#lib/components/library/PlaylistSongs.svelte'
  import PlaylistTile from '#lib/components/library/PlaylistTile.svelte'
  import { playlistHeader } from '#lib/components/library/view.js'
  import { anchorBelow } from '#lib/components/menu/menu-anchor.js'
  import { getOverlays } from '#lib/components/overlay/overlay-context.js'
  import { playlistName } from '#lib/components/playlist/playlist-text.js'
  import { getAppView } from '#lib/components/shared/app-context.svelte.js'
  import { failureText } from '#lib/components/shared/failure.js'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import { atOnce, reveal, scrollBehavior, stagger } from '#lib/components/shared/motion.js'
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js'
  import { langOf } from '#lib/components/shared/text.js'
  import PlayAllButton from '#lib/components/songs/PlayAllButton.svelte'
  import Button from '#lib/components/ui/Button.svelte'
  import IconButton from '#lib/components/ui/IconButton.svelte'
  import Scrollbar from '#lib/components/ui/Scrollbar.svelte'
  import SearchField from '#lib/components/ui/SearchField.svelte'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'
  import ToolButton from '#lib/components/ui/ToolButton.svelte'

  import type { PageProps } from './$types'

  const { params }: PageProps = $props()
  const view = getAppView()
  const { addSongsDialog, playlistSelection, playlistMenu } = getOverlays()
  const library = $derived(view.state.library)
  const id = $derived(params.id)
  const page = $derived(library?.playlistPage(id) ?? null)
  const shown = $derived(page?.songs ?? null)
  /** 不在曲库里的歌单（歌单列表已经拿到、里面没有它） */
  const outside = $derived(page?.inLibrary === false)
  const header = $derived(page && playlistHeader(page))
  const phone = $derived(!desktopLayout.current)
  /** 页头大封面代表这一页：从格子点进来时，格子的封面飞到这里（Cover 的 flight） */
  const here = $derived(resolve('/playlists/[id=neteaseId]', { id }))

  let query = $state('')
  /** 桌面“多选 · 排序”：进入多选后被工具条换掉，退出时靠它重新找到并接回焦点（#66） */
  let desktopEntry = $state<HTMLElement>()
  /** 桌面“多选 · 排序”入口：按钮自己的 focusEntry 和列表行回收后的兜底都用它 */
  const desktopEntryFocus = () => desktopEntry?.querySelector<HTMLElement>('button') ?? null
  scrollSnapshot('/playlists/[id=neteaseId]', () => query, (value) => {
    query = value
  })
  // 从左边换到另一张歌单：搜索词清空，直接到位（新的这一页里不再淡一次）。前进、后退由 snapshot 恢复
  afterNavigate(({ type, shallow }) => {
    // 打开播放页、歌曲菜单是浅路由（goto 的 shallow），还在这一张歌单上，搜索词不清
    if (shallow && type === 'goto')
      return
    if (type !== 'popstate' && type !== 'enter')
      atOnce(() => (query = ''))
  })

  // 听众在看这一张歌单（换一张、离开这一页都由这一次调用管）：什么时候拉、进出曲库怎么切换由 App 决定；
  // 离开时 App 提交还没提交的移除和排序
  $effect(() => view.app.viewing({ kind: 'playlist', id }))

  const name = $derived(header?.name ?? '')
  /**
   * 下面列表里的首数（同步完了是实际有的歌，还在同步时是一共几首）；列表还没出来时不写，
   * 头部和左栏当前这一项都用它，和列表对得上（DESIGN.md Do's）
   */
  const listedCount = $derived(page?.count?.total ?? null)
  /** 自建歌单：有 •••，能编辑、删除 */
  const own = $derived(page?.can.edit ?? false)
  /** 能拖动排序的列表（自建歌单、我喜欢的音乐）：桌面的入口写“多选 · 排序”（#36） */
  const sortableList = $derived(page?.can.sort ?? false)

  /** 打开 •••：触屏是底部弹层，鼠标贴着按钮；已经从这个按钮打开着就关上 */
  const openMenu = (event: MouseEvent) => {
    const button = event.currentTarget as HTMLElement
    if (playlistMenu.request?.from === button)
      return playlistMenu.close()
    playlistMenu.open({
      playlistId: id,
      from: button,
      anchor: anchorBelow(event),
    })
  }

  /** 自建歌单的“添加歌曲”：桌面居中弹窗、手机底部弹层。 */
  const openAddSongs = (event: MouseEvent) => {
    addSongsDialog.open({ playlistId: id, from: event.currentTarget as HTMLElement })
  }

  // 离开这张歌单、还没提交的移除立即提交：由上面 viewing 的清理做（页面隐藏时 App 自己也会做）；
  // 多选由列表源卸载时自己退出

  /** 打不开的歌单：标题说清是哪一种，只有“不存在”补一句 */
  const UNAVAILABLE = {
    deleted: { icon: ListMusic, title: '这张歌单已被删除' },
    missing: { icon: SearchX, title: '没有这张歌单', body: '可能是地址不对' },
    private: { icon: Lock, title: '这是别人的隐私歌单' },
  } satisfies Record<PlaylistUnavailable, { icon: LucideIcon, title: string, body?: string }>

  // 桌面左栏：打开时、歌单列表到了时、换了一张歌单时，把当前这张滚进左栏的视野里（只滚左栏，不动页面，免得打乱返回时恢复的滚动位置）。
  // 刚打开时直接定位过去；之后（前进、后退到别的歌单）平滑地滚过去，减少动态效果时直接跳
  let sideNav = $state<HTMLElement>()
  let sidePlaced = false
  $effect(() => {
    void id
    void (library?.playlists != null)
    const current = sideNav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!sideNav || !current)
      return
    if (current.offsetTop < sideNav.scrollTop || current.offsetTop + current.offsetHeight > sideNav.scrollTop + sideNav.clientHeight) {
      sideNav.scrollTo({
        top: current.offsetTop - 8,
        behavior: sidePlaced
          ? scrollBehavior()
          : 'auto',
      })
    }
    sidePlaced = true
  })
</script>

<svelte:head><title>{name || '歌单'} · Campanula</title></svelte:head>

{#snippet headerMeta()}
  {#if header}
    {#each header.meta as part, i (i)}
      {#if i > 0}<span aria-hidden='true'>·</span>{/if}
      <span class='tabular-nums' lang={i === 0
        ? langOf(part)
        : undefined}>{part}</span>
    {/each}
    {#if header.private}<span class='inline-flex items-center' role='img' aria-label='隐私歌单' title='隐私歌单'><Lock size={13} aria-hidden='true' /></span>{/if}
  {/if}
{/snippet}

{#snippet headerActions()}
  <PlayAllButton songs={shown?.kind === 'songs'
    ? shown.songs
    : null} source={{ kind: 'playlist', id }} />
  {#if own}
    <ToolButton icon={ListPlus} label='添加歌曲' data-add-songs-entry onclick={openAddSongs} />
  {/if}
  {#if desktopLayout.current && shown?.kind === 'songs' && shown.songs.length > 0 && !playlistSelection.mode}
    <span class='contents' bind:this={desktopEntry}>
      <Button
        variant='outline'
        icon={ListChecks}
        onclick={(event: MouseEvent) => playlistSelection.enter({
          from: event.currentTarget as HTMLElement,
          focusFirst: true,
          focusEntry: desktopEntryFocus,
        })}
      >{sortableList ? '多选 · 排序' : '多选'}</Button>
    </span>
  {/if}
  {#if page?.can.collect}
    <CollectButton target={{ kind: 'playlist', id }} {name} look='pill' />
  {/if}
  {#if own}
    <IconButton icon={Ellipsis} label='歌单操作：{name}' aria-haspopup='menu' aria-expanded={playlistMenu.request?.playlistId === id} onclick={openMenu} />
  {/if}
{/snippet}

{#snippet headerSearch()}
  <SearchField label='在歌单里搜索' bind:value={query} class='max-w-full w-[280px]' disabled={shown?.kind !== 'songs'} />
{/snippet}

{#snippet mainColumn(library: LibraryState)}
  <DetailHeader
    ready={!!header}
    cover={{ url: header?.coverUrl ?? null }}
    title={name}
    flight={here}
    tags={header?.tags ?? []}
  >
    {#snippet meta()}{@render headerMeta()}{/snippet}
    {#snippet actions()}{@render headerActions()}{/snippet}
    {#snippet trailing()}{@render headerSearch()}{/snippet}
  </DetailHeader>
  <!-- 从左栏换到另一张歌单时简介重新来过：上一张展开过的，这一张还是截断着 -->
  {#if header?.description}<div in:reveal>{#key id}<Description text={header.description} {phone} />{/key}</div>{/if}
  <div class={phone ? '' : 'mt-6'}><PlaylistSongs {library} playlistId={id} bind:query entryFocus={desktopEntryFocus} {phone} /></div>
{/snippet}

{#if library && page && page.songs.kind === 'unavailable'}
  {@const why = UNAVAILABLE[page.songs.reason]}
  <div in:reveal>
    <StateBlock
      kind='empty'
      icon={why.icon}
      title={why.title}
      body={'body' in why
        ? why.body
        : undefined}
      action={{
        label: '回到曲库',
        run: () => goto(resolve('/')),
      }}
    />
  </div>
{:else if library && outside && page?.failure?.where === 'list'}
  <!-- 第一次打开就什么都没取到 -->
  <div in:reveal>
    <StateBlock
      kind='error'
      title='这张歌单没能打开'
      body={page.failure.failure.kind === 'offline'
        ? '不在曲库里的歌单要联网才能打开'
        : failureText(page.failure.failure)}
      action={{
        label: '重试',
        run: () => void view.app.openPlaylist(id),
      }}
    />
  </div>
{:else if library && desktopLayout.current && outside}
  <!-- 不在曲库里的歌单：和专辑页一样一栏，不显示左栏 -->
  {@render mainColumn(library)}
{:else if library && desktopLayout.current}
  <!-- 左栏在视觉上排在前面，但 Tab 先到这张歌单（搜索、列表），不用先走完几十张歌单 -->
  <div class='grid items-start gap-8 lg:grid-cols-[208px_minmax(0,1fr)]'>
    <div class='min-w-0 lg:col-start-2 lg:row-start-1'>{@render mainColumn(library)}</div>

    <nav bind:this={sideNav} class='sticky top-20 hidden max-h-[calc(100dvh-112px)] overflow-y-auto pb-4 lg:col-start-1 lg:row-start-1 -ml-2 lg:block' aria-label='曲库里的歌单'>
      <Scrollbar />
      <ul class='flex flex-col gap-1 px-2'>
        {#each library.playlists ?? [] as item, i (item.id)}
          {@const current = item.id === id}
          <!-- 首次同步时歌单列表到了，左栏的歌单依次飘入；之后同步来的新歌单也飘进来 -->
          <li in:stagger={{ order: i }}>
            <PlaylistTile
              id={item.id}
              name={playlistName(item)}
              coverUrl={item.coverUrl}
              trackCount={current
                ? listedCount ?? item.trackCount
                : item.trackCount}
              creator={null}
              locked={item.private}
              look='nav'
              {current}
            />
          </li>
        {/each}
      </ul>
    </nav>
  </div>
{:else if library}
  {@render mainColumn(library)}
{/if}
