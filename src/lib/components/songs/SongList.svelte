<!--
  歌曲列表（深模块）：输入是列表状态（加载 / 失败 + 重试 / 空 / 歌曲）、播放来源和布局，以及可选的搜索、编号、“显示更多”的飘入起点、行前装饰。
  它负责正在播放、点歌（用整个列表替换播放队列，App.play 按播放来源决定；搜索是插播）、白色面板和表头、骨架、空 / 没搜到、虚拟化和唯一的行高（view.ts）。
  歌单特有的搜索框、多选工具条、拖动排序留在调用方，通过插槽和钩子给进来（#36、#66）。
-->
<script lang='ts'>
  import { ListMusic, SearchX } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import type { ClassValue } from 'svelte/elements'

  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'

  import { currentSong } from '../player/now'
  import { getAppView } from '../shared/app-context.svelte'
  import { fade, reveal, stagger } from '../shared/motion'
  import { formatCount } from '../shared/text'
  import StateBlock from '../ui/StateBlock.svelte'
  import VirtualList from '../ui/VirtualList.svelte'
  import SkeletonRows from './SkeletonRows.svelte'
  import SongRow, { SONG_COLUMNS, SONG_GRID } from './SongRow.svelte'
  import type { SongDragHooks, SongListView, SongSearch, SongSelection } from './view'
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
    /** 手机数量行在不搜时写“N 首”（歌单页用；已下载页不传） */
    count?: number
    countAction?: Snippet
    /** 骨架行数；默认手机 8、桌面 9（搜索综合的前几首传 5） */
    skeleton?: number
    /** 列表上方的说明（其余没加载成、多选时不能排序）：调用方给 */
    notice?: Snippet
    /** 桌面白色面板的表头换成这个（多选工具条） */
    toolbar?: Snippet
    selection?: SongSelection | null
    /** 拖动把手：多选里能排序的歌单才有 */
    grip?: Snippet<[Song]>
    /** 拖动排序的几何（#36）；不拖时不传 */
    drag?: SongDragHooks | null
    /** 包住每一行：拖动排序时被拖的行收拢、落位展开 */
    rowWrap?: Snippet<[Song, number, Snippet<[Song, number]>]>
    /** “显示更多”加进来的行从第几行开始依次飘入（不虚拟化的列表） */
    appendedAt?: number
    /** 搜索结果放在调用的白色面板里：不画面板和表头（虚拟化另由 virtual 决定） */
    bare?: boolean
    /** 虚拟列表：默认非 bare；几十首的搜索结果和小列表关掉 */
    virtual?: boolean
    /** 不虚拟化时逐行依次飘入；专辑/歌手/每日推荐按基线关掉，只保留整组淡入 */
    staggerRows?: boolean
    /** 桌面表头对读屏隐藏：专辑/歌手/每日推荐按基线隐藏，歌单/已下载不隐藏 */
    headerHidden?: boolean
    /** 内容换上来时飘入；默认 bare 的列表不飘（调用方已经包了一层） */
    reveal?: boolean
    /** 列表的读屏名字 */
    label?: string
    contentClass?: ClassValue
    /** 列表内容的位置：拖动排序量宽高、退出多选接回焦点用它 */
    host?: HTMLElement
    /** 列表上方的东西挪了位置（已下载页的“正在下载”）：变了就重新量一次虚拟列表 */
    remeasure?: unknown
  }

  let {
    list,
    source,
    phone = false,
    numbered = false,
    loadingLabel,
    search = null,
    count,
    countAction,
    skeleton,
    notice,
    toolbar,
    selection = null,
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
  }: Props = $props()

  const revealContent = $derived(wantedReveal ?? !bare)
  const virtualRows = $derived(wantedVirtual ?? !bare)
  const view = getAppView()
  const nowId = $derived(currentSong(view.state.player)?.id ?? null)
  const songs = $derived(list.kind === 'songs'
    ? list.songs
    : [])
  const mode = $derived(search
    ? (songs.length === 0
      ? 'none'
      : 'found')
    : 'all')
  /** 手机数量行：搜索时写找到几首；给 count / countAction 的不搜时也出现 */
  const countRow = $derived(list.kind === 'songs' && (search !== null || count !== undefined || countAction !== undefined))

  const play = (song: Song): void => {
    view.app.play(source, song.id)
  }

  const activate = (song: Song): void => {
    if (selection?.active)
      selection.toggle(song)
    else
      play(song)
  }
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
    selecting={selection?.active ?? false}
    selected={selection?.has(song.id) ?? false}
    onselect={selection
      ? (event: MouseEvent) => selection.modifiers(song, event)
      : undefined}
    onlongpress={selection?.longpress
      ? (from: HTMLElement) => selection.longpress!(song, from)
      : undefined}
    grip={selection?.active ? grip : undefined}
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

{#snippet header()}
  {#if toolbar}
    {@render toolbar()}
  {:else}
    <div class={[SONG_GRID, 'h-9 text-caption text-neutral-500']} aria-hidden={headerHidden ? 'true' : undefined}>
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
      <span></span>
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
    <div class={countAction ? 'min-h-11 flex items-center gap-2 px-4 pt-1' : 'flex items-center gap-2 px-4 pt-2'}>
      <p class='min-w-0 flex-1 px-1 text-caption text-neutral-600 tabular-nums' role='status'>
        {#if search}
          {@render found()}
        {:else if count !== undefined}
          {formatCount(count)} 首
        {/if}
      </p>
      {#if countAction}{@render countAction()}{/if}
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
