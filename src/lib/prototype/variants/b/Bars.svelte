<!-- PROTOTYPE · “正在播放”指示：三根薄荷色短竖条，播放时轻轻起伏，暂停时停住。 -->
<script lang='ts'>
  interface Props {
    playing: boolean
    size?: number
  }

  const { playing, size = 14 }: Props = $props()
</script>

<span class={['bars', playing && 'live']} style:--size='{size}px' role='img' aria-label={playing ? '正在播放' : '已暂停'}>
  <i></i><i></i><i></i>
</span>

<style>
  .bars {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    width: var(--size);
    height: var(--size);
  }

  i {
    flex: 1;
    border-radius: 1px;
    background: #2b976f;
    height: 40%;
  }

  i:nth-child(1) {
    height: 70%;
  }

  i:nth-child(2) {
    height: 100%;
  }

  i:nth-child(3) {
    height: 50%;
  }

  .live i {
    animation: bar 900ms ease-in-out infinite alternate;
  }

  .live i:nth-child(2) {
    animation-delay: -300ms;
  }

  .live i:nth-child(3) {
    animation-delay: -600ms;
  }

  @keyframes bar {
    from {
      height: 25%;
    }

    to {
      height: 100%;
    }
  }
</style>
