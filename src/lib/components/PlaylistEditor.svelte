<!--
  歌单编辑的外壳（playlist-edit.svelte.ts 的 playlistEditor；里面的内容是 PlaylistEditorPanel）：新建、编辑歌单信息、改为公开、删除。
  桌面是居中弹窗（DESIGN.md Overlays · 弹窗：遮罩淡入，弹窗从下面 8px、98% 大小飘到位，关掉时淡出），点遮罩、关闭键、Esc 关上；
  手机是底部弹层，和播放页同一套抽屉：拉手、标题按住往下拖收起，点遮罩、返回、Esc 也收起。表单是接近全屏的弹层，确认贴着底边。
  正在等网易云建好新歌单时关不掉：拖下去会弹回来，返回会再压回那条浅路由（只有零点几秒）。
  开着时后面的骨架和播放页都不能操作（SignedInFrame 设 inert），打开时焦点落在名称输入框（确认时落在取消上），关上后回到打开它的地方。
  放在 SignedInFrame 里，盖在所有东西上面；换封面的裁剪页（CoverEditor）盖在它上面
-->
<script lang='ts'>
  import type { Attachment } from 'svelte/attachments'
  import type { EditorRequest } from './playlist-edit.svelte'
  import { page } from '$app/state'
  import { coverEditor } from './cover-edit.svelte'
  import { dialog, fade } from './motion'
  import { DURATIONS } from './motion-tokens'
  import { createDrawer } from './player/drawer.svelte'
  import { playlistEditor } from './playlist-edit.svelte'
  import PlaylistEditorPanel from './PlaylistEditorPanel.svelte'
  import { pushShallowState } from './shallow-state'

  /** 确认弹层还没画出来时（打开的头一帧）按多高算（px） */
  const CONFIRM_SHEET_ESTIMATE = 320

  const request = $derived(playlistEditor.request)
  /** 换封面的裁剪页盖在上面：下面的编辑不能操作 */
  const behindCover = $derived(coverEditor.request !== null)
  /** 关上的动画里还画着刚才那一个 */
  let shown = $state<EditorRequest | null>(null)
  $effect.pre(() => {
    if (request)
      shown = request
  })
  const form = $derived(shown?.mode === 'new' || shown?.mode === 'info')

  const dialogOpen = $derived(request !== null && !playlistEditor.sheet)
  /** 底部弹层开着：浅路由也说开着 */
  const sheetOpen = $derived(request !== null && playlistEditor.sheet && page.state.editorSheet === true)
  const drawer = createDrawer(() => (form ? window.innerHeight - 24 : CONFIRM_SHEET_ESTIMATE))
  /** 拖过了阈值：收起；正在新建时弹回去 */
  function commit() {
    if (playlistEditor.busy)
      drawer.settle(true)
    else
      playlistEditor.close()
  }
  const gripHandle = drawer.grip({ from: 'open', commit, tap: () => playlistEditor.close() })
  const gripTitle = drawer.grip({ from: 'open', commit })

  $effect(() => drawer.settle(sheetOpen))

  /** 浅路由已经说过开着的那一次：压浏览记录要等一会儿，刚打开的那一下它还没说开着，不算收起 */
  let acknowledged: EditorRequest | null = null
  // 返回手势、后退收起了底部弹层：关上，焦点回到打开它的地方；正在新建时再压回那条浅路由
  $effect(() => {
    if (!request || !playlistEditor.sheet)
      return
    if (page.state.editorSheet)
      acknowledged = request
    else if (acknowledged === request && playlistEditor.busy)
      pushShallowState({ ...page.state, editorSheet: true })
    else if (acknowledged === request)
      playlistEditor.dismiss(request)
  })

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape')
      return
    event.preventDefault()
    playlistEditor.close()
  }

  /** 打开时焦点落在标了 data-autofocus 的地方（名称输入框、确认时的取消），没有就是第一个能操作的 */
  const focusFirst: Attachment<HTMLElement> = (node) => {
    queueMicrotask(() => (node.querySelector<HTMLElement>('[data-autofocus]') ?? node.querySelector<HTMLElement>('input, textarea, button'))?.focus({ preventScroll: true }))
  }
</script>

{#if dialogOpen && shown}
  <button type='button' class='fixed inset-0 z-70 bg-neutral-900/35' aria-label='关闭' tabindex='-1' onclick={() => playlistEditor.close()} transition:fade={{ duration: DURATIONS.state }}></button>
  <div class='pointer-events-none fixed inset-0 z-71 grid place-items-center p-6'>
    <div
      class={['pointer-events-auto max-h-[calc(100dvh-48px)] w-full flex flex-col rounded-xl bg-white shadow-float', shown.mode === 'info' ? 'max-w-[680px]' : shown.mode === 'new' ? 'max-w-[480px]' : 'max-w-[440px]']}
      role='dialog'
      aria-modal='true'
      aria-labelledby='playlist-editor-title'
      tabindex='-1'
      inert={behindCover}
      {onkeydown}
      {@attach focusFirst}
      transition:dialog
    >
      {#key shown}<PlaylistEditorPanel request={shown} sheet={false} />{/key}
    </div>
  </div>
{/if}

{#if shown && playlistEditor.sheet && (sheetOpen || drawer.visible)}
  <button type='button' class='fixed inset-0 z-70 bg-neutral-900/30' style:opacity={1 - drawer.position} aria-label='关闭' tabindex='-1' onclick={() => playlistEditor.close()}></button>
  <div
    class={['fixed inset-x-0 z-71 flex flex-col rounded-t-sheet bg-white shadow-float', form && 'top-6']}
    {@attach drawer.panel}
    role='dialog'
    tabindex='-1'
    aria-modal='true'
    aria-labelledby='playlist-editor-title'
    inert={!sheetOpen || behindCover}
    {onkeydown}
    {@attach focusFirst}
  >
    <div class='grid h-6 flex-none touch-none place-items-center' aria-hidden='true' {@attach gripHandle}>
      <span class='h-1 w-9 rounded-full bg-neutral-300'></span>
    </div>
    {#key shown}<PlaylistEditorPanel request={shown} sheet grip={gripTitle} />{/key}
  </div>
{/if}
