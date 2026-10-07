<!--
  PROTOTYPE：桌面全屏播放页。底色由当前封面染出（放大、模糊、盖白纱，保持明亮）；
  左边封面、歌名、波浪进度条和控制键，右边 歌词 / 播放队列。整页放进 1440×900 不需要滚动。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player, playModeLabel } from '$lib/prototype/player.svelte'
  import { ChevronDown, Ellipsis, Heart, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from '@lucide/svelte'
  import { fade, fly } from 'svelte/transition'
  import CoverTint from './CoverTint.svelte'
  import Lyrics from './Lyrics.svelte'
  import QueueList from './QueueList.svelte'
  import Slider from './Slider.svelte'
  import { ui } from './state.svelte'
  import Wave from './Wave.svelte'

  const song = $derived(player.current)
  const tabs = [
    { key: 'lyrics', label: '歌词' },
    { key: 'queue', label: '播放队列' },
  ] as const
  const repeatOn = $derived(player.mode !== 'shuffle')

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !ui.menu)
      nav.closePlayer()
  }
</script>

<svelte:window {onkeydown} />

<div
  class='fixed inset-0 z-50 flex flex-col overflow-hidden bg-white'
  role='dialog'
  aria-modal='true'
  aria-label='正在播放'
  transition:fade={{ duration: 220 }}
>
  {#if song}<CoverTint cover={song.cover} />{/if}

  <header class='relative flex h-16 flex-none items-center gap-3 px-6'>
    <button
      class='ghost grid size-10 place-items-center rounded-full text-neutral-800'
      aria-label='收起播放页'
      title='收起（Esc）'
      onclick={() => nav.closePlayer()}
    >
      <ChevronDown size={24} aria-hidden='true' />
    </button>
    <p class='min-w-0 truncate text-[14px] text-neutral-700'>
      <span class='font-600 text-neutral-900'>正在播放</span>
      <span aria-hidden='true'> · </span>来自「<span lang={langOf(player.source.name)}>{player.source.name}</span>」
    </p>
  </header>

  {#if song}
    <div
      class='relative mx-auto grid min-h-0 w-full max-w-[1240px] flex-1 grid-cols-[minmax(320px,420px)_minmax(0,1fr)] gap-x-20 px-12 pb-8'
      in:fly={{ y: 24, duration: 420, easing: t => 1 - (1 - t) ** 4 }}
    >
      <!-- 左：封面和控制键 -->
      <section class='flex min-h-0 flex-col justify-center' aria-label='播放控制'>
        <Cover cover={song.cover} eager class='cover aspect-square w-full rounded-2xl shadow-float' />

        <div class='mt-6 flex items-start gap-1'>
          <div class='min-w-0 flex-1'>
            <h2 class='truncate text-[24px] leading-8 font-600 text-neutral-900' lang={song.lang}>{song.title}</h2>
            <p class='mt-0.5 truncate text-[15px] leading-[22px] text-neutral-700' lang={song.lang}>{artistLine(song)}</p>
            <p class='truncate text-[14px] leading-5 text-neutral-600' lang={song.lang}>{song.album}</p>
          </div>
          {#if !nav.loggedOut}
          <button
            class='ghost grid size-10 flex-none place-items-center rounded-full'
            aria-label={ui.isLiked(song) ? '取消红心' : '红心'}
            aria-pressed={ui.isLiked(song)}
            onclick={() => ui.toggleLike(song)}
          >
            <Heart size={20} class={ui.isLiked(song) ? 'text-accent-600' : 'text-neutral-700'} fill={ui.isLiked(song) ? 'currentColor' : 'none'} aria-hidden='true' />
          </button>
          {/if}
          <button
            class='ghost grid size-10 flex-none place-items-center rounded-full text-neutral-700'
            aria-label='更多操作'
            aria-haspopup='menu'
            onclick={e => ui.openMenuFrom(song, e.currentTarget)}
          >
            <Ellipsis size={20} aria-hidden='true' />
          </button>
        </div>

        <div class='mt-3'>
          <Wave />
        </div>

        <div class='mt-3 flex items-center justify-between'>
          <button
            class={['mode grid size-10 place-items-center rounded-full', repeatOn ? 'bg-primary-100 text-primary-900' : 'text-neutral-500']}
            aria-label='播放模式：{repeatOn ? playModeLabel[player.mode] : playModeLabel.shuffle}，点按切换{player.mode === 'one' ? '列表循环' : '单曲循环'}'
            aria-pressed={repeatOn}
            title={repeatOn ? playModeLabel[player.mode] : playModeLabel.loop}
            onclick={() => (player.mode = player.mode === 'loop' ? 'one' : 'loop')}
          >
            {#if player.mode === 'one'}<Repeat1 size={18} aria-hidden='true' />{:else}<Repeat size={18} aria-hidden='true' />{/if}
          </button>
          <div class='flex items-center gap-4'>
            <button class='tonal grid h-12 w-16 place-items-center rounded-full bg-primary-100 text-primary-950' aria-label='上一首' onclick={() => player.prev()}>
              <SkipBack size={20} fill='currentColor' aria-hidden='true' />
            </button>
            <button
              class='play grid size-16 place-items-center rounded-full bg-primary-950 text-white shadow-ambient'
              aria-label={player.playing ? '暂停' : '播放'}
              onclick={() => player.toggle()}
            >
              {#if player.playing}<Pause size={26} fill='currentColor' aria-hidden='true' />{:else}<Play size={26} fill='currentColor' class='ml-1' aria-hidden='true' />{/if}
            </button>
            <button class='tonal grid h-12 w-16 place-items-center rounded-full bg-primary-100 text-primary-950' aria-label='下一首' onclick={() => player.next()}>
              <SkipForward size={20} fill='currentColor' aria-hidden='true' />
            </button>
          </div>
          <button
            class={['mode grid size-10 place-items-center rounded-full', player.mode === 'shuffle' ? 'bg-primary-100 text-primary-900' : 'text-neutral-500']}
            aria-label={playModeLabel.shuffle}
            aria-pressed={player.mode === 'shuffle'}
            title={playModeLabel.shuffle}
            onclick={() => (player.mode = player.mode === 'shuffle' ? 'loop' : 'shuffle')}
          >
            <Shuffle size={18} aria-hidden='true' />
          </button>
        </div>

        <div class='mt-4 flex items-center gap-3 px-1'>
          <button
            class='ghost -ml-2 grid size-9 flex-none place-items-center rounded-full text-neutral-600'
            aria-label={player.volume === 0 ? '取消静音' : '静音'}
            onclick={() => (player.volume = player.volume === 0 ? 0.7 : 0)}
          >
            {#if player.volume === 0}<VolumeX size={18} aria-hidden='true' />{:else if player.volume < 0.5}<Volume1 size={18} aria-hidden='true' />{:else}<Volume2 size={18} aria-hidden='true' />{/if}
          </button>
          <Slider
            size='sm'
            value={player.volume}
            max={1}
            step={0.01}
            label='音量'
            valueText='{Math.round(player.volume * 100)}%'
            onchange={v => (player.volume = v)}
          />
        </div>
      </section>

      <!-- 右：歌词 / 播放队列 -->
      <section class='flex min-h-0 flex-col' aria-label={nav.panel === 'queue' ? '播放队列' : '歌词'}>
        <div class='flex flex-none items-center'>
          <div class='relative grid grid-cols-2 rounded-full bg-white/70 p-1 shadow-ambient' role='tablist' aria-label='播放页面板'>
            <span
              class='indicator absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-primary-100'
              style:transform={nav.panel === 'queue' ? 'translateX(100%)' : 'none'}
              aria-hidden='true'
            ></span>
            {#each tabs as tab (tab.key)}
              <button
                role='tab'
                aria-selected={nav.panel === tab.key}
                class={['relative h-9 w-28 rounded-full text-[14px] font-500 transition-colors duration-200', nav.panel === tab.key ? 'text-primary-950' : 'text-neutral-700']}
                onclick={() => (nav.panel = tab.key)}
              >{tab.label}</button>
            {/each}
          </div>
        </div>

        <div class='mt-5 flex min-h-0 flex-1 flex-col'>
          {#if nav.panel === 'queue'}
            <div class='flex min-h-0 flex-1 flex-col rounded-2xl bg-white shadow-ambient'>
              <QueueList class='flex-1' />
            </div>
          {:else}
            <Lyrics class='flex-1' />
          {/if}
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  div :global(.cover) {
    max-width: min(420px, calc(100dvh - 440px));
    align-self: center;
  }

  .indicator {
    transition: transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .indicator {
      transition: none;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .ghost:hover,
    .mode:hover {
      background: rgb(232 248 241 / 0.9);
      color: #1a5b43;
    }

    .tonal:hover {
      background: #d1f1e3;
    }

    .play:hover {
      background: #206f52;
    }
  }
</style>
