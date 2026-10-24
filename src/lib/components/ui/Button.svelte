<!--
  胶囊按钮（DESIGN.md Buttons）：40px 高，上下各往外撑 2px、点击范围 44px，不改布局（pill-hit）。悬停效果只给鼠标（mouse:）。
  primary 深薄荷（播放全部、登录、重试）；download 浅蜜桃（下载）；outline 纸白描边；destructive 出错红（只用在删除歌单的确认键）。
  进行中（busy）：文字不变、图标换成转圈，宽度不变；颜色不变、不能点（aria-disabled，点按和回车提交都拦下），焦点留在按钮上。
  手机上只留图标的次级操作用 ToolButton，写成文字的用 TextButton；它们在桌面画的就是这里的胶囊。
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import { LoaderCircle } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'

  import { busyClick } from '../shared/busy'

  interface Props extends Omit<HTMLButtonAttributes, 'children'> {
    variant: 'primary' | 'download' | 'outline' | 'destructive'
    icon?: LucideIcon
    busy?: boolean
    children: Snippet
  }

  const { variant, icon: Icon, busy = false, type = 'button', class: klass, onclick, children, ...rest }: Props = $props()

  const look = {
    primary: { color: 'bg-primary-900 text-white disabled:(bg-neutral-200 text-neutral-500)', hover: 'mouse:enabled:hover:bg-primary-950' },
    download: { color: 'bg-secondary-100 text-secondary-900 disabled:(bg-neutral-200 text-neutral-500)', hover: 'mouse:enabled:hover:bg-secondary-200' },
    outline: { color: 'border border-neutral-200 bg-white text-neutral-800 disabled:opacity-50', hover: 'mouse:enabled:hover:(border-primary-300 bg-primary-50)' },
    destructive: { color: 'bg-error-700 text-white disabled:(bg-neutral-200 text-neutral-500)', hover: 'mouse:enabled:hover:bg-error-800' },
  }

  const click = busyClick(() => busy, event => onclick?.(event))
</script>

<button
  {type}
  class={[
    'pill-hit h-10 inline-flex flex-none items-center justify-center whitespace-nowrap rounded-full text-label font-500 transition-[background-color,border-color,color,opacity,transform] duration-feedback disabled:cursor-not-allowed',
    // 没有图标的在文字前加 16px 转圈、隔 6px：两边各让出 11px（20 → 9），宽度不变
    Icon
      ? 'gap-2 pl-4 pr-5'
      : busy ? 'gap-1.5 px-[9px]' : 'gap-2 px-5',
    look[variant].color,
    busy
      ? 'cursor-progress'
      : ['enabled:press', look[variant].hover],
    klass,
  ]}
  aria-busy={busy || undefined}
  aria-disabled={busy || undefined}
  onclick={click}
  {...rest}
>
  {#if busy}
    <LoaderCircle size={Icon ? 18 : 16} class='flex-none animate-spin' aria-hidden='true' />
  {:else if Icon}
    <Icon size={18} aria-hidden='true' />
  {/if}
  {@render children()}
</button>
