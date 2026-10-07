<!--
  PROTOTYPE：桌面底部通栏（80px）。左：上一首/播放/下一首 + 时间；中：封面、歌名、歌手（点开播放页）；
  右：播放模式、音量、播放队列。顶边一条细的薄荷进度线。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, formatDuration } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player, playModeLabel } from '$lib/prototype/player.svelte'
  import { ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from '@lucide/svelte'
  import Slider from './Slider.svelte'

  const song = $derived(player.current)
  let lastVolume = 0.72
</script>

<footer class='fixed inset-x-0 bottom-0 z-30 h-20 bg-white shadow-float'>
  <div class='absolute inset-x-0 top-0 h-[2px] bg-primary-100' aria-hidden='true'>
    <div class='h-full bg-primary-700 transition-[width] duration-250 ease-linear' style:width='{player.progress * 100}%'></div>
  </div>

  <div class='grid h-full grid-cols-[minmax(0,1fr)_minmax(0,440px)_minmax(0,1fr)] items-center gap-6 px-5'>
    <div class='flex items-center gap-1.5'>
      <button class='ghost grid size-10 place-items-center rounded-xl text-neutral-700' aria-label='上一首' onclick={() => player.prev()}>
        <SkipBack size={20} fill='currentColor' aria-hidden='true' />
      </button>
      <button
        class='play grid size-11 place-items-center rounded-full bg-primary-950 text-white'
        aria-label={player.playing ? '暂停' : '播放'}
        onclick={() => player.toggle()}
      >
        {#if player.playing}<Pause size={20} fill='currentColor' aria-hidden='true' />{:else}<Play size={20} fill='currentColor' class='ml-0.5' aria-hidden='true' />{/if}
      </button>
      <button class='ghost grid size-10 place-items-center rounded-xl text-neutral-700' aria-label='下一首' onclick={() => player.next()}>
        <SkipForward size={20} fill='currentColor' aria-hidden='true' />
      </button>
      <span class='ml-3 text-[13px] text-neutral-600 tnum'>
        {formatDuration(player.position)} / {formatDuration(song?.duration ?? 0)}
      </span>
    </div>

    {#if song}
      <button class='now flex min-w-0 items-center gap-3 rounded-xl p-1.5 pr-4 text-left' aria-label='打开播放页：{song.title}' onclick={() => nav.openPlayer('lyrics')}>
        <Cover cover={song.cover} class='size-12 flex-none rounded-lg' />
        <span class='min-w-0'>
          <span class='block truncate text-[14px] leading-5 font-500 text-neutral-900' lang={song.lang}>{song.title}</span>
          <span class='block truncate text-[13px] leading-5 text-neutral-600' lang={song.lang}>{artistLine(song)}</span>
        </span>
      </button>
    {:else}
      <span class='text-center text-[14px] text-neutral-500'>播放队列是空的</span>
    {/if}

    <div class='flex items-center justify-end gap-1.5'>
      <button
        class={['ghost grid size-10 place-items-center rounded-xl', player.mode === 'loop' ? 'text-neutral-700' : 'text-primary-900']}
        aria-label='播放模式：{playModeLabel[player.mode]}'
        title={playModeLabel[player.mode]}
        onclick={() => player.cycleMode()}
      >
        {#if player.mode === 'one'}<Repeat1 size={19} aria-hidden='true' />{:else if player.mode === 'shuffle'}<Shuffle size={19} aria-hidden='true' />{:else}<Repeat size={19} aria-hidden='true' />{/if}
      </button>
      <button
        class='ghost grid size-10 place-items-center rounded-xl text-neutral-700'
        aria-label={player.volume === 0 ? '取消静音' : '静音'}
        onclick={() => {
          if (player.volume > 0) {
            lastVolume = player.volume
            player.volume = 0
          }
          else {
            player.volume = lastVolume
          }
        }}
      >
        {#if player.volume === 0}<VolumeX size={19} aria-hidden='true' />{:else if player.volume < 0.5}<Volume1 size={19} aria-hidden='true' />{:else}<Volume2 size={19} aria-hidden='true' />{/if}
      </button>
      <div class='w-24'>
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
      <button
        class='ghost ml-2 grid size-10 place-items-center rounded-xl text-neutral-700'
        aria-label='播放队列'
        onclick={() => nav.openPlayer('queue')}
      >
        <ListMusic size={20} aria-hidden='true' />
      </button>
    </div>
  </div>
</footer>

<style>
  @media (hover: hover) and (pointer: fine) {
    .ghost:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }

    .play:hover {
      background: #206f52;
    }

    .now:hover {
      background: #f5fcf9;
    }
  }
</style>
