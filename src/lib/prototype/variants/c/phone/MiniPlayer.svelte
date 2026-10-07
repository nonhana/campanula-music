<!-- PROTOTYPE（变体 C）：手机迷你播放条。封面、歌名（500）、歌手、播放/暂停、下一首；最下面压一条细进度线；点一下打开播放页。 -->
<script lang='ts'>
  import { Pause, Play, SkipForward } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'

  const s = $derived(player.current)
</script>

{#if s}
  <div class='mini'>
    <button type='button' class='open' aria-label='打开播放页：{s.title}' onclick={() => nav.openPlayer('lyrics')}></button>
    <Cover cover={s.cover} eager class='pointer-events-none size-11 shrink-0 rounded-lg' />
    <span class='pointer-events-none min-w-0 flex-1'>
      <span class='block truncate text-[15px] text-neutral-900 font-500 leading-[22px]' lang={s.lang}>{s.title}</span>
      <span class='block truncate text-[13px] text-neutral-600 leading-[18px]' lang={s.lang}>{artistLine(s)}</span>
    </span>
    <button type='button' class='ctl play' aria-label={player.playing ? '暂停' : '播放'} onclick={() => player.toggle()}>
      {#if player.playing}<Pause size={20} fill='currentColor' aria-hidden='true' />{:else}<Play size={20} fill='currentColor' aria-hidden='true' />{/if}
    </button>
    <button type='button' class='ctl' aria-label='下一首' onclick={() => player.next()}>
      <SkipForward size={20} fill='currentColor' aria-hidden='true' />
    </button>
    <span class='line' aria-hidden='true'><span style:width='{player.progress * 100}%'></span></span>
  </div>
{/if}

<style>
  .mini {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: calc(8px + env(safe-area-inset-bottom));
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 64px;
    padding: 0 6px 0 10px;
    border-radius: 16px;
    background: #fff;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
    overflow: hidden;
  }

  .open {
    position: absolute;
    inset: 0;
    border-radius: 16px;
    outline-offset: -2px;
  }

  .ctl {
    position: relative;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    color: #1f2937;
  }

  .ctl.play {
    background: #1a5b43;
    color: #fff;
  }

  .line {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 0;
    height: 2px;
    border-radius: 2px;
    background: #e8f8f1;
  }

  .line > span {
    position: absolute;
    inset-block: 0;
    left: 0;
    border-radius: 2px;
    background: #37be8c;
  }
</style>
