<!--
  PROTOTYPE：歌曲的 ••• 菜单。桌面是贴着指针/按钮的浮层（右键同一份），手机是底部弹层；
  窄窗口里用鼠标右键时也用浮层（按输入方式切换，不按宽度）。未登录时只有播放、加入播放队列、删除下载。
  键盘：打开后焦点落在第一项，↑/↓ 移动，Esc 关闭并把焦点还给触发它的元素。
-->
<script lang='ts'>
  import { albumIdOf, artistIdOf } from '$lib/prototype/catalog'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { CircleArrowDown, Disc3, Heart, ListEnd, ListPlus, ListStart, Play, Trash2, UserRound } from '@lucide/svelte'
  import { fade, fly } from 'svelte/transition'
  import { ui } from './state.svelte'

  interface Props {
    phone: boolean
  }

  const { phone }: Props = $props()

  const req = $derived(ui.menu)
  /** 底部弹层只给手机布局里的触屏操作；鼠标右键用浮层 */
  const sheet = $derived(phone && (req?.sheet ?? true))
  let box = $state<HTMLElement>()
  let w = $state(232)
  let h = $state(320)

  const pos = $derived.by(() => {
    if (!req)
      return { left: 0, top: 0 }
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = req.x - w
    if (left < 8)
      left = Math.min(req.x, vw - w - 8)
    let top = req.y
    if (top + h > vh - 8)
      top = Math.max(8, req.y - h - 8)
    return { left, top }
  })

  function items() {
    return box ? [...box.querySelectorAll<HTMLElement>('[role="menuitem"]')] : []
  }

  function focusFirst(node: HTMLElement) {
    queueMicrotask(() => node.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true }))
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      ui.closeMenu()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End')
      return
    e.preventDefault()
    const list = items()
    const i = list.indexOf(document.activeElement as HTMLElement)
    let next = 0
    if (e.key === 'ArrowDown')
      next = (i + 1) % list.length
    else if (e.key === 'ArrowUp')
      next = (i - 1 + list.length) % list.length
    else if (e.key === 'End')
      next = list.length - 1
    list[next]?.focus()
  }

  function run(action: () => void) {
    action()
    ui.closeMenu()
  }
</script>

{#snippet menuItems()}
  {@const song = req!.song}
  {@const liked = ui.isLiked(song)}
  {@const rowClass = sheet
    ? 'mrow flex h-13 w-full items-center gap-4 rounded-xl px-4 text-left text-[15px] text-neutral-900 active:bg-primary-100 focus-visible:bg-primary-100 disabled:opacity-45'
    : 'mrow menu-item flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] text-neutral-900 focus-visible:(bg-primary-100 outline-none) disabled:opacity-45'}
  {@const sepClass = sheet ? 'mx-4 my-1 h-px bg-neutral-100' : 'mx-3 my-1 h-px bg-neutral-100'}
  {#if nav.loggedOut}
    <button role='menuitem' class={rowClass} onclick={() => run(() => req?.onplay?.())}>
      <Play size={18} class='text-neutral-600' aria-hidden='true' />播放
    </button>
    <button role='menuitem' class={rowClass} onclick={() => run(() => player.enqueue(song))}>
      <ListEnd size={18} class='text-neutral-600' aria-hidden='true' />加入播放队列
    </button>
    <div class={sepClass} role='separator'></div>
    <button role='menuitem' class={rowClass} onclick={() => run(() => ui.removed.add(song.id))}>
      <Trash2 size={18} class='text-error-700' aria-hidden='true' /><span class='text-error-700'>删除下载</span>
    </button>
  {:else}
    <button role='menuitem' class={rowClass} onclick={() => run(() => player.playNext(song))}>
      <ListStart size={18} class='text-neutral-600' aria-hidden='true' />下一首播放
    </button>
    <button role='menuitem' class={rowClass} onclick={() => run(() => player.enqueue(song))}>
      <ListEnd size={18} class='text-neutral-600' aria-hidden='true' />加入播放队列
    </button>
    <button role='menuitem' class={rowClass} onclick={() => run(() => {})}>
      <ListPlus size={18} class='text-neutral-600' aria-hidden='true' />加入歌单
    </button>
    <button role='menuitem' class={rowClass} onclick={() => run(() => ui.toggleLike(song))}>
      <Heart size={18} class={liked ? 'text-accent-600' : 'text-neutral-600'} fill={liked ? 'currentColor' : 'none'} aria-hidden='true' />
      {liked ? '取消红心' : '红心'}
    </button>
    <div class={sepClass} role='separator'></div>
    {#if req!.context === 'downloads'}
      <button role='menuitem' class={rowClass} onclick={() => run(() => ui.removed.add(song.id))}>
        <Trash2 size={18} class='text-error-700' aria-hidden='true' /><span class='text-error-700'>删除下载</span>
      </button>
    {:else}
      <button role='menuitem' class={rowClass} disabled={song.download === 'done' || song.trial} onclick={() => run(() => {})}>
        <CircleArrowDown size={18} class='text-secondary-800' aria-hidden='true' />
        {song.download === 'done' ? '已下载' : song.trial ? '试听歌曲不能下载' : song.download === 'failed' ? '重新下载' : '下载'}
      </button>
    {/if}
    <button role='menuitem' class={rowClass} onclick={() => run(() => nav.openArtist(artistIdOf(song.artists[0])))}>
      <UserRound size={18} class='text-neutral-600' aria-hidden='true' />
      <span class='min-w-0 truncate'>查看歌手<span class='ml-2 text-neutral-500' lang={song.lang}>{artistLine(song)}</span></span>
    </button>
    <button role='menuitem' class={rowClass} onclick={() => run(() => nav.openAlbum(albumIdOf(song)))}>
      <Disc3 size={18} class='text-neutral-600' aria-hidden='true' />
      <span class='min-w-0 truncate'>查看专辑<span class='ml-2 text-neutral-500' lang={song.lang}>{song.album}</span></span>
    </button>
  {/if}
{/snippet}

{#if req}
  {#if sheet}
    <div class='fixed inset-0 z-[70]' role='presentation'>
      <button
        class='absolute inset-0 bg-neutral-900/30'
        aria-label='关闭菜单'
        tabindex='-1'
        onclick={() => ui.closeMenu()}
        transition:fade={{ duration: 180 }}
      ></button>
      <div
        bind:this={box}
        class='absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-2 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-float'
        role='menu'
        tabindex='-1'
        aria-label='歌曲操作'
        {onkeydown}
        {@attach focusFirst}
        transition:fly={{ y: 320, duration: 320, opacity: 1, easing: t => 1 - (1 - t) ** 4 }}
      >
        <div class='mx-auto mb-2 h-1 w-9 rounded-full bg-neutral-300' aria-hidden='true'></div>
        <div class='flex items-center gap-3 px-4 pt-1 pb-3'>
          <Cover cover={req.song.cover} class='size-12 flex-none rounded-lg' />
          <div class='min-w-0'>
            <p class='truncate text-[15px] font-500 text-neutral-900' lang={req.song.lang}>{req.song.title}</p>
            <p class='truncate text-[13px] text-neutral-600' lang={req.song.lang}>{artistLine(req.song)}</p>
          </div>
        </div>
        <div class='mx-4 mb-1 h-px bg-neutral-100'></div>
        {@render menuItems()}
      </div>
    </div>
  {:else}
    <div
      class='fixed inset-0 z-[70]'
      role='presentation'
      onclick={() => ui.closeMenu()}
      oncontextmenu={(e) => {
        e.preventDefault()
        ui.closeMenu()
      }}
    ></div>
    <div
      bind:this={box}
      bind:offsetWidth={w}
      bind:offsetHeight={h}
      class='fixed z-[71] w-[248px] rounded-xl bg-white p-1.5 shadow-float'
      style:left='{pos.left}px'
      style:top='{pos.top}px'
      role='menu'
      tabindex='-1'
      aria-label='歌曲操作'
      {onkeydown}
      {@attach focusFirst}
      transition:fly={{ y: -4, duration: 160, easing: t => 1 - (1 - t) ** 3 }}
    >
      {@render menuItems()}
    </div>
  {/if}
{/if}

<style>
  /* 文字很长时图标不被挤小 */
  .mrow > :global(svg) {
    flex: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .menu-item:hover {
      background: #f5fcf9;
    }
  }
</style>
