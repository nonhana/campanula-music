<!--
  歌单页（我喜欢的音乐也是这一页）。桌面曲库里的歌单是两栏（左栏曲库、右栏 200px 大封面头部和虚拟列表，窄于 1024px 收起，
  DESIGN.md Layout），不在曲库里的和专辑页一样是一栏；手机是返回栏 + 居中封面头部 + 简介 + 歌单内搜索 + 歌曲行。
  头部交给 DetailHeader（#75），左栏用 PlaylistTile 的 nav 画法。页面只读 App 给的答案（state.library.playlistPage）：
  打开时还没同步全就由 App 用前台请求拉，不等后台同步；不在曲库里的不存进本机，每次打开都联网取。
  动作：收藏开关（不在曲库里的和收藏的歌单有）、自建歌单的“添加歌曲”和 •••（#33）；我喜欢的音乐都没有。
  返回这一页时，搜索词和滚动位置都回到原来的样子（snapshot，跟着浏览历史走）。
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
  const { addSongsDialog, multiSelect, playlistMenu } = getOverlays()
  const library = $derived(view.state.library)
  const id = $derived(params.id)
  const page = $derived(library?.playlistPage(id) ?? null)
  const shown = $derived(page?.songs ?? null)
  /** 歌单列表已经拿到、里面没有它 */
  const outside = $derived(page?.inLibrary === false)
  const header = $derived(page && playlistHeader(page))
  const phone = $derived(!desktopLayout.current)
  const here = $derived(resolve('/playlists/[id=neteaseId]', { id }))

  let query = $state('')
  /** 桌面“多选 · 排序”：进入多选后被工具条换掉，退出时靠它重新找到并接回焦点（#66） */
  let desktopEntry = $state<HTMLElement>()
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

  // 听众在看这一张歌单：什么时候拉、进出曲库怎么切换由 App 决定；离开时 App 提交还没提交的移除和排序
  $effect(() => view.app.viewing({ kind: 'playlist', id }))

  const name = $derived(header?.name ?? '')
  /** 同步完了是实际有的歌、还在同步时是一共几首；列表还没出来时不写。和列表对得上（DESIGN.md Do's） */
  const listedCount = $derived(page?.count?.total ?? null)
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

  const openAddSongs = (event: MouseEvent) => {
    addSongsDialog.open({ playlistId: id, from: event.currentTarget as HTMLElement })
  }

  // 离开还没提交的移除由上面 viewing 的清理立即提交（页面隐藏时 App 自己也会做）；多选由列表源卸载时自己退出

  /** 打不开的歌单：标题说清是哪一种，只有“不存在”补一句 */
  const UNAVAILABLE = {
    deleted: { icon: ListMusic, title: '这张歌单已被删除' },
    missing: { icon: SearchX, title: '没有这张歌单', body: '可能是地址不对' },
    private: { icon: Lock, title: '这是别人的隐私歌单' },
  } satisfies Record<PlaylistUnavailable, { icon: LucideIcon, title: string, body?: string }>

  // 桌面左栏：把当前这张滚进视野（只滚左栏，不动页面，免得打乱返回时恢复的滚动位置）；刚打开直接定位，之后平滑地滚过去
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
  {#if desktopLayout.current && shown?.kind === 'songs' && shown.songs.length > 0 && !multiSelect.mode}
    <span class='contents' bind:this={desktopEntry}>
      <Button
        variant='outline'
        icon={ListChecks}
        onclick={(event: MouseEvent) => multiSelect.enter({
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
