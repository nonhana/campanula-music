<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { LayoutData } from './$types'
  import BannerCard from '$lib/components/hana/BannerCard.svelte'
  import { Music } from 'lucide-svelte'

  interface Props {
    data: LayoutData
    children: Snippet
  }

  const { data, children }: Props = $props()
</script>

<svelte:head>
  <title>Songs</title>
  <meta name='description' content='Lists of songs' />
</svelte:head>

<BannerCard title='全部歌曲' subtitle={`共 ${data.songCount} 首`}>
  {#snippet icon()}
    <Music />
  {/snippet}
  {@render children()}
</BannerCard>
