<script lang='ts'>
  import type { LyricItem } from '$lib/types'

  interface Props {
    lyric: LyricItem
    isActivated: boolean
    activateCallback: (curLyric: LyricItem) => void
  }

  const { lyric, isActivated, activateCallback }: Props = $props()

  $effect(() => {
    if (isActivated) {
      activateCallback(lyric)
    }
  })
</script>

<div
  class={[
    'flex justify-between items-center w-full h-20 transition-all duration-300 leading-4',
    isActivated ? 'text-black md:text-lg' : 'text-neutral text-xs md:text-sm',
  ]}
>
  <div class='flex flex-col gap-2'>
    <span>{lyric.text}</span>
    {#if lyric.translate}
      <span>{lyric.translate}</span>
    {/if}
  </div>
</div>
