<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { LayoutData } from './$types'
  import { page } from '$app/state'
  import PlaylistItem from '$lib/components/common/PlaylistItem.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'

  interface Props {
    data: LayoutData
    children: Snippet
  }

  const { data, children }: Props = $props()
</script>

<div class='relative h-[calc(100dvh-9rem)] flex justify-between gap-12 py-5'>
  <div class='h-full w-fit'>
    <ScrollContainer contentClass='flex flex-col gap-5 mx-2'>
      {#each data.playlists as playlist}
        <PlaylistItem
          playlist={playlist}
          type='playlist'
          imgClass='w-48'
          activated={Number(page.params.id) === playlist.id}
        />
      {/each}
    </ScrollContainer>
  </div>
  {@render children()}
</div>
