<!--
  桌面多选工具条（原型 DesktopPlaylist 的多选行）：盖在列表面板的表头上，多选时吸在顶栏下面（有吸顶标签行的吸在它下面）。
  左边“已选 N 首”、全选 / 全不选，右边对勾选的歌做的事，最后是取消选择（Esc）。
  动作由调用方从目录里挑、按给的先后画（#82）：歌单里是加入歌单、下载（自建还有移除），已下载页是导出和删除（#79）；
  断网时下载变灰并写原因，浏览器不能选文件夹时目录里就没有导出（ADR-0014）。吸顶和工具条本身由列表（songs/SongList）给，这里只是视图。
-->
<script lang='ts'>
  import { CheckCheck, ListChecks, SquareMinus, X } from '@lucide/svelte'

  import { anchorBelow } from '../menu/menu-anchor'
  import { getOverlays } from '../overlay/overlay-context'
  import { formatCount } from '../shared/text'

  const { multiSelect: selection } = getOverlays()
  const none = $derived(selection.picked.length === 0)
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
  {#each selection.actions as action (action.key)}
    {@const Icon = action.icon}
    <button
      type='button'
      class={[
        ACTION,
        action.tone === 'destructive'
          ? 'text-error-700'
          : 'text-neutral-800',
      ]}
      disabled={none || action.blocked !== null}
      title={action.blocked ?? undefined}
      onclick={(event: MouseEvent) => action.run(selection.picked, event.currentTarget as HTMLElement, anchorBelow(event))}
    >
      <Icon size={15} aria-hidden='true' />{action.label}
    </button>
  {/each}
  <span class='mx-1 h-5 w-px bg-neutral-200' aria-hidden='true'></span>
  <button
    type='button'
    class='h-8 inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 text-caption text-neutral-700 font-500 transition-colors duration-feedback mouse:hover:bg-primary-100'
    title='Esc'
    onclick={() => selection.leave()}
  ><X size={14} aria-hidden='true' />取消选择</button>
</div>
