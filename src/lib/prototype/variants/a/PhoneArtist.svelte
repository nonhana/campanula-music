<!--
  PROTOTYPE：手机歌手页——居中头像、操作行、热门歌曲、两列专辑。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistById } from '$lib/prototype/catalog'
  import { formatCount, langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { Check, Play, Plus } from '@lucide/svelte'
  import PhoneSongRow from './PhoneSongRow.svelte'
  import PhoneTopBar from './PhoneTopBar.svelte'
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

<PhoneTopBar title='歌手' />

<header class='px-4 pt-2 text-center'>
  <Cover cover={ar.avatar} eager alt='' class='mx-auto size-[156px] rounded-full shadow-ambient' />
  <h1 class='mt-4 line-clamp-2 text-[24px] leading-8 font-600 text-neutral-900' lang={langOf(ar.name)}>{ar.name}</h1>
  <p class='mt-1 text-[13px] text-neutral-600'>歌手 · <span class='tnum'>{formatCount(ar.songCount)}</span> 首歌 · <span class='tnum'>{formatCount(ar.albumCount)}</span> 张专辑</p>
  <div class='mt-4 flex items-center justify-center gap-2'>
    <button class='inline-flex h-11 items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-[15px] font-500 text-white active:bg-primary-950' disabled={!ar.hotSongs.length} onclick={playHot}>
      <Play size={17} fill='currentColor' aria-hidden='true' />播放热门歌曲
    </button>
    <button class='inline-flex h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-4 pr-5 text-[15px] font-500 text-neutral-800 active:bg-primary-50' aria-pressed={collected} onclick={() => (collected = !collected)}>
      {#if collected}<Check size={17} class='text-primary-900' aria-hidden='true' />已收藏{:else}<Plus size={17} aria-hidden='true' />收藏{/if}
    </button>
  </div>
</header>

<section class='pt-6' aria-labelledby='par-hot'>
  <h2 id='par-hot' class='px-4 text-[18px] leading-7 font-600 text-neutral-900'>热门歌曲</h2>
  <div class='pt-1'>
    {#if nav.demo === 'loading'}
      <SkeletonRows phone count={8} label='正在加载热门歌曲' />
    {:else if nav.demo === 'error'}
      <StateBlock kind='error' compact title='热门歌曲没能加载' body='网络不太稳定，稍后再试。' actionLabel='重试' onaction={() => (nav.demo = '')} />
    {:else if ar.hotSongs.length === 0}
      <StateBlock kind='empty' compact title='暂时没有热门歌曲' />
    {:else}
      <ul>
        {#each ar.hotSongs as song, i (song.id)}
          <li class='h-14'><PhoneSongRow {song} now={isNow(ar.hotSongs, i, song)} onplay={() => play(i)} /></li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

{#if nav.demo !== 'loading' && nav.demo !== 'error' && ar.albums.length}
  <section class='pb-28 pt-6' aria-labelledby='par-albums'>
    <h2 id='par-albums' class='px-4 text-[18px] leading-7 font-600 text-neutral-900'>专辑</h2>
    <ul class='grid grid-cols-2 gap-x-3 gap-y-5 px-4 pt-3'>
      {#each ar.albums as al (al.id)}
        <li>
          <button class='w-full min-w-0 text-left' onclick={() => nav.openAlbum(al.id)}>
            <Cover cover={al.cover} class='w-full rounded-xl shadow-ambient' />
            <span class='mt-2 block truncate text-[15px] font-500 text-neutral-900' lang={langOf(al.name)}>{al.name}</span>
            <span class='mt-0.5 block text-[13px] text-neutral-600 tnum'>{al.year}</span>
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}
