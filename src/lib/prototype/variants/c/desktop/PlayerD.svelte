<!-- PROTOTYPE（变体 C）：桌面全屏播放页。晨光底（primary-50）；左边封面和控制键，右边白色面板里是 歌词 / 播放队列。
  播放队列自带搜索框，和顶栏一样“打字即点亮”。 -->
<script lang='ts'>
  import { ChevronDown, Ellipsis, Heart } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, formatDuration } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import Controls from '../Controls.svelte'
  import FlatRange from '../FlatRange.svelte'
  import Lyrics from '../Lyrics.svelte'
  import QueuePanel from '../QueuePanel.svelte'
  import { ui } from '../ui.svelte'

  let showTranslation = $state(true)
  let showRomaji = $state(false)

  const s = $derived(player.current)

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !ui.menu && !(e.target as HTMLElement).closest('input'))
      nav.closePlayer()
  }
</script>

<svelte:window {onkeydown} />

<div class='fixed inset-0 z-50 flex flex-col bg-primary-50' role='dialog' aria-modal='true' aria-label='播放页'>
  <header class='h-16 flex shrink-0 items-center gap-3 px-6'>
    <button type='button' class='icon-btn' aria-label='收起播放页' onclick={() => nav.closePlayer()}>
      <ChevronDown size={22} aria-hidden='true' />
    </button>
    <p class='min-w-0 truncate text-sm text-neutral-600'>
      <span class='text-neutral-900 font-600'>正在播放</span><span class='mx-1.5 text-neutral-400'>·</span>来自「{player.source.name}」
    </p>
  </header>

  {#if s}
    <div class='grid mx-auto min-h-0 max-w-[1240px] w-full flex-1 grid-cols-[420px_minmax(0,1fr)] gap-16 px-12 pb-8 pt-2'>
      <section class='flex flex-col justify-center' aria-label='正在播放的歌曲'>
        <Cover cover={s.cover} eager alt='{s.album} 封面' class='w-[420px] rounded-2xl shadow-float' />
        <div class='mt-7 flex items-start gap-2'>
          <div class='min-w-0 flex-1'>
            <h1 class='truncate text-[22px] text-neutral-900 font-600 leading-8' lang={s.lang}>{s.title}</h1>
            <p class='mt-0.5 truncate text-sm text-neutral-600 leading-[22px]' lang={s.lang}>{artistLine(s)}<span class='mx-1.5 text-neutral-400'>·</span>{s.album}</p>
          </div>
          <button type='button' class='icon-btn' aria-label={s.liked ? '取消红心' : '红心'} aria-pressed={s.liked}>
            <Heart size={20} fill={s.liked ? 'currentColor' : 'none'} class={s.liked ? 'text-accent-600' : 'text-neutral-600'} aria-hidden='true' />
          </button>
          <button type='button' class='icon-btn' aria-label='更多操作' aria-haspopup='menu' onclick={e => ui.openMenu(s, e, false)}>
            <Ellipsis size={20} aria-hidden='true' />
          </button>
        </div>
        <div class='mt-4'>
          <FlatRange value={player.position} max={s.duration} label='播放进度' valueText='{formatDuration(player.position)} / {formatDuration(s.duration)}' oninput={v => player.seek(v)} />
          <div class='tnum mt-0.5 flex justify-between text-xs text-neutral-600'>
            <span>{formatDuration(player.position)}</span>
            <span>{formatDuration(s.duration)}</span>
          </div>
        </div>
        <div class='mt-5 px-4'>
          <Controls />
        </div>
      </section>

      <section class='panel min-h-0 flex flex-col rounded-2xl bg-white shadow-ambient' aria-label='歌词和播放队列'>
        <div class='h-14 flex shrink-0 items-center gap-6 px-6 shadow-[inset_0_-1px_0_#f3f4f6]'>
          <div class='h-full flex gap-6' role='tablist' aria-label='播放页面板'>
            <button type='button' role='tab' class='tab' class:on={nav.panel === 'lyrics'} aria-selected={nav.panel === 'lyrics'} onclick={() => (nav.panel = 'lyrics')}>歌词</button>
            <button type='button' role='tab' class='tab' class:on={nav.panel === 'queue'} aria-selected={nav.panel === 'queue'} onclick={() => (nav.panel = 'queue')}>
              播放队列<span class='tnum ml-1.5 text-xs text-neutral-500 font-400'>{player.queue.length.toLocaleString('en-US')}</span>
            </button>
          </div>
          {#if nav.panel === 'lyrics' && player.lyrics}
            <div class='ml-auto flex gap-1.5'>
              <button type='button' class='toggle' aria-pressed={showTranslation} onclick={() => (showTranslation = !showTranslation)}>翻译</button>
              <button type='button' class='toggle' aria-pressed={showRomaji} onclick={() => (showRomaji = !showRomaji)}>音译</button>
            </div>
          {/if}
        </div>
        <div class='min-h-0 flex-1' class:pt-4={nav.panel === 'queue'} role='tabpanel'>
          {#if nav.panel === 'lyrics'}
            <Lyrics {showTranslation} {showRomaji} />
          {:else}
            <QueuePanel />
          {/if}
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .icon-btn {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    color: #374151;
  }

  .tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    height: 100%;
    font-size: 15px;
    font-weight: 500;
    color: #4b5563;
  }

  .tab.on {
    color: #111827;
    font-weight: 600;
  }

  .tab.on::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    border-radius: 2px;
    background: #37be8c;
  }

  .toggle {
    height: 30px;
    padding: 0 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #4b5563;
    background: #f3f4f6;
  }

  .toggle[aria-pressed='true'] {
    background: #d1f1e3;
    color: #1a5b43;
  }

  @media (hover: hover) and (pointer: fine) {
    .icon-btn:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }

    .tab:not(.on):hover {
      color: #111827;
    }

    .toggle[aria-pressed='false']:hover {
      background: #e8f8f1;
    }
  }
</style>
