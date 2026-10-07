<!-- PROTOTYPE：跟在歌名后面的小徽标：无版权、试听（照视觉原型）。 -->
<script lang='ts'>
  import type { Song } from '../data'

  interface Props {
    song: Song
  }

  const { song }: Props = $props()
</script>

{#if song.unavailable}
  <span class='flex-none rounded-md bg-neutral-100 px-1.5 text-[11px] leading-[18px] font-500 text-neutral-700'>无版权</span>
{:else if song.trial}
  <span class='flex-none rounded-md bg-warning-50 px-1.5 text-[11px] leading-[18px] font-500 text-warning-900'>试听</span>
{/if}
