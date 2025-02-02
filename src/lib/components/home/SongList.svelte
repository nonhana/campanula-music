<script lang='ts'>
  import SongItem from '$lib/components/common/SongItem.svelte'
  import BannerCard from '$lib/components/hana/BannerCard.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import { mockSongs } from '$lib/mock'
  import { Music } from 'lucide-svelte'

  const songGroups = Array.from(
    { length: Math.ceil(mockSongs.length / 3) },
    (_, i) => mockSongs.slice(i * 3, i * 3 + 3),
  )
</script>

<BannerCard title='歌曲列表'>
  {#snippet icon()}<Music />{/snippet}
  <div class='w-full rounded-lg bg-white'>
    <ScrollContainer>
      <div class='flex'>
        {#each songGroups as group}
          <div class='flex flex-col'>
            {#each group as song}
              <SongItem song={song} />
            {/each}
          </div>
        {/each}
      </div>
    </ScrollContainer>
  </div>
</BannerCard>
