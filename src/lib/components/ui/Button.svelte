<!--
  胶囊按钮（DESIGN.md Buttons）：手机桌面看得见的都是 40px 高，上下各往外撑 2px，点击范围 44px，不改布局；
  按下时缩到 98%，焦点环用全局的 :focus-visible。
  primary 深薄荷底白字（播放全部、登录、重试）；download 浅蜜桃底蜜桃木字（下载）；
  outline 纸白底发丝线（桌面的收藏、清空、取消）；destructive 出错红底白字（只用在删除歌单的确认键）。
  禁用：实心按钮变成发丝线灰底、石墨淡字，描边按钮降到 50% 不透明度。悬停效果只给鼠标（mouse:）。
  phoneLabel：手机布局上只显示图标（DESIGN.md Buttons · 工具），样子就是 IconButton（44px 的圆、20px 图标、没有底色和边框），
  phoneLabel 是这时读屏读出的名字和鼠标悬停的提示；桌面照旧是带字的胶囊。页头的操作行手机桌面共用，不用各写一份
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { desktopLayout } from '../layout'
  import IconButton from './IconButton.svelte'

  interface Props extends Omit<HTMLButtonAttributes, 'children'> {
    variant: 'primary' | 'download' | 'outline' | 'destructive'
    /** 放在文字左边的 Lucide 图标 */
    icon?: LucideIcon
    /** 手机布局上只显示图标时读屏读出的名字（要和 icon 一起给） */
    phoneLabel?: string
    children: Snippet
  }

  const { variant, icon: Icon, phoneLabel, type = 'button', class: klass, children, ...rest }: Props = $props()
  const iconOnly = $derived(Icon !== undefined && phoneLabel !== undefined && !desktopLayout.current)

  const look = {
    primary: 'bg-primary-900 text-white mouse:enabled:hover:bg-primary-950 disabled:(bg-neutral-200 text-neutral-500)',
    download: 'bg-secondary-100 text-secondary-900 mouse:enabled:hover:bg-secondary-200 disabled:(bg-neutral-200 text-neutral-500)',
    outline: 'border border-neutral-200 bg-white text-neutral-800 disabled:opacity-50 mouse:enabled:hover:(border-primary-300 bg-primary-50)',
    destructive: 'bg-error-700 text-white mouse:enabled:hover:bg-error-800 disabled:(bg-neutral-200 text-neutral-500)',
  }
</script>

{#if iconOnly && Icon && phoneLabel}
  <IconButton icon={Icon} label={phoneLabel} title={phoneLabel} {type} class={klass} {...rest} />
{:else}
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
{/if}
