<!-- PROTOTYPE：正在播放的三根小竖条（薄荷 900）。暂停时停在原地。 -->
<script lang='ts'>
  interface Props {
    playing: boolean
    class?: string
  }

  const { playing, class: klass = '' }: Props = $props()
</script>

<span class={['bars', klass]} class:paused={!playing} aria-hidden='true'>
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
    background: #206f52;
    transform-origin: bottom;
    animation: rise 1.1s cubic-bezier(0.45, 0, 0.55, 1) infinite alternate;
  }

  .bars span:nth-child(1) {
    transform: scaleY(0.55);
    animation-delay: -0.35s;
  }

  .bars span:nth-child(2) {
    transform: scaleY(0.95);
    animation-delay: -0.8s;
    animation-duration: 0.9s;
  }

  .bars span:nth-child(3) {
    transform: scaleY(0.4);
    animation-delay: -0.1s;
    animation-duration: 1.3s;
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

  @media (prefers-reduced-motion: reduce) {
    .bars span {
      animation: none;
    }
  }
</style>
