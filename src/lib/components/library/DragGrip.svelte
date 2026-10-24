<!--
  拖动排序的把手（#36 歌曲列表、#37 曲库歌单列表和桌面网格共用）：能排序的列表进入多选或排序模式时，
  每一行右边、或每张卡片封面的右上角出现它；其余时候歌曲行右边仍是 •••。按住把手立即拖；
  触屏上把手自己设 touch-action: none，不和滚动抢。键盘用焦点所在那一行 / 那一张的 Alt + ↑ / ↓ 移一位，
  把手本身不用按；悬停提示只写这组快捷键。overlay 是网格卡片上用的小白圆钮，class 用来定位置。
-->
<script lang='ts'>
  import type { Attachment } from 'svelte/attachments'
  import type { ClassValue } from 'svelte/elements'
  import { GripVertical } from '@lucide/svelte'

  interface Props {
    /** 这一行 / 这一张是什么（歌名、歌单名），读屏读成“拖动排序：…” */
    label: string
    size: 'phone' | 'desktop'
    /** 按下开始拖动的接线（press.ts 的 attachWindowGrip）；浮起的复制行不给 */
    attach?: Attachment<HTMLElement>
    /** 浮起的复制行：只画样子，不接指针、不能聚焦 */
    ghost?: boolean
    /** 网格卡片封面上的小白圆钮；平时是歌曲行 / 列表行里的透明按钮 */
    overlay?: boolean
    class?: ClassValue
    /** 鼠标拖完以后焦点可能留在这个把手上：Alt + ↑ / ↓ 也要能接着用 */
    onkeydown?: (event: KeyboardEvent) => void
  }

  const { label, size, attach, ghost = false, overlay = false, class: klass, onkeydown }: Props = $props()
  const shape = $derived(overlay || size === 'phone'
    ? 'rounded-full'
    : 'rounded-lg')
  const tone = $derived(overlay ? 'bg-white/95 shadow-ambient ring-1 ring-neutral-900/5 text-neutral-600 backdrop-blur' : 'text-neutral-500')
</script>

{#if ghost}
  <span
    class={[
      'relative z-1 grid flex-none place-items-center',
      tone,
      shape,
      size === 'phone'
        ? 'size-11'
        : 'size-9',
      klass,
    ]}
    aria-hidden='true'
  >
    <GripVertical size={size === 'phone'
      ? 20
      : 18} aria-hidden='true' />
  </span>
{:else}
  <button
    type='button'
    data-grip
    tabindex={-1}
    class={[
      'relative z-1 grid flex-none place-items-center transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950) focus-visible:(outline-2 outline-offset-2 outline-primary-800)',
      tone,
      shape,
      size === 'phone'
        ? 'size-11 active:bg-primary-100'
        : 'size-9',
      klass,
    ]}
    aria-label='拖动排序：{label}'
    title='Alt + ↑ / ↓'
    aria-keyshortcuts='Alt+ArrowUp Alt+ArrowDown'
    {onkeydown}
    {@attach attach}
  >
    <GripVertical size={size === 'phone'
      ? 20
      : 18} aria-hidden='true' />
  </button>
{/if}
