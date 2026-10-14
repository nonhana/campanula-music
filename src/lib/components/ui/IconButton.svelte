<!--
  图标按钮（DESIGN.md Buttons · Icon）：透明底、石墨重图标，手机 44px、桌面 40px 的圆；
  鼠标悬停时薄荷雾底、森林墨图标。没有文字，label 就是读屏读出的名字。
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'

  interface Props extends Omit<HTMLButtonAttributes, 'children' | 'aria-label'> {
    icon: LucideIcon
    label: string
    /** 实心图标（上一首、下一首） */
    filled?: boolean
  }

  const { icon: Icon, label, filled = false, type = 'button', class: klass, ...rest }: Props = $props()
</script>

<button
  {type}
  aria-label={label}
  class={[
    'size-11 grid flex-none place-items-center rounded-full text-neutral-700 transition-[background-color,color,transform] duration-feedback md:size-10 enabled:press disabled:(cursor-not-allowed opacity-50) mouse:enabled:hover:(bg-primary-100 text-primary-950)',
    klass,
  ]}
  {...rest}
>
  <Icon size={20} fill={filled ? 'currentColor' : 'none'} aria-hidden='true' />
</button>
