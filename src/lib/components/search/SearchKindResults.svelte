<!--
  结果页的一个标签（单曲、歌单、歌手、专辑，视觉原型 SearchPanel、DesktopSearchResults）：取到的全部，后面还有时“显示更多”。
  桌面放在白色面板里：单曲是带序号的桌面歌曲行，歌单是 64px 的行，歌手是圆头像网格，专辑是封面网格；
  手机放在晨光底上：Auxio 式歌曲行、歌单的行、三列歌手、两列专辑。
  歌手和专辑的骨架、失败、空和格宽交给 TileGrid（#75）；第一页还在拉时是形状一致的骨架，骨架换成内容时依次飘入；
  没拉成时说明原因、能重试；一个都没有时只有“没有相关的…”的标题
-->
<script lang='ts'>
  import { SearchX } from '@lucide/svelte'
  import { tick } from 'svelte'

  import { creditLine } from '#lib/api/library.js'
  import type { SearchedItems, SearchKind } from '#lib/api/search.js'

  import AlbumTile from '../library/AlbumTile.svelte'
  import ArtistTile from '../library/ArtistTile.svelte'
  import TileGrid from '../library/TileGrid.svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { fadeAway, reveal } from '../shared/motion'
  import { formatCount, yearOf } from '../shared/text'
  import SongList from '../songs/SongList.svelte'
  import type { SongListView } from '../songs/view'
  import ShowMore from '../ui/ShowMore.svelte'
  import StateBlock from '../ui/StateBlock.svelte'
  import PlaylistResults from './PlaylistResults.svelte'
  import type { KindItems } from './view'
  import { KIND_WORDS, searchFailure } from './view'

  interface Props {
    keyword: string
    kind: SearchKind
    phone?: boolean
  }

  const { keyword, kind, phone = false }: Props = $props()
  const view = getAppView()
  /** App 只记着最后一次搜的词的结果：记着的是别的词（刚换了词、还没打开）时当作还在加载 */
  const list = $derived(view.state.search.results?.keyword === keyword
    ? view.state.search.results[kind]
    : { status: 'loading' } as const)
  /** 取到的这一类，带上是哪一类：模板里按 kind 分开画，各自拿到自己那一类的项 */
  const shown = $derived(list.status === 'shown'
    ? { kind, items: list.items } as KindItems
    : null)
  const more = $derived(list.status === 'shown'
    ? list.more
    : null)
  const words = $derived(KIND_WORDS[kind])
  const failed = $derived(list.status === 'failed'
    ? searchFailure(list.failure)
    : null)
  const gridFailure = $derived(failed
    ? {
      title: failed.title,
      body: failed.body,
      retry: () => void view.app.openSearch(keyword),
    }
    : null)
  const songs = $derived(shown?.kind === 'songs'
    ? shown.items
    : null)
  const playlists = $derived(shown?.kind === 'playlists'
    ? shown.items
    : null)
  const artists = $derived(shown?.kind === 'artists'
    ? shown.items
    : null)
  const albums = $derived(shown?.kind === 'albums'
    ? shown.items
    : null)
  /** 单曲这一类的列表状态交给 songs/SongList：骨架、失败、空、歌曲都在它里面 */
  const songView = $derived.by((): SongListView => {
    if (list.status === 'failed') {
      const action = searchFailure(list.failure)
      return {
        kind: 'failed',
        title: action.title,
        body: action.body,
        retry: () => void view.app.openSearch(keyword),
      }
    }
    if (!songs)
      return { kind: 'loading' }
    if (songs.length === 0)
      return { kind: 'empty', icon: SearchX, title: `没有相关的${words.label}` }
    return { kind: 'songs', songs }
  })

  let body = $state<HTMLElement>()
  /** 上一次“显示更多”之前已经有几项：后加进来的从第几项开始依次飘入 */
  let appendedAt = $state(0)
  const showMore = async () => {
    const before = list.status === 'shown'
      ? list.items.length
      : 0
    appendedAt = before
    await view.app.moreSearchResults(keyword, kind)
    await tick()
    // 取完了，按钮跟着淡出不见：焦点移到新出来的第一项，免得掉回页面最上面（和歌手页“显示更多专辑”一样）；
    // 最后一页没加进新的（网易云给的都是前面列过的、或者是空的）就落在最后一项上
    if (more === null && list.status === 'shown') {
      const items = body?.querySelectorAll('li') ?? []
      ;(items[before] ?? items[items.length - 1])?.querySelector<HTMLElement>('a, button')?.focus()
    }
  }
</script>

<div bind:this={body} class={phone ? '' : 'rounded-xl bg-white p-2 shadow-ambient'}>
  <!-- 骨架和出错、内容放在同一串分支里：骨架换成内容时，骨架的淡出、内容的飘入才会播放 -->
  {#if kind === 'songs'}
    <SongList
      list={songView}
      source={{ kind: 'search', keyword }}
      {phone}
      loadingLabel={`正在搜索${words.label}`}
      bare
      reveal
      virtual={false}
      label='单曲'
      {appendedAt}
    />
    {#if songs && songs.length > 0}
      <ShowMore {more} onmore={showMore} class='justify-center px-4 pb-2 pt-4' />
    {/if}
  {:else if kind === 'playlists'}
    {#if list.status === 'failed' && failed}
      <div in:reveal><StateBlock kind='error' title={failed.title} body={failed.body} action={{
        label: '重试',
        run: () => void view.app.openSearch(keyword),
      }} /></div>
    {:else if !playlists}
      <!-- 和歌单的行一样：64px，48px 封面，两行字 -->
      <div role='status' aria-busy='true' aria-label='正在搜索歌单' out:fadeAway>
        {#each {
          length: phone ? 8 : 9,
        }, i (i)}
          <div class={[
            'h-16 flex items-center gap-3',
            phone ? 'px-4' : 'px-2',
          ]}>
            <span class='bone size-12 flex-none rounded-lg'></span>
            <span class='min-w-0 flex-1'>
              <span class='bone h-3.5 rounded-full' style:width={`${[62, 48, 71, 55, 66, 44, 58, 69, 51][i]}%`}></span>
              <span class='bone mt-2 h-3 w-2/5 rounded-full'></span>
            </span>
          </div>
        {/each}
      </div>
    {:else if playlists.length === 0}
      <div in:reveal><StateBlock kind='empty' icon={SearchX} title={`没有相关的${words.label}`} /></div>
    {:else}
      <div in:reveal>
        <PlaylistResults playlists={playlists} {phone} {appendedAt} />
        <ShowMore {more} onmore={showMore} class='justify-center px-4 pb-2 pt-4' />
      </div>
    {/if}
  {:else if kind === 'artists'}
    <TileGrid kind='artist' layout='grid' {phone} inset={!phone} items={artists} label='歌手' loadingLabel={`正在搜索${words.label}`} failure={gridFailure} empty={{ icon: SearchX, title: `没有相关的${words.label}` }} staggerFrom={appendedAt}>
      {#snippet tile(artist: SearchedItems['artists'])}
        <ArtistTile id={artist.id} name={artist.name} avatarUrl={artist.avatarUrl} detail={`${formatCount(artist.songCount)} 首`} collectable />
      {/snippet}
    </TileGrid>
    {#if artists && artists.length > 0}
      <ShowMore {more} onmore={showMore} class='justify-center px-4 pb-2 pt-4' />
    {/if}
  {:else}
    <TileGrid kind='album' layout='grid' {phone} inset={!phone} items={albums} label='专辑' loadingLabel={`正在搜索${words.label}`} failure={gridFailure} empty={{ icon: SearchX, title: `没有相关的${words.label}` }} staggerFrom={appendedAt}>
      {#snippet tile(album: SearchedItems['albums'])}
        <AlbumTile id={album.id} name={album.name} coverUrl={album.coverUrl} detail={creditLine(album.artists)} year={yearOf(album.publishedAt)} {phone} collectable />
      {/snippet}
    </TileGrid>
    {#if albums && albums.length > 0}
      <ShowMore {more} onmore={showMore} class='justify-center px-4 pb-2 pt-4' />
    {/if}
  {/if}
</div>
