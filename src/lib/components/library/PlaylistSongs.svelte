<!--
  一张歌单（包括我喜欢的音乐）的歌曲列表和歌单内搜索：歌单页和手机曲库的“我喜欢”标签共用。
  也用于不在曲库里的歌单：歌是打开时联网一页一页取的，提示里说“加载”，不说“同步”。
  - 手机：搜索框和“找到几首”在列表上面；桌面：搜索框在歌单页的头部（调用方放，绑定同一个 query），
    “找到几首”在白色面板的表头里。
  - 搜索在本机副本里即时完成；歌单还没同步全时结果标“可能不全”。
  - 点一首歌（搜索结果里点也一样）就用整张歌单替换播放队列。
  - 加载中、空、出错、搜不到都有各自的样子；已经有一部分歌时，没拉完、没拉成在列表上方说明。
  - 骨架换成歌（或空、出错）时骨架淡出、前几行依次飘入；带着歌打开这一页时不飘（DESIGN.md Motion）。
  - 开始搜、清空搜索、搜不到时，列表那一块交叉淡化；接着打字时结果原地换。“找到几首”、“没加载完”推开下面的列表时展开、收起
    （motion.ts 的 unfold），桌面表头的“标题”和“找到几首”交叉淡化。
-->
<script lang='ts'>
  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'
  import type { LibraryState } from '#lib/app/library.js'
  import { CheckCheck, CircleAlert, Heart, ListChecks, ListMinus, ListMusic, ListPlus, ListX, SearchX, X } from '@lucide/svelte'
  import { untrack } from 'svelte'
  import { canSortPlaylist } from '#lib/api/library.js'
  import { addSongsDialog } from '../add-songs.svelte'
  import { getAppView } from '../app-context.svelte'
  import { batchPicker } from '../batch-picker.svelte'
  import { failureText } from '../failure'
  import { fade, reveal, unfold } from '../motion'
  import { anchorBelow } from '../overlay-layer.svelte'
  import { currentSong } from '../player/view'
  import Button from '../ui/Button.svelte'
  import SearchField from '../ui/SearchField.svelte'
  import StateBlock from '../ui/StateBlock.svelte'
  import DesktopSongRow, { SONG_COLUMNS, SONG_GRID } from './DesktopSongRow.svelte'
  import PhoneSongRow from './PhoneSongRow.svelte'
  import { enterSelection, leaveSelection, playlistSelection } from './playlist-selection.svelte'
  import SkeletonRows from './SkeletonRows.svelte'
  import { SONG_ROW_HEIGHT, SongDrag } from './song-drag.svelte'
  import SongGrip from './SongGrip.svelte'
  import { formatCount, openingOf, playlistView, songMark } from './view'
  import VirtualList from './VirtualList.svelte'

  interface Props {
    library: LibraryState
    playlistId: number
    /** 搜索词：调用方存着，返回这一页时恢复 */
    query: string
    phone?: boolean
  }

  let { library, playlistId, query = $bindable(), phone = false }: Props = $props()
  const view = getAppView()
  const shown = $derived(playlistView(library, playlistId))
  const liked = $derived(library.songsOf(playlistId)?.playlist.kind === 'liked')
  const opening = $derived(openingOf(library, playlistId))
  /** 不在曲库里的歌单：歌是打开时联网取的，说“加载”，不说“同步” */
  const outside = $derived(!library.songsOf(playlistId))
  const term = $derived(query.trim())
  const result = $derived(term && shown.kind === 'songs' ? view.app.searchPlaylist(playlistId, term) : null)
  /** 列表里显示的歌：搜索时是搜到的 */
  const songs = $derived(result ? result.songs : shown.kind === 'songs' ? shown.songs : [])
  /** 列表那一块显示什么：整张歌单、搜到的歌、一首都没搜到。换的时候交叉淡化 */
  const mode = $derived(result === null ? 'all' : songs.length === 0 ? 'none' : 'found')
  const nowId = $derived(currentSong(view.state.player)?.id ?? null)
  const source = $derived<PlaySource>({ kind: 'playlist', id: playlistId })
  const incompleteText = $derived(outside ? '这张歌单还没加载完，结果可能不全' : '这张歌单还没同步完，结果可能不全')
  const selection = playlistSelection
  /** 曲库里的这张歌单是哪一类；不在曲库里的歌单是 null */
  const kind = $derived(library.songsOf(playlistId)?.playlist.kind ?? null)
  /** 这张歌单能不能移除：只有自建歌单有（我喜欢的音乐、收藏的歌单没有） */
  const own = $derived(kind === 'own')
  /** 能排序的列表（自建歌单、我喜欢的音乐）：入口写“多选 · 排序”（#36） */
  const sortableList = $derived(kind !== null && canSortPlaylist(kind))
  /**
   * 现在能不能拖：歌都同步全了、每一首都有歌曲信息（不然列表和整张歌单对不上），也没在搜索、没在重新拉
   */
  const sortable = $derived(sortableList && shown.kind === 'songs' && shown.complete && shown.songs.length === shown.total && result === null && opening === null)
  /** 能排序的列表现在拖不了：说清楚是搜索结果，还是还没同步完 */
  const sortBlockedText = $derived.by(() => {
    if (result !== null)
      return '搜索结果里不能拖动排序，清空搜索后再拖。'
    if (shown.kind === 'songs' && shown.complete)
      return '还有歌没取到，取到才能拖动排序。'
    return '这张歌单还没同步完，同步完才能拖动排序。'
  })
  /** 勾选的是整张歌单里的歌，不只是搜索出来的这些 */
  const picked = $derived(shown.kind === 'songs' ? shown.songs.filter(song => selection.has(song.id)) : [])

  /** 拖动排序（#36）：只在多选里、按每行的把手拖；勾选的几首一起拖，保持原来的先后 */
  let listHost = $state<HTMLElement>()
  const drag = new SongDrag({
    songs: () => songs,
    selection,
    move: (songIds, before) => view.app.moveSongs(playlistId, songIds, before),
    host: () => listHost,
  })
  // 拖动期间虚拟列表的 items 保持原顺序，只改每一行的 placeOf；
  // 不能把被拖的行挪到数组末尾：DOM 节点被移走会丢指针捕获（#36 真实输入验证）

  // 退出多选、换了列表（搜索、歌单加载完重排）：拖动作废，不提交
  $effect(() => {
    if (!selection.mode || !sortable)
      untrack(() => drag.cancel())
    return () => drag.cancel()
  })

  /** 桌面：焦点在某一行时 Alt + ↑ / ↓ 移一位（#36）；走的和拖动是同一个 App 操作 */
  function onListKeydown(event: KeyboardEvent): void {
    if (!sortable || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown'))
      return
    const row = (event.target as Element).closest<HTMLElement>('[data-song-id]')
    if (!row)
      return
    if (drag.moveByKeyboard(Number(row.dataset.songId), event.key === 'ArrowUp' ? -1 : 1)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  $effect(() => selection.follow(playlistId))
  $effect(() => selection.setVisible(songs.map(song => song.id)))
  // 列表没了（出错、换歌单）：勾选也清掉
  $effect(() => {
    if (shown.kind !== 'songs' && selection.mode)
      selection.exit()
  })

  function activate(song: Song): void {
    if (selection.mode)
      selection.toggle(song.id)
    else
      void view.app.play(source, song.id)
  }

  /** 桌面的 ⌘/Ctrl 点选、Shift 连选：第一次也进入同一个多选状态 */
  function selectWithModifiers(song: Song, event: MouseEvent): void {
    if (!selection.mode)
      enterSelection(playlistId)
    if (event.shiftKey)
      selection.range(song.id)
    else
      selection.toggle(song.id)
  }

  function openMulti(event: MouseEvent): void {
    enterSelection(playlistId, undefined, event.currentTarget as HTMLElement)
  }

  function openBatch(event: MouseEvent): void {
    if (picked.length === 0)
      return
    batchPicker.open({
      songs: picked,
      currentPlaylistId: playlistId,
      from: event.currentTarget as HTMLElement,
      anchor: anchorBelow(event),
    })
  }

  function removePicked(): void {
    if (picked.length === 0)
      return
    view.app.removeFromPlaylist(playlistId, picked.map(song => song.id))
    leaveSelection()
  }

  function openAddSongs(event?: MouseEvent): void {
    addSongsDialog.open({ playlistId, from: event?.currentTarget as HTMLElement ?? null })
  }

  function retry() {
    if (library.playlists)
      void view.app.openPlaylist(playlistId)
    else
      view.app.retrySync()
  }
</script>

{#snippet found()}
  <!-- 元素开头的普通空格 Svelte 会去掉，分隔符前用不换行空格 -->
  找到 {formatCount(songs.length)} 首{#if result?.incomplete}<span class='text-neutral-700 font-500'>&nbsp;· {incompleteText}</span>{/if}
{/snippet}

{#snippet rowGrip(song: Song)}
  <SongGrip {song} size={phone ? 'phone' : 'desktop'} attach={drag.handle(song)} />
{/snippet}

{#snippet ghostGrip(song: Song)}
  <SongGrip {song} size={phone ? 'phone' : 'desktop'} ghost />
{/snippet}

{#snippet ghostRow()}
  {#if drag.ghostSong}
    {#if phone}
      <PhoneSongRow
        song={drag.ghostSong}
        {source}
        now={false}
        selecting
        selected={selection.has(drag.ghostSong.id)}
        grip={ghostGrip}
        ghost
        count={drag.moved.length}
        onplay={() => {}}
      />
    {:else}
      <DesktopSongRow
        song={drag.ghostSong}
        {source}
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
  {/if}
{/snippet}

{#snippet songRow(song: Song, i: number)}
  {@const motion = drag.motionOf(song)}
  <div
    class='h-full origin-center'
    class:relative={motion !== null}
    class:z-10={motion !== null}
    class:drag-row-pick={motion === 'pick'}
    class:drag-row-land={motion === 'land'}
    style:--drag-shift="{motion === 'pick' ? drag.liftShift(i) : motion === 'land' ? drag.landShift(song) : 0}px"
    style:--drag-delay="{motion === 'land' ? drag.landDelay(song) : 0}ms"
  >
    {#if phone}
      <PhoneSongRow
        {song}
        {source}
        now={song.id === nowId}
        selecting={selection.mode}
        selected={selection.has(song.id)}
        grip={sortable && selection.mode ? rowGrip : undefined}
        onlongpress={() => enterSelection(playlistId, song.id)}
        onplay={() => activate(song)}
      />
    {:else}
      <DesktopSongRow
        {song}
        {source}
        n={i + 1}
        now={song.id === nowId}
        selecting={selection.mode}
        selected={selection.has(song.id)}
        grip={sortable && selection.mode ? rowGrip : undefined}
        onselect={event => selectWithModifiers(song, event)}
        onplay={() => activate(song)}
      />
    {/if}
  </div>
{/snippet}

{#snippet list()}
  {#if shown.kind === 'loading'}
    <SkeletonRows count={phone ? 8 : 10} {phone} label='正在加载歌单' />
  {:else}
    <div in:reveal>
      {#if shown.kind === 'failed'}
        <StateBlock kind='error' title={liked ? '我喜欢的音乐没能同步' : '这张歌单没能加载'} body={failureText(shown.failure)} action={{ label: '重试', run: retry }} />
      {:else if shown.kind === 'empty'}
        {#if liked}
          <StateBlock kind='empty' icon={Heart} title='还没有红心的歌' body='在网易云音乐里红心的歌，会同步到这里。' />
        {:else if outside}
          <StateBlock kind='empty' icon={ListMusic} title='这张歌单还没有歌' body='创建者还没有往里面加歌。' />
        {:else if kind === 'own'}
          <StateBlock
            kind='empty'
            icon={ListMusic}
            title='这张歌单还没有歌'
            body='点“添加歌曲”，从搜索或我喜欢的音乐里挑几首加进来。'
            action={{ label: '添加歌曲', run: () => openAddSongs() }}
          />
        {:else}
          <StateBlock kind='empty' icon={ListMusic} title='这张歌单还没有歌' body='创建者还没有往里面加歌。' />
        {/if}
      {:else if shown.kind === 'songs'}
        {#if opening?.status === 'failed'}
          <div transition:unfold>
            <div class='flex items-center gap-3 px-3 py-2 text-caption text-neutral-700' role='alert'>
              <CircleAlert size={16} class='flex-none text-error-700' aria-hidden='true' />
              <span class='min-w-0 flex-1'>这张歌单没加载完。{failureText(opening.failure)}</span>
              <Button variant='outline' class='h-9! md:h-9!' onclick={retry}>重试</Button>
            </div>
          </div>
        {:else if opening?.status === 'loading'}
          <div transition:unfold>
            <p class='px-3 py-2 text-caption text-neutral-600' role='status'>正在加载这张歌单的其余歌曲…</p>
          </div>
        {/if}
        {#if selection.mode && sortableList && !sortable}
          <p class='px-3 py-2 text-caption text-neutral-600' role='status'>{sortBlockedText}</p>
        {/if}
        <!-- 新旧两块叠在同一格里交叉淡化：换的这一会儿高度按高的那块算 -->
        <div class='grid grid-cols-[minmax(0,1fr)]'>
          {#key mode}
            <div class='col-start-1 row-start-1 min-w-0' transition:fade>
              {#if songs.length === 0}
                <StateBlock
                  kind='empty'
                  icon={SearchX}
                  title={`这张歌单里没有“${term}”`}
                  body={result?.incomplete
                    ? outside ? '这张歌单还没加载完，还没加载到的歌里可能有，加载完再搜一次。' : '这张歌单还没同步完，还没同步到的歌里可能有，同步完再搜一次。'
                    : '只搜了这张歌单里的歌名、歌手和专辑。'}
                />
              {:else}
                <!-- 拖动排序：#36。清空右侧按钮的淡出只在手机上；拖动中列表照常跟手滚动 -->
                <!-- 按键从行里的按钮冒泡上来（事件委托），列表本身不需要能获得焦点 -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <div
                  bind:this={listHost}
                  class={['relative', phone && drag.dragging && 'clear-rail']}
                  role='group'
                  aria-label='歌单里的歌曲'
                  onkeydown={onListKeydown}
                >
                  <VirtualList
                    items={songs}
                    itemHeight={SONG_ROW_HEIGHT}
                    getKey={(song: Song) => song.id}
                    markOf={drag.dragging ? undefined : songMark}
                    placeOf={drag.dragging ? drag.placeOf : undefined}
                    keep={drag.dragging || drag.settling || drag.expanding ? drag.keep : undefined}
                    animatePlace={drag.dragging || drag.settling || drag.expanding}
                    hidden={drag.dragging || drag.settling || drag.expanding ? drag.hideMoved : undefined}
                    row={songRow}
                  ></VirtualList>
                </div>
              {/if}
            </div>
          {/key}
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

{#if phone}
  <div class='px-4 pt-3'>
    <SearchField label='在歌单里搜索' bind:value={query} disabled={shown.kind !== 'songs'} />
    {#if result || (shown.kind === 'songs' && songs.length > 0)}
      <div class='min-h-11 flex items-center gap-2 pt-1'>
        <p class='min-w-0 flex-1 px-1 text-caption text-neutral-600 tabular-nums' role='status'>
          {#if result}
            {@render found()}
          {:else if shown.kind === 'songs'}
            {formatCount(shown.total)} 首
          {/if}
        </p>
        {#if !selection.mode && shown.kind === 'songs' && songs.length > 0}
          <button
            type='button'
            class='h-11 inline-flex flex-none items-center gap-1.5 border border-neutral-200 rounded-full bg-white pl-3.5 pr-4 text-label text-neutral-800 font-500 active:bg-neutral-50'
            data-multiselect-entry
            onclick={openMulti}
          >
            <ListChecks size={16} aria-hidden='true' />{sortableList ? '多选 · 排序' : '多选'}
          </button>
        {/if}
      </div>
    {/if}
  </div>
  <div class='pt-2'>{@render list()}</div>
{:else}
  <div class='rounded-xl bg-white p-2 shadow-ambient'>
    {#if selection.mode}
      <div class='h-9 flex items-center gap-1.5 rounded-lg bg-primary-50 pl-3 pr-1' role='toolbar' aria-label='对选中的歌'>
        <span class='inline-flex flex-none items-center gap-1.5 text-caption text-neutral-900 font-500 tabular-nums' role='status'>
          <ListChecks size={14} aria-hidden='true' />已选 {formatCount(selection.size)} 首
        </span>
        <button
          type='button'
          class='h-8 inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 text-caption text-primary-900 font-500 transition-colors duration-feedback mouse:hover:bg-primary-100'
          onclick={() => selection.selectAll()}
        >
          {#if selection.allOn}<ListX size={14} aria-hidden='true' />{:else}<CheckCheck size={14} aria-hidden='true' />{/if}
          {selection.allOn ? '全不选' : `全选 ${formatCount(songs.length)} 首`}
        </button>
        <span class='flex-1'></span>
        <button
          type='button'
          class='h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-caption text-neutral-800 font-500 transition-colors duration-feedback disabled:opacity-45 mouse:enabled:hover:bg-primary-100'
          disabled={picked.length === 0}
          onclick={openBatch}
        ><ListPlus size={15} aria-hidden='true' />加入歌单</button>
        {#if own}
          <button
            type='button'
            class='h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-caption text-neutral-800 font-500 transition-colors duration-feedback disabled:opacity-45 mouse:enabled:hover:bg-primary-100'
            disabled={picked.length === 0}
            onclick={removePicked}
          ><ListMinus size={15} aria-hidden='true' />从歌单移除</button>
        {/if}
        <span class='mx-1 h-5 w-px bg-neutral-200' aria-hidden='true'></span>
        <button
          type='button'
          class='h-8 inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 text-caption text-neutral-700 font-500 transition-colors duration-feedback mouse:hover:bg-primary-100'
          title='Esc'
          onclick={() => leaveSelection()}
        ><X size={14} aria-hidden='true' />取消选择</button>
      </div>
    {:else}
      <div class={[SONG_GRID, 'h-9 text-caption text-neutral-500']}>
        <span class={SONG_COLUMNS.index}>#</span>
        <span class={['grid grid-cols-[minmax(0,1fr)] pl-[52px]', SONG_COLUMNS.title]} role='status'>
          {#if result}
            <span class='col-start-1 row-start-1 truncate' transition:fade>{@render found()}</span>
          {:else}
            <span class='col-start-1 row-start-1 truncate' transition:fade>标题</span>
          {/if}
        </span>
        <span class={SONG_COLUMNS.album}>专辑</span>
        <span class={SONG_COLUMNS.status}>状态</span>
        <span class={SONG_COLUMNS.duration}>时长</span>
        <span></span>
      </div>
    {/if}
    {@render list()}
  </div>
{/if}

<!-- 浮起的行跟着指针；松手后落进空位。“移到第 N 首”的标签在它上面，最上层（DESIGN.md Overlays） -->
{#if drag.dragging || drag.settling || drag.expanding}
  <div
    class='pointer-events-none fixed left-0 top-0 z-[60] h-14'
    style:left='{drag.ghostLeft}px'
    style:width='{drag.ghostWidth}px'
    style:transform='translate3d(0, {drag.ghostY}px, 0)'
    class:transition-transform={drag.settling}
    class:duration-move-state={drag.settling}
    class:transition-opacity={drag.expanding}
    class:duration-state={drag.expanding}
    class:ease-out-soft={drag.settling || drag.expanding}
    class:opacity-0={drag.expanding}
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

<!-- 快速定位：拖到右侧窄条按比例跳。从窄条里开始拖时，先往左离开窄条才接手（手机上把手正好在窄条里） -->
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
        class={['absolute left-1/2 inset-y-0 w-2 -ml-1 rounded-full transition-[scale,background-color] duration-move-feedback ease-out-soft', drag.scrubbing ? 'bg-primary-200' : 'bg-primary-100']}
        style:scale={drag.scrubbing ? '1 1' : '0.5 1'}
      ></span>
      <span
        class='absolute left-1/2 size-5 border-2 border-white rounded-full bg-primary-800 shadow-ambient -ml-2.5 -mt-2.5'
        style:top='{(drag.target / Math.max(1, drag.rest.length)) * 100}%'
      ></span>
    </span>
    <span class='absolute inset-x-0 bottom-0 h-6 text-center text-caption text-neutral-600 font-500 tabular-nums'>{formatCount(drag.railTotal)}</span>
    {#if drag.railArmed && !drag.scrubbing}
      <span class='absolute right-12 whitespace-nowrap rounded-xl bg-white px-2.5 py-1.5 text-center text-caption text-neutral-700 leading-4 shadow-ambient -translate-y-1/2' style:top={drag.hintTop}>拖到这里<br />快速定位</span>
    {/if}
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
  .clear-rail :global([data-more]),
  .clear-rail :global([data-grip]) {
    opacity: 0;
    transition: opacity var(--duration-feedback) var(--ease-out-soft);
  }
</style>
