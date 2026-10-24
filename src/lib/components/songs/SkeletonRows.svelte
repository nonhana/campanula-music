<!--
  加载中的骨架行，形状和真实歌曲行一致（手机、桌面都是 56px），一道很淡的光从左扫到右；
  减少动态效果时不动。放在列表本来的位置上；被内容换掉时原地淡出（motion.ts 的 fadeAway），淡出写在它自己的最外层，
  外面不要再包一层 out:fadeAway；要放在面板里整块淡出时，面板的样式用 class 给它。
-->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import { fadeAway } from '../shared/motion'
  import { SONG_COLUMNS, SONG_GRID } from './SongRow.svelte'

  interface Props {
    count: number
    phone?: boolean
    /** 读屏读出的“正在加载什么” */
    label: string
    /** 最外层的样式（例如白色面板） */
    class?: ClassValue
  }

  const { count, phone = false, label, class: klass }: Props = $props()
  const widths = [72, 54, 81, 63, 48, 76, 58, 69, 51, 66]
</script>

<div class={klass} role='status' aria-busy='true' aria-label={label} out:fadeAway>
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
      <div class={[SONG_GRID, 'h-14']}>
        <span class={['bone h-3 w-4 rounded-full', SONG_COLUMNS.index]}></span>
        <span class='flex items-center gap-3'>
          <span class='bone size-10 flex-none rounded-md'></span>
          <span class='flex flex-1 flex-col gap-2'>
            <span class='bone h-3.5 rounded-full' style:width='{w}%'></span>
            <span class='bone h-3 rounded-full' style:width='{Math.round(w * 0.5)}%'></span>
          </span>
        </span>
        <span class='bone h-3 rounded-full' style:width='{Math.round(w * 0.7)}%'></span>
        <span></span>
        <span class={['bone h-3 w-8 rounded-full', SONG_COLUMNS.duration]}></span>
      </div>
    {/if}
  {/each}
</div>
