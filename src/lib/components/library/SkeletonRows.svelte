<!--
  加载中的骨架行，形状和真实歌曲行一致（手机、桌面都是 56px），一道很淡的光从左扫到右；
  减少动态效果时不动。放在列表本来的位置上；被内容换掉时原地淡出（motion.ts 的 fadeAway）。
-->
<script lang='ts'>
  import { fadeAway } from '../motion'

  interface Props {
    count: number
    phone?: boolean
    /** 读屏读出的“正在加载什么” */
    label: string
  }

  const { count, phone = false, label }: Props = $props()
  const widths = [72, 54, 81, 63, 48, 76, 58, 69, 51, 66]
</script>

<div role='status' aria-busy='true' aria-label={label} out:fadeAway>
  {#each { length: count }, i (i)}
    {@const w = widths[i % widths.length]}
    {#if phone}
      <div class='grid grid-cols-[48px_minmax(0,1fr)_44px] h-14 items-center gap-3.5 pl-4 pr-1'>
        <span class='bone size-12 rounded-md'></span>
        <span class='flex flex-col gap-2'>
          <span class='bone h-3.5 rounded-full' style:width='{w}%'></span>
          <span class='bone h-3 rounded-full' style:width='{Math.round(w * 0.55)}%'></span>
        </span>
      </div>
    {:else}
      <div class='grid grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px] h-14 items-center gap-4 pl-2 pr-1'>
        <span class='bone mx-auto h-3 w-4 rounded-full'></span>
        <span class='flex items-center gap-3'>
          <span class='bone size-10 flex-none rounded-md'></span>
          <span class='flex flex-1 flex-col gap-2'>
            <span class='bone h-3.5 rounded-full' style:width='{w}%'></span>
            <span class='bone h-3 rounded-full' style:width='{Math.round(w * 0.5)}%'></span>
          </span>
        </span>
        <span class='bone h-3 rounded-full' style:width='{Math.round(w * 0.7)}%'></span>
        <span></span>
        <span class='bone ml-auto h-3 w-8 rounded-full'></span>
      </div>
    {/if}
  {/each}
</div>
