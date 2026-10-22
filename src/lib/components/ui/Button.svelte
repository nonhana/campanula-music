<!--
  胶囊按钮（DESIGN.md Buttons）：手机桌面看得见的都是 40px 高，上下各往外撑 2px，点击范围 44px，不改布局（pill-hit）；
  按下时缩到 98%，焦点环用全局的 :focus-visible。
  primary 深薄荷底白字（播放全部、登录、重试）；download 浅蜜桃底蜜桃木字（下载）；
  outline 纸白底发丝线（桌面的收藏、清空、取消）；destructive 出错红底白字（只用在删除歌单的确认键）。
  禁用：实心按钮变成发丝线灰底、石墨淡字，描边按钮降到 50% 不透明度。悬停效果只给鼠标（mouse:）。
  手机上只留图标的次级操作用 ToolButton，写成文字的用 TextButton；它们在桌面布局上画的就是这里的胶囊
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'

  interface Props extends Omit<HTMLButtonAttributes, 'children'> {
    variant: 'primary' | 'download' | 'outline' | 'destructive'
    /** 放在文字左边的 Lucide 图标 */
    icon?: LucideIcon
    children: Snippet
  }

  const { variant, icon: Icon, type = 'button', class: klass, children, ...rest }: Props = $props()

  const look = {
    primary: 'bg-primary-900 text-white mouse:enabled:hover:bg-primary-950 disabled:(bg-neutral-200 text-neutral-500)',
    download: 'bg-secondary-100 text-secondary-900 mouse:enabled:hover:bg-secondary-200 disabled:(bg-neutral-200 text-neutral-500)',
    outline: 'border border-neutral-200 bg-white text-neutral-800 disabled:opacity-50 mouse:enabled:hover:(border-primary-300 bg-primary-50)',
    destructive: 'bg-error-700 text-white mouse:enabled:hover:bg-error-800 disabled:(bg-neutral-200 text-neutral-500)',
  }
</script>

<button
  {type}
  class={[
    'pill-hit h-10 inline-flex flex-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-label font-500 transition-[background-color,border-color,color,opacity,transform] duration-feedback enabled:press disabled:cursor-not-allowed',
    Icon ? 'pl-4 pr-5' : 'px-5',
    look[variant],
    klass,
  ]}
  {...rest}
>
  {#if Icon}<Icon size={18} aria-hidden='true' />{/if}
  {@render children()}
</button>
