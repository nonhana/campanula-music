<!--
  歌手页：圆形头像的头部（名字、“几首歌 · 几张专辑”）、热门歌曲、专辑网格（新的在前，后面还有时“显示更多”）。
  桌面头像在左；手机是返回栏 + 居中头像头部 + Auxio 式歌曲行 + 两列专辑。头部交给 DetailHeader（#75），网格交给 TileGrid。
  告诉 App 听众在看这一位歌手（viewing）：什么时候拉、没拉成后重试都由 App 决定。滚动位置随浏览历史恢复。
-->
<script lang='ts'>
  import { Disc3, UserRound } from '@lucide/svelte'
  import { tick } from 'svelte'

  import type { ArtistAlbum } from '#lib/api/library.js'
  import AlbumTile from '#lib/components/library/AlbumTile.svelte'
  import CollectButton from '#lib/components/library/CollectButton.svelte'
  import DetailHeader from '#lib/components/library/DetailHeader.svelte'
  import { selectionActions } from '#lib/components/library/selection-actions.svelte.js'
  import TileGrid from '#lib/components/library/TileGrid.svelte'
  import { getAppView } from '#lib/components/shared/app-context.svelte.js'
  import { failureText } from '#lib/components/shared/failure.js'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import { reveal } from '#lib/components/shared/motion.js'
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js'
  import { formatCount, yearOf } from '#lib/components/shared/text.js'
  import PlayAllButton from '#lib/components/songs/PlayAllButton.svelte'
  import SongList from '#lib/components/songs/SongList.svelte'
  import type { SongListView } from '#lib/components/songs/view.js'
  import ShowMore from '#lib/components/ui/ShowMore.svelte'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'

  import type { PageProps } from './$types'

  const { params }: PageProps = $props()
  const view = getAppView()
  const library = $derived(view.state.library)
  const id = $derived(params.id)
  const opened = $derived(library?.artistPage(id) ?? null)
  const content = $derived(opened?.status === 'shown'
    ? opened.content
    : null)
  const artist = $derived(content?.artist ?? null)
  const more = $derived(content?.moreAlbums ?? null)
  const phone = $derived(!desktopLayout.current)
  /** “几首歌 · 几张专辑”：网易云没给的那一项连同分隔不写（#78） */
  const counts = $derived(artist
    ? [
      artist.songCount === null
        ? null
        : `${formatCount(artist.songCount)} 首歌`,
      artist.albumCount === null
        ? null
        : `${formatCount(artist.albumCount)} 张专辑`,
    ].filter(part => part !== null).join(' · ')
    : '')

  scrollSnapshot('/artists/[id=neteaseId]', () => null, () => {})

  // 听众在看这一位歌手：什么时候拉由 App 决定，换一位、本机状态变了不用页面再调一次
  $effect(() => view.app.viewing({ kind: 'artist', id }))

  const hotSongs = $derived.by((): SongListView => {
    if (!content)
      return { kind: 'loading' }
    if (content.hotSongs.length === 0)
      return { kind: 'empty', title: '暂时没有热门歌曲' }
    return { kind: 'songs', songs: content.hotSongs }
  })

  const actions = selectionActions()
  /** 热门歌曲能做的事（#82）：加入歌单、下载；从别的列表挑出来的歌，来源记成单独下载（规则⑦） */
  const select = $derived({
    actions: [
      actions.addToPlaylist(),
      actions.download(() => ({ kind: 'single' })),
    ],
  })

  let albumList = $state<HTMLElement>()
  /** 上一次“显示更多”之前已经有几张：后加进来的从第几张开始依次飘入 */
  let appendedAt = $state(0)
  const showMore = async () => {
    const shown = content?.albums.length ?? 0
    appendedAt = shown
    await view.app.moreArtistAlbums(id)
    await tick()
    // 取完了，按钮跟着不见：焦点移到新出来的第一张，免得掉回页面最上面
    if (!more)
      albumList?.querySelectorAll('a')[shown]?.focus()
  }
</script>

<svelte:head><title>{artist?.name ?? '歌手'} · Campanula</title></svelte:head>

{#if library}
  {#if opened?.status === 'failed'}
    <div in:reveal><StateBlock kind='error' title='这位歌手的页面没能加载' body={failureText(opened.failure)} action={{
      label: '重试',
      run: () => void view.app.openArtist(id),
    }} /></div>
  {:else}
    <DetailHeader
      align='center'
      ready={!!artist}
      cover={{ url: artist?.avatarUrl ?? null, round: true, fallback: UserRound }}
      title={artist?.name ?? ''}
    >
      {#snippet meta()}
        {#if artist}
          {counts}
        {/if}
      {/snippet}
      {#snippet actions()}
        {#if artist}
          <PlayAllButton songs={content?.hotSongs ?? null} source={{ kind: 'artist', id }} label='播放热门歌曲' />
          <CollectButton target={{ kind: 'artist', id }} name={artist.name} look='pill' />
        {/if}
      {/snippet}
    </DetailHeader>

    {#if desktopLayout.current}
      <section class='mt-10' aria-labelledby='artist-hot'>
        <h2 id='artist-hot' class='text-title text-neutral-900 font-600'>热门歌曲</h2>
        <div class='mt-3'><SongList list={hotSongs} source={{ kind: 'artist', id }} loadingLabel='正在加载热门歌曲' virtual={false} staggerRows={false} {select} /></div>
      </section>
      {#if content}
        <section class='mt-10 pb-6' aria-labelledby='artist-albums'>
          <h2 id='artist-albums' class='text-title text-neutral-900 font-600'>专辑</h2>
          <div bind:this={albumList} class='mt-3'>
            <TileGrid kind='album' layout='grid' items={content.albums} label='专辑' loadingLabel='正在加载专辑' empty={more
              ? undefined
              : { icon: Disc3, title: '还没有专辑' }} staggerFrom={appendedAt}>
              {#snippet tile(album: ArtistAlbum)}
                <AlbumTile id={album.id} name={album.name} coverUrl={album.coverUrl} detail='' year={yearOf(album.publishedAt)} />
              {/snippet}
            </TileGrid>
          </div>
          <ShowMore {more} onmore={() => void showMore()} failed='没能加载更多专辑' class='pt-5' />
        </section>
      {/if}
    {:else}
      <section class='pt-6' aria-labelledby='artist-hot'>
        <h2 id='artist-hot' class='px-4 text-title-sm text-neutral-900 font-600'>热门歌曲</h2>
        <div class='-mt-1'><SongList list={hotSongs} source={{ kind: 'artist', id }} loadingLabel='正在加载热门歌曲' phone virtual={false} staggerRows={false} {select} /></div>
      </section>
      {#if content}
        <section class='pt-6' aria-labelledby='artist-albums'>
          <h2 id='artist-albums' class='px-4 text-title-sm text-neutral-900 font-600'>专辑</h2>
          <div bind:this={albumList} class={phone ? '' : 'mt-3'}>
            <TileGrid kind='album' layout='grid' {phone} items={content.albums} label='专辑' loadingLabel='正在加载专辑' empty={more
              ? undefined
              : { icon: Disc3, title: '还没有专辑' }} staggerFrom={appendedAt}>
              {#snippet tile(album: ArtistAlbum)}
                <AlbumTile id={album.id} name={album.name} coverUrl={album.coverUrl} detail='' year={yearOf(album.publishedAt)} {phone} />
              {/snippet}
            </TileGrid>
          </div>
          <ShowMore {more} onmore={() => void showMore()} failed='没能加载更多专辑' class='justify-center px-4 pt-5' />
        </section>
      {/if}
    {/if}
  {/if}
{/if}
