<!--
  PROTOTYPE · 手机迷你播放条：封面、歌名（500），有歌词时第二行是正在唱的那句（逐字扫光），
  否则是歌手；播放/暂停、下一首；最下面压一条很细的进度线。点左边一块打开播放页。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { Pause, Play, SkipForward } from '@lucide/svelte'
  import { clock } from './clock.svelte'
  import LiveLyric from './LiveLyric.svelte'

  const song = $derived(player.current)
  const ratio = $derived(song ? Math.min(1, clock.t / song.duration) : 0)
</script>

{#if song}
  <div class='mini'>
    <button type='button' class='open' aria-label='打开播放页：{song.title}' onclick={() => nav.openPlayer('lyrics')}>
      <Cover cover={song.cover} class='mini-cover' />
      <span class='text'>
        <span class='title' lang={song.lang}>{song.title}</span>
        <LiveLyric class='sub' fallback={artistLine(song)} fallbackLang={song.lang} />
      </span>
    </button>
    <button type='button' class='play' aria-label={player.playing ? '暂停' : '播放'} onclick={() => player.toggle()}>
      <span class='disc'>
        {#if player.playing}
          <Pause size={18} strokeWidth={2.25} fill='currentColor' />
        {:else}
          <Play size={18} strokeWidth={2.25} fill='currentColor' class='nudge' />
        {/if}
      </span>
    </button>
    <button type='button' class='next' aria-label='下一首' onclick={() => player.next()}>
      <SkipForward size={22} strokeWidth={2} />
    </button>
    <span class='line' aria-hidden='true'><span style:transform='scaleX({ratio})'></span></span>
  </div>
{/if}

<style>
  .mini {
    position: fixed;
    inset: auto 0 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 2px;
    height: calc(64px + env(safe-area-inset-bottom));
    padding: 0 6px env(safe-area-inset-bottom) 10px;
    background: #fff;
    box-shadow: 0 -1px 2px rgb(17 24 39 / 0.04), 0 -12px 32px -16px rgb(17 24 39 / 0.18);
  }

  .open {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 12px;
    min-width: 0;
    height: 56px;
    padding-left: 2px;
    border-radius: 12px;
    text-align: left;
  }

  .open :global(.mini-cover) {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 8px;
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    line-height: 21px;
    font-weight: 500;
    color: #111827;
  }

  .text :global(.sub) {
    font-size: 13px;
    line-height: 19px;
    --unsung: #6b7280;
  }

  .play,
  .next {
    display: grid;
    flex: none;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 9999px;
    color: #1f2937;
  }

  .disc {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 9999px;
    background: #111827;
    color: #fff;
  }

  .disc :global(.nudge) {
    transform: translateX(1px);
  }

  .line {
    position: absolute;
    inset: auto 0 env(safe-area-inset-bottom);
    height: 2px;
    background: #f3f4f6;
  }

  .line span {
    position: absolute;
    inset: 0;
    background: #37be8c;
    transform-origin: left;
  }
</style>
