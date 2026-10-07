<!-- PROTOTYPE：手机迷你播放条（照视觉原型，静态进度）。它占着屏幕下边，自动滚动的下边缘区从它上面开始算。 -->
<script lang='ts'>
  import { Pause, Play, SkipForward } from '@lucide/svelte'
  import Cover from '../Cover.svelte'
  import { artistLine, songById } from '../data'
  import { player } from '../store.svelte'

  const song = $derived(songById.get(player.current))
</script>

{#if song}
  <div class='dock pointer-events-none fixed inset-x-0 bottom-0 z-29 h-[calc(104px+env(safe-area-inset-bottom))]' aria-hidden='true'></div>
  <div class='fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] z-30 h-16 overflow-hidden rounded-2xl bg-white shadow-float'>
    <div class='flex h-full items-center gap-1 pl-2 pr-1.5'>
      <span class='flex min-w-0 flex-1 items-center gap-3'>
        <Cover cover={song.cover} class='size-11 flex-none rounded-lg' />
        <span class='min-w-0'>
          <span class='block truncate text-[14px] leading-5 font-500 text-neutral-900' lang={song.lang}>{song.title}</span>
          <span class='block truncate text-[12.5px] leading-[18px] text-neutral-600' lang={song.lang}>{artistLine(song)}</span>
        </span>
      </span>
      <button
        class='grid size-11 flex-none place-items-center rounded-full bg-primary-950 text-white active:bg-primary-900'
        aria-label={player.playing ? '暂停' : '播放'}
        onclick={() => (player.playing = !player.playing)}
      >
        {#if player.playing}<Pause size={20} fill='currentColor' aria-hidden='true' />{:else}<Play size={20} fill='currentColor' class='ml-0.5' aria-hidden='true' />{/if}
      </button>
      <button class='grid size-11 flex-none place-items-center rounded-full text-neutral-700 active:bg-primary-100' aria-label='下一首'>
        <SkipForward size={20} fill='currentColor' aria-hidden='true' />
      </button>
    </div>
    <div class='absolute inset-x-0 bottom-0 h-[2px] bg-primary-100' aria-hidden='true'>
      <div class='h-full w-[42%] bg-primary-700'></div>
    </div>
  </div>
{/if}

<style>
  .dock {
    background: linear-gradient(to bottom, rgb(245 252 249 / 0), #f5fcf9 45%);
  }
</style>
