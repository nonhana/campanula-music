<!--
  歌手页（#83，作者 2026-10-31 定，偏离原型 A 的上下排）：圆形头像的头部（名字、“几首歌 · 几张专辑”、播放全部、收藏），下面是吸顶的标签行“歌曲 / 专辑 / 简介”。
  歌曲是全部歌曲，按热门或最新排（每次 100 首，后面还有时“显示更多”）；专辑是网格（新的在前，同样“显示更多”）；简介是一段简介加分段介绍。
  选中的标签和排法写在地址里（?tab=albums、?tab=intro、?order=time，默认的歌曲、热门不写）：换的时候替换当前记录，内容在同一页的换页过渡里交叉淡化，
  标签行已经吸住时换完滚到它刚好吸住的位置；返回、刷新都停在原来的标签和排法，滚动位置随浏览历史恢复。
  桌面标签行吸在顶栏下，排法切换在它最右（只在歌曲标签）；手机吸在返回栏下，排法切换在数量行里。头部交给 DetailHeader（#75），网格交给 TileGrid。
  告诉 App 听众在看这位歌手的哪个标签、哪种排法（viewing）：什么时候取（最新、简介第一次要看时）、没取成后重试都由 App 决定。
-->
<script lang='ts'>
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { Disc3, UserRound } from '@lucide/svelte'
  import { tick } from 'svelte'

  import type { ArtistAlbum, ArtistIntroResponse, ArtistSongOrder } from '#lib/api/library.js'
  import type { ArtistTab } from '#lib/app/library.js'
  import AlbumTile from '#lib/components/library/AlbumTile.svelte'
  import { ARTIST_ORDERS, ARTIST_PANEL_ID, ARTIST_TABS, artistOrderOf, artistSearch, artistTabId, artistTabOf } from '#lib/components/library/artist-view.js'
  import CollectButton from '#lib/components/library/CollectButton.svelte'
  import DetailHeader from '#lib/components/library/DetailHeader.svelte'
  import { selectionActions } from '#lib/components/library/selection-actions.svelte.js'
  import TileGrid from '#lib/components/library/TileGrid.svelte'
  import { getOverlays } from '#lib/components/overlay/overlay-context.js'
  import { getAppView } from '#lib/components/shared/app-context.svelte.js'
  import { failureText } from '#lib/components/shared/failure.js'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import { DURATIONS } from '#lib/components/shared/motion-tokens.js'
  import { fade, fadeAway, reveal } from '#lib/components/shared/motion.js'
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js'
  import { formatCount, langOf, yearOf } from '#lib/components/shared/text.js'
  import PlayAllButton from '#lib/components/songs/PlayAllButton.svelte'
  import SongList from '#lib/components/songs/SongList.svelte'
  import type { SongListView } from '#lib/components/songs/view.js'
  import { SONG_ROW_HEIGHT } from '#lib/components/songs/view.js'
  import Segmented from '#lib/components/ui/Segmented.svelte'
  import ShowMore from '#lib/components/ui/ShowMore.svelte'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'
  import Tabs from '#lib/components/ui/Tabs.svelte'

  import type { PageProps } from './$types'

  const { params }: PageProps = $props()
  const view = getAppView()
  const { multiSelect } = getOverlays()
  const library = $derived(view.state.library)
  const id = $derived(params.id)
  const tab = $derived(artistTabOf(page.url.searchParams.get('tab')))
  const order = $derived(artistOrderOf(page.url.searchParams.get('order')))
  const opened = $derived(library?.artistPage(id) ?? null)
  const content = $derived(opened?.status === 'shown'
    ? opened.content
    : null)
  const artist = $derived(content?.artist ?? null)
  const phone = $derived(!desktopLayout.current)
  /** “几首歌 · 几张专辑”：网易云没给的那一项连同分隔不写（#78） */
  const counts = $derived(artist
    ? [
      artist.songCount === null
        ? null
        : `${formatCount(artist.songCount)} 首歌`,
      artist.albumCount === null
        ? null
        : `${formatCount(artist.albumCount)} 张专辑`,
    ].filter(part => part !== null).join(' · ')
    : '')

  scrollSnapshot('/artists/[id=neteaseId]', () => null, () => {})

  // 听众在看这位歌手的这个标签、这种排法：什么时候取由 App 决定，换一位、换标签、换排法、本机状态变了不用页面再调一次
  $effect(() => view.app.viewing({ kind: 'artist', id, tab, order }))

  /** 当前排法那一份：还没取过（App 马上去取）和取着的都画骨架 */
  const songs = $derived(content?.songs[order] ?? null)
  const shownSongs = $derived(songs?.status === 'shown'
    ? songs.content
    : null)
  const songList = $derived.by((): SongListView => {
    if (songs?.status === 'failed') {
      return {
        kind: 'failed',
        title: '歌曲没能加载',
        body: failureText(songs.failure),
        retry: () => void view.app.openArtistSongs(id, order),
      }
    }
    if (!shownSongs)
      return { kind: 'loading' }
    if (shownSongs.songs.length === 0)
      return { kind: 'empty', title: '还没有歌' }
    return { kind: 'songs', songs: shownSongs.songs }
  })

  const actions = selectionActions()
  /** 歌曲标签能做的事（#82）：加入歌单、下载；从歌手页挑出来的歌，来源记成单独下载（规则⑦） */
  const select = $derived({
    actions: [
      actions.addToPlaylist(),
      actions.download(() => ({ kind: 'single' })),
    ],
  })

  const tabs = $derived(ARTIST_TABS.map(item => ({
    key: item.key,
    label: item.label,
    href: resolve(`/artists/[id=neteaseId]${artistSearch(item.key, order)}`, { id }),
  })))

  /** 标签行本来的位置在它的下沿（标签行吸住以后它跟着页面滚走） */
  let gap = $state<HTMLElement>()
  let tabRow = $state<HTMLElement>()
  let tabsHeight = $state(0)
  // Tab 到、定位到的东西不藏在吸顶的标签行底下（外框的 scroll-padding-top、定位到正在播放；多选工具条吸在它下面，DESIGN.md Layout · 滚动）
  $effect(() => {
    const { style } = document.documentElement
    style.setProperty('--sticky-below-header', `${tabsHeight}px`)
    return () => style.removeProperty('--sticky-below-header')
  })

  /** 标签行吸住时它的上沿离视口顶多远；还没吸住是 null */
  const stuckTop = (): number | null => {
    if (!gap || !tabRow)
      return null
    const top = Number.parseFloat(getComputedStyle(tabRow).top)
    return gap.getBoundingClientRect().bottom < top
      ? top
      : null
  }

  /**
   * 换标签、换排法：先退出多选，再换地址（替换当前这条记录，不留浏览记录；不回顶、焦点不动）。
   * 标签行已经吸住时，换完把页面滚到它刚好吸住的位置，新内容从头看起；没吸住时不动
   */
  const go = async (next: { tab: ArtistTab, order: ArtistSongOrder }) => {
    if (next.tab === tab && next.order === order)
      return
    if (multiSelect.mode)
      await multiSelect.leave()
    const stuck = stuckTop()
    await goto(resolve(`/artists/[id=neteaseId]${artistSearch(next.tab, next.order)}`, { id }), { replace: true, reset: false })
    await tick()
    if (stuck !== null && gap)
      window.scrollTo({ top: window.scrollY + gap.getBoundingClientRect().bottom - stuck, behavior: 'instant' })
  }

  const selectTab = (key: ArtistTab) => go({ tab: key, order })
  const selectOrder = (key: ArtistSongOrder) => void go({ tab, order: key })

  /** 标签行吸住以后，下面的内容至少有一屏高：短的内容（简介）也能让标签行停在吸住的位置 */
  const panelMinHeight = $derived(phone
    ? `calc(100dvh - var(--phone-top, 0px) - ${tabsHeight}px)`
    : `calc(100dvh - 4rem - var(--offline-bar-height, 0px) - ${tabsHeight}px)`)

  let songsHost = $state<HTMLElement>()
  const showMoreSongs = async () => {
    const from = order
    const shown = shownSongs?.songs.length ?? 0
    await view.app.moreArtistSongs(id, from)
    await tick()
    // 取完了，按钮跟着不见：焦点移到新出来的第一首（虚拟列表里按行的位置找），免得掉回页面最上面；取的时候换了排法就不动
    if (order === from && shownSongs?.more === null && songsHost) {
      const top = songsHost.getBoundingClientRect().top + shown * SONG_ROW_HEIGHT
      ;[
        ...songsHost.querySelectorAll<HTMLElement>('[data-play-target]'),
      ]
        .find(target => target.getBoundingClientRect().top >= top - 1)
        ?.focus()
    }
  }

  /** 简介的外框和白色卡片：骨架和内容用同一套，骨架淡出时不占高度，内容从同一个位置淡入、不跳 */
  const introFrame = $derived(phone
    ? 'px-4 pt-4'
    : 'pb-6 pt-5')
  const introCard = $derived([
    'rounded-xl bg-white shadow-ambient',
    phone ? 'p-4' : 'max-w-[768px] p-6',
  ])

  let albumList = $state<HTMLElement>()
  /** 上一次“显示更多”之前已经有几张：后加进来的从第几张开始依次飘入 */
  let appendedAt = $state(0)
  const showMoreAlbums = async () => {
    const shown = content?.albums.length ?? 0
    appendedAt = shown
    await view.app.moreArtistAlbums(id)
    await tick()
    // 取完了，按钮跟着不见：焦点移到新出来的第一张，免得掉回页面最上面
    if (!content?.moreAlbums)
      albumList?.querySelectorAll('a')[shown]?.focus()
  }

  const intro = $derived(content?.intro ?? null)
  const introEmpty = $derived(intro?.status === 'shown' && !intro.content.brief && intro.content.sections.length === 0)
</script>

<svelte:head><title>{artist?.name ?? '歌手'} · Campanula</title></svelte:head>

{#snippet orderSwitch()}
  <Segmented
    options={ARTIST_ORDERS}
    value={order}
    onchange={selectOrder}
    role='radio'
    id='artist-order'
    label='排序'
    class='h-9 w-32 flex-none bg-white/70 shadow-ambient'
  />
{/snippet}

{#snippet introText(text: ArtistIntroResponse)}
  <div class='space-y-6'>
    {#if text.brief}
      <p class='whitespace-pre-line break-words text-body text-neutral-700 leading-7' lang={langOf(text.brief)}>{text.brief}</p>
    {/if}
    {#each text.sections as section (section)}
      <section>
        {#if section.title}
          <h2 class='break-words text-title-sm text-neutral-900 font-600' lang={langOf(section.title)}>{section.title}</h2>
        {/if}
        <p class={['whitespace-pre-line break-words text-body text-neutral-700 leading-7', section.title && 'mt-2']} lang={langOf(section.text)}>{section.text}</p>
      </section>
    {/each}
  </div>
{/snippet}

{#snippet introPanel()}
  <!-- 骨架和内容各自带着同样的内边距：骨架淡出时不占高度，内容从同一个位置淡入，不跳（DESIGN.md Overlays · 加载 → 内容） -->
  {#if intro?.status === 'failed'}
    <div in:fade><StateBlock kind='error' title='简介没能加载' body={failureText(intro.failure)} action={{
      label: '重试',
      run: () => void view.app.openArtistIntro(id),
    }} /></div>
  {:else if introEmpty}
    <div in:fade><StateBlock kind='empty' icon={UserRound} title='还没有简介' /></div>
  {:else if intro?.status === 'shown'}
    <div class={introFrame} in:fade={{ duration: DURATIONS.reveal }}>
      <div class={introCard}>{@render introText(intro.content)}</div>
    </div>
  {:else}
    <div class={introFrame} role='status' aria-busy='true' aria-label='正在加载简介' out:fadeAway>
      <div class={introCard}>
        <span class='h-6 w-1/3 flex items-center'><span class='bone h-4 w-full rounded-full'></span></span>
        {#each [100, 92, 64] as width (width)}
          <span class='mt-2 h-7 flex items-center' style:width='{width}%'><span class='bone h-3.5 w-full rounded-full'></span></span>
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

{#if library}
  {#if opened?.status === 'failed'}
    <div in:reveal><StateBlock kind='error' title='这位歌手的页面没能加载' body={failureText(opened.failure)} action={{
      label: '重试',
      run: () => void view.app.openArtist(id),
    }} /></div>
  {:else}
    <DetailHeader
      align='center'
      ready={!!artist}
      cover={{ url: artist?.avatarUrl ?? null, round: true, fallback: UserRound }}
      title={artist?.name ?? ''}
    >
      {#snippet meta()}
        {#if artist}
          {counts}
        {/if}
      {/snippet}
      {#snippet actions()}
        {#if artist}
          <PlayAllButton songs={shownSongs?.songs ?? null} source={{ kind: 'artist', id }} />
          <CollectButton target={{ kind: 'artist', id }} name={artist.name} look='pill' />
        {/if}
      {/snippet}
    </DetailHeader>

    <!-- 标签行本来的位置：这段空白的下沿 -->
    <div bind:this={gap} class={phone ? 'h-4' : 'h-8'}></div>
    {#if phone}
      <div bind:this={tabRow} class='sticky z-10 bg-primary-50' style:top='var(--phone-top, 0px)' bind:clientHeight={tabsHeight}>
        <Tabs {tabs} selected={tab} onselect={selectTab} idOf={artistTabId} panel={ARTIST_PANEL_ID} label='歌手页' class='px-2' />
      </div>
    {:else}
      <!-- 底色比内容区两边各宽 12px（和搜索结果的标签行一样）：网格的阴影滚到它底下时也盖得住 -->
      <div bind:this={tabRow} class='sticky z-10 flex items-center gap-4 bg-primary-50 px-3 -mx-3' style:top='calc(4rem + var(--offline-bar-height, 0px))' bind:clientHeight={tabsHeight}>
        <Tabs {tabs} selected={tab} onselect={selectTab} idOf={artistTabId} panel={ARTIST_PANEL_ID} label='歌手页' class='min-w-0 flex-1 -ml-3' />
        {#if tab === 'songs'}
          <div class='flex-none' transition:fade>{@render orderSwitch()}</div>
        {/if}
      </div>
    {/if}

    <div id={ARTIST_PANEL_ID} role='tabpanel' aria-labelledby={artistTabId(tab)} style:min-height={panelMinHeight}>
      {#if tab === 'songs'}
        {#if phone}
          <SongList list={songList} source={{ kind: 'artist', id }} loadingLabel='正在加载歌曲' phone count={shownSongs?.total ?? null} {select} bind:host={songsHost}>
            {#snippet countExtra()}{@render orderSwitch()}{/snippet}
          </SongList>
          <ShowMore more={shownSongs?.more ?? null} onmore={() => void showMoreSongs()} failed='没能加载更多歌曲' class='justify-center px-4 pt-5' />
        {:else}
          <div class='pb-6 pt-5'>
            <SongList list={songList} source={{ kind: 'artist', id }} loadingLabel='正在加载歌曲' {select} bind:host={songsHost} />
            <ShowMore more={shownSongs?.more ?? null} onmore={() => void showMoreSongs()} failed='没能加载更多歌曲' class='pt-5' />
          </div>
        {/if}
      {:else if tab === 'albums'}
        <div class={phone ? '' : 'pb-6 pt-5'}>
          <div bind:this={albumList}>
            <TileGrid kind='album' layout='grid' {phone} items={content?.albums ?? null} label='专辑' loadingLabel='正在加载专辑' empty={content?.moreAlbums
              ? undefined
              : { icon: Disc3, title: '还没有专辑' }} staggerFrom={appendedAt}>
              {#snippet tile(album: ArtistAlbum)}
                <AlbumTile id={album.id} name={album.name} coverUrl={album.coverUrl} detail='' year={yearOf(album.publishedAt)} {phone} />
              {/snippet}
            </TileGrid>
          </div>
          <ShowMore more={content?.moreAlbums ?? null} onmore={() => void showMoreAlbums()} failed='没能加载更多专辑' class={phone
            ? 'justify-center px-4 pt-5'
            : 'pt-5'} />
        </div>
      {:else}
        {@render introPanel()}
      {/if}
    </div>
  {/if}
{/if}
