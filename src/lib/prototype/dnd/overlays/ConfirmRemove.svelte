<!--
  PROTOTYPE：批量移除前的确认（原型面板里“移除方式”选“先确认”时才出现）。手机是底部弹层，桌面是居中弹窗。
  按 DESIGN.md，出错红的实心按钮只留给“删除歌单”；从歌单里移除几首歌用深薄荷的主要按钮。
-->
<script lang='ts'>
  import { langOf } from '../data'
  import { layout } from '../layout.svelte'
  import { library, removeSongs, ui, view } from '../store.svelte'
  import Layer from '../Layer.svelte'

  const req = $derived(ui.confirmRemove)
  const pl = $derived(library.byId(view.pl))

  function close() {
    ui.confirmRemove = null
  }

  function confirm() {
    const ids = req?.ids ?? []
    close()
    removeSongs(view.pl, ids)
  }
</script>

{#if req && pl}
  {@const liked = pl.kind === 'liked'}
  {@const title = liked ? `取消红心 ${req.ids.length} 首歌？` : `从歌单移除 ${req.ids.length} 首歌？`}
  <Layer kind={layout.phone ? 'sheet' : 'dialog'} width={440} label={title} onclose={close}>
    <div class={layout.phone ? 'px-4 pb-1 pt-2' : 'px-6 pb-5 pt-5'}>
      <h2 class='text-[18px] leading-7 font-600 text-neutral-900'>{title}</h2>
      <p class='mt-2 text-[14px] leading-[22px] text-neutral-700'>
        {#if liked}
          这些歌会从我喜欢的音乐里拿掉。已下载的歌不受影响。
        {:else}
          它们会从<span class='font-500 text-neutral-900' lang={langOf(pl.name)}>「{pl.name}」</span>里拿掉；歌曲本身、你的红心和已下载的歌都不受影响。
        {/if}
      </p>
      <div class={layout.phone ? 'mt-6 grid gap-2' : 'mt-6 flex justify-end gap-2'}>
        {#if layout.phone}
          <button class='h-11 rounded-full bg-primary-900 px-5 text-[15px] font-500 text-white active:bg-primary-950' data-autofocus onclick={confirm}>{liked ? '取消红心' : '移除'}</button>
          <button class='h-11 rounded-full border border-neutral-200 bg-white text-[15px] font-500 text-neutral-800 active:bg-neutral-50' onclick={close}>先不了</button>
        {:else}
          <button class='btn-line h-10 rounded-full border border-neutral-200 bg-white px-5 text-[14px] font-500 text-neutral-800' onclick={close}>先不了</button>
          <button class='btn-solid h-10 rounded-full bg-primary-900 px-5 text-[14px] font-500 text-white' data-autofocus onclick={confirm}>{liked ? '取消红心' : '移除'}</button>
        {/if}
      </div>
    </div>
  </Layer>
{/if}

<style>
  @media (hover: hover) and (pointer: fine) {
    .btn-line:hover {
      border-color: #b9ead5;
      background: #f5fcf9;
    }

    .btn-solid:hover {
      background: #1a5b43;
    }
  }
</style>
