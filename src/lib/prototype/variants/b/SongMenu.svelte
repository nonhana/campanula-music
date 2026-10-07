<!--
  PROTOTYPE · 歌曲的 ••• 菜单。桌面是贴着点击位置的浮层（右键同样打开），手机是底部弹层。
  ↑/↓ 在菜单项之间移动，Esc 关闭。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine } from '$lib/prototype/data'
  import { Disc3, Download, Heart, ListEnd, ListMusic, ListPlus, MicVocal } from '@lucide/svelte'
  import { ui } from './ui.svelte'

  interface Props {
    phone: boolean
  }

  const { phone }: Props = $props()

  let panel = $state<HTMLElement>()
  let pw = $state(232)
  let ph = $state(0)

  const menu = $derived(ui.menu)
  const left = $derived(menu ? Math.max(8, Math.min(menu.x - (menu.x > window.innerWidth - pw - 8 ? pw : 0), window.innerWidth - pw - 8)) : 0)
  const top = $derived(menu ? Math.max(8, menu.y + ph > window.innerHeight - 8 ? menu.y - ph - 8 : menu.y) : 0)

  $effect(() => {
    if (menu && panel)
      panel.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  })

  function run(action: () => void) {
    action()
    ui.closeMenu()
  }

  function onkeydown(e: KeyboardEvent) {
    if (!ui.menu)
      return
    if (e.key === 'Escape') {
      e.preventDefault()
      ui.closeMenu()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')
      return
    const items = [...(panel?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length
    items[next]?.focus()
    e.preventDefault()
  }

  function onpointerdown(e: PointerEvent) {
    if (ui.menu && panel && !panel.contains(e.target as Node))
      ui.closeMenu()
  }
</script>

<svelte:window {onkeydown} onresize={() => ui.closeMenu()} />
<svelte:document {onpointerdown} />

{#if menu}
  {@const song = menu.song}
  {@const liked = ui.liked(song)}
  {#snippet items()}
    <button type='button' role='menuitem' onclick={() => run(() => ui.playNext(song))}>
      <ListEnd size={18} strokeWidth={2} /><span>下一首播放</span>
    </button>
    <button type='button' role='menuitem' onclick={() => run(() => ui.enqueue(song))}>
      <ListPlus size={18} strokeWidth={2} /><span>加入播放队列</span>
    </button>
    <button type='button' role='menuitem' onclick={() => run(() => {})}>
      <ListMusic size={18} strokeWidth={2} /><span>加入歌单</span>
    </button>
    <button type='button' role='menuitem' disabled={song.download === 'done' || song.trial} onclick={() => run(() => {})}>
      <Download size={18} strokeWidth={2} />
      <span>{song.download === 'done' ? '已下载' : song.download === 'failed' ? '重新下载' : '下载'}</span>
      {#if song.trial}<small>试听片段不能下载</small>{/if}
    </button>
    <hr />
    <button type='button' role='menuitem' onclick={() => run(() => {})}>
      <MicVocal size={18} strokeWidth={2} /><span>查看歌手</span>
    </button>
    <button type='button' role='menuitem' onclick={() => run(() => {})}>
      <Disc3 size={18} strokeWidth={2} /><span>查看专辑</span>
    </button>
    <hr />
    <button type='button' role='menuitem' class='heart' onclick={() => run(() => ui.toggleHeart(song))}>
      <Heart size={18} strokeWidth={2} fill={liked ? 'currentColor' : 'none'} class={liked ? 'on' : ''} />
      <span>{liked ? '取消红心' : '红心'}</span>
    </button>
  {/snippet}

  {#if phone}
    <div class='scrim' aria-hidden='true'></div>
    <div class='sheet' role='menu' aria-label='歌曲操作' bind:this={panel}>
      <div class='handle' aria-hidden='true'></div>
      <div class='head'>
        <Cover cover={song.cover} class='head-cover' />
        <div class='head-text'>
          <p class='head-title' lang={song.lang}>{song.title}</p>
          <p class='head-artist' lang={song.lang}>{artistLine(song)}</p>
        </div>
      </div>
      {@render items()}
    </div>
  {:else}
    <div
      class='pop'
      role='menu'
      aria-label='歌曲操作：{song.title}'
      bind:this={panel}
      bind:offsetWidth={pw}
      bind:offsetHeight={ph}
      style:left='{left}px'
      style:top='{top}px'
    >
      {@render items()}
    </div>
  {/if}
{/if}

<style>
  .pop {
    position: fixed;
    z-index: 80;
    width: 232px;
    padding: 6px;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
    animation: pop-in 160ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  [role='menuitem'] {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 36px;
    padding: 0 10px;
    border-radius: 8px;
    font-size: 14px;
    color: #1f2937;
    text-align: left;
  }

  [role='menuitem'] :global(svg) {
    flex: none;
    color: #4b5563;
  }

  [role='menuitem']:disabled {
    color: #9ca3af;
  }

  [role='menuitem']:disabled :global(svg) {
    color: #9ca3af;
  }

  [role='menuitem'] small {
    margin-left: auto;
    font-size: 11px;
    color: #6b7280;
  }

  .heart :global(.on) {
    color: #ff3040;
  }

  [role='menuitem']:focus-visible {
    outline: none;
    background: #e8f8f1;
    color: #1a5b43;
  }

  hr {
    margin: 4px 10px;
    border: 0;
    border-top: 1px solid #f3f4f6;
  }

  .scrim {
    position: fixed;
    inset: 0;
    z-index: 79;
    background: rgb(17 24 39 / 0.28);
    animation: fade-in 200ms;
  }

  .sheet {
    position: fixed;
    inset: auto 0 0;
    z-index: 80;
    padding: 8px 8px calc(12px + env(safe-area-inset-bottom));
    border-radius: 20px 20px 0 0;
    background: #fff;
    box-shadow: 0 -2px 8px rgb(17 24 39 / 0.06), 0 -16px 40px -12px rgb(17 24 39 / 0.18);
    animation: sheet-in 280ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sheet [role='menuitem'] {
    height: 50px;
    padding: 0 16px;
    font-size: 15px;
    gap: 16px;
  }

  .sheet hr {
    margin: 4px 16px;
  }

  .handle {
    width: 36px;
    height: 4px;
    margin: 0 auto 8px;
    border-radius: 9999px;
    background: #d1d5db;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 16px 12px;
    margin-bottom: 4px;
    border-bottom: 1px solid #f3f4f6;
  }

  .head :global(.head-cover) {
    width: 48px;
    height: 48px;
    flex: none;
    border-radius: 8px;
  }

  .head-text {
    min-width: 0;
  }

  .head-title,
  .head-artist {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .head-title {
    font-size: 15px;
    line-height: 22px;
    font-weight: 500;
    color: #111827;
  }

  .head-artist {
    font-size: 13px;
    line-height: 19px;
    color: #4b5563;
  }

  @media (hover: hover) and (pointer: fine) {
    [role='menuitem']:not(:disabled):hover {
      background: #f3f4f6;
    }
  }

  @keyframes pop-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
  }

  @keyframes sheet-in {
    from {
      transform: translateY(100%);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
</style>
