<!--
  结果页的“综合”：照桌面首页的分区总览，依次是单曲（白色面板里的前几首歌曲行）、歌单（一排封面）、歌手（一排横向架子，圆头像）、
  专辑（一排横向架子）。每块的标题旁写网易云给的总数，右边“查看全部”切到那个标签。不做最佳匹配（作者定，DESIGN.md 桌面搜索）。
  四块各拉各的：还在拉的那块是形状一致的骨架，没拉成的那块说明原因、能重试，别的照常显示；
  一个都没有的那块不显示，四块都没有时说明没找到。手机上竖着排，歌单、歌手、专辑都是横向架子。
  歌单、歌手、专辑的封面右下角压一个收藏小圆（CollectButton 的 corner，和格子的链接并排，不嵌在里面）；自建歌单、我喜欢的音乐在那里标“自建”
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { SearchedPlaylist, SearchKind } from '#lib/api/search.js'
  import type { SearchList } from '#lib/app/search.js'
  import { resolve } from '$app/paths'
  import { SearchX } from '@lucide/svelte'
  import { creditLine } from '#lib/api/library.js'
  import { getAppView } from '../app-context.svelte'
  import AlbumTile from '../library/AlbumTile.svelte'
  import ArtistTile from '../library/ArtistTile.svelte'
  import { collectState } from '../library/collect'
  import CollectButton from '../library/CollectButton.svelte'
  import PlaylistTile from '../library/PlaylistTile.svelte'
  import Shelf from '../library/Shelf.svelte'
  import SkeletonRows from '../library/SkeletonRows.svelte'
  import TileBone from '../library/TileBone.svelte'
  import { formatCount, yearOf } from '../library/view'
  import { fade, fadeAway, reveal } from '../motion'
  import StateBlock from '../ui/StateBlock.svelte'
  import Tag from '../ui/Tag.svelte'
  import { selectSearchTab } from './search-box.svelte'
  import SongResults from './SongResults.svelte'
  import { KIND_WORDS, OVERVIEW_COUNTS, searchFailure, searchPath } from './view'

  interface Props {
    keyword: string
    phone?: boolean
  }

  const { keyword, phone = false }: Props = $props()
  const view = getAppView()
  const LOADING = { status: 'loading' } as const
  /** App 只记着最后一次搜的词的结果：记着的是别的词（刚换了词、还没打开）时当作还在加载 */
  const results = $derived(view.state.search.results?.keyword === keyword ? view.state.search.results : null)
  const songs = $derived(results?.songs ?? LOADING)
  const playlists = $derived(results?.playlists ?? LOADING)
  const artists = $derived(results?.artists ?? LOADING)
  const albums = $derived(results?.albums ?? LOADING)
  /** 这一类拉到了、一个都没有：这一块不显示 */
  const none = (list: SearchList) => list.status === 'shown' && list.items.length === 0
  const nothing = $derived([songs, playlists, artists, albums].every(none))

  /** 桌面歌单那一排：1280px 以上 6 张，窄了 5 张、4 张；放不下的藏起来（不进 Tab 顺序），“查看全部”里都有。骨架和真的一样排 */
  const PLAYLIST_ROW = 'grid grid-cols-4 gap-x-5 lg:grid-cols-5 xl:grid-cols-6'
  function playlistCell(index: number): (string | false)[] {
    return ['min-w-0', index === 4 && 'hidden lg:block', index === 5 && 'hidden xl:block']
  }
  /** 横向架子的格宽和间距（骨架和真的一样） */
  const shelves = $derived({
    playlists: { gap: 'gap-3', cell: 'w-[140px]' },
    artists: { gap: phone ? 'gap-3' : 'gap-6', cell: phone ? 'w-[104px]' : 'w-[120px]' },
    albums: { gap: phone ? 'gap-3' : 'gap-5', cell: phone ? 'w-[140px]' : 'w-[168px]' },
  })
  /** 架子骨架那一排：手机和真的架子一样离边 16px */
  const shelfBones = (gap: string) => ['flex overflow-hidden pb-3 pt-1', gap, phone && 'px-4'].filter(Boolean).join(' ')

  /** “查看全部”：切到那个标签 */
  function seeAll(event: MouseEvent, kind: SearchKind) {
    event.preventDefault()
    void selectSearchTab(keyword, kind)
  }
</script>

{#snippet section(kind: SearchKind, list: SearchList, body: Snippet, bones: Snippet)}
  {#if !none(list)}
    <section class={phone ? 'pt-5 first:pt-0' : 'pt-8 first:pt-0'} aria-labelledby={`overview-${kind}`}>
      <div class={['flex items-center gap-3', phone ? 'h-11 px-4' : 'mb-3']}>
        <h2 id={`overview-${kind}`} class={['text-neutral-900 font-600', phone ? 'text-title-sm' : 'text-title']}>{KIND_WORDS[kind].label}</h2>
        {#if list.status === 'shown'}
          <span class='text-caption text-neutral-500 tabular-nums' in:fade>{formatCount(list.total)} {KIND_WORDS[kind].unit}</span>
        {/if}
        <a
          href={resolve(searchPath(keyword, kind))}
          class={['ml-auto inline-flex items-center rounded-full text-label text-primary-900 font-500 transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950)', phone ? '-mr-3 h-11 px-3' : '-mr-4 h-9 px-4']}
          onclick={event => seeAll(event, kind)}
        >查看全部</a>
      </div>
      <!-- 骨架和出错、内容放在同一串分支里：骨架换成内容时，骨架的淡出、内容的飘入才会播放。
           淡出（out:fadeAway）写在每种骨架自己的最外层，这里不再包一层：两层都会让出高度，后面的内容被往上拉一截 -->
      {#if list.status === 'failed'}
        {@const failed = searchFailure(list.failure)}
        <div in:reveal>
          <StateBlock kind='error' title={failed.title} body={failed.body} action={{ label: '重试', run: () => void view.app.openSearch(keyword) }} />
        </div>
      {:else if list.status === 'loading'}
        {@render bones()}
      {:else}
        <div in:reveal>{@render body()}</div>
      {/if}
    </section>
  {/if}
{/snippet}

{#snippet tileBones(count: number, listClass: string, cellClass: (index: number) => (string | false)[], round: boolean)}
  <div class={listClass} role='status' aria-busy='true' aria-label='正在搜索' out:fadeAway>
    {#each { length: count }, i (i)}
      <TileBone class={cellClass(i)} {round} {phone} />
    {/each}
  </div>
{/snippet}

{#snippet songsBody()}
  {#if songs.status === 'shown'}
    <div class={phone ? '' : 'rounded-xl bg-white p-2 shadow-ambient'}>
      <SongResults {keyword} songs={songs.items.slice(0, OVERVIEW_COUNTS.songs)} {phone} />
    </div>
  {/if}
{/snippet}

{#snippet songsBones()}
  <!-- 白色面板就是 SkeletonRows 自己的最外层：整块一起淡出、让出高度 -->
  <SkeletonRows count={OVERVIEW_COUNTS.songs} {phone} label='正在搜索单曲' class={phone ? '' : 'rounded-xl bg-white p-2 shadow-ambient'} />
{/snippet}

{#snippet playlistsBody()}
  {#if playlists.status === 'shown'}
    {@const first = playlists.items.slice(0, OVERVIEW_COUNTS.playlists)}
    {#if phone}
      <Shelf label='歌单' class={shelves.playlists.gap} phone>
        {#each first as playlist (playlist.id)}
          <li class={['relative min-w-0 flex-none', shelves.playlists.cell]}>
            <PlaylistTile id={playlist.id} name={playlist.name} coverUrl={playlist.coverUrl} trackCount={playlist.trackCount} creator={playlist.creator} phone />
            {@render playlistCorner(playlist)}
          </li>
        {/each}
      </Shelf>
    {:else}
      <!-- 一排封面（见 PLAYLIST_ROW） -->
      <ul class={PLAYLIST_ROW} aria-label='歌单' data-reveal-group>
        {#each first as playlist, i (playlist.id)}
          <li class={['relative', playlistCell(i)]}>
            <PlaylistTile id={playlist.id} name={playlist.name} coverUrl={playlist.coverUrl} trackCount={playlist.trackCount} creator={playlist.creator} />
            {@render playlistCorner(playlist)}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
{/snippet}

{#snippet playlistCorner(playlist: SearchedPlaylist)}
  {@const target = { kind: 'playlist', id: playlist.id } as const}
  {@const status = view.state.library && collectState(view.state.library, target)}
  {#if status}
    <!-- 和封面一样大的一格（自己不挡点击），收藏小圆或“自建”压在它的右下角（和 AlbumTile 的一样） -->
    <div class='pointer-events-none absolute inset-x-0 top-0 aspect-square'>
      {#if status === 'own'}
        <span class='absolute bottom-2 right-2'><Tag>自建</Tag></span>
      {:else}
        <CollectButton {target} name={playlist.name} look='corner' class='pointer-events-auto absolute bottom-2 right-2' />
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet playlistsBones()}
  <!-- 手机、桌面不用 {#if} 分开：{#if} 里面的 out:fadeAway 在骨架换成内容时不播 -->
  {@render tileBones(
    phone ? 3 : OVERVIEW_COUNTS.playlists,
    phone ? shelfBones(shelves.playlists.gap) : PLAYLIST_ROW,
    phone ? () => [shelves.playlists.cell, 'flex-none'] : playlistCell,
    false,
  )}
{/snippet}

{#snippet artistsBody()}
  {#if artists.status === 'shown'}
    <Shelf label='歌手' class={shelves.artists.gap} {phone}>
      {#each artists.items.slice(0, OVERVIEW_COUNTS.artists) as artist (artist.id)}
        <li class={['min-w-0 flex-none', shelves.artists.cell]}>
          <ArtistTile id={artist.id} name={artist.name} avatarUrl={artist.avatarUrl} detail={`${formatCount(artist.songCount)} 首单曲`} collectable />
        </li>
      {/each}
    </Shelf>
  {/if}
{/snippet}

{#snippet artistsBones()}
  {@render tileBones(phone ? 4 : 9, shelfBones(shelves.artists.gap), () => [shelves.artists.cell, 'flex-none'], true)}
{/snippet}

{#snippet albumsBody()}
  {#if albums.status === 'shown'}
    <Shelf label='专辑' class={shelves.albums.gap} {phone}>
      {#each albums.items.slice(0, OVERVIEW_COUNTS.albums) as album (album.id)}
        <li class={['min-w-0 flex-none', shelves.albums.cell]}>
          <AlbumTile id={album.id} name={album.name} coverUrl={album.coverUrl} detail={creditLine(album.artists)} year={yearOf(album.publishedAt)} {phone} collectable />
        </li>
      {/each}
    </Shelf>
  {/if}
{/snippet}

{#snippet albumsBones()}
  {@render tileBones(phone ? 3 : 7, shelfBones(shelves.albums.gap), () => [shelves.albums.cell, 'flex-none'], false)}
{/snippet}

{#if nothing}
  <div in:reveal>
    <StateBlock kind='empty' icon={SearchX} title={`没有找到“${keyword}”`} body='换个歌名、歌手或专辑名试试。' />
  </div>
{:else}
  {@render section('songs', songs, songsBody, songsBones)}
  {@render section('playlists', playlists, playlistsBody, playlistsBones)}
  {@render section('artists', artists, artistsBody, artistsBones)}
  {@render section('albums', albums, albumsBody, albumsBones)}
{/if}
