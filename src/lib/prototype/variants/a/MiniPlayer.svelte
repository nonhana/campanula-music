<!--
  PROTOTYPE：手机迷你播放条——白色、浮起、圆角 2xl，离屏幕边 8px；最下面压一条很细的进度线。轻点打开播放页。
  底下垫一层晨光底的渐隐，列表滚到条下面时不会从缝里露出来。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { Pause, Play, SkipForward } from '@lucide/svelte'

  const song = $derived(player.current)
</script>

{#if song}
  <div class='dock pointer-events-none fixed inset-x-0 bottom-0 z-29 h-[calc(104px+env(safe-area-inset-bottom))]' aria-hidden='true'></div>
  <div class='fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] z-30 h-16 overflow-hidden rounded-2xl bg-white shadow-float'>
    <div class='flex h-full items-center gap-1 pl-2 pr-1.5'>
      <button class='open flex min-w-0 flex-1 items-center gap-3 text-left' aria-label='打开播放页：{song.title}' onclick={() => nav.openPlayer('lyrics')}>
        <Cover cover={song.cover} class='size-11 flex-none rounded-lg' />
        <span class='min-w-0'>
          <span class='block truncate text-[14px] leading-5 font-500 text-neutral-900' lang={song.lang}>{song.title}</span>
          <span class='block truncate text-[12.5px] leading-[18px] text-neutral-600' lang={song.lang}>{artistLine(song)}</span>
        </span>
      </button>
      <button
        class='relative z-1 grid size-11 flex-none place-items-center rounded-full bg-primary-950 text-white active:bg-primary-900'
        aria-label={player.playing ? '暂停' : '播放'}
        onclick={() => player.toggle()}
      >
        {#if player.playing}<Pause size={20} fill='currentColor' aria-hidden='true' />{:else}<Play size={20} fill='currentColor' class='ml-0.5' aria-hidden='true' />{/if}
      </button>
      <button class='relative z-1 grid size-11 flex-none place-items-center rounded-full text-neutral-700 active:bg-primary-100' aria-label='下一首' onclick={() => player.next()}>
        <SkipForward size={20} fill='currentColor' aria-hidden='true' />
      </button>
    </div>
    <div class='absolute inset-x-0 bottom-0 h-[2px] bg-primary-100' aria-hidden='true'>
      <div class='h-full bg-primary-700 transition-[width] duration-250 ease-linear' style:width='{player.progress * 100}%'></div>
    </div>
  </div>
{/if}

<style>
  .dock {
    background: linear-gradient(to bottom, rgb(245 252 249 / 0), #f5fcf9 45%);
  }

  .open::after {
    content: '';
    position: absolute;
    inset: 0;
  }
</style>
