<!-- PROTOTYPE（变体 C）：歌曲的操作菜单。桌面是跟着 ••• 或右键位置弹出的浮层，手机是底部弹层；内容相同。 -->
<script lang='ts'>
  import type { Component } from 'svelte'
  import { Disc3, Download, Heart, ListMusic, ListPlus, ListStart, MicVocal } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine } from '$lib/prototype/data'
  import { player } from '$lib/prototype/player.svelte'
  import { ui } from './ui.svelte'

  let box = $state<HTMLElement>()
  let pos = $state({ left: 0, top: 0 })

  const menu = $derived(ui.menu)

  interface Action {
    label: string
    icon: Component<any>
    run: () => void
    tone?: 'accent'
  }

  const actions = $derived.by<Action[]>(() => {
    const s = menu?.song
    if (!s)
      return []
    return [
      { label: '下一首播放', icon: ListStart, run: () => player.playNext(s) },
      { label: '加入播放队列', icon: ListPlus, run: () => player.enqueue(s) },
      { label: '加入歌单', icon: ListMusic, run: () => {} },
      { label: s.download === 'done' ? '已下载' : '下载', icon: Download, run: () => {} },
      { label: '查看歌手', icon: MicVocal, run: () => {} },
      { label: '查看专辑', icon: Disc3, run: () => {} },
      { label: s.liked ? '取消红心' : '红心', icon: Heart, run: () => {}, tone: 'accent' },
    ]
  })

  function run(a: Action) {
    a.run()
    ui.closeMenu()
  }

  // 浮层放进视口内；打开后焦点落在第一项
  $effect(() => {
    if (!menu || !box)
      return
    const r = box.getBoundingClientRect()
    if (!menu.sheet) {
      const left = Math.min(menu.alignEnd ? menu.x - r.width : menu.x, window.innerWidth - r.width - 8)
      const top = menu.y + r.height > window.innerHeight - 8 ? Math.max(8, menu.y - r.height - 8) : menu.y
      pos = { left: Math.max(8, left), top }
    }
    box.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
  })

  function onkeydown(e: KeyboardEvent) {
    if (!box)
      return
    const items = [...box.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      ui.closeMenu()
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(i + 1) % items.length]?.focus()
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(i - 1 + items.length) % items.length]?.focus()
    }
    else if (e.key === 'Tab') {
      ui.closeMenu()
    }
  }
</script>

{#if menu}
  <!-- 点外面关闭 -->
  <div
    class='fixed inset-0 z-[80]'
    class:scrim={menu.sheet}
    aria-hidden='true'
    onclick={() => ui.closeMenu()}
    oncontextmenu={(e) => {
      e.preventDefault()
      ui.closeMenu()
    }}
  ></div>
  {#if menu.sheet}
    <div
      bind:this={box}
      class='sheet fixed inset-x-0 bottom-0 z-[81] rounded-t-2xl bg-white pb-[max(12px,env(safe-area-inset-bottom))] shadow-float'
      role='menu'
      tabindex='-1'
      aria-label='{menu.song.title} 的操作'
      {onkeydown}
    >
      <div class='mx-auto mt-2 h-1 w-9 rounded-full bg-neutral-300' aria-hidden='true'></div>
      <div class='flex items-center gap-3 px-4 pb-3 pt-3'>
        <Cover cover={menu.song.cover} class='size-12 shrink-0 rounded-lg' />
        <div class='min-w-0'>
          <p class='truncate text-[15px] text-neutral-900 font-500 leading-[22px]' lang={menu.song.lang}>{menu.song.title}</p>
          <p class='truncate text-[13px] text-neutral-600 leading-5' lang={menu.song.lang}>{artistLine(menu.song)}</p>
        </div>
      </div>
      <div class='mx-4 h-px bg-neutral-100'></div>
      <div class='py-1'>
        {#each actions as a (a.label)}
          <button type='button' role='menuitem' class='item phone' onclick={() => run(a)}>
            <a.icon size={20} class={a.tone === 'accent' ? 'text-accent-600' : 'text-neutral-600'} fill={a.tone === 'accent' ? 'currentColor' : 'none'} aria-hidden='true' />
            <span>{a.label}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <div
      bind:this={box}
      class='fixed z-[81] w-[208px] rounded-xl bg-white py-1.5 shadow-float'
      style:left='{pos.left}px'
      style:top='{pos.top}px'
      role='menu'
      tabindex='-1'
      aria-label='{menu.song.title} 的操作'
      {onkeydown}
    >
      {#each actions as a, i (a.label)}
        {#if i === 4 || i === 6}<div class='mx-3 my-1 h-px bg-neutral-100' role='separator'></div>{/if}
        <button type='button' role='menuitem' class='item' onclick={() => run(a)}>
          <a.icon size={16} class={a.tone === 'accent' ? 'text-accent-600' : 'text-neutral-500'} fill={a.tone === 'accent' ? 'currentColor' : 'none'} aria-hidden='true' />
          <span>{a.label}</span>
        </button>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .scrim {
    background: rgb(17 24 39 / 0.32);
  }

  .item {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 14px;
    font-size: 13px;
    color: #111827;
    text-align: left;
    outline-offset: -2px;
  }

  .item.phone {
    height: 52px;
    gap: 16px;
    padding: 0 20px;
    font-size: 15px;
  }

  .item:focus-visible {
    background: #f5fcf9;
  }

  @media (hover: hover) and (pointer: fine) {
    .item:hover {
      background: #f5fcf9;
    }
  }
</style>
