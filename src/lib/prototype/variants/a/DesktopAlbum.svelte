<!--
  PROTOTYPE：桌面专辑页——封面页头、操作行、简介（长了折叠）、带曲序的曲目。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { albumById, artistIdOf } from '$lib/prototype/catalog'
  import { langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { Check, CircleArrowDown, Play, Plus } from '@lucide/svelte'
  import DesktopSongRow from './DesktopSongRow.svelte'
  import SkeletonRows from './SkeletonRows.svelte'
  import StateBlock from './StateBlock.svelte'
  import { isNow } from './state.svelte'

  const al = $derived(albumById(nav.id))
  // svelte-ignore state_referenced_locally
  let collected = $state(albumById(nav.id).collected)
  let expanded = $state(false)
  const long = $derived(al.description.length > 120)
  const source = $derived({ kind: 'album' as const, name: al.name, id: al.id })

  function play(i: number) {
    player.playFrom(al.tracks, i, source)
  }

  function playAll() {
    const i = al.tracks.findIndex(s => player.playable(s))
    if (i >= 0)
      play(i)
  }
</script>

<div class='pt-2'>
  <header class='flex gap-7'>
    <Cover cover={al.cover} eager class='size-[200px] flex-none rounded-2xl shadow-ambient' />
    <div class='flex min-w-0 flex-1 flex-col pt-1'>
      <h1 class='truncate text-[28px] leading-9 font-600 tracking-[-0.01em] text-neutral-900' lang={langOf(al.name)}>{al.name}</h1>
      <p class='mt-2 flex items-center gap-1.5 text-[14px] text-neutral-600'>
        <span>专辑</span>
        <span aria-hidden='true'>·</span>
        <button class='link font-500 text-primary-900' lang={langOf(al.artist)} onclick={() => nav.openArtist(artistIdOf(al.artist))}>{al.artist}</button>
        <span aria-hidden='true'>·</span><span class='tnum'>{al.year}</span>
        <span aria-hidden='true'>·</span><span class='tnum'>{al.count} 首</span>
      </p>
      <div class='mt-auto flex items-center gap-2 pt-4'>
        <button class='filled inline-flex h-10 items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-[14px] font-500 text-white' disabled={!al.tracks.length} onclick={playAll}>
          <Play size={16} fill='currentColor' aria-hidden='true' />播放全部
        </button>
        <button class='btn-line inline-flex h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-4 pr-5 text-[14px] font-500 text-neutral-800' aria-pressed={collected} onclick={() => (collected = !collected)}>
          {#if collected}<Check size={16} class='text-primary-900' aria-hidden='true' />已收藏{:else}<Plus size={16} aria-hidden='true' />收藏{/if}
        </button>
        <button class='tonal inline-flex h-10 items-center gap-2 rounded-full bg-secondary-100 pl-4 pr-5 text-[14px] font-500 text-secondary-900'>
          <CircleArrowDown size={16} aria-hidden='true' />下载
        </button>
      </div>
    </div>
  </header>

  {#if al.description}
    <section class='mt-6 max-w-[72ch]' aria-labelledby='al-desc'>
      <h2 id='al-desc' class='sr-only'>简介</h2>
      <p id='al-desc-text' class={['text-[14px] leading-[22px] text-neutral-600', long && !expanded && 'line-clamp-3']}>{al.description}</p>
      {#if long}
        <button class='link mt-1 text-[13px] font-500 text-primary-900' aria-expanded={expanded} aria-controls='al-desc-text' onclick={() => (expanded = !expanded)}>{expanded ? '收起' : '展开'}</button>
      {/if}
    </section>
  {/if}

  <div class='mt-6 rounded-2xl bg-white p-2 shadow-ambient'>
    {#if nav.demo === 'loading'}
      <SkeletonRows count={9} label='正在加载专辑曲目' />
    {:else if nav.demo === 'error'}
      <StateBlock kind='error' compact title='专辑曲目没能加载' body='网络不太稳定，稍后再试。' actionLabel='重试' onaction={() => (nav.demo = '')} />
    {:else if al.tracks.length === 0}
      <StateBlock kind='empty' compact title='这张专辑暂时没有曲目' />
    {:else}
      <ul>
        {#each al.tracks as song, i (song.id)}
          <li class='h-14'><DesktopSongRow {song} n={i + 1} now={isNow(al.tracks, i, song)} onplay={() => play(i)} /></li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  @media (hover: hover) and (pointer: fine) {
    .filled:hover { background: #1a5b43; }
    .btn-line:hover { border-color: #b9ead5; background: #f3fbf7; }
    .tonal:hover { background: #ffe1cc; }
    .link:hover { text-decoration: underline; text-underline-offset: 3px; }
  }
</style>
