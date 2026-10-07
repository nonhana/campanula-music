<!--
  PROTOTYPE：手机每日推荐页。头部呼应首页日历：大号日期“7”+“10月 · 星期三”，标题、说明、播放全部；下面 30 首。
  ?demo=loading 骨架行，?demo=error 出错。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { daily } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { Play } from '@lucide/svelte'
  import PhoneSongRow from './PhoneSongRow.svelte'
  import PhoneTopBar from './PhoneTopBar.svelte'
  import SkeletonRows from './SkeletonRows.svelte'
  import StateBlock from './StateBlock.svelte'
  import { dailyDay, dailySource, isNow } from './state.svelte'

  const songs = daily.songs
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

<PhoneTopBar title='每日推荐' />

<header class='px-4 pt-2'>
  <div class='flex items-end gap-4'>
    <span class='flex flex-none items-end gap-2.5' aria-hidden='true'>
      <span class='text-[72px] leading-[64px] font-600 tracking-[-0.04em] text-primary-900 tnum'>{dailyDay[1]}</span>
      <span class='pb-1.5 text-[14px] leading-5 text-neutral-600'>{dailyDay[0]}月<br />{daily.weekday}</span>
    </span>
    <span class='mb-1 ml-auto flex' aria-hidden='true'>
      {#each songs.slice(0, 3) as s, i (s.id)}
        <Cover cover={s.cover} eager class={['size-12 rounded-lg ring-2 ring-primary-50', i > 0 && '-ml-4']} />
      {/each}
    </span>
  </div>
  <h1 class='mt-4 text-[24px] leading-8 font-600 tracking-[-0.01em] text-neutral-900'>每日推荐<span class='sr-only'>，{daily.dateLabel} {daily.weekday}</span></h1>
  <p class='mt-1 text-[13px] leading-5 text-neutral-600'>根据你的听歌口味生成，每天 6:00 更新 · <span class='tnum'>{songs.length} 首</span></p>
  <button
    class='mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-[15px] font-500 text-white active:bg-primary-950 disabled:(bg-neutral-100 text-neutral-500)'
    disabled={!ready}
    onclick={playAll}
  >
    <Play size={17} fill='currentColor' aria-hidden='true' />播放全部
  </button>
</header>

<div class='pt-3'>
  {#if nav.demo === 'loading'}
    <SkeletonRows phone count={10} label='正在加载每日推荐' />
  {:else if nav.demo === 'error'}
    <StateBlock
      kind='error'
      title='今天的每日推荐没能加载'
      body='网络不太稳定。曲库里的歌照常能听，稍后再试一次。'
      actionLabel='重试'
      onaction={() => (nav.demo = '')}
    />
  {:else}
    {#each songs as song, i (song.id)}
      <div class='h-14'>
        <PhoneSongRow {song} now={isNow(songs, i, song)} onplay={() => play(i)} />
      </div>
    {/each}
  {/if}
</div>
