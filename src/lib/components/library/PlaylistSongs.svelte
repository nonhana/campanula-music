<!--
  一张歌单（包括我喜欢的音乐）特有的部分：拖动排序和它的浮起行 / 快速定位窄条、多选里不能排序时的说明；列表本身在 songs/SongList，
  多选的入口、工具条、勾选和焦点也在那里（#82），这里只挑这张歌单能做的事（加入歌单、下载，自建歌单还有移除）。
  歌单页和手机曲库的“我喜欢”共用；不在曲库里的歌单歌是联网一页页取的，提示说“加载”不说“同步”。
  搜索框桌面在页头的动作行里、手机在列表上方；“找到几首”在面板表头里；搜索在本机副本即时完成，没同步全时标“可能不全”；
  点歌（包括搜索结果）用整张歌单替换队列；其余的没拉成、多选里不能排序都在列表上方说明。
-->
<script lang='ts'>
  import { CircleAlert, Heart, ListMusic } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import { untrack } from 'svelte'

  import type { Song } from '#lib/api/library.js'
  import { playlistName, songTitle } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'
  import type { LibraryState } from '#lib/app/library.js'

  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import { failureText } from '../shared/failure'
  import { unfold } from '../shared/motion'
  import { formatCount } from '../shared/text'
  import SongList from '../songs/SongList.svelte'
  import SongRow from '../songs/SongRow.svelte'
  import type { SongListView } from '../songs/view'
  import SearchField from '../ui/SearchField.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import DragGrip from './DragGrip.svelte'
  import { selectionActions } from './selection-actions.svelte'
  import { SongDrag } from './song-drag.svelte'

  const { addSongsDialog, multiSelect } = getOverlays()

  interface Props {
    library: LibraryState
    playlistId: number
    query: string
    phone?: boolean
  }

  let { library, playlistId, query = $bindable(), phone = false }: Props = $props()
  const view = getAppView()
  const page = $derived(library.playlistPage(playlistId))
  const shown = $derived(page.songs)
  const liked = $derived(page.kind === 'liked')
  const outside = $derived(page.inLibrary === false)
  const term = $derived(query.trim())
  const result = $derived(term && shown.kind === 'songs'
    ? view.app.searchPlaylist(playlistId, term)
    : null)
  const songs = $derived(result
    ? result.songs
    : shown.kind === 'songs'
    ? shown.songs
    : [])
  const source = $derived<PlaySource>({ kind: 'playlist', id: playlistId })
  const selection = multiSelect
  const kind = $derived(page.kind)
  const sortableList = $derived(page.can.sort)
  /** 歌都同步全了、每首都有歌曲信息（不然列表和整张歌单对不上），也没在搜索、没在重新拉 */
  const sortable = $derived(sortableList && shown.kind === 'songs' && shown.complete && shown.songs.length === shown.total && result === null && page.more === null)
  const sortBlockedText = $derived.by(() => {
    if (result !== null)
      return '清空搜索后才能排序'
    if (shown.kind === 'songs' && shown.complete)
      return '歌还没取全，暂时不能排序'
    return '同步完才能排序'
  })
  /** 勾选和“加入歌单 / 移除”都用它，搜索时也一样 */
  const allSongs = $derived(shown.kind === 'songs'
    ? shown.songs
    : [])

  /** 只在多选里按每行把手拖；勾选的几首一起拖、保持先后（#36） */
  let listHost = $state<HTMLElement>()
  const drag = new SongDrag({
    songs: () => songs,
    selection,
    move: (songIds, before) => view.app.moveSongs(playlistId, songIds, before),
    host: () => listHost,
  })
  // 拖动期间虚拟列表的 items 保持原顺序，只改每一行的 placeOf；
  // 不能把被拖的行挪到数组末尾：DOM 节点被移走会丢指针捕获（#36 真实输入验证）

  const actions = selectionActions()
  /** 这张歌单能做的事（#82）：加入歌单排除自己，下载记成这张歌单；自建歌单还能移除。能排序的入口写“多选和排序” */
  const select = $derived({
    actions: [
      actions.addToPlaylist(playlistId),
      actions.download(() => ({
        kind: 'playlist',
        id: playlistId,
        name: playlistName({
          name: page.info?.name ?? null,
          kind,
        }),
      })),
      ...(kind === 'own'
        ? [
          actions.removeFromPlaylist(playlistId),
        ]
        : []),
    ],
    songs: () => allSongs,
    entryLabel: sortableList
      ? '多选和排序'
      : '多选',
  })

  // 退出多选、换了列表（搜索、歌单加载完重排）：拖动作废，不提交
  $effect(() => {
    if (!selection.mode || !sortable)
      untrack(() => drag.cancel())
    return () => drag.cancel()
  })

  /** 焦点在某一行时 Alt+↑/↓ 移一位（#36），和拖动是同一个 App 操作 */
  const onListKeydown = (event: KeyboardEvent): void => {
    if (!sortable || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown'))
      return
    const row = (event.target as Element).closest<HTMLElement>('[data-song-id]')
    if (!row)
      return
    if (drag.moveByKeyboard(Number(row.dataset.songId), event.key === 'ArrowUp'
      ? -1
      : 1)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const listView = $derived.by((): SongListView => {
    if (page.failure && page.failure.where === 'list') {
      return {
        kind: 'failed',
        title: liked ? '我喜欢的音乐没能同步' : '这张歌单没能加载',
        body: failureText(page.failure.failure),
        retry,
      }
    }
    if (shown.kind === 'empty') {
      if (liked)
        return { kind: 'empty', icon: Heart, title: '还没有红心的歌' }
      if (kind === 'own') {
        return {
          kind: 'empty',
          icon: ListMusic,
          title: '这张歌单还没有歌',
          action: {
            label: '添加歌曲',
            run: () => openAddSongs(),
          },
        }
      }
      return { kind: 'empty', icon: ListMusic, title: '这张歌单还没有歌' }
    }
    if (shown.kind === 'songs')
      return { kind: 'songs', songs }
    return { kind: 'loading' }
  })

  /** “找到几首、可能不全”；没搜到时下面那句按在不在曲库里说 */
  const search = $derived(result
    ? {
      term,
      incomplete: result.incomplete,
      incompleteBody: outside ? '还没加载完，加载完再搜一次' : '还没同步完，同步完再搜一次',
    }
    : null)

  const dragHooks = $derived({
    placeOf: drag.placeOf,
    keep: drag.keep,
    animatePlace: drag.sorting,
    hidden: drag.hideMoved,
    marks: !drag.dragging,
  })

  const retry = () => {
    if (page.failure?.retry === 'sync')
      view.app.retrySync()
    else
      void view.app.openPlaylist(playlistId)
  }

  const openAddSongs = (event?: MouseEvent): void => {
    addSongsDialog.open({ playlistId, from: event?.currentTarget as HTMLElement ?? null })
  }
</script>

{#snippet rowGrip(song: Song)}
  <DragGrip label={songTitle(song)} size={phone ? 'phone' : 'desktop'} attach={drag.handle(song)} />
{/snippet}

{#snippet ghostGrip(song: Song)}
  <DragGrip label={songTitle(song)} size={phone ? 'phone' : 'desktop'} ghost />
{/snippet}

{#snippet ghostRow()}
  {#if drag.ghostSong}
    <SongRow
      song={drag.ghostSong}
      {source}
      {phone}
      n={drag.position}
      now={false}
      selecting
      selected={selection.has(drag.ghostSong.id)}
      grip={ghostGrip}
      ghost
      count={drag.moved.length}
      onplay={() => {}}
    />
  {/if}
{/snippet}

{#snippet rowWrap(song: Song, i: number, row: Snippet<[Song, number]>)}
  {@const motion = drag.motionOf(song)}
  <div
    class={[
      'h-full origin-center',
      motion !== null && 'relative z-10',
      motion === 'pick' && 'drag-row-pick',
      motion === 'land' && 'drag-row-land',
    ]}
    style:--drag-shift="{motion === 'pick'
      ? drag.liftShift(i)
      : motion === 'land'
      ? drag.landShift(song)
      : 0}px"
    style:--drag-delay="{motion === 'land'
      ? drag.landDelay(song)
      : 0}ms"
  >
    {@render row(song, i)}
  </div>
{/snippet}

{#snippet notice()}
  {#if page.failure && page.failure.where === 'more'}
    <div transition:unfold>
      <div class={[
        'flex items-center gap-3 px-3 text-caption text-neutral-700',
        phone ? 'min-h-11 py-1' : 'py-2',
      ]} role='alert'>
        <CircleAlert size={16} class='flex-none text-error-700' aria-hidden='true' />
        <span class='min-w-0 flex-1'>没加载完：{failureText(page.failure.failure)}</span>
        <TextButton desktop={{ variant: 'outline' }} class='max-md:-mr-3 md:h-9!' onclick={retry}>重试</TextButton>
      </div>
    </div>
  {/if}
  {#if selection.mode && sortableList && !sortable}
    <p class='px-3 py-2 text-caption text-neutral-600' role='status'>{sortBlockedText}</p>
  {/if}
{/snippet}

{#if phone}
  <div class='px-4 pt-3'>
    <SearchField label='在歌单里搜索' bind:value={query} disabled={shown.kind !== 'songs'} />
  </div>
{/if}

<!-- 按键从行里的按钮冒泡上来（事件委托），列表本身不需要能获得焦点；外层不重复读屏组名 -->
<div class='grid grid-cols-[minmax(0,1fr)]' role='presentation' onkeydown={onListKeydown}>
  <SongList
    list={listView}
    {source}
    {phone}
    loadingLabel='正在加载歌单'
    {search}
    skeleton={phone ? 8 : 10}
    headerHidden={false}
    count={shown.kind === 'songs'
      ? shown.total
      : undefined}
    {notice}
    {select}
    grip={sortable ? rowGrip : undefined}
    drag={sortable && selection.mode
      ? dragHooks
      : undefined}
    {rowWrap}
    bind:host={listHost}
    contentClass={phone && drag.dragging
      ? 'clear-rail'
      : undefined}
    label='歌单里的歌曲'
  />
</div>

<!-- 浮起的行跟着指针；松手后落进空位。“第 N 首”的标签在它上面，最上层（DESIGN.md Overlays） -->
{#if drag.sorting}
  <div
    class={[
      'pointer-events-none fixed left-0 top-0 z-[60] h-14',
      drag.settling && 'transition-transform duration-move-state',
      drag.expanding && 'transition-opacity duration-state opacity-0',
      (drag.settling || drag.expanding) && 'ease-out-soft',
    ]}
    style:left='{drag.ghostLeft}px'
    style:width='{drag.ghostWidth}px'
    style:transform='translate3d(0, {(drag.settling || drag.expanding)
      ? drag.settleY
      : drag.ghostY}px, 0)'
  >
    <div
      class='ghost-in ghost-scale h-full origin-center'
      style:scale={drag.expanding ? '0.96' : '1.02'}
      inert
      aria-hidden='true'
    >
      {@render ghostRow()}
    </div>
    {#if !drag.settling && !drag.expanding}
      <span
        class={[
          'absolute z-[70] -top-3.5 h-6 inline-flex items-center rounded-full bg-primary-950 px-2.5 text-caption text-white font-500 whitespace-nowrap shadow-float tabular-nums',
          phone ? 'right-[52px]' : 'right-3',
        ]}
        role='status'
        aria-live='polite'
      >{drag.label}</span>
    {/if}
  </div>
{/if}

<!-- 快速定位：拖到右侧窄条按比例跳，窄条上只有刻度和滑块。从窄条里开始拖时，先往左离开窄条才接手（手机上把手正好在窄条里） -->
{#if drag.dragging && !drag.settling}
  <div
    class='pointer-events-none fixed right-0 z-[65] w-11 select-none'
    style:top='{drag.railTop}px'
    style:bottom='{drag.railBottom}px'
    aria-hidden='true'
  >
    <span class='absolute inset-x-0 top-0 h-6 text-center text-caption text-neutral-600 font-500 tabular-nums'>1</span>
    <span class='absolute inset-x-0 bottom-6 top-6'>
      <span
        class={[
          'absolute left-1/2 inset-y-0 w-2 -ml-1 rounded-full transition-[scale,background-color] duration-move-feedback ease-out-soft',
          drag.scrubbing ? 'bg-primary-200' : 'bg-primary-100',
        ]}
        style:scale={drag.scrubbing ? '1 1' : '0.5 1'}
      ></span>
      <span
        class='absolute left-1/2 size-5 border-2 border-white rounded-full bg-primary-800 shadow-ambient -ml-2.5 -mt-2.5'
        style:top='{(drag.target / Math.max(1, drag.rest.length)) * 100}%'
      ></span>
    </span>
    <span class='absolute inset-x-0 bottom-0 h-6 text-center text-caption text-neutral-600 font-500 tabular-nums'>{formatCount(drag.railTotal)}</span>
  </div>
{/if}

<style>
  /* 拿起：被拖的行从自己的位置往浮起的行收拢、缩小、淡出；落位：再从浮起的行依次展开 */
  .drag-row-pick {
    transform: translateY(var(--drag-shift, 0px)) scale(0.92);
    opacity: 0;
    transition:
      transform var(--move-state) var(--ease-out-soft),
      opacity var(--duration-state) var(--ease-out-soft);
  }

  .drag-row-land {
    animation:
      drag-row-land-move var(--move-state) var(--ease-out-soft) both,
      drag-row-land-fade var(--duration-state) var(--ease-out-soft) both;
    animation-delay: var(--drag-delay);
  }

  @keyframes drag-row-land-move {
    from { transform: translateY(var(--drag-shift, 0px)) scale(0.92); }
    to { transform: translateY(0) scale(1); }
  }

  @keyframes drag-row-land-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* 浮起的行：拿起时从 96% 长大，落位后缩小淡出 */
  .ghost-scale {
    transition: scale var(--move-state) var(--ease-out-soft);
  }

  .ghost-in {
    animation:
      ghost-in-move var(--move-state) var(--ease-out-soft),
      ghost-in-fade var(--duration-state) var(--ease-out-soft);
  }

  @keyframes ghost-in-move {
    from { scale: 0.96; }
    to { scale: 1.02; }
  }

  @keyframes ghost-in-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* 手机上拖动时，其余行右边的按钮（更多、把手）淡出，不和快速定位窄条叠在一起 */
  :global(.clear-rail) :global([data-more]),
  :global(.clear-rail) :global([data-grip]) {
    opacity: 0;
    transition: opacity var(--duration-feedback) var(--ease-out-soft);
  }
</style>
