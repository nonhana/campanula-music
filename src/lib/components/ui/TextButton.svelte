<!--
  文字按钮（DESIGN.md Buttons · Text）：没有底色和边框的字，点击范围 44px 高（桌面要矮一点的由调用方写 md:h-*），左右 12px。
  图标说不清、或点错有代价的次级操作用它：完成、重试、撤销、清空、查看全部、取消 / 保存、全选。
  tone：primary 深薄荷（默认），neutral 石墨（取消、清空）。strong 是 600 字重，给一行里起确认作用的那个（创建、保存、完成、撤销）。
  size：字号跟着所在的那一行。默认 label；弹层标题行里的是 body（不 strong 时 400 字重）；说明行里的是 caption（neutral 时是浅一档的石墨）。
  按下时浅底（primary 配薄荷雾，neutral 配淡发丝），鼠标悬停时薄荷雾底、森林墨字，按下时缩到 98%。
  禁用：primary 变成石墨淡字，neutral 降到 50%。给了 href 就是链接（查看全部）。
  desktop：桌面布局上不是文字，而是这种胶囊（Button），图标只画在胶囊上；手机布局照旧是文字。调用的地方不用分。
  class 两种样子都加：只给一种的用 max-md: / md: 前缀（靠边放时 max-md:-mr-3 让字对齐边缘）
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { desktopLayout } from '../layout'
  import Button from './Button.svelte'

  interface Props extends Omit<HTMLButtonAttributes, 'children'> {
    tone?: 'primary' | 'neutral'
    strong?: boolean
    size?: 'body' | 'label' | 'caption'
    /** 放在文字左边的 16px 图标 */
    icon?: LucideIcon
    /** 给了就画成链接 */
    href?: string
    /** 桌面布局上画成这种胶囊 */
    desktop?: { variant: 'primary' | 'outline', icon?: LucideIcon }
    children: Snippet
  }

  const { tone = 'primary', strong = false, size = 'label', icon: Icon, href, desktop, type = 'button', class: klass, children, ...rest }: Props = $props()

  const SIZES = { body: 'text-body', label: 'text-label', caption: 'text-caption' }
  const weight = $derived(strong ? 'font-600' : size === 'body' ? 'font-400' : 'font-500')
  const color = $derived(tone === 'primary'
    ? 'text-primary-900 active:bg-primary-100 disabled:text-neutral-500'
    : [size === 'caption' ? 'text-neutral-600' : 'text-neutral-700', 'active:bg-neutral-100 disabled:opacity-50'])
</script>

{#if desktop && desktopLayout.current}
  <Button variant={desktop.variant} icon={desktop.icon} {type} class={klass} {...rest}>{@render children()}</Button>
{:else}
  <svelte:element
    this={href ? 'a' : 'button'}
    {href}
    type={href ? undefined : type}
    class={[
      'h-11 inline-flex flex-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 transition-[background-color,color,opacity,transform] duration-feedback press disabled:cursor-not-allowed mouse:not-disabled:hover:(bg-primary-100 text-primary-950)',
      SIZES[size],
      weight,
      color,
      klass,
    ]}
    {...rest}
  >
    {#if Icon}<Icon size={16} class='flex-none' aria-hidden='true' />{/if}
    {@render children()}
  </svelte:element>
{/if}
