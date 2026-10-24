<!--
  格子型骨架（一格）：封面，下面一两条灰线。和真格子一样高：每条灰线放在和真字一样高的行里（名字 20px，手机歌单、专辑名字 22px，
  歌手名一直 14px，下面一行灰字 20px）。首页、曲库、搜索的格子骨架都用它；外层怎么排、淡出由调用方写。
-->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'

  interface Props {
    round?: boolean
    /** 专辑的歌手、歌单的首数、搜索里歌手的单曲数；收藏的歌手没有 */
    detail?: boolean
    phone?: boolean
    class?: ClassValue
  }

  const { round = false, detail = true, phone = false, class: klass }: Props = $props()
</script>

<div class={klass}>
  <span class={[
    'bone aspect-square w-full',
    round ? 'rounded-full' : 'rounded-lg',
  ]}></span>
  <span class={[
    'mt-2.5 flex items-center',
    phone && !round
      ? 'h-5.5'
      : 'h-5',
    round && 'justify-center',
  ]}>
    <span class={[
      'bone h-3.5 rounded-full',
      round ? 'w-2/3' : 'w-3/4',
    ]}></span>
  </span>
  {#if detail}
    <span class={['mt-0.5 h-5 flex items-center', round && 'justify-center']}>
      <span class='bone h-3 w-1/2 rounded-full'></span>
    </span>
  {/if}
</div>
