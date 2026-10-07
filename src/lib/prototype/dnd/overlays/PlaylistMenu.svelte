<!-- PROTOTYPE：歌单的“更多”菜单（只放这次原型用得到的几项）。手机触屏是底部弹层，鼠标是浮动菜单。 -->
<script lang='ts'>
  import { ImageUp, ListChecks, PencilLine } from '@lucide/svelte'
  import { layout } from '../layout.svelte'
  import { library, selection, view } from '../store.svelte'
  import Layer from '../Layer.svelte'

  interface Props {
    x: number
    y: number
    sheet: boolean
    onclose: () => void
    oncover: () => void
    onedit: () => void
  }

  const { x, y, sheet, onclose, oncover, onedit }: Props = $props()
  const pl = $derived(library.byId(view.pl))

  function run(fn: () => void) {
    onclose()
    fn()
  }

  const rowClass = $derived(sheet
    ? 'mrow flex h-13 w-full items-center gap-4 rounded-xl px-4 text-left text-[15px] text-neutral-900 active:bg-primary-100 focus-visible:bg-primary-100'
    : 'mrow menu-item flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] text-neutral-900 focus-visible:(bg-primary-100 outline-none)')
</script>

<Layer kind={sheet ? 'sheet' : 'popover'} {x} {y} label='歌单操作' role='menu' {onclose}>
  <button role='menuitem' class={rowClass} onclick={() => run(() => (layout.phone || view.dragVariant === 'C' ? selection.enter() : selection.set([])))}>
    <ListChecks size={18} class='text-neutral-600' aria-hidden='true' />多选
  </button>
  {#if pl?.kind === 'own'}
    <button role='menuitem' class={rowClass} onclick={() => run(oncover)}>
      <ImageUp size={18} class='text-neutral-600' aria-hidden='true' />更换封面
    </button>
    <button role='menuitem' class={rowClass} onclick={() => run(onedit)}>
      <PencilLine size={18} class='text-neutral-600' aria-hidden='true' />编辑歌单信息
    </button>
  {/if}
</Layer>

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
