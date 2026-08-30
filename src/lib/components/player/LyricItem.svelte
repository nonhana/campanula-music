<script lang='ts'>
  import type { LyricItem } from '$lib/types'

  interface Props {
    lyric: LyricItem
    activated: boolean
    onclick?: () => void
  }

  const { lyric, activated, onclick }: Props = $props()
</script>
<!-- 歌词行点击跳转进度：纯文本行不做键盘聚焦（百余行全部进 tab 序会污染键盘导航） -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class={[
    'flex justify-between items-center w-full h-20 transition-all duration-300 leading-4',
    activated ? 'text-black md:text-lg' : 'text-neutral text-xs md:text-sm',
    onclick ? 'cursor-pointer' : '',
  ]}
  {onclick}
>
  <div class='flex flex-col gap-2'>
    <span>{lyric.text}</span>
    {#if lyric.translate}
      <span>{lyric.translate}</span>
    {/if}
  </div>
</div>
