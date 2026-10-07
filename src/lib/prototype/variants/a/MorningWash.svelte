<!--
  PROTOTYPE：变体 A 的签名“晨光行”——正在播放的那一行，被一层浅薄荷光从歌名开始往右慢慢铺开（长度 = 播放进度）。
  光从歌名左边缘起步（封面和左边距不被照到），两头都是柔的，像晨光爬过桌面，不是一根进度条。
  放在 position: relative 的行里，内容要叠在它上面。
-->
<script lang='ts'>
  import { player } from '$lib/prototype/player.svelte'

  interface Props {
    /** 光的起点（px，取歌名左边缘稍往左一点） */
    start: number
    /** 行放在晨光底（primary-50）上时，光要深一级（primary-200）才看得见；白色面板上用 primary-100 */
    onGround?: boolean
    class?: string
  }

  const { start, onGround = false, class: klass = '' }: Props = $props()
</script>

<span class={['wash', klass]} style:--start='{start}px' style:--tone={onGround ? '#d1f1e3' : '#e8f8f1'} aria-hidden='true'>
  <span class='light' style:--p={player.progress}></span>
</span>

<style>
  .wash {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
  }

  /* 注册成数字才能过渡；只重绘，不重排 */
  @property --p {
    syntax: '<number>';
    inherits: false;
    initial-value: 0;
  }

  .light {
    position: absolute;
    inset: 0 0 0 var(--start);
    /* 进度只在歌名到行尾这一段上走；前沿 40px 渐隐 */
    background: linear-gradient(90deg, var(--tone) calc(var(--p) * 100% - 40px), transparent calc(var(--p) * 100%));
    /* 起点 16px 渐入，贴着封面也不会切出一道硬边 */
    mask-image: linear-gradient(90deg, transparent 0, #000 16px);
    transition: --p 260ms linear;
  }
</style>
