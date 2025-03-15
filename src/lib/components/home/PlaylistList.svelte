<script lang='ts'>
  import type { PlaylistItem as PlaylistItemType } from '$lib/types'
  import PlaylistItem from '$lib/components/common/PlaylistItem.svelte'
  import BannerCard from '$lib/components/hana/BannerCard.svelte'
  import { ListMusic } from 'lucide-svelte'

  interface Props {
    playlists: PlaylistItemType[]
  }

  const { playlists }: Props = $props()
</script>

<BannerCard title='歌单列表'>
  {#snippet icon()}<ListMusic />{/snippet}
  <div class='grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] w-full gap-5'>
    {#each playlists as playlist}
      <PlaylistItem type='playlist' {playlist} />
    {/each}
  </div>
</BannerCard>
