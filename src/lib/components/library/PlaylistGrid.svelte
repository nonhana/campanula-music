<!--
  曲库里的歌单（自建的、收藏的，不含我喜欢的音乐）：全部 / 自建 / 收藏 筛选加封面网格，筛选右边是“新建歌单”（#33，打开 PlaylistEditor）。
  手机的歌单标签和桌面首页的歌单区块共用；歌单列表还没拿到时是骨架，没拿到就出错时能重试，筛完一张都没有时说明。
  骨架换成格子时骨架淡出、前几格依次飘入（DESIGN.md Motion）；换筛选时整个格子先淡出再淡入，不让一个个格子各自挪位
  （DESIGN.md Overlays · 筛选）。heading：桌面放在筛选左边的区块标题
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { LibraryState } from '#lib/app/library.js'
  import type { PlaylistFilter } from './view'
  import { ListMusic, Plus } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { failureText } from '../failure'
  import { fadeAway, fadeThrough, reveal } from '../motion'
  import { playlistEditor } from '../playlist-edit.svelte'
  import Button from '../ui/Button.svelte'
  import FilterChip from '../ui/FilterChip.svelte'
  import StateBlock from '../ui/StateBlock.svelte'
  import PlaylistTile from './PlaylistTile.svelte'
  import TileBone from './TileBone.svelte'
  import { filterPlaylists, PLAYLIST_FILTERS, playlistName } from './view'

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
    all: { title: '曲库里还没有歌单', body: '点“新建歌单”建一张；在网易云音乐里新建或收藏的歌单也会同步到这里。' },
    own: { title: '还没有自建歌单', body: '点“新建歌单”建一张；在网易云音乐里新建的歌单也会同步到这里。' },
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
  <Button variant='outline' icon={Plus} class='ml-auto' onclick={event => playlistEditor.open({ mode: 'new', songs: [], from: event.currentTarget })}>新建歌单</Button>
</div>

<!-- 骨架和出错、内容放在同一串分支里：骨架换成内容时，骨架的淡出、内容的飘入才会播放 -->
{#if shown === null && library.sync.status === 'failed'}
  <div in:reveal><StateBlock kind='error' title='歌单列表没能同步' body={failureText(library.sync.failure)} action={{ label: '重试', run: () => view.app.retrySync() }} /></div>
{:else if shown === null}
  <div class={gridClass} role='status' aria-busy='true' aria-label='正在加载歌单' out:fadeAway>
    {#each { length: phone ? 4 : 6 }, i (i)}
      <TileBone {phone} />
    {/each}
  </div>
{:else}
  <div in:reveal>
    <!-- 新旧两份格子叠在同一格里：换筛选的这一会儿高度按高的那份算，淡完旧的才换成新的高度 -->
    <div class='grid grid-cols-[minmax(0,1fr)]'>
      {#key filter}
        <div class='col-start-1 row-start-1 min-w-0' transition:fadeThrough>
          {#if shown.length === 0}
            <StateBlock kind='empty' icon={ListMusic} title={EMPTY[filter].title} body={EMPTY[filter].body} />
          {:else}
            <ul class={gridClass} aria-label='歌单' data-reveal-group>
              {#each shown as playlist (playlist.id)}
                <li class='min-w-0'>
                  <PlaylistTile
                    id={playlist.id}
                    name={playlistName(playlist)}
                    coverUrl={playlist.coverUrl}
                    trackCount={playlist.trackCount}
                    creator={playlist.kind === 'collected' ? playlist.creator : null}
                    locked={playlist.private}
                    {phone}
                  />
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/key}
    </div>
  </div>
{/if}
