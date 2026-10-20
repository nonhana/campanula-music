<!--
  拖动排序的把手（#36 歌曲列表、#37 曲库歌单列表共用）：能排序的列表进入多选或排序模式时，
  每一行右边出现它；其余时候歌曲行右边仍是 •••。按住把手立即拖；触屏上把手自己设 touch-action: none，
  不和滚动抢。键盘用焦点所在那一行的 Alt + ↑ / ↓ 移一位，把手本身不用按。
-->
<script lang='ts'>
  import type { Attachment } from 'svelte/attachments'
  import { GripVertical } from '@lucide/svelte'

  interface Props {
    /** 这一行是什么（歌名、歌单名），读屏读成“拖动排序：…” */
    label: string
    size: 'phone' | 'desktop'
    /** 按下开始拖动的接线（press.ts 的 attachWindowGrip）；浮起的复制行不给 */
    attach?: Attachment<HTMLElement>
    /** 浮起的复制行：只画样子，不接指针、不能聚焦 */
    ghost?: boolean
  }

  const { label, size, attach, ghost = false }: Props = $props()
</script>

{#if ghost}
  <span
    class={[
      'relative z-1 grid flex-none place-items-center text-neutral-500',
      size === 'phone' ? 'size-11 rounded-full' : 'size-9 rounded-lg',
    ]}
    aria-hidden='true'
  >
    <GripVertical size={size === 'phone' ? 20 : 18} aria-hidden='true' />
  </span>
{:else}
  <button
    type='button'
    data-grip
    tabindex={-1}
    class={[
      'relative z-1 grid flex-none place-items-center rounded-lg text-neutral-500 transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950) focus-visible:(outline-2 outline-offset-2 outline-primary-800)',
      size === 'phone' ? 'size-11 rounded-full active:bg-primary-100' : 'size-9',
    ]}
    aria-label='拖动排序：{label}'
    title='按住拖动；键盘选中这一行后按 Alt + ↑ / ↓ 移一位'
    {@attach attach}
  >
    <GripVertical size={size === 'phone' ? 20 : 18} aria-hidden='true' />
  </button>
{/if}
