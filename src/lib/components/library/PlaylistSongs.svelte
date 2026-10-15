<!--
  一张歌单（包括我喜欢的音乐）的歌曲列表和歌单内搜索：歌单页和手机曲库的“我喜欢”标签共用。
  - 手机：搜索框和“找到几首”在列表上面；桌面：搜索框在歌单页的头部（调用方放，绑定同一个 query），
    “找到几首”在白色面板的表头里。
  - 搜索在本机副本里即时完成；歌单还没同步全时结果标“可能不全”。
  - 点一首歌（搜索结果里点也一样）就用整张歌单替换播放队列。
  - 加载中、空、出错、搜不到都有各自的样子；已经有一部分歌时，没拉完、没拉成在列表上方说明。
  - 骨架换成歌（或空、出错）时骨架淡出、前几行依次飘入；带着歌打开这一页时不飘（DESIGN.md Motion）。
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import type { LibraryState } from '$lib/app/library'
  import type { PlaySource } from '$lib/app/player'
  import { CircleAlert, Heart, ListMusic, SearchX } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { failureText } from '../failure'
  import { reveal } from '../motion'
  import { currentSong } from '../player/view'
  import Button from '../ui/Button.svelte'
  import SearchField from '../ui/SearchField.svelte'
  import StateBlock from '../ui/StateBlock.svelte'
  import DesktopSongRow from './DesktopSongRow.svelte'
  import PhoneSongRow from './PhoneSongRow.svelte'
  import SkeletonRows from './SkeletonRows.svelte'
  import { formatCount, playlistView, songMark } from './view'
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
  const opening = $derived(library.opening.get(playlistId))
  const term = $derived(query.trim())
  const result = $derived(term && shown.kind === 'songs' ? view.app.searchPlaylist(playlistId, term) : null)
  /** 列表里显示的歌：搜索时是搜到的 */
  const songs = $derived(result ? result.songs : shown.kind === 'songs' ? shown.songs : [])
  const nowId = $derived(currentSong(view.state.player)?.id ?? null)
  const source = $derived<PlaySource>({ kind: 'playlist', id: playlistId })
  const play = (song: Song) => () => view.app.play(source, song.id)
  const INCOMPLETE = '这张歌单还没同步完，结果可能不全'

  function retry() {
    if (library.playlists)
      void view.app.openPlaylist(playlistId)
    else
      view.app.retrySync()
  }
</script>

{#snippet found()}
  <!-- 元素开头的普通空格 Svelte 会去掉，分隔符前用不换行空格 -->
  找到 {formatCount(songs.length)} 首{#if result?.incomplete}<span class='text-neutral-700 font-500'>&nbsp;· {INCOMPLETE}</span>{/if}
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
        {:else}
          <StateBlock kind='empty' icon={ListMusic} title='这张歌单还没有歌' body='在网易云音乐里加进这张歌单的歌，会同步到这里。' />
        {/if}
      {:else if shown.kind === 'songs'}
        {#if opening?.status === 'failed'}
          <div class='flex items-center gap-3 px-3 py-2 text-caption text-neutral-700' role='alert'>
            <CircleAlert size={16} class='flex-none text-error-700' aria-hidden='true' />
            <span class='min-w-0 flex-1'>这张歌单没加载完。{failureText(opening.failure)}</span>
            <Button variant='outline' class='h-9! md:h-9!' onclick={retry}>重试</Button>
          </div>
        {:else if opening?.status === 'loading'}
          <p class='px-3 py-2 text-caption text-neutral-600' role='status'>正在加载这张歌单的其余歌曲…</p>
        {/if}
        {#if songs.length === 0}
          <StateBlock
            kind='empty'
            icon={SearchX}
            title={`这张歌单里没有“${term}”`}
            body={result?.incomplete ? '这张歌单还没同步完，还没同步到的歌里可能有，同步完再搜一次。' : '只搜了这张歌单里的歌名、歌手和专辑。'}
          />
        {:else}
          <VirtualList items={songs} itemHeight={56} getKey={(song: Song) => song.id} markOf={songMark}>
            {#snippet row(song: Song, i: number)}
              {#if phone}
                <PhoneSongRow {song} {source} now={song.id === nowId} onplay={play(song)} />
              {:else}
                <DesktopSongRow {song} {source} n={i + 1} hearted={library.hearts?.has(song.id) ?? false} now={song.id === nowId} onplay={play(song)} />
              {/if}
            {/snippet}
          </VirtualList>
        {/if}
      {/if}
    </div>
  {/if}
{/snippet}

{#if phone}
  <div class='px-4 pt-3'>
    <SearchField label='在歌单里搜索' bind:value={query} disabled={shown.kind !== 'songs'} />
    {#if result}
      <p class='px-1 pt-2.5 text-caption text-neutral-600 tabular-nums' role='status'>{@render found()}</p>
    {/if}
  </div>
  <div class='pt-2'>{@render list()}</div>
{:else}
  <div class='rounded-xl bg-white p-2 shadow-ambient'>
    <div class='grid grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px] h-9 items-center gap-4 pl-2 pr-1 text-caption text-neutral-500'>
      <span class='text-center'>#</span>
      <span class='truncate pl-[52px]' role='status'>{#if result}{@render found()}{:else}标题{/if}</span>
      <span>专辑</span>
      <span>状态</span>
      <span class='text-right'>时长</span>
      <span></span>
    </div>
    {@render list()}
  </div>
{/if}
