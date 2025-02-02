<script lang='ts'>
  import PlaylistItem from '$lib/components/common/PlaylistItem.svelte'
  import BannerCard from '$lib/components/hana/BannerCard.svelte'
  import { mockPlaylists } from '$lib/mock'
  import { ListMusic } from 'lucide-svelte'
</script>

<BannerCard title='歌单列表'>
  {#snippet icon()}<ListMusic />{/snippet}
  <div class='w-full grid gap-5 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]'>
    {#each mockPlaylists as playlist}
      <PlaylistItem {playlist} />
    {/each}
  </div>
</BannerCard>
