<!--
  PROTOTYPE · 桌面全屏播放页 = 歌词舞台。底色是当前封面放大模糊后盖上白纱的晨光；
  左列封面、歌曲信息、波浪进度、控制键；右边整片是歌词舞台；播放队列从右侧抽屉滑出。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { ChevronDown, ListMusic } from '@lucide/svelte'
  import Controls from './Controls.svelte'
  import CoverWash from './CoverWash.svelte'
  import LyricStage from './LyricStage.svelte'
  import QueuePanel from './QueuePanel.svelte'
  import { ui } from './ui.svelte'
  import Wave from './Wave.svelte'

  const song = $derived(player.current)
  const queueOpen = $derived(nav.panel === 'queue')

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || ui.menu)
      return
    if (queueOpen)
      nav.panel = 'lyrics'
    else nav.closePlayer()
  }
</script>

<svelte:window {onkeydown} />

<div class='player' role='dialog' aria-modal='true' aria-label='正在播放'>
  {#if song}
    <CoverWash cover={song.cover} veil={0.72} />
  {/if}

  <header class='top'>
    <div class='where'>
      <button type='button' class='round' aria-label='收起播放页' onclick={() => nav.closePlayer()}>
        <ChevronDown size={22} strokeWidth={2} />
      </button>
      <p>正在播放 · 来自「<span>{player.source.name}</span>」</p>
    </div>
    <div class='tools'>
      <button type='button' class={['pill', ui.showTranslation && 'on']} aria-pressed={ui.showTranslation} onclick={() => (ui.showTranslation = !ui.showTranslation)}>翻译</button>
      <button type='button' class={['pill', ui.showRomaji && 'on']} aria-pressed={ui.showRomaji} onclick={() => (ui.showRomaji = !ui.showRomaji)}>音译</button>
      <span class='sep' aria-hidden='true'></span>
      <button type='button' class={['pill', 'queue-btn', queueOpen && 'on']} aria-pressed={queueOpen} onclick={() => (nav.panel = queueOpen ? 'lyrics' : 'queue')}>
        <ListMusic size={16} strokeWidth={2} />播放队列
      </button>
    </div>
  </header>

  {#if song}
    <div class='body'>
      <section class='side' aria-label='歌曲'>
        <Cover cover={song.cover} alt='{song.album} 封面' class='big-cover' eager />
        <div class='meta'>
          <h1 lang={song.lang}>{song.title}</h1>
          <p class='artist' lang={song.lang}>{artistLine(song)}</p>
          <p class='album' lang={song.lang}>{song.album}</p>
        </div>
        <Wave />
        <Controls />
      </section>
      <section class='stage' aria-label='歌词'>
        <LyricStage />
      </section>
    </div>
  {/if}

  <aside class={['drawer', queueOpen && 'open']} aria-hidden={!queueOpen} inert={!queueOpen}>
    {#if queueOpen}
      <QueuePanel onclose={() => (nav.panel = 'lyrics')} />
    {/if}
  </aside>
</div>

<style>
  .player {
    position: fixed;
    inset: 0;
    z-index: 60;
    overflow: hidden;
    background: #fff;
    animation: lift 420ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .top {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 72px;
    padding: 0 32px 0 24px;
  }

  .where {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .where p {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    color: #374151;
  }

  .where p span {
    font-weight: 500;
    color: #111827;
  }

  .round {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 9999px;
    color: #1f2937;
  }

  .tools {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sep {
    width: 1px;
    height: 20px;
    margin: 0 4px;
    background: rgb(17 24 39 / 0.12);
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border: 1px solid rgb(17 24 39 / 0.14);
    border-radius: 9999px;
    font-size: 13.5px;
    color: #1f2937;
    background: rgb(255 255 255 / 0.4);
    transition: background-color 140ms, border-color 140ms;
  }

  .pill.on {
    border-color: transparent;
    background: #e8f8f1;
    color: #1a5b43;
    font-weight: 500;
  }

  .body {
    position: relative;
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    column-gap: clamp(56px, 8vw, 120px);
    height: calc(100% - 72px);
    padding: 0 clamp(32px, 6vw, 96px) 0 clamp(40px, 8vw, 128px);
  }

  .side {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0;
    padding-bottom: 56px;
  }

  .side :global(.big-cover) {
    width: 300px;
    height: 300px;
    border-radius: 16px;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
  }

  .meta {
    margin: 28px 0 14px;
  }

  h1 {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    font-size: 22px;
    line-height: 30px;
    font-weight: 600;
    color: #111827;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .artist,
  .album {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .artist {
    margin-top: 4px;
    font-size: 15px;
    line-height: 22px;
    color: #374151;
  }

  .album {
    font-size: 13px;
    line-height: 20px;
    color: #4b5563;
  }

  .side :global(.controls) {
    margin-top: 18px;
  }

  .stage {
    min-width: 0;
    height: 100%;
    padding-right: 8px;
  }

  .drawer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 380px;
    background: #fff;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
    transform: translateX(104%);
    transition: transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .drawer.open {
    transform: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .round:hover {
      background: rgb(255 255 255 / 0.6);
    }

    .pill:not(.on):hover {
      background: rgb(255 255 255 / 0.75);
      border-color: rgb(17 24 39 / 0.22);
    }
  }

  @keyframes lift {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
  }
</style>
