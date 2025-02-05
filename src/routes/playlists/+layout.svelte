<script lang='ts'>
  import { page } from '$app/state'
  import PlaylistItem from '$lib/components/common/PlaylistItem.svelte'
  import BannerCard from '$lib/components/hana/BannerCard.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import { mockPlaylists } from '$lib/mock'
  import { ListMusic } from 'lucide-svelte'

  const { children } = $props()
</script>

<BannerCard title='歌单列表'>
  {#snippet icon()}
    <ListMusic />
  {/snippet}
  <ScrollContainer>
    <div class='flex mb-5 gap-5'>
      {#each mockPlaylists as playlist}
        <PlaylistItem
          playlist={playlist}
          type='playlist'
          activated={Number(page.params.id) === playlist.id}
        />
      {/each}
    </div>
  </ScrollContainer>
</BannerCard>

{@render children()}
