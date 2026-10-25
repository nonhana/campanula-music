<!--
  桌面多选工具条（原型 DesktopPlaylist 的多选行）：盖在列表面板的表头上。左边“已选 N 首”、全选 / 全不选，右边对勾选的歌做的事，最后是取消选择（Esc）。
  能做什么由多选模块按列表种类给出（#66）：歌单里加入歌单，自建歌单还能移除；已下载页只有导出和删除（#79），浏览器不能选文件夹时没有导出（ADR-0014）。
  歌单页和已下载页共用，这里只是视图。
-->
<script lang='ts'>
  import { CheckCheck, CircleArrowDown, FolderDown, ListChecks, ListMinus, ListPlus, SquareMinus, Trash2, X } from '@lucide/svelte'

  import { anchorBelow } from '../menu/menu-anchor'
  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import { formatCount } from '../shared/text'

  const { multiSelect: selection } = getOverlays()
  const view = getAppView()
  const can = $derived(selection.capabilities)
  const none = $derived(selection.picked.length === 0)
  const offline = $derived(!view.state.online)
  const ACTION = 'h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-caption font-500 transition-colors duration-feedback disabled:opacity-45 mouse:enabled:hover:bg-primary-100'
</script>

<div class='h-9 flex items-center gap-1.5 rounded-lg bg-primary-50 pl-3 pr-1' role='toolbar' aria-label='对选中的歌'>
  <span class='inline-flex flex-none items-center gap-1.5 text-caption text-neutral-900 font-500 tabular-nums' role='status'>
    <ListChecks size={14} aria-hidden='true' />已选 {formatCount(selection.size)} 首
  </span>
  <button
    type='button'
    class='h-8 inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 text-caption text-primary-900 font-500 transition-colors duration-feedback mouse:hover:bg-primary-100'
    onclick={() => selection.selectAll()}
  >
    {#if selection.allOn}<SquareMinus size={14} aria-hidden='true' />{:else}<CheckCheck size={14} aria-hidden='true' />{/if}
    {selection.allOn ? '全不选' : '全选'}
  </button>
  <span class='flex-1'></span>
  {#if can.add}
    <button type='button' class={[ACTION, 'text-neutral-800']} disabled={none} onclick={event => selection.addPicked(event, anchorBelow(event))}>
      <ListPlus size={15} aria-hidden='true' />加入歌单
    </button>
  {/if}
  {#if can.download}
    <button type='button' class={[ACTION, 'text-neutral-800']} disabled={none || offline} title={offline ? '断网时不能下载' : undefined} onclick={() => selection.downloadPicked()}>
      <CircleArrowDown size={15} aria-hidden='true' />下载
    </button>
  {/if}
  {#if can.remove}
    <button type='button' class={[ACTION, 'text-neutral-800']} disabled={none} onclick={() => selection.removePicked()}>
      <ListMinus size={15} aria-hidden='true' />移除
    </button>
  {/if}
  {#if can.export}
    <button type='button' class={[ACTION, 'text-neutral-800']} disabled={none} onclick={event => selection.exportPicked(event)}>
      <FolderDown size={15} aria-hidden='true' />导出
    </button>
  {/if}
  {#if can.delete}
    <button type='button' class={[ACTION, 'text-error-700']} disabled={none} onclick={event => selection.deletePicked(event)}>
      <Trash2 size={15} aria-hidden='true' />删除
    </button>
  {/if}
  <span class='mx-1 h-5 w-px bg-neutral-200' aria-hidden='true'></span>
  <button
    type='button'
    class='h-8 inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 text-caption text-neutral-700 font-500 transition-colors duration-feedback mouse:hover:bg-primary-100'
    title='Esc'
    onclick={() => selection.leave()}
  ><X size={14} aria-hidden='true' />取消选择</button>
</div>
