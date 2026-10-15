<!--
  歌曲的“更多”菜单（song-menu.svelte.ts，原型 SongMenu）。鼠标打开的是贴着锚点的浮动菜单：从锚点那一侧飘出来，关掉时淡出（DESIGN.md Overlays），
  点外面、滚动、换页都关上；触屏是底部弹层：和播放页同一套抽屉，按住拉手或上面的歌名往下拖、点按拉手或遮罩都收起，返回也先收起它。
  先放“下一首播放”“加入播放队列”，加入歌单、下载、查看歌手和专辑由之后的票加；无版权的歌、正在放的那首这两项不能选（放不进来、什么都不变）。
  键盘：打开时焦点落在第一项，↑/↓、Home/End 移动，Esc 关上并回到打开它的地方，Tab 离开时关上。放在 SignedInFrame 里，盖在播放页上面
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { Attachment } from 'svelte/attachments'
  import type { SongMenuRequest } from './song-menu.svelte'
  import { page } from '$app/state'
  import { ListEnd, ListStart } from '@lucide/svelte'
  import { getAppView } from './app-context.svelte'
  import Cover from './library/Cover.svelte'
  import { artistLine, langOf } from './library/view'
  import { pop } from './motion'
  import { createDrawer } from './player/drawer.svelte'
  import { currentSong } from './player/view'
  import { closeSongMenu, songMenu } from './song-menu.svelte'

  /** 浮动菜单离视口边至少这么远（px） */
  const MARGIN = 8
  /** 浮动菜单一项的高度和上下内边距（px）：还没画出来时按它估计高度，决定往下还是往上飘 */
  const FLOATING_ITEM = 36
  const FLOATING_PADDING = 12

  interface Item {
    label: string
    icon: LucideIcon
    disabled: boolean
    run: () => void
  }

  const view = getAppView()
  const request = $derived(songMenu.request)
  const floating = $derived(request?.anchor ? request : null)
  const sheetRequest = $derived(request && !request.anchor ? request : null)
  /** 底部弹层开着：浅路由也说开着 */
  const sheetOpen = $derived(sheetRequest !== null && page.state.songSheet === true)
  /** 收起的动画里还画着刚才那首 */
  let sheetShown = $state<SongMenuRequest | null>(null)
  /** 菜单本身（浮动菜单，或者底部弹层里的那一列）：在里面找菜单项 */
  let menu = $state<HTMLElement>()
  /** 底部弹层还没画出来时（打开的头一帧）按这么高算（px）：拉手、歌名和两项 */
  const drawer = createDrawer(() => 240)
  const gripSheet = drawer.grip({ from: 'open', commit: closeSongMenu, tap: closeSongMenu })

  $effect.pre(() => {
    if (sheetRequest)
      sheetShown = sheetRequest
  })

  $effect(() => drawer.settle(sheetOpen))

  // 返回手势、后退收起了底部弹层：菜单关上，焦点回到打开它的那个按钮
  $effect(() => {
    if (sheetRequest && !page.state.songSheet) {
      const { from } = sheetRequest
      songMenu.request = null
      if (from?.isConnected)
        from.focus({ preventScroll: true })
    }
  })

  // 浮动菜单：点外面（打开它的那个按钮除外：再点一下是关上）、滚动、窗口变了、换页都关上，焦点留在点到的地方
  $effect(() => {
    if (!floating)
      return
    const from = floating.from
    const dismiss = () => {
      if (songMenu.request === floating)
        songMenu.request = null
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu?.contains(target) && !from?.contains(target))
        dismiss()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', dismiss, { capture: true, passive: true })
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', dismiss, { capture: true })
      window.removeEventListener('resize', dismiss)
    }
  })

  $effect(() => {
    void page.url.pathname
    return () => {
      if (songMenu.request?.anchor)
        songMenu.request = null
    }
  })

  function itemsOf({ song, source }: SongMenuRequest): Item[] {
    const unchanged = song.availability === 'noCopyright' || currentSong(view.state.player)?.id === song.id
    return [
      { label: '下一首播放', icon: ListStart, disabled: unchanged, run: () => view.app.playNext(source, song) },
      { label: '加入播放队列', icon: ListEnd, disabled: unchanged, run: () => view.app.addToQueue(source, song) },
    ]
  }

  function choose(item: Item) {
    item.run()
    closeSongMenu()
  }

  const enabled = () => [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])]

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSongMenu()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      closeSongMenu()
      return
    }
    const list = enabled()
    const at = list.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      list[(at + step + list.length) % list.length]?.focus()
    }
    else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      ;(event.key === 'Home' ? list[0] : list.at(-1))?.focus()
    }
  }

  /** 打开时焦点落在第一项能选的；一项都不能选时落在菜单上，Esc 照样能关 */
  const focusFirst: Attachment<HTMLElement> = (node) => {
    queueMicrotask(() => (enabled()[0] ?? node).focus({ preventScroll: true }))
  }

  /** 菜单在锚点下面放得下（按估计的高度）：往下飘，放不下就翻到锚点上面 */
  function fitsBelow(anchor: NonNullable<SongMenuRequest['anchor']>, items: number): boolean {
    return anchor.y + FLOATING_PADDING + items * FLOATING_ITEM <= window.innerHeight - MARGIN
  }

  /** 摆好浮动菜单：贴着锚点，不出视口 */
  const place: Attachment<HTMLElement> = (node) => {
    const anchor = floating!.anchor!
    const below = anchor.y + node.offsetHeight <= window.innerHeight - MARGIN
    const left = Math.min(Math.max(MARGIN, anchor.end ? anchor.x - node.offsetWidth : anchor.x), window.innerWidth - node.offsetWidth - MARGIN)
    node.style.left = `${left}px`
    node.style.top = `${below ? anchor.y : Math.max(MARGIN, anchor.top - node.offsetHeight)}px`
    node.style.transformOrigin = `${anchor.end ? 'right' : 'left'} ${below ? 'top' : 'bottom'}`
  }
</script>

{#if floating}
  {@const items = itemsOf(floating)}
  <div
    bind:this={menu}
    class='fixed z-60 w-62 rounded-xl bg-white p-1.5 shadow-float outline-none'
    role='menu'
    tabindex='-1'
    aria-label='更多操作：{floating.song.name}'
    {onkeydown}
    {@attach place}
    {@attach focusFirst}
    in:pop={{ below: fitsBelow(floating.anchor!, items.length) }}
    out:pop={{ below: true }}
  >
    {#each items as item (item.label)}
      <button
        type='button'
        role='menuitem'
        tabindex='-1'
        class='h-9 w-full flex items-center gap-3 rounded-lg px-3 text-left text-label text-neutral-900 outline-none transition-colors duration-feedback disabled:(cursor-not-allowed opacity-45) focus-visible:bg-primary-100 mouse:enabled:hover:bg-primary-50'
        disabled={item.disabled}
        onclick={() => choose(item)}
      >
        <item.icon size={18} class='flex-none text-neutral-600' aria-hidden='true' />{item.label}
      </button>
    {/each}
  </div>
{/if}

{#if sheetShown && (sheetOpen || drawer.visible)}
  {@const { song } = sheetShown}
  <button type='button' class='fixed inset-0 z-60 bg-neutral-900/30' style:opacity={1 - drawer.position} aria-label='关闭菜单' tabindex='-1' onclick={closeSongMenu}></button>
  <div
    class='fixed inset-x-0 z-61 rounded-t-sheet bg-white px-2 pt-1 shadow-float'
    {@attach drawer.panel}
    role='dialog'
    tabindex='-1'
    aria-modal='true'
    aria-label='更多操作：{song.name}'
    inert={!sheetOpen}
    {onkeydown}
  >
    <div class='touch-none' {@attach gripSheet}>
      <div class='grid h-6 place-items-center' aria-hidden='true'>
        <span class='h-1 w-9 rounded-full bg-neutral-300'></span>
      </div>
      <div class='flex items-center gap-3 px-4 pb-3 pt-1'>
        <Cover url={song.album.coverUrl} size={48} class='rounded-md' />
        <div class='min-w-0'>
          <p class='truncate text-body text-neutral-900 font-500' lang={langOf(song.name)}>{song.name}</p>
          <p class='truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</p>
        </div>
      </div>
    </div>
    <div class='mx-4 mb-1 h-px bg-neutral-100' aria-hidden='true'></div>
    <div bind:this={menu} class='pb-3 outline-none' role='menu' tabindex='-1' aria-label='更多操作：{song.name}' {@attach focusFirst}>
      {#each itemsOf(sheetShown) as item (item.label)}
        <button
          type='button'
          role='menuitem'
          tabindex='-1'
          class='h-13 w-full flex items-center gap-4 rounded-lg px-4 text-left text-body text-neutral-900 outline-none focus-visible:bg-primary-100 disabled:opacity-45 enabled:active:bg-primary-100'
          disabled={item.disabled}
          onclick={() => choose(item)}
        >
          <item.icon size={20} class='flex-none text-neutral-600' aria-hidden='true' />{item.label}
        </button>
      {/each}
    </div>
  </div>
{/if}
