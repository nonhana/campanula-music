<!--
  曲库里的歌单（自建的、收藏的，不含我喜欢的音乐）：全部 / 自建 / 收藏 筛选加封面网格。
  手机的歌单标签和桌面首页的歌单区块共用；歌单列表还没拿到时是骨架，没拿到就出错时能重试，筛完一张都没有时说明。
  骨架换成格子时骨架淡出、前几格依次飘入（DESIGN.md Motion）。heading：桌面放在筛选左边的区块标题
-->
<script lang='ts'>
  import type { LibraryState } from '$lib/app/library'
  import type { Snippet } from 'svelte'
  import type { PlaylistFilter } from './view'
  import { ListMusic } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { failureText } from '../failure'
  import { fadeAway, reveal } from '../motion'
  import FilterChip from '../ui/FilterChip.svelte'
  import StateBlock from '../ui/StateBlock.svelte'
  import PlaylistTile from './PlaylistTile.svelte'
  import { filterPlaylists, PLAYLIST_FILTERS } from './view'

  interface Props {
    library: LibraryState
    filter: PlaylistFilter
    phone?: boolean
    heading?: Snippet
  }

  let { library, filter = $bindable(), phone = false, heading }: Props = $props()
  const view = getAppView()
  const shown = $derived(library.playlists && filterPlaylists(library.playlists, filter))
  /** 骨架和真的网格一样排（DESIGN.md Do's：形状一致的骨架） */
  const gridClass = $derived(['grid', phone ? 'grid-cols-2 gap-x-3 gap-y-5 px-4 pt-4' : 'grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-x-5 gap-y-6'])

  const EMPTY = {
    all: { title: '曲库里还没有歌单', body: '在网易云音乐里新建或收藏的歌单，会同步到这里。' },
    own: { title: '还没有自建歌单', body: '在网易云音乐里新建的歌单，会同步到这里。' },
    collected: { title: '还没有收藏的歌单', body: '在网易云音乐里收藏的歌单，会同步到这里。' },
  }
</script>

<div class={['flex items-center', phone ? 'gap-2 px-4 pt-3' : 'mb-4 gap-4']}>
  {@render heading?.()}
  <div class='flex gap-2' role='group' aria-label='筛选歌单'>
    {#each PLAYLIST_FILTERS as item (item.key)}
      <FilterChip selected={filter === item.key} onclick={() => (filter = item.key)}>{item.label}</FilterChip>
    {/each}
  </div>
</div>

<!-- 骨架和出错、内容放在同一串分支里：骨架换成内容时，骨架的淡出、内容的飘入才会播放 -->
{#if shown === null && library.sync.status === 'failed'}
  <div in:reveal><StateBlock kind='error' title='歌单列表没能同步' body={failureText(library.sync.failure)} action={{ label: '重试', run: () => view.app.retrySync() }} /></div>
{:else if shown === null}
  <div class={gridClass} role='status' aria-busy='true' aria-label='正在加载歌单' out:fadeAway>
    {#each { length: phone ? 4 : 6 }, i (i)}
      <div>
        <span class='bone aspect-square w-full rounded-lg'></span>
        <span class='bone mt-3 h-3.5 w-3/4 rounded-full'></span>
        <span class='bone mt-2 h-3 w-1/3 rounded-full'></span>
      </div>
    {/each}
  </div>
{:else}
  <div in:reveal>
    {#if shown.length === 0}
      <StateBlock kind='empty' icon={ListMusic} title={EMPTY[filter].title} body={EMPTY[filter].body} />
    {:else}
      <ul class={gridClass} aria-label='歌单' data-reveal-group>
        {#each shown as playlist (playlist.id)}
          <li class='min-w-0'><PlaylistTile {playlist} {phone} /></li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}
