<!--
  正在播放的三根小竖条（森林绿，DESIGN.md Morning Row）：在放时起伏，停着时停在原地；减少动态效果时不动
-->
<script lang='ts'>
  import { getAppView } from '../app-context.svelte'

  const view = getAppView()
  const playing = $derived(view.state.player.status === 'playing')
</script>

<span class={['bars', !playing && 'paused']} aria-hidden='true'>
  <span></span><span></span><span></span>
</span>

<style>
  .bars {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    width: 14px;
    height: 14px;
  }

  .bars span {
    flex: 1;
    height: 100%;
    border-radius: 1px;
    background: theme('colors.primary.900');
    transform-origin: bottom;
    animation: rise var(--loop-now-bars) ease-in-out infinite alternate;
    animation-play-state: var(--loop-state);
  }

  /* 三根快慢、起点各不相同，起伏不齐 */
  .bars span:nth-child(1) {
    transform: scaleY(0.55);
    animation-delay: calc(var(--loop-now-bars) * -0.3);
  }

  .bars span:nth-child(2) {
    transform: scaleY(0.95);
    animation-duration: calc(var(--loop-now-bars) * 0.8);
    animation-delay: calc(var(--loop-now-bars) * -0.7);
  }

  .bars span:nth-child(3) {
    transform: scaleY(0.4);
    animation-duration: calc(var(--loop-now-bars) * 1.2);
    animation-delay: calc(var(--loop-now-bars) * -0.1);
  }

  .paused span {
    animation-play-state: paused;
  }

  @keyframes rise {
    from {
      transform: scaleY(0.3);
    }
    to {
      transform: scaleY(1);
    }
  }
</style>
