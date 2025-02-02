<script lang='ts'>
  import PlaylistItem from '$lib/components/common/PlaylistItem.svelte'
  import BannerCard from '$lib/components/hana/BannerCard.svelte'
  import { mockPlaylists } from '$lib/mock'
  import { ListMusic } from 'lucide-svelte'
</script>

<BannerCard title='歌单列表'>
  {#snippet icon()}<ListMusic />{/snippet}
  <div class='w-full grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8'>
    {#each mockPlaylists as playlist}
      <PlaylistItem {playlist} />
    {/each}
  </div>
</BannerCard>
