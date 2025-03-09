<script lang='ts'>
  import type { PlaylistItem as PlaylistItemType } from '$lib/types'
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import PlaylistItem from '$lib/components/common/PlaylistItem.svelte'
  import BannerCard from '$lib/components/hana/BannerCard.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import { ListMusic } from 'lucide-svelte'

  interface Props {
    playlists: PlaylistItemType[]
    children: Snippet
  }

  const { playlists, children }: Props = $props()
</script>

<BannerCard title='歌单列表'>
  {#snippet icon()}
    <ListMusic />
  {/snippet}
  <ScrollContainer contentClass='flex mb-5 gap-5'>
    {#each playlists as playlist}
      <PlaylistItem
        playlist={playlist}
        type='playlist'
        activated={Number(page.params.id) === playlist.id}
      />
    {/each}
  </ScrollContainer>
</BannerCard>

{@render children()}
