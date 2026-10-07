<!--
  PROTOTYPE：手机选择模式的底部操作条，占迷你播放条的位置（拇指够得着）：加入歌单、下载、移除。
  我喜欢的音乐里“移除”就是取消红心；收藏来的歌单不能编辑，没有“移除”。
-->
<script lang='ts'>
  import type { Song } from '../data'
  import { CircleArrowDown, HeartOff, ListMinus, ListPlus } from '@lucide/svelte'
  import { downloadSongs, library, requestRemove, selection, ui, view } from '../store.svelte'

  interface Props {
    list: Song[]
  }

  const { list }: Props = $props()

  const pl = $derived(library.byId(view.pl))
  const picked = $derived(selection.size ? list.filter(s => selection.has(s.id)) : [])
  const none = $derived(picked.length === 0)
</script>

<div class='dock pointer-events-none fixed inset-x-0 bottom-0 z-29 h-[calc(104px+env(safe-area-inset-bottom))]' aria-hidden='true'></div>
<div
  class='fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] z-30 h-16 overflow-hidden rounded-2xl bg-white shadow-float'
  role='toolbar'
  aria-label='对选中的歌'
>
  <div class={['grid h-full', pl?.kind === 'collected' ? 'grid-cols-2' : 'grid-cols-3']}>
    <button class='act flex flex-col items-center justify-center gap-1 text-neutral-800' disabled={none} onclick={() => (ui.add = { songs: picked, x: 0, y: 0, sheet: true })}>
      <ListPlus size={20} aria-hidden='true' />
      <span class='text-[12.5px] leading-4 font-500'>加入歌单</span>
    </button>
    <button class='act flex flex-col items-center justify-center gap-1 text-secondary-900' disabled={none} onclick={() => downloadSongs(picked)}>
      <CircleArrowDown size={20} class='text-secondary-800' aria-hidden='true' />
      <span class='text-[12.5px] leading-4 font-500'>下载</span>
    </button>
    {#if pl?.kind === 'own'}
      <button class='act flex flex-col items-center justify-center gap-1 text-neutral-800' disabled={none} onclick={() => requestRemove(picked.map(s => s.id))}>
        <ListMinus size={20} aria-hidden='true' />
        <span class='text-[12.5px] leading-4 font-500'>移除</span>
      </button>
    {:else if pl?.kind === 'liked'}
      <button class='act flex flex-col items-center justify-center gap-1 text-neutral-800' disabled={none} onclick={() => requestRemove(picked.map(s => s.id))}>
        <HeartOff size={20} aria-hidden='true' />
        <span class='text-[12.5px] leading-4 font-500'>取消红心</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .dock {
    background: linear-gradient(to bottom, rgb(245 252 249 / 0), #f5fcf9 45%);
  }

  .act:not(:disabled):active {
    background: #e8f8f1;
  }

  .act:disabled {
    opacity: 0.45;
  }
</style>
