<!--
  手机多选的顶栏（#35，原型 PhoneSelectBar）：替换歌单页的返回栏。左边关闭，中间“已选 N 首”，右边全选 / 全不选。
  关闭用 history.back() 把进多选时压的那条浅路由用掉（Spec #11 验证关卡③）。
-->
<script lang='ts'>
  import { CheckCheck, ListChecks, ListX, X } from '@lucide/svelte'
  import { leaveSelection, playlistSelection } from './playlist-selection.svelte'
  import { formatCount } from './view'
</script>

<div class='min-w-0 flex flex-1 items-center gap-1'>
  <button
    type='button'
    class='grid size-11 flex-none place-items-center rounded-full text-neutral-800 active:bg-primary-100'
    aria-label='退出多选'
    onclick={() => leaveSelection()}
  >
    <X size={22} aria-hidden='true' />
  </button>
  <span class='min-w-0 inline-flex flex-1 items-center gap-1.5 truncate text-body text-neutral-900 font-500 tabular-nums' role='status'>
    <ListChecks size={16} class='flex-none' aria-hidden='true' />
    <span class='min-w-0 truncate'>{playlistSelection.size > 0 ? `已选 ${formatCount(playlistSelection.size)} 首` : '选择歌曲'}</span>
  </span>
  <button
    type='button'
    class='h-11 inline-flex flex-none items-center gap-1.5 rounded-full px-3.5 text-label text-primary-900 font-500 active:bg-primary-100'
    onclick={() => playlistSelection.selectAll()}
  >
    {#if playlistSelection.allOn}<ListX size={16} aria-hidden='true' />{:else}<CheckCheck size={16} aria-hidden='true' />{/if}
    {playlistSelection.allOn ? '全不选' : '全选'}
  </button>
</div>
