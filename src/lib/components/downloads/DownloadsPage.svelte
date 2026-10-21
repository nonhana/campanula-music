<!--
  “已下载”页（#38，原型 DesktopDownloads / PhoneDownloads，Spec #11 用户故事 117）：这台设备上下载完的全部歌，一个长列表加搜索，不分歌单，最近下载完的在前。
  登录、没登录都是这一页：没登录时从登录页进来（外框是 SignedOutFrame），说明只能播放、加入播放队列和删除。
  桌面：200px 的拼贴封面头部（前四首的封面），标题、首数、说明，播放全部和右边的搜索框；下面是白色面板里带表头的歌曲行。
  手机：88px 的拼贴和标题一行，播放全部，下面单独一行搜索框，歌曲行直接放在晨光底上。
  点一首（搜索结果里点也一样）就用整个已下载替换播放队列，播放来源是“已下载”。行的“更多”菜单里有删除下载。
  还没从本机读出来时是骨架；一首都没有、搜不到各有说明。头部的首数和列表对得上（DESIGN.md Do's）。
  返回这一页时，搜索词和滚动位置都回到原来的样子（snapshot）
-->
<script lang='ts'>
  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { CircleArrowDown, Info, SearchX } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { desktopLayout } from '../layout'
  import Cover from '../library/Cover.svelte'
  import DesktopSongRow, { SONG_COLUMNS, SONG_GRID } from '../library/DesktopSongRow.svelte'
  import PhoneSongRow from '../library/PhoneSongRow.svelte'
  import PlayAllButton from '../library/PlayAllButton.svelte'
  import SkeletonRows from '../library/SkeletonRows.svelte'
  import { formatCount, songMark } from '../library/view'
  import VirtualList from '../library/VirtualList.svelte'
  import { fade, reveal } from '../motion'
  import { currentSong } from '../player/view'
  import Button from '../ui/Button.svelte'
  import SearchField from '../ui/SearchField.svelte'
  import StateBlock from '../ui/StateBlock.svelte'

  /** 搜索词：页面存着，返回这一页时恢复 */
  let { query = $bindable() }: { query: string } = $props()

  const SOURCE: PlaySource = { kind: 'downloads' }
  const ROW = 56

  const view = getAppView()
  const all = $derived(view.state.downloads.songs)
  const signedIn = $derived(view.state.session.status === 'signedIn')
  const term = $derived(query.trim())
  const songs = $derived(all && term ? view.app.searchDownloads(term) : all)
  /** 列表那一块显示什么：全部、搜到的、一首都没搜到。换的时候交叉淡化 */
  const mode = $derived(!term ? 'all' : songs?.length === 0 ? 'none' : 'found')
  const nowId = $derived(currentSong(view.state.player)?.id ?? null)
  /** 拼贴的封面：前四首（不同的封面） */
  const covers = $derived([...new Set((all ?? []).map(song => song.album.coverUrl))].slice(0, 4))

  function play(song: Song): void {
    view.app.play(SOURCE, song.id)
  }
</script>

{#snippet collage(size: number)}
  <div class='relative flex-none' style:width='{size}px' style:height='{size}px'>
    {#if covers.length === 0}
      <span class='rounded-2xl grid size-full place-items-center bg-secondary-50 text-secondary-800' aria-hidden='true'>
        <CircleArrowDown size={size > 100 ? 56 : 34} strokeWidth={1.5} />
      </span>
    {:else if covers.length < 4}
      <Cover url={covers[0]} {size} eager class='rounded-2xl shadow-ambient' />
    {:else}
      <div class='rounded-2xl grid grid-cols-2 size-full overflow-hidden shadow-ambient' aria-hidden='true'>
        {#each covers as url (url)}
          <Cover url={url} size={size / 2} eager />
        {/each}
      </div>
    {/if}
    {#if covers.length > 0 && size > 100}
      <span class='absolute grid size-11 place-items-center rounded-full bg-secondary-100 text-secondary-800 ring-4 ring-primary-50 -bottom-2 -right-2' aria-hidden='true'>
        <CircleArrowDown size={22} />
      </span>
    {/if}
  </div>
{/snippet}

{#snippet signedOutNote(card: boolean)}
  <p class={['flex items-start gap-1.5 text-caption text-neutral-700', card && 'rounded-xl bg-white px-3.5 py-2.5 shadow-ambient']}>
    <Info size={15} class='mt-0.5 flex-none text-neutral-500' aria-hidden='true' />
    <span>没登录时只能播放、加入播放队列和删除；登录后可以红心、加入歌单。</span>
  </p>
{/snippet}

{#snippet found()}
  找到 {formatCount(songs?.length ?? 0)} 首
{/snippet}

{#snippet emptyState()}
  <StateBlock
    kind='empty'
    icon={CircleArrowDown}
    title='这台设备上还没有下载的歌'
    body={`${signedIn ? '' : '登录后，'}在歌曲的“更多”菜单里点“下载”。下载的歌离线也能听。`}
    action={{ label: signedIn ? '去曲库' : '登录', run: () => void goto(resolve('/')) }}
  />
{/snippet}

{#snippet notFound(phone: boolean)}
  <div class='flex flex-col items-center px-6 py-12 text-center' role='status'>
    <SearchX size={24} class='text-neutral-500' aria-hidden='true' />
    <p class='mt-3 text-body text-neutral-900 font-500'>已下载里没有“{term}”</p>
    <p class='mt-1 text-caption text-neutral-600'>换个歌名、歌手或专辑名试试</p>
    {#if !phone}
      <Button variant='outline' class='mt-4' onclick={() => (query = '')}>清除搜索</Button>
    {/if}
  </div>
{/snippet}

{#snippet rows(list: readonly Song[], phone: boolean)}
  <div role='group' aria-label='已下载的歌曲'>
    <VirtualList items={list} itemHeight={ROW} getKey={(song: Song) => song.id} markOf={songMark}>
      {#snippet row(song: Song, i: number)}
        {#if phone}
          <PhoneSongRow {song} source={SOURCE} now={song.id === nowId} onplay={() => play(song)} />
        {:else}
          <DesktopSongRow {song} source={SOURCE} n={i + 1} now={song.id === nowId} onplay={() => play(song)} />
        {/if}
      {/snippet}
    </VirtualList>
  </div>
{/snippet}

{#snippet list(phone: boolean)}
  {#if songs === null}
    <SkeletonRows count={phone ? 8 : 10} {phone} label='正在读出这台设备上的下载' />
  {:else if all?.length === 0}
    <div in:reveal>{@render emptyState()}</div>
  {:else}
    <!-- 新旧两块叠在同一格里交叉淡化：换的这一会儿高度按高的那块算 -->
    <div class='grid grid-cols-[minmax(0,1fr)]' in:reveal>
      {#key mode}
        <div class='col-start-1 row-start-1 min-w-0' transition:fade>
          {#if songs.length === 0}
            {@render notFound(phone)}
          {:else}
            {@render rows(songs, phone)}
          {/if}
        </div>
      {/key}
    </div>
  {/if}
{/snippet}

{#if desktopLayout.current}
  <header class='flex gap-7 pt-2'>
    {@render collage(200)}
    <div class='min-w-0 flex flex-1 flex-col'>
      <h1 class='text-headline text-neutral-900 font-600'>已下载</h1>
      <p class='mt-2 text-label text-neutral-600 tabular-nums'>{all === null ? '　' : `${formatCount(all.length)} 首`}</p>
      <div class='mt-2'>
        {#if signedIn}
          <p class='text-caption text-neutral-600'>保存在这台设备上，离线也能听</p>
        {:else}
          {@render signedOutNote(false)}
        {/if}
      </div>
      <div class='mt-auto flex items-center gap-2 pt-4'>
        <PlayAllButton songs={all} source={SOURCE} />
        {#if all && all.length > 0}
          <SearchField label='在已下载里搜索' bind:value={query} class='ml-auto w-[280px]' />
        {/if}
      </div>
    </div>
  </header>
  <div class='mt-6 rounded-xl bg-white p-2 shadow-ambient'>
    <div class={[SONG_GRID, 'h-9 text-caption text-neutral-500']}>
      <span class={SONG_COLUMNS.index}>#</span>
      <span class={['grid grid-cols-[minmax(0,1fr)] pl-[52px]', SONG_COLUMNS.title]} role='status'>
        {#if term && songs}
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
    {@render list(false)}
  </div>
{:else}
  <header class='px-4 pt-2'>
    <div class='flex items-center gap-4'>
      {@render collage(88)}
      <div class='min-w-0'>
        <h1 class='text-headline-sm text-neutral-900 font-600'>已下载</h1>
        <p class='mt-0.5 text-caption text-neutral-600 tabular-nums'>{all === null ? '　' : `${formatCount(all.length)} 首`}</p>
      </div>
    </div>
    {#if !signedIn}
      <div class='mt-4'>{@render signedOutNote(true)}</div>
    {/if}
    <div class='mt-4 flex items-center gap-2'>
      <PlayAllButton songs={all} source={SOURCE} />
    </div>
    {#if all && all.length > 0}
      <SearchField label='在已下载里搜索' bind:value={query} class='mt-4' />
      {#if term && songs}
        <p class='px-1 pt-2 text-caption text-neutral-600 tabular-nums' role='status'>{@render found()}</p>
      {/if}
    {/if}
  </header>
  <div class='pt-2'>{@render list(true)}</div>
{/if}
