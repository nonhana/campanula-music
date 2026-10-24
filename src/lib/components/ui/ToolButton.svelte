<!--
  工具档按钮（DESIGN.md Buttons · 手机上的四档）：和标题、数量排在一行的次级操作。
  手机只有图标（IconButton：44px 的圆、20px 图标），读屏读 label；桌面是带图标和字的描边胶囊（Button outline）。
  class 只给手机的图标按钮（靠边放时用负外边距对齐边缘）；pressed 是开关，带 aria-pressed、图标是深薄荷。
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'

  import { desktopLayout } from '../shared/layout'
  import Button from './Button.svelte'
  import IconButton from './IconButton.svelte'

  interface Props extends Omit<HTMLButtonAttributes, 'children' | 'aria-label' | 'aria-pressed' | 'title'> {
    icon: LucideIcon
    label: string
    text?: string
    pressed?: boolean
  }

  const { icon, label, text = label, pressed, class: klass, ...rest }: Props = $props()
  const pressedLook = $derived(pressed ? '[&_svg]:text-primary-900' : '')
</script>

{#if desktopLayout.current}
  <Button variant='outline' {icon} class={pressedLook} aria-pressed={pressed} {...rest}>{text}</Button>
{:else}
  <IconButton {icon} {label} title={label} class={[pressedLook, klass]} aria-pressed={pressed} {...rest} />
{/if}
