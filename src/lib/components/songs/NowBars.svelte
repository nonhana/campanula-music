<script lang="ts">
  import { getAppView } from '../shared/app-context.svelte.ts';

  const view = getAppView();
  const playing = $derived(view.state.player.status === 'playing');
</script>

<span class={['bars', playing && 'playing']} aria-hidden="true">
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
  }

  .bars span:nth-child(1) {
    transform: scaleY(0.55);
  }

  .bars span:nth-child(2) {
    transform: scaleY(0.95);
  }

  .bars span:nth-child(3) {
    transform: scaleY(0.4);
  }

  /* 暂停时不挂 animation，避免空闲竖条常驻独立合成层 */
  .bars.playing span {
    animation: rise var(--loop-now-bars) ease-in-out infinite alternate;
    animation-play-state: var(--loop-state);
  }

  .bars.playing span:nth-child(1) {
    animation-delay: calc(var(--loop-now-bars) * -0.3);
  }

  .bars.playing span:nth-child(2) {
    animation-duration: calc(var(--loop-now-bars) * 0.8);
    animation-delay: calc(var(--loop-now-bars) * -0.7);
  }

  .bars.playing span:nth-child(3) {
    animation-duration: calc(var(--loop-now-bars) * 1.2);
    animation-delay: calc(var(--loop-now-bars) * -0.1);
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
