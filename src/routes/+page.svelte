<script lang='ts'>
  import BannerCard from '$lib/components/hana/BannerCard.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import { Music } from 'lucide-svelte'
</script>

<svelte:head>
  <title>Home</title>
  <meta name='description' content='Svelte demo app' />
</svelte:head>

<BannerCard title='歌曲列表'>
  {#snippet icon()}
    <Music />
  {/snippet}
  <div class='w-40 h-40 bg-white'>
    <ScrollContainer>
      <div class='w-[1000px]'>
        <p>123</p>
      </div>
    </ScrollContainer>
  </div>
</BannerCard>
