<script lang='ts'>
  import type { LyricItem } from '$lib/types'
  import { durationFormatter } from '$lib/utils'

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
    'flex justify-between items-center w-full h-20 transition-all duration-300',
    isActivated ? 'text-black text-lg' : 'text-neutral text-sm',
  ]}
>
  <div class='flex flex-col gap-2'>
    <span>{lyric.text}</span>
    {#if lyric.translate}
      <span>{lyric.translate}</span>
    {/if}
  </div>
  <span>{durationFormatter(lyric.time)}</span>
</div>
