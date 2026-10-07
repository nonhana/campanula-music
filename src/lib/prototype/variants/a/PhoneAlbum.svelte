<!--
  PROTOTYPE：手机专辑页——居中封面、歌手链接、操作行、简介、曲目。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { albumById, artistIdOf } from '$lib/prototype/catalog'
  import { langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { Check, CircleArrowDown, Play, Plus } from '@lucide/svelte'
  import PhoneSongRow from './PhoneSongRow.svelte'
  import PhoneTopBar from './PhoneTopBar.svelte'
  import SkeletonRows from './SkeletonRows.svelte'
  import StateBlock from './StateBlock.svelte'
  import { isNow } from './state.svelte'

  const al = $derived(albumById(nav.id))
  // svelte-ignore state_referenced_locally
  let collected = $state(albumById(nav.id).collected)
  let expanded = $state(false)
  const long = $derived(al.description.length > 60)
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

<PhoneTopBar title='专辑' />

<header class='px-4 pt-2 text-center'>
  <Cover cover={al.cover} eager class='mx-auto size-[168px] rounded-2xl shadow-ambient' />
  <h1 class='mt-4 line-clamp-2 text-[22px] leading-7 font-600 text-neutral-900' lang={langOf(al.name)}>{al.name}</h1>
  <p class='mt-1 flex items-center justify-center gap-1.5 text-[13px] text-neutral-600'>
    <button class='inline-flex min-h-8 items-center font-500 text-primary-900' lang={langOf(al.artist)} onclick={() => nav.openArtist(artistIdOf(al.artist))}>{al.artist}</button>
    <span aria-hidden='true'>·</span><span class='tnum'>{al.year}</span>
    <span aria-hidden='true'>·</span><span class='tnum'>{al.count} 首</span>
  </p>
  <!-- 专辑没有别的操作（评论、分享不在范围内），所以不放“更多”按钮；收藏和歌手页一样用带文字的浅色胶囊 -->
  <div class='mt-3 flex items-center justify-center gap-2'>
    <button class='inline-flex h-11 items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-[15px] font-500 text-white active:bg-primary-950' disabled={!al.tracks.length} onclick={playAll}>
      <Play size={17} fill='currentColor' aria-hidden='true' />播放全部
    </button>
    <button class='inline-flex h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-4 pr-5 text-[15px] font-500 text-neutral-800 active:bg-primary-50' aria-pressed={collected} onclick={() => (collected = !collected)}>
      {#if collected}<Check size={17} class='text-primary-900' aria-hidden='true' />已收藏{:else}<Plus size={17} aria-hidden='true' />收藏{/if}
    </button>
    <button class='inline-flex h-11 items-center gap-2 rounded-full bg-secondary-100 pl-4 pr-5 text-[15px] font-500 text-secondary-900 active:bg-secondary-200' disabled={nav.offline}>
      <CircleArrowDown size={17} aria-hidden='true' />下载
    </button>
  </div>
</header>

{#if al.description}
  <section class='px-4 pt-4' aria-label='简介'>
    <button class='block w-full rounded-2xl bg-white p-3.5 text-left shadow-ambient' aria-expanded={long ? expanded : undefined} disabled={!long} onclick={() => (expanded = !expanded)}>
      <span class={['block text-[13.5px] leading-[21px] text-neutral-600', long && !expanded && 'line-clamp-3']}>{al.description}</span>
      {#if long}<span class='mt-1 block text-[13px] font-500 text-primary-900'>{expanded ? '收起' : '展开'}</span>{/if}
    </button>
  </section>
{/if}

<div class='pb-28 pt-3'>
  {#if nav.demo === 'loading'}
    <SkeletonRows phone count={9} label='正在加载专辑曲目' />
  {:else if nav.demo === 'error'}
    <StateBlock kind='error' compact title='专辑曲目没能加载' body='网络不太稳定，稍后再试。' actionLabel='重试' onaction={() => (nav.demo = '')} />
  {:else if al.tracks.length === 0}
    <StateBlock kind='empty' compact title='这张专辑暂时没有曲目' />
  {:else}
    <ul>
      {#each al.tracks as song, i (song.id)}
        <li class='flex h-14 items-center'>
          <span class='w-9 flex-none pl-4 text-[13px] text-neutral-500 tnum' aria-hidden='true'>{i + 1}</span>
          <div class='h-full min-w-0 flex-1 -ml-2'><PhoneSongRow {song} now={isNow(al.tracks, i, song)} onplay={() => play(i)} /></div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
