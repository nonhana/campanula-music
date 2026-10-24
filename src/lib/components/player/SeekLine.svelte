<!--
  桌面底栏顶边的进度线，也是滑块（DESIGN.md Player Bars）：平时 2px 薄荷线；悬停、聚焦、拖动时加粗到 4px，露出 4×14px 深薄荷游标。
  点按、拖动跳到那里（seek-slider.svelte.ts），拖动时底栏左边的时间跟着走。点按区域是顶边上下 16px 高的一条，往上只伸 6px，少挡内容。
  放在 position: fixed 的底栏里，slider 由底栏创建（它的时间也要跟着拖动变）。
-->
<script lang='ts'>
  import { getAppView } from '../shared/app-context.svelte'
  import type { SeekSlider } from './seek-slider.svelte'

  const { slider }: { slider: SeekSlider } = $props()
  const view = getAppView()
  const ratio = $derived(slider.ratio(view.state.player.position))
  const percent = $derived(`${ratio * 100}%`)
</script>

<div class={['seek absolute inset-x-0 -top-1.5 h-4 cursor-pointer touch-none', slider.dragging !== null && 'dragging']} {...slider.attributes(ratio)} {@attach slider.attach}>
  <div class='rail absolute inset-x-0 top-1.5 bg-primary-100' aria-hidden='true'>
    <div class='fill h-full bg-primary-700' style:width={percent}></div>
  </div>
  <span class='thumb absolute top-px h-3.5 w-1 rounded-full bg-primary-900' style:left='calc({percent} - 2px)' aria-hidden='true'></span>
</div>

<style>
  .seek[aria-disabled='true'] {
    cursor: default;
  }

  /* 焦点环画在游标上，不围着整条 16px 高的点按区域 */
  .seek:focus-visible {
    outline: none;
  }

  .rail {
    height: 2px;
    transition: height var(--move-feedback) var(--ease-out-soft);
  }

  /* 跟着播放器报的进度匀速走，下一次报之前刚好走到 */
  .fill {
    transition: width var(--move-tick) linear;
  }

  .thumb {
    opacity: 0;
    transition:
      left var(--move-tick) linear,
      opacity var(--duration-feedback) var(--ease-out-soft);
  }

  .seek:focus-visible .rail,
  .dragging .rail {
    height: 4px;
  }

  .seek:focus-visible .thumb,
  .dragging .thumb {
    opacity: 1;
  }

  .seek:focus-visible .thumb {
    outline: 2px solid theme('colors.primary.800');
    outline-offset: 2px;
  }

  /* 拖动时游标跟着指针走，不追着过渡 */
  .dragging .fill {
    transition: none;
  }

  .dragging .thumb {
    transition: opacity var(--duration-feedback) var(--ease-out-soft);
  }

  @media (hover: hover) and (pointer: fine) {
    .seek:not([aria-disabled='true']):hover .rail {
      height: 4px;
    }

    .seek:not([aria-disabled='true']):hover .thumb {
      opacity: 1;
    }
  }
</style>
