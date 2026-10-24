<!--
  工具档按钮（DESIGN.md Buttons · 手机上的四档）：和标题、数量排在一行的次级操作（添加歌曲、收藏、排序、新建歌单）。
  手机布局上只有图标（IconButton：44px 的圆、20px 图标），label 是读屏名字，也是鼠标悬停的提示；
  桌面布局上是带图标和字的描边胶囊（Button outline），字是 text，没给就是 label。按布局切换，调用的地方不用分。
  class 只给手机的图标按钮（靠边放时用负的外边距让图标对齐边缘）；桌面胶囊不加东西。
  pressed：是开关（收藏 / 已收藏），带 aria-pressed，按下时图标是深薄荷
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { desktopLayout } from '../shared/layout'
  import Button from './Button.svelte'
  import IconButton from './IconButton.svelte'

  interface Props extends Omit<HTMLButtonAttributes, 'children' | 'aria-label' | 'aria-pressed' | 'title'> {
    icon: LucideIcon
    /** 读屏名字；手机上也是悬停提示 */
    label: string
    /** 桌面胶囊上写的字（默认是 label） */
    text?: string
    /** 开关按下了：aria-pressed，图标是深薄荷 */
    pressed?: boolean
  }

  const { icon, label, text = label, pressed, class: klass, ...rest }: Props = $props()
  /** 按下了的开关：图标是深薄荷 */
  const pressedLook = $derived(pressed ? '[&_svg]:text-primary-900' : '')
</script>

{#if desktopLayout.current}
  <Button variant='outline' {icon} class={pressedLook} aria-pressed={pressed} {...rest}>{text}</Button>
{:else}
  <IconButton {icon} {label} title={label} class={[pressedLook, klass]} aria-pressed={pressed} {...rest} />
{/if}
