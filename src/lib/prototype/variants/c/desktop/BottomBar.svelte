<!-- PROTOTYPE（变体 C）：桌面底部通栏。左：上一首 / 播放 / 下一首 + 时间；中：封面、歌名、歌手；右：播放模式、音量、播放队列。
  顶边一条细的薄荷进度线；点空白处或中间的歌曲打开播放页。 -->
<script lang='ts'>
  import { ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, formatDuration } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player, playModeLabel } from '$lib/prototype/player.svelte'
  import FlatRange from '../FlatRange.svelte'

  const s = $derived(player.current)

  function onclick(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('button, input'))
      return
    nav.openPlayer()
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions（键盘用户用中间的歌曲按钮打开播放页） -->
<div class='bar' {onclick}>
  <div class='line' aria-hidden='true'><span style:width='{player.progress * 100}%'></span></div>
  {#if s}
    <div class='flex items-center gap-1'>
      <button type='button' class='ctl' aria-label='上一首' onclick={() => player.prev()}><SkipBack size={20} fill='currentColor' aria-hidden='true' /></button>
      <button type='button' class='ctl play' aria-label={player.playing ? '暂停' : '播放'} onclick={() => player.toggle()}>
        {#if player.playing}<Pause size={20} fill='currentColor' aria-hidden='true' />{:else}<Play size={20} fill='currentColor' aria-hidden='true' />{/if}
      </button>
      <button type='button' class='ctl' aria-label='下一首' onclick={() => player.next()}><SkipForward size={20} fill='currentColor' aria-hidden='true' /></button>
      <span class='tnum ml-3 text-xs text-neutral-500'>
        <span class='text-neutral-700'>{formatDuration(player.position)}</span> / {formatDuration(s.duration)}
      </span>
    </div>

    <button type='button' class='now' onclick={() => nav.openPlayer('lyrics')} aria-label='打开播放页：{s.title}'>
      <Cover cover={s.cover} eager class='size-12 shrink-0 rounded-lg' />
      <span class='min-w-0 text-left'>
        <span class='block truncate text-sm text-neutral-900 font-500 leading-5' lang={s.lang}>{s.title}</span>
        <span class='block truncate text-xs text-neutral-600 leading-[18px]' lang={s.lang}>{artistLine(s)}</span>
      </span>
    </button>

    <div class='flex items-center justify-end gap-1'>
      <button type='button' class='ctl' aria-label='播放模式：{playModeLabel[player.mode]}' title={playModeLabel[player.mode]} onclick={() => player.cycleMode()}>
        {#if player.mode === 'one'}<Repeat1 size={18} aria-hidden='true' />{:else if player.mode === 'shuffle'}<Shuffle size={18} aria-hidden='true' />{:else}<Repeat size={18} aria-hidden='true' />{/if}
      </button>
      <div class='flex items-center gap-1.5'>
        <button type='button' class='ctl' aria-label={player.volume === 0 ? '取消静音' : '静音'} onclick={() => (player.volume = player.volume === 0 ? 0.72 : 0)}>
          {#if player.volume === 0}<VolumeX size={18} aria-hidden='true' />{:else if player.volume < 0.5}<Volume1 size={18} aria-hidden='true' />{:else}<Volume2 size={18} aria-hidden='true' />{/if}
        </button>
        <FlatRange class='w-24' value={player.volume} max={1} label='音量' valueText='{Math.round(player.volume * 100)}%' track={4} thumb={12} oninput={v => (player.volume = v)} />
      </div>
      <button type='button' class='ctl ml-2' class:on={nav.screen === 'player' && nav.panel === 'queue'} aria-label='播放队列' title='播放队列' onclick={() => nav.openPlayer('queue')}>
        <ListMusic size={18} aria-hidden='true' />
      </button>
    </div>
  {/if}
</div>

<style>
  .bar {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 40;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 440px) minmax(0, 1fr);
    align-items: center;
    gap: 24px;
    height: 80px;
    padding: 0 20px;
    background: #fff;
    box-shadow: 0 -1px 0 rgb(17 24 39 / 0.04), 0 -12px 32px -16px rgb(17 24 39 / 0.16);
    cursor: pointer;
  }

  .line {
    position: absolute;
    inset-inline: 0;
    top: 0;
    height: 2px;
    background: #e8f8f1;
  }

  .line > span {
    position: absolute;
    inset-block: 0;
    left: 0;
    background: #37be8c;
  }

  .ctl {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    color: #374151;
  }

  .ctl.play {
    width: 44px;
    height: 44px;
    margin-inline: 4px;
    background: #1a5b43;
    color: #fff;
  }

  .ctl.on {
    background: #d1f1e3;
    color: #1a5b43;
  }

  .now {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 6px 12px 6px 6px;
    border-radius: 12px;
  }

  @media (hover: hover) and (pointer: fine) {
    .ctl:not(.play):hover {
      background: #e8f8f1;
      color: #1a5b43;
    }

    .ctl.play:hover {
      background: #206f52;
    }

    .now:hover {
      background: #f5fcf9;
    }
  }
</style>
