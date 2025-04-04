<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { LayoutData } from './$types'
  import { page } from '$app/state'
  import PlaylistItem from '$lib/components/common/PlaylistItem.svelte'
  import Drawer from '$lib/components/hana/Drawer.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import { setPlaylists } from '$lib/stores'
  import { ChevronLeft, ListMusic } from 'lucide-svelte'

  interface Props {
    data: LayoutData
    children: Snippet
  }

  const { data, children }: Props = $props()

  setPlaylists(data.playlists)

  let drawerOpen = $state(false)
</script>

<div class='relative h-[calc(100dvh-9rem)] flex justify-between gap-12 py-5 md:flex-row-reverse'>
  {@render children()}
  <div class='h-full w-fit hidden md:block'>
    <ScrollContainer contentClass='flex flex-col gap-5 mx-2'>
      {#each data.playlists as playlist}
        <PlaylistItem
          playlist={playlist}
          imgClass='w-48'
          activated={Number(page.params.id) === playlist.id}
        />
      {/each}
    </ScrollContainer>
  </div>
  <Drawer bind:visible={drawerOpen} title='歌单列表'>
    {#snippet icon()}<ListMusic />{/snippet}
    <div class='mx-2 flex flex-col gap-5'>
      {#each data.playlists as playlist}
        <PlaylistItem playlist={playlist} imgClass='w-48' onclick={() => drawerOpen = false} />
      {/each}
    </div>
  </Drawer>
  <button
    class='fixed right-0 h-20 w-5 rounded-l-xl bg-primary-200 text-neutral md:hidden'
    onclick={() => drawerOpen = true}
  >
    <ChevronLeft class='h-5 w-5' />
  </button>
</div>
