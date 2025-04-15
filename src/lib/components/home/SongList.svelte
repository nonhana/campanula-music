<script lang='ts'>
  import type { SongItem as SongItemType } from '$lib/types'
  import SongHomeItem from '$lib/components/common/SongHomeItem.svelte'
  import BannerCard from '$lib/components/hana/BannerCard.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import { Music } from 'lucide-svelte'

  interface Props {
    songList: SongItemType[]
  }

  const { songList }: Props = $props()

  const songGroups = Array.from(
    { length: Math.ceil(songList.length / 3) },
    (_, i) => songList.slice(i * 3, i * 3 + 3),
  )
</script>

<BannerCard title='歌曲列表'>
  {#snippet icon()}<Music />{/snippet}
  <div class='w-full rounded-lg bg-white px-2'>
    <ScrollContainer contentClass='flex'>
      {#each songGroups as group}
        <div class='flex flex-col'>
          {#each group as song}
            <SongHomeItem song={song} />
          {/each}
        </div>
      {/each}
    </ScrollContainer>
  </div>
</BannerCard>
