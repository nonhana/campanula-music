<!-- PROTOTYPE：手机选择模式的顶栏，替换原来的返回栏：退出、已选几首、全选。系统返回键也能退出（见 DndPrototype 的历史记录处理）。 -->
<script lang='ts'>
  import type { Song } from '../data'
  import { X } from '@lucide/svelte'
  import { formatCount } from '../data'
  import { selection, view } from '../store.svelte'

  interface Props {
    list: Song[]
  }

  const { list }: Props = $props()

  const allOn = $derived(selection.size >= list.length && list.length > 0 && list.every(s => selection.has(s.id)))

  function toggleAll() {
    if (allOn)
      selection.set([])
    else selection.set(list.map(s => s.id))
  }
</script>

<div class='sticky top-0 z-20 flex h-14 items-center gap-1 bg-primary-50 px-1'>
  <button
    class='grid size-11 flex-none place-items-center rounded-full text-neutral-800 active:bg-primary-100'
    aria-label={view.dragVariant === 'C' ? '完成编辑' : '退出多选'}
    onclick={() => selection.exit()}
  >
    <X size={22} aria-hidden='true' />
  </button>
  <span class='min-w-0 flex-1 truncate text-[16px] font-500 text-neutral-900 tnum' role='status'>
    {selection.size ? `已选 ${formatCount(selection.size)} 首` : '选择歌曲'}
  </span>
  <button class='h-11 flex-none rounded-full px-3.5 text-[15px] font-500 text-primary-900 active:bg-primary-100' onclick={toggleAll}>
    {allOn ? '全不选' : '全选'}
  </button>
</div>
