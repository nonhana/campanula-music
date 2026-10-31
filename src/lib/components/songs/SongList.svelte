<!--
  歌曲列表（深模块）：输入是列表状态（加载 / 失败 + 重试 / 空 / 歌曲）、播放来源和布局，以及可选的搜索、编号、“显示更多”的飘入起点、行前装饰。
  它负责正在播放、点歌（用整个列表替换播放队列，App.play 按播放来源决定；搜索是插播）、白色面板和表头、骨架、空 / 没搜到、虚拟化和唯一的行高（view.ts）。
  正在放的那首在列表里时登记给外框的“定位到正在播放”（shared/now-locate）：那一行不在屏幕内时外框画定位按钮；多选、拖动排序时不登记位置。
  多选（#82）也是列表自带的能力：给了 select 才挂多选源，入口（桌面表头最右、手机数量行）、工具条、行的勾选和快捷键、焦点归还都在这里，
  列表标识从播放来源推出来（换了列表就退出）；页面只挑这张列表能做的事。歌单特有的搜索框和拖动排序仍留在调用方，通过插槽和钩子给进来（#36）。
-->
<script lang='ts'>
  import { ListChecks, ListMusic, SearchX } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import { untrack } from 'svelte'
  import type { ClassValue } from 'svelte/elements'

  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'

  import type { SelectionSource } from '../library/multi-select.svelte'
  import { selectionKeyOf } from '../library/selection-core'
  import SelectionToolbar from '../library/SelectionToolbar.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import { currentSong } from '../player/now'
  import { getAppView } from '../shared/app-context.svelte'
  import { fade, reveal, stagger } from '../shared/motion'
  import { focusNowRow, getNowLocate, hasNowLocate } from '../shared/now-locate.svelte'
  import { formatCount } from '../shared/text'
  import IconButton from '../ui/IconButton.svelte'
  import StateBlock from '../ui/StateBlock.svelte'
  import VirtualList from '../ui/VirtualList.svelte'
  import SkeletonRows from './SkeletonRows.svelte'
  import SongRow, { SONG_COLUMNS, SONG_GRID } from './SongRow.svelte'
  import type { SongDragHooks, SongListView, SongSearch, SongSelect } from './view'
  import { SONG_ROW_HEIGHT, songMark } from './view'

  interface Props {
    /** 列表那一块显示什么：加载 / 失败 + 重试 / 空 / 歌曲 */
    list: SongListView
    source: PlaySource
    phone?: boolean
    /** 手机行前面加序号（专辑的曲序） */
    numbered?: boolean
    /** 骨架读屏读出的“正在加载什么” */
    loadingLabel: string
    /** 在列表里搜：表头写“找到 N 首”，没搜到时只有“没有…” */
    search?: SongSearch | null
    /** 手机数量行在不搜时写“N 首”（歌单页用总数，不给就是列表里的首数）；null 是总数不知道（网易云没给），不写数字 */
    count?: number | null
    /** 手机数量行里、“N 首”和多选入口之间的东西（歌手页的排法切换）；给了它数量行一直在，加载中、出错时也能用 */
    countExtra?: Snippet
    /** 骨架行数；默认手机 8、桌面 9（搜索综合的前几首传 5） */
    skeleton?: number
    /** 列表上方的说明（其余没加载成、多选时不能排序）：调用方给 */
    notice?: Snippet
    /** 多选：给了才有多选，入口、工具条、勾选和焦点都在列表里（#82） */
    select?: SongSelect | null
    /** 拖动把手：多选里能排序的歌单才有 */
    grip?: Snippet<[Song]>
    /** 拖动排序的几何（#36）；不拖时不传 */
    drag?: SongDragHooks | null
    /** 包住每一行：拖动排序时被拖的行收拢、落位展开 */
    rowWrap?: Snippet<[Song, number, Snippet<[Song, number]>]>
    /** “显示更多”加进来的行从第几行开始依次飘入（不虚拟化的列表） */
    appendedAt?: number
    /** 搜索结果放在调用的白色面板里：不画面板；给了多选时仍画表头放入口和工具条 */
    bare?: boolean
    /** 虚拟列表：默认非 bare；几十首的搜索结果和小列表关掉 */
    virtual?: boolean
    /** 不虚拟化时逐行依次飘入；专辑/歌手/每日推荐按基线关掉，只保留整组淡入 */
    staggerRows?: boolean
    /** 列名对读屏隐藏：专辑/歌手/每日推荐/搜索单曲按基线隐藏，歌单/已下载不隐藏（入口按钮照样读得到） */
    headerHidden?: boolean
    /** 内容换上来时飘入；默认 bare 的列表不飘（调用方已经包了一层） */
    reveal?: boolean
    /** 列表的读屏名字 */
    label?: string
    contentClass?: ClassValue
    /** 列表内容的位置：拖动排序量宽高、多选进入后焦点落第一行用它 */
    host?: HTMLElement
    /** 列表上方的东西挪了位置（已下载页的“正在下载”）：变了就重新量一次虚拟列表 */
    remeasure?: unknown
    /** 登记给“定位到正在播放”；搜索综合的前几首关掉 */
    locate?: boolean
  }

  let {
    list,
    source,
    phone = false,
    numbered = false,
    loadingLabel,
    search = null,
    count,
    skeleton,
    notice,
    select = null,
    countExtra,
    grip,
    drag = null,
    rowWrap,
    appendedAt = 0,
    bare = false,
    virtual: wantedVirtual,
    staggerRows = true,
    headerHidden = true,
    reveal: wantedReveal,
    label = '歌曲',
    contentClass,
    host = $bindable(),
    remeasure,
    locate = true,
  }: Props = $props()

  const revealContent = $derived(wantedReveal ?? !bare)
  const virtualRows = $derived(wantedVirtual ?? !bare)
  const view = getAppView()
  const { multiSelect } = getOverlays()
  const nowId = $derived(currentSong(view.state.player)?.id ?? null)
  const songs = $derived(list.kind === 'songs'
    ? list.songs
    : [])
  const selecting = $derived(select !== null && multiSelect.mode)
  const entryLabel = $derived(select?.entryLabel ?? '多选')
  const mode = $derived(search
    ? (songs.length === 0
      ? 'none'
      : 'found')
    : 'all')
  /** 手机数量行：搜索时写找到几首；能给多选、给了总数的不搜时也出现；数量行里另有东西时一直在 */
  const countRow = $derived(countExtra !== undefined || (list.kind === 'songs' && (search !== null || count !== undefined || select !== null)))

  const play = (song: Song): void => {
    view.app.play(source, song.id)
  }

  const activate = (song: Song): void => {
    if (selecting)
      multiSelect.toggle(song.id)
    else
      play(song)
  }

  /** 入口按钮会被工具条换掉，退出时靠它重新找到；行被虚拟列表回收后也回这里 */
  let entry = $state<HTMLElement>()
  const entryFocus = (): HTMLElement | null => entry?.querySelector<HTMLElement>('button') ?? null
  const rowEntryFocus = (from: HTMLElement): () => HTMLElement | null => () => from.isConnected
    ? from
    : entryFocus()

  /** 多选从这里读整张列表、显示着的歌和这张列表的动作；换列表、列表消失、离开页面由模块自己退出 */
  const selectionSource: SelectionSource = {
    get key() { return selectionKeyOf(source) },
    songs: () => select?.songs?.() ?? songs,
    visible: () => songs.map(song => song.id),
    get actions() { return select?.actions ?? [] },
    present: () => list.kind === 'songs',
    focusFirst: () => host?.querySelector<HTMLElement>('[data-play-target]')?.focus({ preventScroll: true }),
  }
  if (untrack(() => select)) {
    multiSelect.attach(selectionSource)
    $effect(() => () => multiSelect.detach(selectionSource))
  }

  const enterFromEntry = (event: MouseEvent): void => {
    void multiSelect.enter({
      from: event.currentTarget as HTMLElement,
      focusFirst: true,
      focusEntry: entryFocus,
    })
  }

  /** ⌘/Ctrl 点选、Shift 连选：不在多选里就从这一行进去，退出时焦点回这一行 */
  const modifiers = (song: Song, event: MouseEvent): void => {
    if (!multiSelect.mode) {
      const from = event.currentTarget as HTMLElement
      multiSelect.enter({
        from,
        focusEntry: rowEntryFocus(from),
      })
    }
    if (event.shiftKey)
      multiSelect.range(song.id)
    else
      multiSelect.toggle(song.id)
  }

  /** 手机长按一行进入多选，并勾上这一首 */
  const longpress = (song: Song, from: HTMLElement): void => {
    multiSelect.enter({
      id: song.id,
      from,
      focusEntry: rowEntryFocus(from),
    })
  }

  const nowLocate = hasNowLocate()
    ? getNowLocate()
    : null
  /** 正在放的那首在这张列表（搜索时是搜到的那些）里第几行 */
  const nowIndex = $derived(nowId === null
    ? -1
    : songs.findIndex(song => song.id === nowId))

  $effect(() => {
    if (!nowLocate || !locate)
      return
    return nowLocate.register({
      // 行高统一 56px，虚拟列表和不虚拟化的列表一样从 host 的上沿往下排
      row: () => nowIndex < 0 || !host || selecting || drag
        ? null
        : {
          top: host.getBoundingClientRect().top + nowIndex * SONG_ROW_HEIGHT,
          height: SONG_ROW_HEIGHT,
          first: nowIndex === 0,
        },
      focus: () => focusNowRow(host),
    })
  })
</script>

{#snippet found()}
  <!-- 元素开头的普通空格 Svelte 会去掉，分隔符前用不换行空格 -->
  找到 {formatCount(songs.length)} 首{#if search?.incomplete}<span class='text-neutral-700 font-500'>&nbsp;· 可能不全</span>{/if}
{/snippet}

{#snippet plainRow(song: Song, i: number)}
  <SongRow
    {song}
    {source}
    {phone}
    n={i + 1}
    now={song.id === nowId}
    selecting={selecting}
    selected={selecting && multiSelect.has(song.id)}
    onselect={select
      ? (event: MouseEvent) => modifiers(song, event)
      : undefined}
    onlongpress={select
      ? (from: HTMLElement) => longpress(song, from)
      : undefined}
    grip={selecting ? grip : undefined}
    onplay={() => activate(song)}
  />
{/snippet}

{#snippet wrappedRow(song: Song, i: number)}
  {#if rowWrap}
    {@render rowWrap(song, i, plainRow)}
  {:else}
    {@render plainRow(song, i)}
  {/if}
{/snippet}

{#snippet listRow(song: Song, i: number)}
  {#if phone && numbered}
    <div class='h-14 flex items-center'>
      <span class='w-9 flex-none pl-4 text-caption text-neutral-500 tabular-nums' aria-hidden='true'>{i + 1}</span>
      <div class='h-full min-w-0 flex-1 -ml-2'>{@render wrappedRow(song, i)}</div>
    </div>
  {:else}
    {@render wrappedRow(song, i)}
  {/if}
{/snippet}

{#snippet entryButton()}
  <button
    type='button'
    class='grid size-8 place-items-center rounded-full text-neutral-700 transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950)'
    aria-label={entryLabel}
    title={entryLabel}
    onclick={enterFromEntry}
  ><ListChecks size={16} aria-hidden='true' /></button>
{/snippet}

{#snippet header()}
  {#if selecting}
    <!-- 多选时吸在顶栏下面（让开断网提示条），页面自己有吸顶行的吸在那一行下面；不透明的底色，行从它底下滚过去，不加阴影 -->
    <div
      class='sticky z-10 rounded-t-xl bg-white px-2 pt-2 -mx-2 -mt-2'
      style:top='calc(4rem + var(--offline-bar-height, 0px) + var(--sticky-below-header, 0px))'
    >
      <SelectionToolbar />
    </div>
  {:else}
    <div class={[SONG_GRID, 'h-9 text-caption text-neutral-500']}>
      <div class='contents' aria-hidden={headerHidden
        ? 'true'
        : undefined}>
        <span class={SONG_COLUMNS.index}>#</span>
        <span class={['grid grid-cols-[minmax(0,1fr)] pl-[52px]', SONG_COLUMNS.title]} role='status'>
          {#if search && list.kind === 'songs'}
            <span class='col-start-1 row-start-1 truncate' transition:fade>{@render found()}</span>
          {:else}
            <span class='col-start-1 row-start-1 truncate' transition:fade>标题</span>
          {/if}
        </span>
        <span class={SONG_COLUMNS.album}>专辑</span>
        <span class={SONG_COLUMNS.status}></span>
        <span class={SONG_COLUMNS.duration}>时长</span>
      </div>
      <span class='grid place-items-center'>
        {#if select && songs.length > 0}
          <span class='contents' bind:this={entry}>{@render entryButton()}</span>
        {/if}
      </span>
    </div>
  {/if}
{/snippet}

{#snippet songList()}
  <div bind:this={host} class={['relative', contentClass]}>
    {#if virtualRows}
      <div role='group' aria-label={label}>
        <VirtualList
          items={songs}
          itemHeight={SONG_ROW_HEIGHT}
          getKey={(song: Song) => song.id}
          markOf={drag && !drag.marks
            ? undefined
            : songMark}
          placeOf={drag?.placeOf}
          keep={drag?.keep}
          animatePlace={drag?.animatePlace}
          hidden={drag?.hidden}
          row={listRow}
          {remeasure}
        />
      </div>
    {:else}
      <ul aria-label={label} data-reveal-group>
        {#each songs as song, i (song.id)}
          {#if staggerRows}
            <li class='h-14' in:stagger={{
              order: Math.max(0, i - appendedAt),
            }}>{@render listRow(song, i)}</li>
          {:else}
            <li class='h-14'>{@render listRow(song, i)}</li>
          {/if}
        {/each}
      </ul>
    {/if}
  </div>
{/snippet}

{#snippet body()}
  {#if list.kind === 'failed'}
    <StateBlock kind='error' title={list.title} body={list.body} action={{ label: '重试', run: list.retry }} />
  {:else if list.kind === 'empty'}
    <StateBlock kind='empty' icon={list.icon ?? ListMusic} title={list.title} body={list.body} action={list.action} />
  {:else}
    <div class='grid grid-cols-[minmax(0,1fr)]'>
      {#key mode}
        <div class='col-start-1 row-start-1 min-w-0' transition:fade>
          {#if songs.length === 0}
            {#if search}
              <StateBlock
                kind='empty'
                icon={SearchX}
                title={`没有“${search.term}”`}
                body={search.incomplete ? search.incompleteBody : undefined}
              />
            {:else}
              <StateBlock kind='empty' icon={ListMusic} title='这里还没有歌' />
            {/if}
          {:else}
            {@render songList()}
          {/if}
        </div>
      {/key}
    </div>
  {/if}
{/snippet}

{#if phone}
  {#if countRow}
    <div class={select
      ? 'min-h-11 flex items-center gap-2 px-4 pt-1'
      : 'flex items-center gap-2 px-4 pt-2'}>
      <p class='min-w-0 flex-1 px-1 text-caption text-neutral-600 tabular-nums' role='status'>
        {#if search}
          {@render found()}
        {:else if list.kind === 'songs' && count !== null}
          {formatCount(count ?? songs.length)} 首
        {/if}
      </p>
      {#if countExtra}{@render countExtra()}{/if}
      {#if select && !selecting && songs.length > 0}
        <span class='contents' bind:this={entry}>
          <IconButton icon={ListChecks} label={entryLabel} title={entryLabel} class='-mr-3' onclick={enterFromEntry} />
        </span>
      {/if}
    </div>
  {/if}
  {#if notice}
    <div class='pt-2'>{@render notice()}</div>
  {/if}
  {#if list.kind === 'loading'}
    <SkeletonRows class='pt-2' count={skeleton ?? 8} phone label={loadingLabel} />
  {:else if bare}
    {#if revealContent}<div in:reveal>{@render body()}</div>{:else}{@render body()}{/if}
  {:else}
    <div class='pt-2' in:reveal>{@render body()}</div>
  {/if}
{:else if bare}
  {#if select}{@render header()}{/if}
  {#if list.kind === 'loading'}
    <SkeletonRows count={skeleton ?? 9} label={loadingLabel} />
  {:else if revealContent}
    <div in:reveal>{@render body()}</div>
  {:else}
    {@render body()}
  {/if}
{:else}
  <div class='rounded-xl bg-white p-2 shadow-ambient'>
    {@render header()}
    {#if notice}{@render notice()}{/if}
    {#if list.kind === 'loading'}
      <SkeletonRows count={skeleton ?? 9} label={loadingLabel} />
    {:else}
      <div in:reveal>{@render body()}</div>
    {/if}
  </div>
{/if}
