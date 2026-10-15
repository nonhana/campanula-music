<!--
  专辑页、歌手页的歌曲列表（一次拿全，几十首，不用虚拟列表）。行和歌单页一样：
  桌面是白色面板里带表头、序号的歌曲行；手机是 Auxio 式的行，numbered 时前面加序号（专辑的曲序）。
  点一首歌就用整个列表替换播放队列，播放来源是 source。songs 是 null 时是形状一致的骨架，一首都没有时说明；
  骨架换成歌时骨架淡出、前几行依次飘入（DESIGN.md Motion）
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import type { PlaySource } from '$lib/app/player'
  import { ListMusic } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { reveal } from '../motion'
  import { currentSong } from '../player/view'
  import StateBlock from '../ui/StateBlock.svelte'
  import DesktopSongRow from './DesktopSongRow.svelte'
  import PhoneSongRow from './PhoneSongRow.svelte'
  import SkeletonRows from './SkeletonRows.svelte'

  interface Props {
    songs: readonly Song[] | null
    /** 点歌时的播放来源：哪张专辑、哪位歌手的热门歌曲 */
    source: PlaySource
    /** 骨架读屏读出的“正在加载什么” */
    loadingLabel: string
    /** 一首都没有时的说明 */
    empty: { title: string, body: string }
    phone?: boolean
    numbered?: boolean
  }

  const { songs, source, loadingLabel, empty, phone = false, numbered = false }: Props = $props()
  const view = getAppView()
  const hearts = $derived(view.state.library?.hearts ?? null)
  const nowId = $derived(currentSong(view.state.player)?.id ?? null)
  const play = (song: Song) => () => view.app.play(source, song.id)
</script>

{#if phone}
  {#if songs === null}
    <SkeletonRows count={8} phone label={loadingLabel} />
  {:else}
    <div in:reveal>
      {#if songs.length === 0}
        <StateBlock kind='empty' icon={ListMusic} title={empty.title} body={empty.body} />
      {:else}
        <ul data-reveal-group>
          {#each songs as song, i (song.id)}
            <li class='h-14 flex items-center'>
              {#if numbered}
                <span class='w-9 flex-none pl-4 text-caption text-neutral-500 tabular-nums' aria-hidden='true'>{i + 1}</span>
                <div class='h-full min-w-0 flex-1 -ml-2'><PhoneSongRow {song} now={song.id === nowId} onplay={play(song)} /></div>
              {:else}
                <div class='h-full min-w-0 flex-1'><PhoneSongRow {song} now={song.id === nowId} onplay={play(song)} /></div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
{:else}
  <div class='rounded-xl bg-white p-2 shadow-ambient'>
    <div class='grid grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px] h-9 items-center gap-4 pl-2 pr-3 text-caption text-neutral-500' aria-hidden='true'>
      <span class='text-center'>#</span>
      <span class='pl-[52px]'>标题</span>
      <span>专辑</span>
      <span>状态</span>
      <span class='text-right'>时长</span>
    </div>
    {#if songs === null}
      <SkeletonRows count={9} label={loadingLabel} />
    {:else}
      <div in:reveal>
        {#if songs.length === 0}
          <StateBlock kind='empty' icon={ListMusic} title={empty.title} body={empty.body} />
        {:else}
          <ul data-reveal-group>
            {#each songs as song, i (song.id)}
              <li class='h-14'><DesktopSongRow {song} n={i + 1} hearted={hearts?.has(song.id) ?? false} now={song.id === nowId} onplay={play(song)} /></li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </div>
{/if}
