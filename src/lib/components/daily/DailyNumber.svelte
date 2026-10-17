<!--
  每日推荐的日期数字。首页方块 56px、每日推荐页 88px、手机每日推荐页 72px，600、等宽数字、深薄荷：
  这三个是图形，不算字号阶梯里的一档（DESIGN.md Typography），所以字号写在这里，不用 text-<档名>。
  手机 logo 行的日历按钮里那个是墨色的小数字：原型是 10px，按阶梯归到 Micro。读屏另有文字说日期，这里不读
-->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'

  const { day, size, class: klass }: { day: number, size: 'icon' | 'tile' | 'phone' | 'page', class?: ClassValue } = $props()
</script>

<span class={['block tabular-nums font-600', size === 'icon' ? 'text-micro leading-3 text-neutral-900' : ['text-primary-900', size], klass]} aria-hidden='true'>{day}</span>

<style>
  .tile {
    font-size: 56px;
    line-height: 52px;
    letter-spacing: -0.03em;
  }

  .phone {
    font-size: 72px;
    line-height: 64px;
    letter-spacing: -0.04em;
  }

  .page {
    font-size: 88px;
    line-height: 76px;
    letter-spacing: -0.04em;
  }
</style>
