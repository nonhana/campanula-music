<!-- PROTOTYPE：跟在歌名后面的小徽标：无版权、离线时未下载、试听。 -->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import { player } from '$lib/prototype/player.svelte'

  interface Props {
    song: Song
  }

  const { song }: Props = $props()
</script>

{#if song.unavailable}
  <span class='flex-none rounded-md bg-neutral-100 px-1.5 text-[11px] leading-[18px] font-500 text-neutral-700'>无版权</span>
{:else if player.offline && song.download !== 'done'}
  <span class='flex-none rounded-md bg-neutral-100 px-1.5 text-[11px] leading-[18px] font-500 text-neutral-700'>未下载</span>
{:else if song.trial}
  <span class='flex-none rounded-md bg-warning-50 px-1.5 text-[11px] leading-[18px] font-500 text-warning-900'>试听</span>
{/if}
