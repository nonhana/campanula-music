<!--
  PROTOTYPE：手机播放页，照 Auxio 的结构：收起箭头 / 正在播放 + 播放来源 / 歌词键；大封面（歌词键把这块换成歌词，再点换回）；
  左对齐的歌名、歌手、专辑 + •••；波浪进度条；五个控制键靠形状和深浅分主次；底部上拉的播放队列。底色由当前封面染出。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player, playModeLabel } from '$lib/prototype/player.svelte'
  import { ChevronDown, Ellipsis, Heart, MicVocal, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from '@lucide/svelte'
  import { fade, fly } from 'svelte/transition'
  import CoverTint from './CoverTint.svelte'
  import Lyrics from './Lyrics.svelte'
  import QueueList from './QueueList.svelte'
  import { ui } from './state.svelte'
  import Wave from './Wave.svelte'

  const song = $derived(player.current)
  // 封面区翻到歌词；?lyr=1 让截图能直接打开歌词视图
  let flipped = $state(new URLSearchParams(location.search).get('lyr') === '1')
  const queueOpen = $derived(nav.panel === 'queue')
  const repeatOn = $derived(player.mode !== 'shuffle')
  const ease = (t: number) => 1 - (1 - t) ** 4
</script>

<div
  class='fixed inset-0 z-50 flex flex-col overflow-hidden bg-white pb-[env(safe-area-inset-bottom)]'
  role='dialog'
  aria-modal='true'
  aria-label='正在播放'
  transition:fly={{ y: 48, duration: 360, opacity: 0, easing: ease }}
>
  {#if song}<CoverTint cover={song.cover} />{/if}

  <div class='relative grid h-16 flex-none grid-cols-[48px_minmax(0,1fr)_48px] items-center px-1'>
    <button class='grid size-12 place-items-center rounded-full text-neutral-800 active:bg-white/60' aria-label='收起播放页' onclick={() => nav.closePlayer()}>
      <ChevronDown size={26} aria-hidden='true' />
    </button>
    <div class='min-w-0 text-center'>
      <p class='text-[15px] leading-5 font-600 text-neutral-900'>正在播放</p>
      <p class='truncate text-[12.5px] leading-[18px] text-neutral-700'>来自「<span lang={langOf(player.source.name)}>{player.source.name}</span>」</p>
    </div>
    <button
      class={['grid size-12 place-items-center rounded-full', flipped ? 'bg-primary-100 text-primary-900' : 'text-neutral-800 active:bg-white/60']}
      aria-label={flipped ? '显示封面' : '显示歌词'}
      aria-pressed={flipped}
      onclick={() => (flipped = !flipped)}
    >
      <MicVocal size={22} aria-hidden='true' />
    </button>
  </div>

  {#if song}
    <div class='relative flex min-h-0 flex-1 flex-col px-6 pb-3'>
      <!-- 封面 / 歌词：同一块地方 -->
      <div class='relative min-h-0 flex-1'>
        {#if flipped}
          <div class='absolute inset-0 flex flex-col pt-1' transition:fade={{ duration: 200 }}>
            <Lyrics compact class='min-h-0 flex-1' />
          </div>
        {:else}
          <div class='stage absolute inset-0 grid place-items-center' transition:fade={{ duration: 200 }}>
            <button class='face rounded-2xl' aria-label='显示歌词' onclick={() => (flipped = true)}>
              <Cover cover={song.cover} eager class='size-full rounded-2xl shadow-float' />
            </button>
          </div>
        {/if}
      </div>

      <div class='flex-none pt-5'>
        <div class='flex items-start gap-1'>
          <div class='min-w-0 flex-1'>
            <h2 class='truncate text-[22px] leading-7 font-600 text-neutral-900' lang={song.lang}>{song.title}</h2>
            <p class='mt-0.5 truncate text-[15px] leading-[22px] text-neutral-700' lang={song.lang}>{artistLine(song)}</p>
            <p class='truncate text-[14px] leading-5 text-neutral-600' lang={song.lang}>{song.album}</p>
          </div>
          {#if !nav.loggedOut}
          <button
            class='grid size-11 flex-none place-items-center rounded-full active:bg-white/60'
            aria-label={ui.isLiked(song) ? '取消红心' : '红心'}
            aria-pressed={ui.isLiked(song)}
            onclick={() => ui.toggleLike(song)}
          >
            <Heart size={22} class={ui.isLiked(song) ? 'text-accent-600' : 'text-neutral-700'} fill={ui.isLiked(song) ? 'currentColor' : 'none'} aria-hidden='true' />
          </button>
          {/if}
          <button
            class='-mr-2 grid size-11 flex-none place-items-center rounded-full text-neutral-700 active:bg-white/60'
            aria-label='更多操作'
            aria-haspopup='menu'
            onclick={e => ui.openMenuFrom(song, e.currentTarget)}
          >
            <Ellipsis size={22} aria-hidden='true' />
          </button>
        </div>

        <div class='mt-2'>
          <Wave touch />
        </div>

        <div class='mt-3 flex items-center justify-between'>
          <button
            class={['grid size-11 place-items-center rounded-full', repeatOn ? 'bg-primary-100 text-primary-900' : 'text-neutral-500 active:bg-white/60']}
            aria-label='播放模式：{repeatOn ? playModeLabel[player.mode] : playModeLabel.shuffle}，点按切换{player.mode === 'one' ? '列表循环' : '单曲循环'}'
            aria-pressed={repeatOn}
            onclick={() => (player.mode = player.mode === 'loop' ? 'one' : 'loop')}
          >
            {#if player.mode === 'one'}<Repeat1 size={20} aria-hidden='true' />{:else}<Repeat size={20} aria-hidden='true' />{/if}
          </button>
          <button class='grid h-14 w-16 place-items-center rounded-full bg-primary-100 text-primary-950 active:bg-primary-200' aria-label='上一首' onclick={() => player.prev()}>
            <SkipBack size={22} fill='currentColor' aria-hidden='true' />
          </button>
          <button
            class='grid size-[72px] place-items-center rounded-full bg-primary-950 text-white shadow-ambient active:bg-primary-900'
            aria-label={player.playing ? '暂停' : '播放'}
            onclick={() => player.toggle()}
          >
            {#if player.playing}<Pause size={30} fill='currentColor' aria-hidden='true' />{:else}<Play size={30} fill='currentColor' class='ml-1' aria-hidden='true' />{/if}
          </button>
          <button class='grid h-14 w-16 place-items-center rounded-full bg-primary-100 text-primary-950 active:bg-primary-200' aria-label='下一首' onclick={() => player.next()}>
            <SkipForward size={22} fill='currentColor' aria-hidden='true' />
          </button>
          <button
            class={['grid size-11 place-items-center rounded-full', player.mode === 'shuffle' ? 'bg-primary-100 text-primary-900' : 'text-neutral-500 active:bg-white/60']}
            aria-label={playModeLabel.shuffle}
            aria-pressed={player.mode === 'shuffle'}
            onclick={() => (player.mode = player.mode === 'shuffle' ? 'loop' : 'shuffle')}
          >
            <Shuffle size={20} aria-hidden='true' />
          </button>
        </div>
      </div>
    </div>
  {/if}

  <button
    class='relative flex h-14 flex-none flex-col items-center rounded-t-3xl bg-white/90 pt-2 shadow-float'
    aria-expanded={queueOpen}
    onclick={() => (nav.panel = 'queue')}
  >
    <span class='h-1 w-9 rounded-full bg-neutral-300' aria-hidden='true'></span>
    <span class='mt-2 text-[14px] font-500 text-neutral-800'>播放队列</span>
  </button>

  {#if queueOpen}
    <button class='fixed inset-0 z-[55] bg-neutral-900/30' aria-label='收起播放队列' tabindex='-1' onclick={() => (nav.panel = 'lyrics')} transition:fade={{ duration: 200 }}></button>
    <div
      class='fixed inset-x-0 bottom-0 z-[56] flex h-[86dvh] flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-float'
      role='dialog'
      aria-label='播放队列'
      transition:fly={{ y: 600, duration: 380, opacity: 1, easing: ease }}
    >
      <button class='grid h-7 flex-none place-items-center' aria-label='收起播放队列' onclick={() => (nav.panel = 'lyrics')}>
        <span class='h-1 w-9 rounded-full bg-neutral-300' aria-hidden='true'></span>
      </button>
      <QueueList phone class='min-h-0 flex-1' />
    </div>
  {/if}
</div>

<style>
  .stage {
    container-type: size;
  }

  .face {
    width: min(100cqw, 100cqh);
    height: min(100cqw, 100cqh);
  }

  .face :global(img) {
    display: block;
  }
</style>
