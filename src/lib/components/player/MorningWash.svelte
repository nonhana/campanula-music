<!--
  晨光行（DESIGN.md Morning Row）：正在播放的那一行，一层浅薄荷光从歌名左边缘往右铺开，长度等于播放进度；
  起点 16px 渐入，前沿 40px 渐隐。白色面板上用薄荷雾，晨光底上（手机）用薄荷玻璃。
  放在 position: relative 的行里，行的内容叠在它上面。减少动态效果时光只跳到位
-->
<script lang='ts'>
  import { getAppView } from '../app-context.svelte'
  import { progressOf } from './view'

  interface Props {
    /** 光的起点（px）：歌名左边缘再往左一点 */
    start: number
    /** 行在晨光底上（手机），光要深一级才看得见 */
    onGround?: boolean
  }

  const { start, onGround = false }: Props = $props()
  const view = getAppView()
  const progress = $derived(progressOf(view.state.player))
</script>

<span class='wash' class:ground={onGround} style:--start='{start}px' aria-hidden='true'>
  <span class='light' style:--wash-progress={progress}></span>
</span>

<style>
  .wash {
    --tone: theme('colors.primary.100');
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
  }

  .wash.ground {
    --tone: theme('colors.primary.200');
  }

  /* 注册成数字才能过渡；只重绘，不重排。注册的名字是全局的，不要和别处的变量重名 */
  @property --wash-progress {
    syntax: '<number>';
    inherits: false;
    initial-value: 0;
  }

  .light {
    position: absolute;
    inset: 0 0 0 var(--start);
    background: linear-gradient(90deg, var(--tone) calc(var(--wash-progress) * 100% - 40px), transparent calc(var(--wash-progress) * 100%));
    mask-image: linear-gradient(90deg, transparent 0, #000 16px);
    transition: --wash-progress 260ms linear;
  }

  @media (prefers-reduced-motion: reduce) {
    .light {
      transition: none;
    }
  }
</style>
