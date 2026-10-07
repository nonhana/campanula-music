<!--
  PROTOTYPE：桌面歌手页——圆形头像页头、热门歌曲、专辑网格。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistById } from '$lib/prototype/catalog'
  import { formatCount, langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { Check, Play, Plus } from '@lucide/svelte'
  import DesktopSongRow from './DesktopSongRow.svelte'
  import SkeletonRows from './SkeletonRows.svelte'
  import StateBlock from './StateBlock.svelte'
  import { isNow } from './state.svelte'

  const ar = $derived(artistById(nav.id))
  // svelte-ignore state_referenced_locally
  let collected = $state(artistById(nav.id).collected)
  const source = $derived({ kind: 'artist' as const, name: `${ar.name}的热门歌曲`, id: ar.id })

  function play(i: number) {
    player.playFrom(ar.hotSongs, i, source)
  }

  function playHot() {
    const i = ar.hotSongs.findIndex(s => player.playable(s))
    if (i >= 0)
      play(i)
  }
</script>

<div class='pt-2'>
  <header class='flex items-center gap-8'>
    <Cover cover={ar.avatar} eager alt='' class='size-[200px] flex-none rounded-full shadow-ambient' />
    <div class='min-w-0 flex-1'>
      <h1 class='truncate text-[32px] leading-10 font-600 tracking-[-0.01em] text-neutral-900' lang={langOf(ar.name)}>{ar.name}</h1>
      <p class='mt-2 text-[14px] text-neutral-600'>歌手 · <span class='tnum'>{formatCount(ar.songCount)}</span> 首歌 · <span class='tnum'>{formatCount(ar.albumCount)}</span> 张专辑</p>
      <div class='mt-6 flex items-center gap-2'>
        <button class='filled inline-flex h-10 items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-[14px] font-500 text-white' disabled={!ar.hotSongs.length} onclick={playHot}>
          <Play size={16} fill='currentColor' aria-hidden='true' />播放热门歌曲
        </button>
        <button class='btn-line inline-flex h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-4 pr-5 text-[14px] font-500 text-neutral-800' aria-pressed={collected} onclick={() => (collected = !collected)}>
          {#if collected}<Check size={16} class='text-primary-900' aria-hidden='true' />已收藏{:else}<Plus size={16} aria-hidden='true' />收藏{/if}
        </button>
      </div>
    </div>
  </header>

  <section class='mt-10' aria-labelledby='ar-hot'>
    <h2 id='ar-hot' class='text-[20px] leading-7 font-600 text-neutral-900'>热门歌曲</h2>
    <div class='mt-3 rounded-2xl bg-white p-2 shadow-ambient'>
      {#if nav.demo === 'loading'}
        <SkeletonRows count={8} label='正在加载热门歌曲' />
      {:else if nav.demo === 'error'}
        <StateBlock kind='error' compact title='热门歌曲没能加载' body='网络不太稳定，稍后再试。' actionLabel='重试' onaction={() => (nav.demo = '')} />
      {:else if ar.hotSongs.length === 0}
        <StateBlock kind='empty' compact title='暂时没有热门歌曲' />
      {:else}
        <ul>
          {#each ar.hotSongs as song, i (song.id)}
            <li class='h-14'><DesktopSongRow {song} n={i + 1} now={isNow(ar.hotSongs, i, song)} onplay={() => play(i)} /></li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>

  {#if nav.demo !== 'loading' && nav.demo !== 'error' && ar.albums.length}
    <section class='mt-10 pb-6' aria-labelledby='ar-albums'>
      <h2 id='ar-albums' class='text-[20px] leading-7 font-600 text-neutral-900'>专辑</h2>
      <ul class='mt-3 grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-2 gap-y-3'>
        {#each ar.albums as al (al.id)}
          <li>
            <button class='card w-full min-w-0 rounded-2xl p-3 text-left' onclick={() => nav.openAlbum(al.id)}>
              <Cover cover={al.cover} class='w-full rounded-xl shadow-ambient' />
              <span class='mt-2.5 block truncate text-[14px] font-500 text-neutral-900' lang={langOf(al.name)}>{al.name}</span>
              <span class='mt-0.5 block text-[12.5px] text-neutral-600 tnum'>{al.year}</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  @media (hover: hover) and (pointer: fine) {
    .filled:hover { background: #1a5b43; }
    .btn-line:hover { border-color: #b9ead5; background: #f3fbf7; }
    .card:hover { background: #fff; }
  }
</style>
