<!--
  文字按钮（DESIGN.md Buttons · 文字）：没有底色和边框的字，点击范围 44px 高；按下、鼠标悬停时薄荷雾底，按下时缩到 98%。
  图标说不清、或点错有代价的次级操作用它：完成、重试、撤销、清空、查看全部、取消 / 保存、全选。
  tone：primary 深薄荷（默认），neutral 石墨重（取消、清空）；strong 是 600 字重，给一行里起确认作用的那个（创建、保存、完成、撤销）。
  桌面上要矮一点的由调用方写 md:h-*；靠边放时调用方用负的外边距让字对齐边缘。给了 href 就是链接（查看全部）
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'

  interface Props extends Omit<HTMLButtonAttributes, 'children'> {
    tone?: 'primary' | 'neutral'
    strong?: boolean
    /** 放在文字左边的 16px 图标 */
    icon?: LucideIcon
    /** 给了就画成链接 */
    href?: string
    children: Snippet
  }

  const { tone = 'primary', strong = false, icon: Icon, href, type = 'button', class: klass, children, ...rest }: Props = $props()
</script>

<svelte:element
  this={href ? 'a' : 'button'}
  {href}
  type={href ? undefined : type}
  class={[
    'h-11 inline-flex flex-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-label transition-[background-color,color,opacity,transform] duration-feedback press disabled:(cursor-not-allowed opacity-50) mouse:not-disabled:hover:(bg-primary-100 text-primary-950)',
    strong ? 'font-600' : 'font-500',
    tone === 'primary' ? 'text-primary-900 active:bg-primary-100' : 'text-neutral-700 active:bg-neutral-100',
    klass,
  ]}
  {...rest}
>
  {#if Icon}<Icon size={16} class='flex-none' aria-hidden='true' />{/if}
  {@render children()}
</svelte:element>
