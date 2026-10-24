<!--
  结果页的一个标签（单曲、歌单、歌手、专辑，视觉原型 SearchPanel、DesktopSearchResults）：取到的全部，后面还有时“显示更多”。
  桌面放在白色面板里：单曲是带序号的桌面歌曲行，歌单是 64px 的行，歌手是圆头像网格，专辑是封面网格；
  手机放在晨光底上：Auxio 式歌曲行、歌单的行、三列歌手、两列专辑。
  第一页还在拉时是形状一致的骨架，骨架换成内容时依次飘入；没拉成时说明原因、能重试；一个都没有时只有“没有相关的…”的标题
-->
<script lang='ts'>
  import type { SearchKind } from '#lib/api/search.js'
  import type { SongListView } from '../songs/view'
  import type { KindItems } from './view'
  import { SearchX } from '@lucide/svelte'
  import { tick } from 'svelte'
  import { creditLine } from '#lib/api/library.js'
  import { getAppView } from '../app-context.svelte'
  import AlbumTile from '../library/AlbumTile.svelte'
  import ArtistTile from '../library/ArtistTile.svelte'
  import TileBone from '../library/TileBone.svelte'
  import { fadeAway, reveal, stagger } from '../motion'
  import SongList from '../songs/SongList.svelte'
  import { formatCount, yearOf } from '../text'
  import ShowMore from '../ui/ShowMore.svelte'
  import StateBlock from '../ui/StateBlock.svelte'
  import PlaylistResults from './PlaylistResults.svelte'
  import { KIND_WORDS, searchFailure } from './view'

  interface Props {
    keyword: string
    kind: SearchKind
    phone?: boolean
  }

  const { keyword, kind, phone = false }: Props = $props()
  const view = getAppView()
  /** App 只记着最后一次搜的词的结果：记着的是别的词（刚换了词、还没打开）时当作还在加载 */
  const list = $derived(view.state.search.results?.keyword === keyword ? view.state.search.results[kind] : { status: 'loading' } as const)
  /** 取到的这一类，带上是哪一类：模板里按 kind 分开画，各自拿到自己那一类的项 */
  const shown = $derived(list.status === 'shown' ? { kind, items: list.items } as KindItems : null)
  const words = $derived(KIND_WORDS[kind])
  /** 单曲这一类的列表状态交给 songs/SongList：骨架、失败、空、歌曲都在它里面 */
  const songView = $derived.by((): SongListView => {
    if (list.status === 'failed') {
      const failed = searchFailure(list.failure)
      return { kind: 'failed', title: failed.title, body: failed.body, retry: () => void view.app.openSearch(keyword) }
    }
    if (!shown)
      return { kind: 'loading' }
    if (shown.kind !== 'songs')
      return { kind: 'loading' }
    if (shown.items.length === 0)
      return { kind: 'empty', icon: SearchX, title: `没有相关的${words.label}` }
    return { kind: 'songs', songs: shown.items }
  })

  /** 歌手、专辑的网格（骨架和真的一样排）：手机三列 / 两列，桌面按格宽排满 */
  const grids = $derived({
    artists: phone ? 'grid-cols-3 gap-x-3 gap-y-5 px-4 pt-3' : 'grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-5 gap-y-6 p-3',
    albums: phone ? 'grid-cols-2 gap-x-3 gap-y-5 px-4 pt-3' : 'grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-5 gap-y-6 p-3',
  })

  let body = $state<HTMLElement>()
  /** 上一次“显示更多”之前已经有几项：后加进来的从第几项开始依次飘入 */
  let appendedAt = $state(0)
  async function showMore() {
    const before = list.status === 'shown' ? list.items.length : 0
    appendedAt = before
    await view.app.moreSearchResults(keyword, kind)
    await tick()
    // 取完了，按钮跟着淡出不见：焦点移到新出来的第一项，免得掉回页面最上面（和歌手页“显示更多专辑”一样）；
    // 最后一页没加进新的（网易云给的都是前面列过的、或者是空的）就落在最后一项上
    if (list.status === 'shown' && !list.more) {
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
    {#if list.status === 'shown' && shown && shown.items.length > 0}
      <ShowMore more={list.more} onmore={showMore} class='justify-center px-4 pb-2 pt-4' />
    {/if}
  {:else if list.status === 'failed'}
    {@const failed = searchFailure(list.failure)}
    <div in:reveal>
      <StateBlock kind='error' title={failed.title} body={failed.body} action={{ label: '重试', run: () => void view.app.openSearch(keyword) }} />
    </div>
  {:else if !shown}
    {#if kind === 'artists' || kind === 'albums'}
      <div class={['grid', grids[kind]]} role='status' aria-busy='true' aria-label={`正在搜索${words.label}`} out:fadeAway>
        {#each { length: phone ? 6 : 12 }, i (i)}
          <TileBone round={kind === 'artists'} {phone} />
        {/each}
      </div>
    {:else if kind === 'playlists'}
      <!-- 和歌单的行一样：64px，48px 封面，两行字 -->
      <div role='status' aria-busy='true' aria-label='正在搜索歌单' out:fadeAway>
        {#each { length: phone ? 8 : 9 }, i (i)}
          <div class={['h-16 flex items-center gap-3', phone ? 'px-4' : 'px-2']}>
            <span class='bone size-12 flex-none rounded-lg'></span>
            <span class='min-w-0 flex-1'>
              <span class='bone h-3.5 rounded-full' style:width={`${[62, 48, 71, 55, 66, 44, 58, 69, 51][i]}%`}></span>
              <span class='bone mt-2 h-3 w-2/5 rounded-full'></span>
            </span>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div in:reveal>
      {#if shown.items.length === 0}
        <StateBlock kind='empty' icon={SearchX} title={`没有相关的${words.label}`} />
      {:else}
        {#if shown.kind === 'playlists'}
          <PlaylistResults playlists={shown.items} {phone} {appendedAt} />
        {:else if shown.kind === 'artists'}
          <ul class={['grid', grids.artists]} aria-label={words.label} data-reveal-group>
            {#each shown.items as artist, i (artist.id)}
              <li class='min-w-0' in:stagger={{ order: i - appendedAt }}>
                <ArtistTile id={artist.id} name={artist.name} avatarUrl={artist.avatarUrl} detail={`${formatCount(artist.songCount)} 首`} collectable />
              </li>
            {/each}
          </ul>
        {:else if shown.kind === 'albums'}
          <ul class={['grid', grids.albums]} aria-label={words.label} data-reveal-group>
            {#each shown.items as album, i (album.id)}
              <li class='min-w-0' in:stagger={{ order: i - appendedAt }}>
                <AlbumTile id={album.id} name={album.name} coverUrl={album.coverUrl} detail={creditLine(album.artists)} year={yearOf(album.publishedAt)} {phone} collectable />
              </li>
            {/each}
          </ul>
        {/if}
        {#if list.status === 'shown'}
          <ShowMore more={list.more} onmore={showMore} class='justify-center px-4 pb-2 pt-4' />
        {/if}
      {/if}
    </div>
  {/if}
</div>
