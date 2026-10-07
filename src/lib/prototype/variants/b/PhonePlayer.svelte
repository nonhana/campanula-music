<!--
  PROTOTYPE · 手机播放页：Auxio 的骨架放在封面染色的晨光底上。大封面下面压一条三行歌词
  （上一句淡、当前句逐字扫光、下一句淡）；点歌词条进入全屏歌词，封面缩成标题栏里的小图，再点一下回来。
  播放队列从底部上拉。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine } from '$lib/prototype/data'
  import { lineIndexAt } from '$lib/prototype/lyrics'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { ChevronDown, Ellipsis, MicVocal } from '@lucide/svelte'
  import { clock } from './clock.svelte'
  import Controls from './Controls.svelte'
  import CoverWash from './CoverWash.svelte'
  import LyricStage from './LyricStage.svelte'
  import QueuePanel from './QueuePanel.svelte'
  import Sweep from './Sweep.svelte'
  import { ui } from './ui.svelte'
  import Wave from './Wave.svelte'

  const song = $derived(player.current)
  const lines = $derived(player.lyrics)
  const index = $derived(lines ? Math.max(0, lineIndexAt(lines, clock.t)) : 0)
  const queueOpen = $derived(nav.panel === 'queue')
  const emptyText = $derived(song?.lyric === 'instrumental' ? '纯音乐，请欣赏' : '暂无歌词')

  function lyricKey(e: KeyboardEvent, open: boolean) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      ui.lyricsMode = open
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || ui.menu)
      return
    if (queueOpen)
      nav.panel = 'lyrics'
    else if (ui.lyricsMode)
      ui.lyricsMode = false
    else nav.closePlayer()
  }
</script>

<svelte:window {onkeydown} />

<div class='player' role='dialog' aria-modal='true' aria-label='正在播放'>
  {#if song}
    <CoverWash cover={song.cover} veil={0.7} />
  {/if}

  <header class='top'>
    <button type='button' class='icon' aria-label='收起播放页' onclick={() => nav.closePlayer()}>
      <ChevronDown size={24} strokeWidth={2} />
    </button>
    <div class='where'>
      <p class='now'>正在播放</p>
      <p class='from'>{player.source.name}</p>
    </div>
    <button type='button' class={['icon', ui.lyricsMode && 'on']} aria-label='全屏歌词' aria-pressed={ui.lyricsMode} onclick={() => (ui.lyricsMode = !ui.lyricsMode)}>
      <MicVocal size={21} strokeWidth={2} />
    </button>
  </header>

  {#if song}
    {#if !ui.lyricsMode}
      <div class='main'>
        <div class='upper'>
          <Cover cover={song.cover} alt='{song.album} 封面' class='big-cover' eager />
          <button type='button' class='strip' aria-label='全屏歌词' onclick={() => (ui.lyricsMode = true)}>
            {#if lines}
              <span class='dim' lang='ja'>{lines[index - 1]?.text ?? ''}</span>
              <span class='cur' lang='ja'>
                {#key index}<span class='in'><Sweep line={lines[index]} t={clock.t} /></span>{/key}
              </span>
              <span class='dim' lang='ja'>{lines[index + 1]?.text ?? ''}</span>
            {:else}
              <span class='none'>{emptyText}</span>
            {/if}
          </button>
        </div>
        <div class='lower'>
          <div class='info'>
            <div class='info-text'>
              <h1 lang={song.lang}>{song.title}</h1>
              <p class='artist' lang={song.lang}>{artistLine(song)}</p>
              <p class='album' lang={song.lang}>{song.album}</p>
            </div>
            <button type='button' class='icon' aria-label='更多操作：{song.title}' onclick={() => ui.openMenu(song, 0, 0)}>
              <Ellipsis size={22} strokeWidth={2} />
            </button>
          </div>
          <Wave touch />
          <Controls touch />
        </div>
      </div>
    {:else}
      <div class='main lyr'>
        <div class='lyr-head'>
          <button type='button' class='thumb' aria-label='回到封面' onclick={() => (ui.lyricsMode = false)}>
            <Cover cover={song.cover} class='thumb-img' />
          </button>
          <div class='lyr-text'>
            <p class='lyr-title' lang={song.lang}>{song.title}</p>
            <p class='lyr-artist' lang={song.lang}>{artistLine(song)}</p>
          </div>
          <div class='chips'>
            <button type='button' class={['chip', ui.showTranslation && 'on']} aria-pressed={ui.showTranslation} onclick={() => (ui.showTranslation = !ui.showTranslation)}>翻译</button>
            <button type='button' class={['chip', ui.showRomaji && 'on']} aria-pressed={ui.showRomaji} onclick={() => (ui.showRomaji = !ui.showRomaji)}>音译</button>
          </div>
        </div>
        <div class='lyr-area' role='button' tabindex='0' aria-label='回到封面' onclick={() => (ui.lyricsMode = false)} onkeydown={e => lyricKey(e, false)}>
          <LyricStage size='phone' anchor={0.3} />
        </div>
        <div class='lyr-controls'>
          <Wave touch />
          <Controls touch />
        </div>
      </div>
    {/if}
  {/if}

  <button type='button' class='peek' aria-label='展开播放队列' onclick={() => (nav.panel = 'queue')}>
    <span class='handle' aria-hidden='true'></span>
    <span>播放队列</span>
  </button>

  {#if queueOpen}
    <button type='button' class='scrim' aria-label='收起播放队列' onclick={() => (nav.panel = 'lyrics')}></button>
    <div class='sheet'>
      <button type='button' class='sheet-handle' aria-label='收起播放队列' onclick={() => (nav.panel = 'lyrics')}>
        <span class='handle' aria-hidden='true'></span>
      </button>
      <div class='sheet-body'>
        <QueuePanel />
      </div>
    </div>
  {/if}
</div>

<style>
  .player {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
    animation: lift 380ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .top {
    position: relative;
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    align-items: center;
    flex: none;
    height: 56px;
    padding: 0 8px;
  }

  .where {
    text-align: center;
    min-width: 0;
  }

  .where p {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .now {
    font-size: 15px;
    line-height: 21px;
    font-weight: 600;
    color: #111827;
  }

  .from {
    font-size: 12px;
    line-height: 17px;
    color: #374151;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 9999px;
    color: #1f2937;
  }

  .icon.on {
    background: #e8f8f1;
    color: #1a5b43;
  }

  .main {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: space-between;
    min-height: 0;
    padding: 4px 24px 72px;
  }

  .upper {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .main :global(.big-cover) {
    width: min(calc(100vw - 48px), calc(100dvh - 486px));
    height: auto;
    align-self: center;
    border-radius: 16px;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
  }

  .strip {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    min-width: 0;
    text-align: left;
    border-radius: 12px;
    padding: 2px 0;
  }

  .strip > span {
    display: block;
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 20px), transparent);
    mask-image: linear-gradient(90deg, #000 calc(100% - 20px), transparent);
  }

  .dim {
    min-height: 20px;
    font-size: 14px;
    line-height: 20px;
    color: rgb(17 24 39 / 0.42);
  }

  .cur {
    font-size: 19px;
    line-height: 28px;
    font-weight: 600;
    --unsung: #9ca3af;
  }

  .in {
    display: inline-block;
    animation: rise 420ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .none {
    font-size: 15px;
    line-height: 28px;
    color: #4b5563;
  }

  .lower {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .info {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 2px;
  }

  .info-text {
    flex: 1;
    min-width: 0;
  }

  h1,
  .artist,
  .album {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  h1 {
    font-size: 20px;
    line-height: 28px;
    font-weight: 600;
    color: #111827;
  }

  .artist {
    font-size: 15px;
    line-height: 21px;
    color: #374151;
  }

  .album {
    font-size: 13px;
    line-height: 19px;
    color: #4b5563;
  }

  .info .icon {
    margin-right: -10px;
  }

  /* 全屏歌词 */
  .lyr {
    justify-content: flex-start;
    gap: 8px;
  }

  .lyr-head {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: none;
  }

  .thumb {
    flex: none;
    border-radius: 10px;
  }

  .thumb :global(.thumb-img) {
    width: 56px;
    height: 56px;
    border-radius: 10px;
    box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07);
  }

  .lyr-text {
    flex: 1;
    min-width: 0;
  }

  .lyr-title,
  .lyr-artist {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lyr-title {
    font-size: 16px;
    line-height: 23px;
    font-weight: 600;
    color: #111827;
  }

  .lyr-artist {
    font-size: 13px;
    line-height: 19px;
    color: #374151;
  }

  .chips {
    display: flex;
    flex: none;
    gap: 6px;
  }

  .chip {
    position: relative;
    height: 32px;
    padding: 0 12px;
    border: 1px solid rgb(17 24 39 / 0.14);
    border-radius: 9999px;
    font-size: 13px;
    color: #1f2937;
    background: rgb(255 255 255 / 0.4);
  }

  .chip::before {
    content: '';
    position: absolute;
    inset: -7px -3px;
  }

  .chip.on {
    border-color: transparent;
    background: #e8f8f1;
    color: #1a5b43;
    font-weight: 500;
  }

  .lyr-area {
    flex: 1;
    min-height: 0;
    margin: 4px -4px 0;
    padding: 0 4px;
    border-radius: 12px;
    cursor: pointer;
  }

  .lyr-controls {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 6px;
  }

  /* 播放队列 */
  .peek {
    position: absolute;
    inset: auto 0 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    height: 60px;
    padding-top: 10px;
    border-radius: 20px 20px 0 0;
    background: rgb(255 255 255 / 0.82);
    box-shadow: 0 -1px 2px rgb(17 24 39 / 0.03), 0 -10px 28px -14px rgb(17 24 39 / 0.18);
    font-size: 13px;
    font-weight: 500;
    color: #374151;
  }

  .handle {
    display: block;
    width: 36px;
    height: 4px;
    border-radius: 9999px;
    background: #d1d5db;
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: rgb(17 24 39 / 0.24);
    animation: fade 200ms;
  }

  .sheet {
    position: absolute;
    inset: auto 0 0;
    display: flex;
    flex-direction: column;
    height: 82%;
    border-radius: 20px 20px 0 0;
    background: #fff;
    box-shadow: 0 -2px 8px rgb(17 24 39 / 0.06), 0 -16px 40px -12px rgb(17 24 39 / 0.18);
    animation: sheet 320ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sheet-handle {
    display: grid;
    flex: none;
    place-items: center;
    height: 24px;
    padding-top: 8px;
  }

  .sheet-body {
    flex: 1;
    min-height: 0;
  }

  @keyframes lift {
    from {
      transform: translateY(32px);
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      transform: translateY(6px);
      opacity: 0.5;
    }
  }

  @keyframes sheet {
    from {
      transform: translateY(100%);
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
