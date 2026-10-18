<!--
  横向架子：一排格子能横着滚，底边是自绘的滚动条（拖动、点空白处翻一屏）；键盘 Tab 到哪一格就把它滚进视野。
  桌面首页收藏的专辑、歌手，搜索结果综合里的歌单、歌手、专辑都用它。格子（li）的宽度由调用方给，间距写在 class 上。
  桌面伸进两边 8px（格子的阴影不被裁掉）；手机从屏幕左边滚到右边，第一格离边 16px，和上面的标题对齐
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { ClassValue } from 'svelte/elements'
  import Scrollbar from '../ui/Scrollbar.svelte'

  interface Props {
    /** 读屏读出的这一排是什么 */
    label: string
    /** 格子之间的间距 */
    class?: ClassValue
    phone?: boolean
    children: Snippet
  }

  const { label, class: klass, phone = false, children }: Props = $props()

  /** 键盘焦点移到架子里看不全的一项：把它滚进视野 */
  function keepInView(event: FocusEvent) {
    if (event.target instanceof HTMLElement)
      event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
</script>

<!-- 滚动的是外面这层，内边距在里面的列表上：滚动条贴着架子的底边。data-shelf：返回这一页时页面按它恢复横向滚动位置 -->
<div class={['overflow-x-auto', !phone && '-mx-2']} data-shelf={label}>
  <Scrollbar axis='x' />
  <ul class={['w-max flex pb-3 pt-1', phone ? 'px-4' : 'px-2', klass]} aria-label={label} onfocusin={keepInView} data-reveal-group>
    {@render children()}
  </ul>
</div>
