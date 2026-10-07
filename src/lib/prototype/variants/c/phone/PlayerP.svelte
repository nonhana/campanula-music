<!-- PROTOTYPE（变体 C）：手机播放页（Auxio 的骨架，晨光底 primary-50）。
  顶部收起 / 正在播放 + 播放来源 / 歌词开关；大封面（或歌词）；歌名、歌手、专辑左对齐 + •••；扁平进度条；五个控制键；
  最下面是播放队列的底部弹层，上拉或轻点把手展开，弹层里自带搜索框。 -->
<script lang='ts'>
  import { ChevronDown, Ellipsis, MicVocal } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, formatDuration } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import Controls from '../Controls.svelte'
  import FlatRange from '../FlatRange.svelte'
  import Lyrics from '../Lyrics.svelte'
  import QueuePanel from '../QueuePanel.svelte'
  import { ui } from '../ui.svelte'

  let showLyrics = $state(false)
  let showTranslation = $state(true)
  let showRomaji = $state(false)

  const s = $derived(player.current)
  const sheetOpen = $derived(nav.panel === 'queue')
  const next = $derived(player.queue[player.index + 1])

  // 把手：轻点切换，上下拖动超过 40px 也切换（拖动后不再把随后的 click 当作轻点）
  let startY: number | null = null
  let dragged = false
  function down(e: PointerEvent) {
    startY = e.clientY
    dragged = false
  }
  function up(e: PointerEvent) {
    if (startY === null)
      return
    const dy = e.clientY - startY
    startY = null
    if (Math.abs(dy) > 40) {
      dragged = true
      nav.panel = dy < 0 ? 'queue' : 'lyrics'
    }
  }
  function toggleSheet() {
    if (dragged) {
      dragged = false
      return
    }
    nav.panel = sheetOpen ? 'lyrics' : 'queue'
  }
</script>

<div class='fixed inset-0 z-50 flex flex-col overflow-hidden bg-primary-50' role='dialog' aria-modal='true' aria-label='播放页'>
  <header class='grid grid-cols-[48px_minmax(0,1fr)_48px] h-14 shrink-0 items-center px-1.5'>
    <button type='button' class='icon' aria-label='收起播放页' onclick={() => nav.closePlayer()}><ChevronDown size={24} aria-hidden='true' /></button>
    <div class='min-w-0 text-center'>
      <p class='text-[15px] text-neutral-900 font-600 leading-5'>正在播放</p>
      <p class='truncate text-xs text-neutral-600 leading-[18px]'>来自「{player.source.name}」</p>
    </div>
    <button type='button' class='icon' class:on={showLyrics} aria-label='歌词' aria-pressed={showLyrics} onclick={() => (showLyrics = !showLyrics)}>
      <MicVocal size={22} aria-hidden='true' />
    </button>
  </header>

  {#if s}
    <div class='min-h-0 flex flex-1 flex-col px-4 pb-[88px]'>
      <div class='relative aspect-square max-h-full w-full shrink-0 self-center'>
        {#if showLyrics}
          <div class='absolute inset-0 flex flex-col overflow-hidden rounded-2xl bg-white shadow-ambient'>
            {#if player.lyrics}
              <div class='flex shrink-0 justify-end gap-1.5 px-3 pt-3'>
                <button type='button' class='toggle' aria-pressed={showTranslation} onclick={() => (showTranslation = !showTranslation)}>翻译</button>
                <button type='button' class='toggle' aria-pressed={showRomaji} onclick={() => (showRomaji = !showRomaji)}>音译</button>
              </div>
            {/if}
            <div class='min-h-0 flex-1'>
              <Lyrics {showTranslation} {showRomaji} phone />
            </div>
          </div>
        {:else}
          <Cover cover={s.cover} eager alt='{s.album} 封面' class='absolute inset-0 size-full rounded-2xl shadow-float' />
        {/if}
      </div>

      <div class='mt-auto pt-5'>
        <div class='flex items-start gap-1'>
          <div class='min-w-0 flex-1'>
            <h1 class='truncate text-[22px] text-neutral-900 font-600 leading-[30px]' lang={s.lang}>{s.title}</h1>
            <p class='truncate text-[15px] text-neutral-700 leading-[22px]' lang={s.lang}>{artistLine(s)}</p>
            <p class='truncate text-sm text-neutral-600 leading-5' lang={s.lang}>{s.album}</p>
          </div>
          <button type='button' class='icon -mr-2' aria-label='更多操作' aria-haspopup='menu' onclick={e => ui.openMenu(s, e, true)}><Ellipsis size={22} aria-hidden='true' /></button>
        </div>
        <div class='mt-3'>
          <FlatRange value={player.position} max={s.duration} label='播放进度' valueText='{formatDuration(player.position)} / {formatDuration(s.duration)}' thumb={16} oninput={v => player.seek(v)} />
          <div class='tnum flex justify-between text-xs text-neutral-600'>
            <span>{formatDuration(player.position)}</span>
            <span>{formatDuration(s.duration)}</span>
          </div>
        </div>
        <div class='mt-3'>
          <Controls phone />
        </div>
      </div>
    </div>
  {/if}

  <!-- 播放队列：底部弹层 -->
  {#if sheetOpen}
    <div class='scrim' aria-hidden='true' onclick={() => (nav.panel = 'lyrics')}></div>
  {/if}
  <section class='sheet' class:open={sheetOpen} aria-label='播放队列'>
    <button
      type='button'
      class='handle'
      aria-expanded={sheetOpen}
      onclick={toggleSheet}
      onpointerdown={down}
      onpointerup={up}
    >
      <span class='grip' aria-hidden='true'></span>
      <span class='text-[15px] text-neutral-900 font-600'>播放队列</span>
      {#if !sheetOpen && next}
        <span class='block max-w-full truncate px-6 text-xs text-neutral-600' lang={next.lang}>下一首：{next.title}</span>
      {/if}
    </button>
    {#if sheetOpen}
      <div class='min-h-0 flex-1'>
        <QueuePanel phone />
      </div>
    {/if}
  </section>
</div>

<style>
  .icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    color: #1f2937;
  }

  .icon.on {
    background: #d1f1e3;
    color: #1a5b43;
  }

  .toggle {
    height: 32px;
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

  .scrim {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: rgb(17 24 39 / 0.24);
  }

  .sheet {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    height: 76px;
    border-radius: 20px 20px 0 0;
    background: #fff;
    box-shadow: 0 -2px 8px rgb(17 24 39 / 0.04), 0 -16px 40px -12px rgb(17 24 39 / 0.16);
    transition: height 320ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sheet.open {
    height: calc(100% - 64px);
  }

  .handle {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    gap: 2px;
    width: 100%;
    padding: 8px 0 10px;
    touch-action: none;
  }

  .grip {
    width: 36px;
    height: 4px;
    margin-bottom: 6px;
    border-radius: 999px;
    background: #d1d5db;
  }
</style>
