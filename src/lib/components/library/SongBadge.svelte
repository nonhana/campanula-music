<!-- 跟在歌名后面的徽标（DESIGN.md Chips · Badges）：只能试听（琥珀）、无版权（淡发丝底） -->
<script lang='ts'>
  import type { Availability } from '$lib/api/library'

  const { availability }: { availability: Availability } = $props()
</script>

{#if availability === 'noCopyright'}
  <span class='flex-none rounded-sm bg-neutral-100 px-1.5 text-micro text-neutral-700 font-500'>无版权</span>
{:else if availability === 'trial'}
  <span class='flex-none rounded-sm bg-warning-50 px-1.5 text-micro text-warning-900 font-500'>试听</span>
{/if}
