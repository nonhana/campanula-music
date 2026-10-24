<!--
  横向架子：一排格子横着滚，底边是自绘滚动条（拖动、点空白翻一屏）；Tab 到哪一格就滚进视野。桌面首页收藏的专辑、歌手，
  搜索结果综合里的歌单、歌手、专辑都用它。格子宽度由调用方给，间距写在 class 上。桌面伸进两边 8px（阴影不被裁），手机从屏幕左滚到右。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { ClassValue } from 'svelte/elements'

  import Scrollbar from '../ui/Scrollbar.svelte'

  interface Props {
    label: string
    class?: ClassValue
    phone?: boolean
    children: Snippet
  }

  const { label, class: klass, phone = false, children }: Props = $props()

  /** 键盘焦点移到看不全的一项：滚进视野 */
  const keepInView = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement)
      event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
</script>

<!-- 滚动的是外面这层，内边距在里面的列表上：滚动条贴着架子的底边。data-shelf：返回这一页时页面按它恢复横向滚动位置 -->
<div class={['overflow-x-auto', !phone && '-mx-2']} data-shelf={label}>
  <Scrollbar axis='x' />
  <ul class={[
    'w-max flex pb-3 pt-1',
    phone ? 'px-4' : 'px-2',
    klass,
  ]} aria-label={label} onfocusin={keepInView} data-reveal-group>
    {@render children()}
  </ul>
</div>
