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
  <div class='size-40 bg-white'>
    <ScrollContainer>
      <div class='relative h-full w-[1000px]'>
        <p>123</p>
        <p class='absolute bottom-0'>这是底部的内容</p>
      </div>
    </ScrollContainer>
  </div>
</BannerCard>
