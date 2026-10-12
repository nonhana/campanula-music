<!--
  我喜欢的音乐的完整列表。桌面：封面和标题的头部、同步提示、表头加虚拟列表；
  手机：标题在返回栏里，下面和曲库首页一样是同步细条加列表。
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import { getAppView } from '$lib/components/app-context.svelte'
  import { desktopLayout } from '$lib/components/layout'
  import Cover from '$lib/components/library/Cover.svelte'
  import DesktopSongRow from '$lib/components/library/DesktopSongRow.svelte'
  import LikedStates from '$lib/components/library/LikedStates.svelte'
  import PhoneLiked from '$lib/components/library/PhoneLiked.svelte'
  import SyncNotice from '$lib/components/library/SyncNotice.svelte'
  import { formatCount, likedView, syncNotice } from '$lib/components/library/view'
  import VirtualList from '$lib/components/library/VirtualList.svelte'

  const view = getAppView()
  const library = $derived(view.state.library)
  const liked = $derived(library && likedView(library))
  const notice = $derived(library && syncNotice(library))
  /** 头部的首数和下面实际显示的列表对得上（DESIGN.md Do's）：还没同步全时写同步了几首 */
  const countLine = $derived.by(() => {
    if (liked?.kind === 'songs')
      return liked.songs.length < liked.total ? `已同步 ${formatCount(liked.songs.length)} / ${formatCount(liked.total)} 首` : `${formatCount(liked.total)} 首`
    if (liked?.kind === 'empty')
      return '0 首'
    return ''
  })
</script>

<svelte:head><title>我喜欢的音乐 · Campanula</title></svelte:head>

{#if library && liked}
  {#if desktopLayout.current}
    <header class='flex gap-7'>
      {#if library.liked}
        <Cover url={library.liked.playlist.coverUrl} size={200} eager class='rounded-xl shadow-ambient' />
      {/if}
      <div class='min-w-0 flex-1 pt-1'>
        <h1 class='text-headline text-neutral-900 font-600'>我喜欢的音乐</h1>
        {#if countLine}<p class='mt-2 text-label text-neutral-600 tabular-nums'>{countLine}</p>{/if}
      </div>
    </header>

    {#if notice}
      <div class='mt-6'><SyncNotice {library} /></div>
    {/if}

    <div class='mt-6 rounded-xl bg-white p-2 shadow-ambient'>
      <div class='grid grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px] h-9 items-center gap-4 pl-2 pr-3 text-caption text-neutral-500'>
        <span class='text-center'>#</span>
        <span class='pl-[52px]'>标题</span>
        <span>专辑</span>
        <span>状态</span>
        <span class='text-right'>时长</span>
      </div>
      {#if liked.kind === 'songs'}
        <VirtualList items={liked.songs} itemHeight={56} getKey={(song: Song) => song.id}>
          {#snippet row(song: Song, i: number)}
            <DesktopSongRow {song} n={i + 1} hearted={library.hearts?.has(song.id) ?? false} />
          {/snippet}
        </VirtualList>
      {:else}
        <LikedStates {liked} rows={10} />
      {/if}
    </div>
  {:else}
    <PhoneLiked {library} />
  {/if}
{/if}
