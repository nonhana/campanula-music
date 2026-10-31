<!--
  歌单页（我喜欢的音乐也是这一页）。桌面曲库里的歌单是两栏（左栏曲库、右栏 200px 大封面头部和虚拟列表，窄于 1024px 收起，
  DESIGN.md Layout），不在曲库里的和专辑页一样是一栏；手机是返回栏 + 居中封面头部 + 简介 + 歌单内搜索 + 歌曲行。
  头部交给 DetailHeader（#75）。左栏是一行一张的目录（PlaylistTile 的 nav 画法）：我喜欢的音乐在最上面，下面自建、收藏两块；页面只读 App 给的答案（state.library.playlistPage）：
  打开时还没同步全就由 App 用前台请求拉，不等后台同步；不在曲库里的不存进本机，每次打开都联网取。
  动作：收藏开关（不在曲库里的和收藏的歌单有）、自建歌单的“添加歌曲”和 •••（#33）、曲库里的歌单和专辑的“下载”（#39）；我喜欢的音乐只有下载。
  操作行分三档：播放（主）、下载 / 收藏（页面级次级）、添加歌曲 / 多选 / •••（管理类，图标簇）。桌面搜索在动作行右端，
  按工具栏自身宽度把管理动作收进 •••；手机搜索仍在简介下面。页头的“下载”打开选歌弹窗。
  返回这一页时，搜索词和滚动位置都回到原来的样子（snapshot，跟着浏览历史走）。
-->
<script lang='ts'>
  import { afterNavigate, goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import type { LucideIcon } from '@lucide/svelte'
  import { CircleArrowDown, Ellipsis, ListMusic, ListPlus, Lock, SearchX } from '@lucide/svelte'

  import type { Playlist, PlaylistUnavailable } from '#lib/api/library.js'
  import { playlistName } from '#lib/api/library.js'
  import type { LibraryState } from '#lib/app/library.js'
  import Avatar from '#lib/components/account/Avatar.svelte'
  import CollectButton from '#lib/components/library/CollectButton.svelte'
  import Description from '#lib/components/library/Description.svelte'
  import DetailHeader from '#lib/components/library/DetailHeader.svelte'
  import PlaylistSongs from '#lib/components/library/PlaylistSongs.svelte'
  import PlaylistTile from '#lib/components/library/PlaylistTile.svelte'
  import { ROW_COVER_SIZE } from '#lib/components/library/tile-grid.js'
  import { playlistHeader } from '#lib/components/library/view.js'
  import { anchorBelow } from '#lib/components/menu/menu-anchor.js'
  import { getOverlays } from '#lib/components/overlay/overlay-context.js'
  import { getAppView } from '#lib/components/shared/app-context.svelte.js'
  import { failureText } from '#lib/components/shared/failure.js'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import { atOnce, reveal, scrollBehavior, stagger } from '#lib/components/shared/motion.js'
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js'
  import { langOf } from '#lib/components/shared/text.js'
  import { playerDockBottom } from '#lib/components/shell/player-dock.js'
  import PlayAllButton from '#lib/components/songs/PlayAllButton.svelte'
  import Button from '#lib/components/ui/Button.svelte'
  import IconButton from '#lib/components/ui/IconButton.svelte'
  import Scrollbar from '#lib/components/ui/Scrollbar.svelte'
  import SearchField from '#lib/components/ui/SearchField.svelte'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'

  import type { PageProps } from './$types'

  const { params }: PageProps = $props()
  const view = getAppView()
  const { addSongsDialog, downloadPicker, playlistMenu, playerLayer } = getOverlays()
  const library = $derived(view.state.library)
  const id = $derived(params.id)
  const page = $derived(library?.playlistPage(id) ?? null)
  const shown = $derived(page?.songs ?? null)
  /** 歌单列表已经拿到、里面没有它 */
  const outside = $derived(page?.inLibrary === false)
  const header = $derived(page && playlistHeader(page))
  const phone = $derived(!desktopLayout.current)

  let query = $state('')
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

  /** 打开 •••：触屏是底部弹层，鼠标贴着按钮；已经从这个按钮打开着就关上。紧凑时它收着添加（多选在列表的表头里） */
  const openMenu = (event: MouseEvent, compact = false) => {
    const button = event.currentTarget as HTMLElement
    if (playlistMenu.request?.from === button)
      return playlistMenu.close()
    playlistMenu.open({
      playlistId: id,
      from: button,
      anchor: anchorBelow(event),
      compact,
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

  /** 左栏：我喜欢的音乐单独在最上面，下面自建、收藏两块，和曲库的歌单区块一样分（#37） */
  const side = $derived.by(() => {
    const playlists = library?.playlists ?? []
    return {
      liked: playlists.filter(item => item.kind === 'liked'),
      own: playlists.filter(item => item.kind === 'own'),
      collected: playlists.filter(item => item.kind === 'collected'),
    }
  })
  const sideListed = $derived(library?.playlists != null)
  /** 播放队列里现在这首是从哪张歌单放的：左栏那一行右边是三根小竖条 */
  const playingFrom = $derived.by(() => {
    const { player } = view.state
    const source = player.current === null
      ? null
      : player.queue[player.current].source
    return source?.kind === 'playlist'
      ? source.id
      : null
  })
  /** 左栏的下沿：有播放条时到它的上沿 */
  const sideBottom = $derived(playerDockBottom({ desktop: true, present: playerLayer.hasQueue, withoutBar: '0px' }))

  /** 左栏上下边缘渐隐多高（px）：样式和“当前这张露全了没有”共用 */
  const SIDE_FADE = 40
  let sideNav = $state<HTMLElement>()
  /** 左栏替哪一张摆过位置：同步刷新歌单列表时不再把听众自己滚开的左栏拽回来；左栏拿掉时清掉，下次挂上又算刚打开 */
  let sidePlacedFor: number | null = null
  // 只滚左栏，不动页面，免得打乱返回时恢复的滚动位置。刚打开直接把当前这张放在正中；之后换到的那张露全了就不动，
  // 免得列表从指针底下溜走；没露全（压在渐隐里、滚出了左栏，比如前进后退）才平滑地滚到正中
  $effect(() => {
    const nav = sideNav
    if (!nav) {
      sidePlacedFor = null
      return
    }
    if (!sideListed || sidePlacedFor === id)
      return
    const current = nav.querySelector<HTMLElement>('[aria-current="page"]')
    if (!current)
      return
    const first = sidePlacedFor === null
    sidePlacedFor = id
    const box = nav.getBoundingClientRect()
    const row = current.getBoundingClientRect()
    // 渐隐只在那一头还有内容时有，离头越近越矮（样式里按滚动位置长出来）
    const fadeTop = Math.min(nav.scrollTop, SIDE_FADE)
    const fadeBottom = Math.min(nav.scrollHeight - nav.clientHeight - nav.scrollTop, SIDE_FADE)
    if (!first && row.top >= box.top + fadeTop && row.bottom <= box.bottom - fadeBottom)
      return
    nav.scrollTo({
      top: nav.scrollTop + row.top - box.top - (nav.clientHeight - row.height) / 2,
      behavior: first
        ? 'auto'
        : scrollBehavior(),
    })
  })
</script>

<svelte:head><title>{name || '歌单'} · Campanula</title></svelte:head>

{#snippet headerMeta()}
  {#if header}
    {#if header.creator}
      <span class='min-w-0 inline-flex items-center gap-1.5'>
        <Avatar url={header.creatorAvatarUrl} size={20} />
        <span class='truncate' lang={langOf(header.creator)}>{header.creator}</span>
      </span>
      {#if header.meta.length > 0}<span aria-hidden='true'>·</span>{/if}
    {/if}
    {#each header.meta as part, i (i)}
      {#if i > 0}<span aria-hidden='true'>·</span>{/if}
      <span class='tabular-nums'>{part}</span>
    {/each}
    {#if header.private}<span class='inline-flex items-center' role='img' aria-label='隐私歌单' title='隐私歌单'><Lock size={13} aria-hidden='true' /></span>{/if}
  {/if}
{/snippet}

{#snippet headerSearch(compact: boolean)}
  <SearchField
    label='在歌单里搜索'
    bind:value={query}
    placeholder={compact
      ? '搜索'
      : '在歌单里搜索'}
    class='max-w-[280px] min-w-[128px] w-full'
    disabled={shown?.kind !== 'songs'}
  />
{/snippet}

{#snippet headerActions(compact: boolean)}
  <PlayAllButton songs={shown?.kind === 'songs'
    ? shown.songs
    : null} source={{ kind: 'playlist', id }} />
  {#if page?.inLibrary === true && shown?.kind === 'songs' && shown.songs.length > 0}
    {#if compact && page?.can.collect}
      <!-- 收藏的歌单在紧凑宽度多一个收藏开关：下载收成同色的图标，给搜索留出能打字的宽度 -->
      <Button
        variant='download'
        icon={CircleArrowDown}
        class='w-10 px-0!'
        title='下载'
        aria-label='下载'
        disabled={!view.state.online}
        onclick={(event: MouseEvent) => downloadPicker.open({
          kind: 'playlist',
          playlistId: id,
          from: event.currentTarget as HTMLElement,
        })}
      ></Button>
    {:else}
      <Button variant='download' icon={CircleArrowDown} disabled={!view.state.online} onclick={(event: MouseEvent) => downloadPicker.open({
        kind: 'playlist',
        playlistId: id,
        from: event.currentTarget as HTMLElement,
      })}>下载</Button>
    {/if}
  {/if}
  {#if page?.can.collect}
    <CollectButton target={{ kind: 'playlist', id }} {name} look={compact ? 'icon' : 'pill'} />
  {/if}
  {#if own}
    <!-- 管理类操作收进一组安静的工具图标：带字胶囊只留给播放、下载、收藏。多选在歌曲列表的表头里（#82），紧凑时也不收进这里 -->
    <span class='flex items-center gap-1 md:ml-1'>
      {#if !compact}
        <IconButton icon={ListPlus} label='添加歌曲' title='添加歌曲' data-add-songs-entry onclick={openAddSongs} />
      {/if}
      <IconButton
        icon={Ellipsis}
        label={`歌单操作：${name}`}
        title='歌单操作'
        aria-haspopup='menu'
        aria-expanded={playlistMenu.request?.playlistId === id}
        onclick={(event: MouseEvent) => openMenu(event, compact)}
      />
    </span>
  {/if}
{/snippet}

{#snippet mainColumn(library: LibraryState)}
  <DetailHeader
    ready={!!header}
    cover={{ url: header?.coverUrl ?? null, placeholder: ROW_COVER_SIZE }}
    title={name}
    tags={header?.tags ?? []}
  >
    {#snippet meta()}{@render headerMeta()}{/snippet}
    {#snippet actions(compact: boolean)}{@render headerActions(compact)}{/snippet}
    {#snippet search(compact: boolean)}{@render headerSearch(compact)}{/snippet}
  </DetailHeader>
  <!-- 从左栏换到另一张歌单时简介重新来过：上一张展开过的，这一张还是截断着 -->
  {#if header?.description}<div in:reveal>{#key id}<Description text={header.description} {phone} />{/key}</div>{/if}
  <div class={phone ? '' : 'mt-6'}><PlaylistSongs {library} playlistId={id} bind:query {phone} /></div>
{/snippet}

{#snippet sideGroup(items: readonly Playlist[], from: number, title: string | null)}
  {#if title && items.length > 0}
    <h2 class='mb-1 mt-5 px-2 text-caption text-neutral-500 font-500' in:stagger={{ order: from }}>{title}</h2>
  {/if}
  <ul class='flex flex-col gap-0.5'>
    {#each items as item, i (item.id)}
      {@const current = item.id === id}
      <!-- 首次同步时歌单列表到了，左栏的歌单依次飘入；之后同步来的新歌单也飘进来 -->
      <li in:stagger={{ order: from + i }}>
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
          now={item.id === playingFrom}
        />
      </li>
    {/each}
  </ul>
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

    <nav
      bind:this={sideNav}
      class='side sticky hidden overflow-y-auto lg:col-start-1 lg:row-start-1 -ml-3 -mt-4 lg:block'
      style:top='calc(4rem + var(--offline-bar-height, 0px))'
      style:max-height={`calc(100dvh - 4rem - var(--offline-bar-height, 0px) - ${sideBottom})`}
      style:--side-fade={`${SIDE_FADE}px`}
      aria-label='曲库里的歌单'
    >
      <Scrollbar />
      <!-- 左边留出焦点环，右边留给滚动条；行的底色往左伸出 8px，封面和右栏页头的封面一样从栏的左边起 -->
      <div class='py-4 pl-1 pr-2'>
        {@render sideGroup(side.liked, 0, null)}
        {@render sideGroup(side.own, side.liked.length, '自建歌单')}
        {@render sideGroup(side.collected, side.liked.length + side.own.length, '收藏的歌单')}
      </div>
    </nav>
  </div>
{:else if library}
  {@render mainColumn(library)}
{/if}

<style>
  /*
   * 左栏上下边缘渐隐（和歌词一样）：哪一头还有内容才淡那一头，滚到头的那一边不淡；淡多高按离头多远长出来，
   * 滚动驱动（animation-timeline），不写 JS。--side-fade 由脚本给。注册的名字是全局的，不要和别处的变量重名
   */
  @property --side-fade-top {
    syntax: '<length>';
    inherits: false;
    initial-value: 0px;
  }

  @property --side-fade-bottom {
    syntax: '<length>';
    inherits: false;
    initial-value: 0px;
  }

  .side {
    /* 键盘 Tab 到的那一行不停在渐隐里 */
    scroll-padding-block: var(--side-fade);
    mask-image: linear-gradient(180deg, transparent, #000 var(--side-fade-top), #000 calc(100% - var(--side-fade-bottom)), transparent);
    animation: side-fade-top linear both, side-fade-bottom linear both;
    animation-timeline: scroll(self), scroll(self);
    animation-range: 0px var(--side-fade), calc(100% - var(--side-fade)) 100%;
  }

  /*
   * 左栏换歌单（同一种页面之间只交叉淡化，page-transition.ts 的 fade）：左栏单独成一块、原地放新的一帧（still，uno.config.ts），
   * 当前这张换底色、滚到正中都是活的，不和旧的一帧叠出重影
   */
  :global(html:active-view-transition-type(fade)) .side {
    view-transition-name: playlist-side;
    view-transition-class: still;
  }

  @keyframes side-fade-top {
    from {
      --side-fade-top: 0px;
    }
    to {
      --side-fade-top: var(--side-fade);
    }
  }

  @keyframes side-fade-bottom {
    from {
      --side-fade-bottom: var(--side-fade);
    }
    to {
      --side-fade-bottom: 0px;
    }
  }
</style>
