<!--
  PROTOTYPE：桌面每日推荐页。头部呼应首页的每日推荐方块：大号日期“7”+“10月 · 星期三”+ 三张叠放的封面；
  右边标题、说明、播放全部；下面 30 首。?demo=loading 骨架行，?demo=error 出错。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { daily } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { Play } from '@lucide/svelte'
  import DesktopSongRow from './DesktopSongRow.svelte'
  import SkeletonRows from './SkeletonRows.svelte'
  import StateBlock from './StateBlock.svelte'
  import { dailyDay, dailySource, isNow } from './state.svelte'

  const songs = daily.songs
  const minutes = Math.round(songs.reduce((t, s) => t + s.duration, 0) / 60)
  const total = minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` : `${minutes} 分钟`
  const ready = $derived(nav.demo !== 'loading' && nav.demo !== 'error')

  function play(i: number) {
    player.playFrom(songs, i, dailySource)
  }

  function playAll() {
    const i = songs.findIndex(s => player.playable(s))
    if (i >= 0)
      play(i)
  }
</script>

<header class='flex gap-7 pt-2'>
  <div class='flex size-[200px] flex-none flex-col rounded-2xl bg-white p-5 shadow-ambient' aria-hidden='true'>
    <span class='block text-[88px] leading-[76px] font-600 tracking-[-0.04em] text-primary-900 tnum'>{dailyDay[1]}</span>
    <span class='mt-2 block text-[14px] text-neutral-600'>{dailyDay[0]}月 · {daily.weekday}</span>
    <span class={['mt-auto flex transition-opacity duration-300', !ready && 'opacity-0']}>
      {#each songs.slice(0, 4) as s, i (s.id)}
        <Cover cover={s.cover} eager class={['size-11 rounded-lg ring-2 ring-white', i > 0 && '-ml-3']} />
      {/each}
    </span>
  </div>

  <div class='flex min-w-0 flex-1 flex-col pt-1'>
    <h1 class='text-[28px] leading-9 font-600 tracking-[-0.01em] text-neutral-900'>每日推荐</h1>
    <p class='mt-2 text-[14px] text-neutral-600'>根据你的听歌口味生成，每天 6:00 更新</p>
    <p class='mt-1 text-[14px] text-neutral-600 tnum'>{daily.dateLabel} {daily.weekday} · {songs.length} 首 · {total}</p>
    <div class='mt-auto flex items-center gap-2 pt-4'>
      <button class='filled inline-flex h-10 items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-[14px] font-500 text-white disabled:(bg-neutral-100 text-neutral-500)' disabled={!ready} onclick={playAll}>
        <Play size={16} fill='currentColor' aria-hidden='true' />播放全部
      </button>
    </div>
  </div>
</header>

<div class='mt-6 rounded-2xl bg-white p-2 shadow-ambient'>
  {#if nav.demo === 'error'}
    <StateBlock
      kind='error'
      title='今天的每日推荐没能加载'
      body='网络不太稳定。曲库里的歌照常能听，稍后再试一次。'
      actionLabel='重试'
      onaction={() => (nav.demo = '')}
    />
  {:else}
    <div class='grid h-9 grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px] items-center gap-4 pl-2 pr-1 text-[12px] text-neutral-500'>
      <span class='text-center'>#</span>
      <span class='pl-[52px]'>标题</span>
      <span>专辑</span>
      <span>状态</span>
      <span class='text-right'>时长</span>
      <span></span>
    </div>
    {#if nav.demo === 'loading'}
      <SkeletonRows count={10} label='正在加载每日推荐' />
    {:else}
      {#each songs as song, i (song.id)}
        <div class='h-14'>
          <DesktopSongRow {song} n={i + 1} now={isNow(songs, i, song)} onplay={() => play(i)} />
        </div>
      {/each}
    {/if}
  {/if}
</div>
<div class='h-6'></div>

<style>
  @media (hover: hover) and (pointer: fine) {
    .filled:not(:disabled):hover {
      background: #1a5b43;
    }
  }
</style>
