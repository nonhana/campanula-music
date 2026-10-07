<!-- PROTOTYPE：歌曲的“更多”菜单（照视觉原型，只留和这次原型有关的几项）。手机触屏是底部弹层，鼠标是浮动菜单。 -->
<script lang='ts'>
  import { CircleArrowDown, HeartOff, ListChecks, ListMinus, ListPlus, ListStart } from '@lucide/svelte'
  import Cover from '../Cover.svelte'
  import { artistLine } from '../data'
  import { layout } from '../layout.svelte'
  import { downloads, downloadSongs, library, requestRemove, selection, toast, ui, view } from '../store.svelte'
  import Layer from '../Layer.svelte'

  const req = $derived(ui.menu)
  const pl = $derived(library.byId(view.pl))

  function close() {
    ui.menu = null
  }

  function run(fn: () => void) {
    fn()
    close()
  }
</script>

{#if req}
  {@const song = req.song}
  {@const sheet = req.sheet}
  {@const st = downloads.stateOf(song)}
  {@const rowClass = sheet
    ? 'mrow flex h-13 w-full items-center gap-4 rounded-xl px-4 text-left text-[15px] text-neutral-900 active:bg-primary-100 focus-visible:bg-primary-100 disabled:opacity-45'
    : 'mrow menu-item flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] text-neutral-900 focus-visible:(bg-primary-100 outline-none) disabled:opacity-45'}
  <Layer kind={sheet ? 'sheet' : 'popover'} x={req.x} y={req.y} label='歌曲操作' role='menu' onclose={close}>
    {#if sheet}
      <div class='flex items-center gap-3 px-4 pt-1 pb-3'>
        <Cover cover={song.cover} class='size-12 flex-none rounded-lg' />
        <div class='min-w-0'>
          <p class='truncate text-[15px] font-500 text-neutral-900' lang={song.lang}>{song.title}</p>
          <p class='truncate text-[13px] text-neutral-600' lang={song.lang}>{artistLine(song)}</p>
        </div>
      </div>
      <div class='mx-4 mb-1 h-px bg-neutral-100'></div>
    {/if}
    <button role='menuitem' class={rowClass} onclick={() => run(() => toast('已设为下一首播放'))}>
      <ListStart size={18} class='text-neutral-600' aria-hidden='true' />下一首播放
    </button>
    <button role='menuitem' class={rowClass} onclick={() => run(() => (ui.add = { songs: [song], x: req.x, y: req.y, sheet }))}>
      <ListPlus size={18} class='text-neutral-600' aria-hidden='true' />加入歌单
    </button>
    <button role='menuitem' class={rowClass} disabled={st === 'done' || song.trial || song.unavailable} onclick={() => run(() => downloadSongs([song]))}>
      <CircleArrowDown size={18} class='text-secondary-800' aria-hidden='true' />
      {st === 'done' ? '已下载' : song.trial ? '试听歌曲不能下载' : song.unavailable ? '无版权，不能下载' : '下载'}
    </button>
    <div class={sheet ? 'mx-4 my-1 h-px bg-neutral-100' : 'mx-3 my-1 h-px bg-neutral-100'} role='separator'></div>
    <button
      role='menuitem'
      class={rowClass}
      onclick={() => run(() => {
        if (layout.phone || view.dragVariant === 'C')
          selection.enter(song.id)
        else selection.set([song.id])
      })}
    >
      <ListChecks size={18} class='text-neutral-600' aria-hidden='true' />多选
    </button>
    {#if pl?.kind === 'own'}
      <button role='menuitem' class={rowClass} onclick={() => run(() => requestRemove([song.id]))}>
        <ListMinus size={18} class='text-neutral-600' aria-hidden='true' />从歌单中移除
      </button>
    {:else if pl?.kind === 'liked'}
      <button role='menuitem' class={rowClass} onclick={() => run(() => requestRemove([song.id]))}>
        <HeartOff size={18} class='text-neutral-600' aria-hidden='true' />取消红心
      </button>
    {/if}
  </Layer>
{/if}

<style>
  .mrow > :global(svg) {
    flex: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .menu-item:hover {
      background: #f5fcf9;
    }
  }
</style>
