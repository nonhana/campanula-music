<!--
  曲库里收藏的专辑或歌手：手机的专辑、歌手标签（两列 / 三列网格），桌面直接打开这两个地址时的网格，桌面首页的横向架子。
  加载 / 失败 / 空 / 条目和格宽都交给 TileGrid（#75）；列表还没拿到时是形状一致的骨架，没拿到就出错时能重试，一个都没有时只有一行标题。
  骨架换成格子时骨架淡出、前几格依次飘入（DESIGN.md Motion）。架子见 Shelf
-->
<script lang='ts'>
  import type { CollectedAlbum, CollectedArtist } from '#lib/api/library.js'
  import type { LibraryState } from '#lib/app/library.js'
  import { Disc3, UserRound } from '@lucide/svelte'
  import { creditLine } from '#lib/api/library.js'
  import { getAppView } from '../shared/app-context.svelte'
  import { failureText } from '../shared/failure'
  import AlbumTile from './AlbumTile.svelte'
  import ArtistTile from './ArtistTile.svelte'
  import TileGrid from './TileGrid.svelte'

  interface Props {
    library: LibraryState
    kind: 'albums' | 'artists'
    layout: 'phone' | 'grid' | 'shelf'
  }

  const { library, kind, layout }: Props = $props()
  const view = getAppView()
  const phone = $derived(layout === 'phone')
  const albums = $derived(kind === 'albums' ? library.albums : null)
  const artists = $derived(kind === 'artists' ? library.artists : null)
  const failure = $derived(library.sync.status === 'failed'
    ? {
      title: `收藏的${kind === 'albums' ? '专辑' : '歌手'}没能同步`,
      body: failureText(library.sync.failure),
      retry: () => view.app.retrySync(),
    }
    : null)
</script>

{#if kind === 'albums'}
  <TileGrid kind='album' layout={layout === 'shelf' ? 'shelf' : 'grid'} {phone} items={albums} label='收藏的专辑' loadingLabel='正在加载收藏的专辑' failure={failure} empty={{ icon: Disc3, title: '还没有收藏的专辑' }}>
    {#snippet tile(album: CollectedAlbum)}
      <AlbumTile id={album.id} name={album.name} coverUrl={album.coverUrl} detail={creditLine(album.artists)} {phone} />
    {/snippet}
  </TileGrid>
{:else}
  <TileGrid kind='artist' layout={layout === 'shelf' ? 'shelf' : 'grid'} {phone} items={artists} label='收藏的歌手' loadingLabel='正在加载收藏的歌手' failure={failure} empty={{ icon: UserRound, title: '还没有收藏的歌手' }} detail={false}>
    {#snippet tile(artist: CollectedArtist)}
      <ArtistTile id={artist.id} name={artist.name} avatarUrl={artist.avatarUrl} />
    {/snippet}
  </TileGrid>
{/if}
