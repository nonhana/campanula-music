<!--
  PROTOTYPE · 桌面底部通栏（80px）：左边上一首/播放/下一首和时间；中间封面、“歌名 · 歌手”，
  第二行是正在唱的那句歌词（逐字扫光的缩小版，没有歌词时是专辑名）；右边播放模式、音量、歌词、播放队列。
  顶边一条细的薄荷进度线。点中间一块打开播放页。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, formatDuration } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player, playModeLabel } from '$lib/prototype/player.svelte'
  import { ListMusic, MicVocal, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from '@lucide/svelte'
  import { clock } from './clock.svelte'
  import LiveLyric from './LiveLyric.svelte'

  const song = $derived(player.current)
  const ratio = $derived(song ? Math.min(1, clock.t / song.duration) : 0)
</script>

<footer class='bar' aria-label='播放条'>
  <div class='line' aria-hidden='true'><span style:transform='scaleX({ratio})'></span></div>

  <div class='left'>
    <button type='button' class='ghost' aria-label='上一首' onclick={() => player.prev()}><SkipBack size={20} strokeWidth={2} /></button>
    <button type='button' class='play' aria-label={player.playing ? '暂停' : '播放'} onclick={() => player.toggle()}>
      {#if player.playing}
        <Pause size={20} strokeWidth={2.25} fill='currentColor' />
      {:else}
        <Play size={20} strokeWidth={2.25} fill='currentColor' class='nudge' />
      {/if}
    </button>
    <button type='button' class='ghost' aria-label='下一首' onclick={() => player.next()}><SkipForward size={20} strokeWidth={2} /></button>
    {#if song}
      <span class='time tnum'>{formatDuration(clock.t)} / {formatDuration(song.duration)}</span>
    {/if}
  </div>

  {#if song}
    <button type='button' class='now' aria-label='打开播放页：{song.title}' onclick={() => nav.openPlayer('lyrics')}>
      <Cover cover={song.cover} class='now-cover' />
      <span class='now-text'>
        <span class='l1'>
          <span class='title' lang={song.lang}>{song.title}</span>
          <span class='by' lang={song.lang}>· {artistLine(song)}</span>
        </span>
        <LiveLyric class='l2' fallback={song.album} fallbackLang={song.lang} />
      </span>
    </button>
  {/if}

  <div class='right'>
    <button type='button' class='ghost' aria-label='播放模式：{playModeLabel[player.mode]}' title={playModeLabel[player.mode]} onclick={() => player.cycleMode()}>
      {#if player.mode === 'one'}
        <Repeat1 size={19} strokeWidth={2} />
      {:else if player.mode === 'shuffle'}
        <Shuffle size={19} strokeWidth={2} />
      {:else}
        <Repeat size={19} strokeWidth={2} />
      {/if}
    </button>
    <div class='volume'>
      <button type='button' class='ghost' aria-label={player.volume === 0 ? '取消静音' : '静音'} onclick={() => (player.volume = player.volume === 0 ? 0.72 : 0)}>
        {#if player.volume === 0}
          <VolumeX size={19} strokeWidth={2} />
        {:else if player.volume < 0.5}
          <Volume1 size={19} strokeWidth={2} />
        {:else}
          <Volume2 size={19} strokeWidth={2} />
        {/if}
      </button>
      <input
        type='range'
        min='0'
        max='1'
        step='0.01'
        aria-label='音量'
        bind:value={player.volume}
        style:--v='{player.volume * 100}%'
      />
    </div>
    <button type='button' class='ghost' aria-label='歌词' onclick={() => nav.openPlayer('lyrics')}><MicVocal size={19} strokeWidth={2} /></button>
    <button type='button' class='ghost' aria-label='播放队列' onclick={() => nav.openPlayer('queue')}><ListMusic size={19} strokeWidth={2} /></button>
  </div>
</footer>

<style>
  .bar {
    position: fixed;
    inset: auto 0 0;
    z-index: 40;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 560px) minmax(0, 1fr);
    align-items: center;
    column-gap: 24px;
    height: 80px;
    padding: 0 20px;
    background: #fff;
    box-shadow: 0 -1px 2px rgb(17 24 39 / 0.04), 0 -12px 32px -16px rgb(17 24 39 / 0.16);
  }

  .line {
    position: absolute;
    inset: 0 0 auto;
    height: 2px;
    background: #f3f4f6;
  }

  .line span {
    position: absolute;
    inset: 0;
    background: #37be8c;
    transform-origin: left;
  }

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .right {
    justify-content: flex-end;
  }

  .ghost {
    display: grid;
    flex: none;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 9999px;
    color: #374151;
  }

  .play {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    margin: 0 2px;
    border-radius: 9999px;
    background: #111827;
    color: #fff;
  }

  .play :global(.nudge) {
    transform: translateX(1px);
  }

  .time {
    margin-left: 10px;
    font-size: 12px;
    color: #6b7280;
    white-space: nowrap;
  }

  .now {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    height: 64px;
    padding: 0 12px 0 8px;
    border-radius: 14px;
    text-align: left;
  }

  .now :global(.now-cover) {
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 8px;
    box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07);
  }

  .now-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .l1 {
    display: flex;
    gap: 6px;
    min-width: 0;
    font-size: 14px;
    line-height: 21px;
    white-space: nowrap;
  }

  .title {
    flex: none;
    max-width: 70%;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
    color: #111827;
  }

  .by {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #4b5563;
  }

  .now :global(.l2) {
    font-size: 13px;
    line-height: 20px;
    --unsung: #6b7280;
  }

  .volume {
    display: flex;
    align-items: center;
  }

  input[type='range'] {
    width: 88px;
    height: 20px;
    margin: 0 8px 0 0;
    background: transparent;
    cursor: pointer;
    appearance: none;
  }

  input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 9999px;
    background: linear-gradient(90deg, #2b976f var(--v), #e5e7eb var(--v));
  }

  input[type='range']::-webkit-slider-thumb {
    width: 12px;
    height: 12px;
    margin-top: -4px;
    border-radius: 9999px;
    background: #206f52;
    appearance: none;
  }

  input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: 9999px;
    background: linear-gradient(90deg, #2b976f var(--v), #e5e7eb var(--v));
  }

  input[type='range']::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: 0;
    border-radius: 9999px;
    background: #206f52;
  }

  @media (hover: hover) and (pointer: fine) {
    .ghost:hover {
      background: #f3f4f6;
      color: #111827;
    }

    .play:hover {
      background: #1f2937;
    }

    .now:hover {
      background: #f9fafb;
    }
  }

  @media (max-width: 1100px) {
    input[type='range'] {
      display: none;
    }
  }
</style>
