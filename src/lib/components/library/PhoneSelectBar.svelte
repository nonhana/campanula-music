<!--
  手机多选的顶栏（#35，原型 PhoneSelectBar）：替换歌单页的返回栏。左边关闭，中间“已选 N 首”，右边全选 / 全不选。
  关闭用 history.back() 把进多选时压的那条浅路由用掉（Spec #11 验证关卡③）。
-->
<script lang='ts'>
  import { CheckCheck, ListChecks, ListX, X } from '@lucide/svelte'
  import TextButton from '../ui/TextButton.svelte'
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
  <span class='min-w-0 inline-flex flex-1 items-center gap-1.5 text-body text-neutral-900 font-500 tabular-nums' role='status'>
    <ListChecks size={16} class='flex-none' aria-hidden='true' />
    <span class='min-w-0 truncate'>{playlistSelection.size > 0 ? `已选 ${formatCount(playlistSelection.size)} 首` : '选择歌曲'}</span>
  </span>
  <TextButton icon={playlistSelection.allOn ? ListX : CheckCheck} onclick={() => playlistSelection.selectAll()}>
    {playlistSelection.allOn ? '全不选' : '全选'}
  </TextButton>
</div>
