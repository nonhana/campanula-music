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
  /** 勾选的是整张歌单里的歌，不只是搜索出来的这些 */
  const picked = $derived(shown.kind === 'songs' ? shown.songs.filter(song => selection.has(song.id)) : [])

  $effect(() => selection.follow(playlistId))
  $effect(() => selection.setVisible(songs.map(song => song.id)))
  // 列表没了（出错、换歌单）：勾选也清掉
  $effect(() => {
    if (shown.kind !== 'songs' && selection.size > 0)
      selection.exit()
  })

  function activate(song: Song): void {
    if (selection.mode)
      selection.toggle(song.id)
    else
      void view.app.play(source, song.id)
  }

  /** 桌面不进多选时的 ⌘/Ctrl 点选、Shift 连选 */
  function selectWithModifiers(song: Song, event: MouseEvent): void {
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
                <VirtualList items={songs} itemHeight={56} getKey={(song: Song) => song.id} markOf={songMark}>
                  {#snippet row(song: Song, i: number)}
                    {#if phone}
                      <PhoneSongRow
                        {song}
                        {source}
                        now={song.id === nowId}
                        selecting={selection.mode}
                        selected={selection.has(song.id)}
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
                        onselect={event => selectWithModifiers(song, event)}
                        onplay={() => activate(song)}
                      />
                    {/if}
                  {/snippet}
                </VirtualList>
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
            <ListChecks size={16} aria-hidden='true' />多选
          </button>
        {/if}
      </div>
    {/if}
  </div>
  <div class='pt-2'>{@render list()}</div>
{:else}
  <div class='rounded-xl bg-white p-2 shadow-ambient'>
    {#if selection.mode || selection.size > 0}
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
          class='h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-caption text-neutral-700 font-500 transition-colors duration-feedback mouse:hover:bg-primary-100'
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
