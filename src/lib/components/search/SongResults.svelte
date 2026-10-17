<!--
  一次搜索的单曲结果（视觉原型 SearchPanel 的结果、DesktopSearchResults）：桌面是白色面板，顶上“单曲”和首数，
  下面是带序号的桌面歌曲行；手机是同样的“单曲”一行和 Auxio 式歌曲行。歌单、歌手、专辑三类由 #32 加成标签。
  只列网易云给的前 100 首（SEARCH_SONGS_PER_REQUEST），首数是列出来的首数。
  点一首歌是插播（App.play 按播放来源决定）：排在当前这首后面马上放，播放队列其余的不变，播放来源是这次搜索。
  加载中是骨架行，骨架换成歌时前几行依次飘入；一首都没搜到、没搜成（断网、网易云出错）时说明，没搜成的能重试
-->
<script lang='ts'>
  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'
  import { SearchX } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import DesktopSongRow from '../library/DesktopSongRow.svelte'
  import PhoneSongRow from '../library/PhoneSongRow.svelte'
  import SkeletonRows from '../library/SkeletonRows.svelte'
  import { formatCount } from '../library/view'
  import { fade, reveal } from '../motion'
  import { currentSong } from '../player/view'
  import StateBlock from '../ui/StateBlock.svelte'
  import { searchFailure } from './view'

  interface Props {
    /** 搜的词 */
    keyword: string
    phone?: boolean
  }

  const { keyword, phone = false }: Props = $props()
  const view = getAppView()
  /** App 只记着最后一次搜的词的结果：记着的是别的词（刚换了词、还没打开）时当作还在加载 */
  const results = $derived(view.state.search.results?.keyword === keyword ? view.state.search.results : null)
  const songs = $derived(results?.status === 'shown' ? results.songs : null)
  const failed = $derived(results?.status === 'failed' ? searchFailure(results.failure) : null)
  /** 在结果里点歌、从“更多”菜单放进播放队列时的播放来源：这次搜索 */
  const source = $derived<PlaySource>({ kind: 'search', keyword })
  const hearts = $derived(view.state.library?.hearts ?? null)
  const nowId = $derived(currentSong(view.state.player)?.id ?? null)
  const play = (song: Song) => () => view.app.play(source, song.id)
</script>

<div class={phone ? '' : 'rounded-xl bg-white p-2 shadow-ambient'}>
  <h2 class={['h-11 flex items-center', phone ? 'px-4' : 'px-3']}>
    <span class='relative text-body text-neutral-900 font-600'>
      单曲{#if songs}<span class='ml-1 text-caption text-neutral-500 font-500 tabular-nums' in:fade>{formatCount(songs.length)}</span>{/if}
      <span class='absolute bottom-[-6px] left-0 h-[3px] w-4 rounded-full bg-primary-700' aria-hidden='true'></span>
    </span>
  </h2>
  {#if failed}
    <div in:reveal>
      <StateBlock kind='error' title={failed.title} body={failed.body} action={{ label: '重试', run: () => void view.app.openSearch(keyword) }} />
    </div>
  {:else if songs === null}
    <SkeletonRows count={phone ? 8 : 9} {phone} label='正在搜索' />
  {:else}
    <div in:reveal>
      {#if songs.length === 0}
        <StateBlock kind='empty' icon={SearchX} title={`没有找到“${keyword}”`} body='换个歌名、歌手或专辑名试试。' />
      {:else}
        <ul data-reveal-group>
          {#each songs as song, i (song.id)}
            <li class='h-14'>
              {#if phone}
                <PhoneSongRow {song} {source} now={song.id === nowId} onplay={play(song)} />
              {:else}
                <DesktopSongRow {song} {source} n={i + 1} hearted={hearts?.has(song.id) ?? false} now={song.id === nowId} onplay={play(song)} />
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>
