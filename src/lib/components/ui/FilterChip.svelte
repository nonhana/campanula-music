<!--
  筛选 chip（DESIGN.md Chips · Filter / History）：编辑歌单时的标签库、搜索历史、播放页歌词的翻译 / 音译开关。手机桌面都是 36px 高。
  纸白底 + 发丝线；选中时薄荷玻璃底 + 森林墨字；禁用时降到 50%（DESIGN.md Buttons · Disabled）。选中状态用 aria-pressed 告诉读屏。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'

  interface Props extends Omit<HTMLButtonAttributes, 'children' | 'aria-pressed'> {
    /** 筛选用；搜索历史这类不分选中的 chip 不传 */
    selected?: boolean
    children: Snippet
  }

  const { selected, type = 'button', class: klass, children, ...rest }: Props = $props()
</script>

<button
  {type}
  aria-pressed={selected}
  class={[
    'h-9 inline-flex flex-none items-center rounded-full px-4 text-label font-500 transition-[background-color,border-color,color,opacity] duration-feedback disabled:(cursor-not-allowed opacity-50)',
    selected
      ? 'bg-primary-200 text-primary-950'
      : 'border border-neutral-200 bg-white text-neutral-700 mouse:enabled:hover:(border-primary-300 bg-primary-50 text-neutral-900)',
    klass,
  ]}
  {...rest}
>
  {@render children()}
</button>
