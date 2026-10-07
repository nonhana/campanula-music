<!--
  PROTOTYPE：交互原型的“世界”：手机 / 桌面骨架、歌单页或曲库页、各种弹层、原型切换栏和面板。
  /prototype/dnd 和 /prototype/dnd/cover 共用它；封面页多一个 CoverFlow（换封面的三种流程）。
  - 选择模式压一条浅路由历史：手机的返回键先退出选择，再离开页面。
  - 离开歌单、切到后台、关页面前，把还在等待合并的排序立刻提交（flushPending）。
  - Esc：先关弹层，再退出选择。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { TestFileKind } from './cover/image'
  import { pushState } from '$app/navigation'
  import { page } from '$app/state'
  import { layout } from './layout.svelte'
  import LibraryPlaylists from './library/LibraryPlaylists.svelte'
  import { inSelectHistory, openLibrary, openPlaylist } from './nav'
  import AddToPlaylist from './overlays/AddToPlaylist.svelte'
  import ConfirmRemove from './overlays/ConfirmRemove.svelte'
  import PlaylistMenu from './overlays/PlaylistMenu.svelte'
  import SongMenu from './overlays/SongMenu.svelte'
  import Toasts from './overlays/Toasts.svelte'
  import DesktopPlaylist from './pages/DesktopPlaylist.svelte'
  import PhonePlaylist from './pages/PhonePlaylist.svelte'
  import ProtoPanel from './ProtoPanel.svelte'
  import PrototypeBar from './PrototypeBar.svelte'
  import PhoneActionBar from './selection/PhoneActionBar.svelte'
  import DesktopChrome from './shell/DesktopChrome.svelte'
  import MiniPlayer from './shell/MiniPlayer.svelte'
  import { api } from './api.svelte'
  import { settings } from './settings.svelte'
  import { dragStats, flushPending, library, selection, toast, tracksOf, ui, view } from './store.svelte'

  interface Props {
    /** 封面页：点封面、选“更换封面”时调用 */
    oncover?: () => void
    /** 封面页：后台上传的进度（0–1），用来在封面上画进度环 */
    coverBusy?: number | null
    /** 封面页：原型面板里的测试文件 */
    onTestFile?: (kind: TestFileKind) => void
    /** 封面流程自己的弹层 */
    children?: Snippet
  }

  const { oncover, coverBusy = null, onTestFile, children }: Props = $props()

  const phone = $derived(layout.phone)
  const pl = $derived(library.byId(view.pl))
  const list = $derived(pl ? tracksOf(pl.id).local : [])

  let plMenu = $state<null | { x: number, y: number, sheet: boolean }>(null)

  function openPlaylistMenu(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const touch = (e as PointerEvent).pointerType !== 'mouse'
    plMenu = { x: r.right, y: r.bottom + 4, sheet: phone && touch }
  }

  function startCover() {
    if (oncover)
      oncover()
    else toast('换封面的流程在 /prototype/dnd/cover 里试。')
  }

  // 选择模式 ↔ 浅路由历史
  $effect(() => {
    if (selection.mode && phone && !inSelectHistory())
      pushState('', { select: true })
  })

  $effect(() => {
    void page.state
    if (!inSelectHistory() && selection.mode && phone)
      selection.exit()
  })

  // 换歌单、换页面：先把等待合并的排序提交掉，再清掉选择
  let lastKey = `${view.screen}:${view.pl}`
  $effect(() => {
    const key = `${view.screen}:${view.pl}`
    if (key !== lastKey) {
      lastKey = key
      flushPending()
      selection.exit()
    }
  })

  function onvisibilitychange() {
    if (document.visibilityState === 'hidden')
      flushPending()
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.defaultPrevented)
      return
    if (ui.menu || ui.add || ui.confirmRemove || plMenu || ui.panel)
      return
    if (selection.mode || selection.size) {
      e.preventDefault()
      if (inSelectHistory())
        history.back()
      else selection.exit()
    }
  }

  const showActionBar = $derived(phone && selection.mode && view.screen === 'playlist')

  // PROTOTYPE：给自动截图和冒烟检查读状态用（只在开发模式）
  if (import.meta.env.DEV)
    (globalThis as Record<string, unknown>).__dnd = { dragStats, tracksOf, selection, library, settings, api, view, ui }
</script>

<svelte:window {onkeydown} onpagehide={flushPending} />
<svelte:document {onvisibilitychange} />

{#if phone}
  <div class='min-h-dvh bg-primary-50 pb-[calc(96px+env(safe-area-inset-bottom))]'>
    {#if view.screen === 'library'}
      <div class='sticky top-0 z-20 flex h-14 items-center bg-primary-50 px-4'>
        <span class='text-[18px] font-500 tracking-[-0.01em] text-neutral-900'>曲库</span>
      </div>
      <div class='flex gap-6 px-4 pb-2' role='tablist' aria-label='曲库分类'>
        {#each ['我喜欢', '歌单', '专辑', '歌手'] as t (t)}
          {@const on = t === '歌单'}
          <span class={['relative pb-2 text-[15px]', on ? 'font-600 text-neutral-900' : 'text-neutral-500']} role='tab' aria-selected={on}>
            {t}
            {#if on}<span class='absolute bottom-0 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-primary-700'></span>{/if}
          </span>
        {/each}
      </div>
      <LibraryPlaylists />
    {:else}
      {#key view.pl}
        <PhonePlaylist onback={openLibrary} onplaylistmenu={openPlaylistMenu} oncover={startCover} {coverBusy} />
      {/key}
    {/if}
    {#if showActionBar}
      <PhoneActionBar {list} />
    {:else}
      <MiniPlayer />
    {/if}
  </div>
{:else}
  <DesktopChrome onback={view.screen === 'playlist' ? openLibrary : undefined} onlibrary={openLibrary}>
    {#if view.screen === 'library'}
      <LibraryPlaylists />
    {:else}
      {#key view.pl}
        <DesktopPlaylist onopen={openPlaylist} onplaylistmenu={openPlaylistMenu} oncover={startCover} {coverBusy} />
      {/key}
    {/if}
  </DesktopChrome>
{/if}

<SongMenu />
<AddToPlaylist />
<ConfirmRemove />
{#if plMenu}
  <PlaylistMenu x={plMenu.x} y={plMenu.y} sheet={plMenu.sheet} onclose={() => (plMenu = null)} oncover={startCover} onedit={() => toast('编辑歌单信息不在这次原型里（视觉原型已经做过）。')} />
{/if}
{@render children?.()}
<Toasts />
<ProtoPanel {onTestFile} />
<PrototypeBar />
