<!--
  曲库里收藏的专辑或歌手：手机的专辑、歌手标签（两列 / 三列网格），桌面直接打开这两个地址时的网格，桌面首页的横向架子。
  列表还没拿到时是形状一致的骨架，没拿到就出错时能重试，一个都没有时说明在网易云音乐里收藏的会出现在这里。
  骨架换成格子时骨架淡出、前几格依次飘入（DESIGN.md Motion）。
  架子见 Shelf
-->
<script lang='ts'>
  import type { LibraryState } from '#lib/app/library.js'
  import { Disc3, UserRound } from '@lucide/svelte'
  import { creditLine } from '#lib/api/library.js'
  import { getAppView } from '../app-context.svelte'
  import { failureText } from '../failure'
  import { fadeAway, reveal } from '../motion'
  import StateBlock from '../ui/StateBlock.svelte'
  import AlbumTile from './AlbumTile.svelte'
  import ArtistTile from './ArtistTile.svelte'
  import Shelf from './Shelf.svelte'
  import TileBone from './TileBone.svelte'

  interface Props {
    library: LibraryState
    kind: 'albums' | 'artists'
    layout: 'phone' | 'grid' | 'shelf'
  }

  const { library, kind, layout }: Props = $props()
  const view = getAppView()

  /** 专辑和歌手不一样的地方：名字、空状态的图标、各种排法的列和格宽、骨架的形状 */
  const KINDS = {
    albums: { noun: '专辑', icon: Disc3, phoneCols: 'grid-cols-2', gridCols: 'grid-cols-[repeat(auto-fill,minmax(176px,1fr))]', shelf: 'gap-5', cell: 'w-[168px]', phoneBones: 4, round: false },
    artists: { noun: '歌手', icon: UserRound, phoneCols: 'grid-cols-3', gridCols: 'grid-cols-[repeat(auto-fill,minmax(128px,1fr))]', shelf: 'gap-6', cell: 'w-[120px]', phoneBones: 6, round: true },
  }
  const look = $derived(KINDS[kind])
  const items = $derived(kind === 'albums' ? library.albums : library.artists)

  const listClass = $derived(
    layout === 'shelf'
      ? ['flex px-2 pb-3 pt-1', look.shelf]
      : layout === 'phone'
      ? ['grid gap-x-3 gap-y-5 px-4 pt-4', look.phoneCols]
      : ['grid gap-x-5 gap-y-6', look.gridCols],
  )
  /** 架子上一格的宽度；网格里跟着列宽 */
  const itemClass = $derived(['min-w-0', layout === 'shelf' && [look.cell, 'flex-none']])
</script>

{#snippet tiles()}
  {#if kind === 'albums' && library.albums}
    {#each library.albums as album (album.id)}
      <li class={itemClass}>
        <AlbumTile id={album.id} name={album.name} coverUrl={album.coverUrl} detail={creditLine(album.artists)} phone={layout === 'phone'} />
      </li>
    {/each}
  {:else if kind === 'artists' && library.artists}
    {#each library.artists as artist (artist.id)}
      <li class={itemClass}>
        <ArtistTile id={artist.id} name={artist.name} avatarUrl={artist.avatarUrl} />
      </li>
    {/each}
  {/if}
{/snippet}

<!-- 骨架和出错、内容放在同一串分支里：骨架换成内容时，骨架的淡出、内容的飘入才会播放 -->
{#if items === null && library.sync.status === 'failed'}
  <div in:reveal><StateBlock kind='error' title={`收藏的${look.noun}没能同步`} body={failureText(library.sync.failure)} action={{ label: '重试', run: () => view.app.retrySync() }} /></div>
{:else if items === null}
  <div class={[listClass, layout === 'shelf' && '-mx-2 overflow-hidden']} role='status' aria-busy='true' aria-label={`正在加载收藏的${look.noun}`} out:fadeAway>
    {#each { length: layout === 'phone' ? look.phoneBones : 6 }, i (i)}
      <TileBone class={itemClass} round={look.round} detail={!look.round} phone={layout === 'phone'} />
    {/each}
  </div>
{:else}
  <div in:reveal>
    {#if items.length === 0}
      <StateBlock kind='empty' icon={look.icon} title={`还没有收藏的${look.noun}`} body={`在网易云音乐里收藏的${look.noun}，会同步到这里。`} />
    {:else if layout === 'shelf'}
      <Shelf label={`收藏的${look.noun}`} class={look.shelf}>{@render tiles()}</Shelf>
    {:else}
      <ul class={listClass} aria-label={`收藏的${look.noun}`} data-reveal-group>
        {@render tiles()}
      </ul>
    {/if}
  </div>
{/if}
