<!--
  PROTOTYPE：加载中的骨架行，形状和真实歌曲行一致（手机 56px、桌面 56px），一道很淡的光从左扫到右。
  虚拟列表的“加载中”放在列表本来的位置上，不放在列表最底下。
-->
<script lang='ts'>
  interface Props {
    count?: number
    phone?: boolean
    label?: string
  }

  const { count = 8, phone = false, label = '正在加载' }: Props = $props()
  const widths = [72, 54, 81, 63, 48, 76, 58, 69, 51, 66]
</script>

<div class='skeleton' role='status' aria-busy='true' aria-label={label}>
  {#each { length: count }, i (i)}
    {@const w = widths[i % widths.length]}
    {#if phone}
      <div class='grid h-14 grid-cols-[48px_minmax(0,1fr)_44px] items-center gap-3.5 pl-4 pr-1'>
        <span class='bone size-12 rounded-lg'></span>
        <span class='flex flex-col gap-2'>
          <span class='bone h-3.5 rounded-full' style:width='{w}%'></span>
          <span class='bone h-3 rounded-full' style:width='{Math.round(w * 0.55)}%'></span>
        </span>
        <span></span>
      </div>
    {:else}
      <div class='grid h-14 grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px] items-center gap-4 pl-2 pr-1'>
        <span class='bone mx-auto h-3 w-4 rounded-full'></span>
        <span class='flex items-center gap-3'>
          <span class='bone size-10 flex-none rounded-lg'></span>
          <span class='flex flex-1 flex-col gap-2'>
            <span class='bone h-3.5 rounded-full' style:width='{w}%'></span>
            <span class='bone h-3 rounded-full' style:width='{Math.round(w * 0.5)}%'></span>
          </span>
        </span>
        <span class='bone h-3 rounded-full' style:width='{Math.round(w * 0.7)}%'></span>
        <span></span>
        <span class='bone ml-auto h-3 w-8 rounded-full'></span>
        <span></span>
      </div>
    {/if}
  {/each}
</div>

<style>
  .bone {
    display: block;
    background: linear-gradient(90deg, #e3eae6 0%, #f0f5f2 40%, #e3eae6 80%);
    background-size: 240% 100%;
    animation: sweep 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  @keyframes sweep {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: -140% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bone {
      animation: none;
    }
  }
</style>
