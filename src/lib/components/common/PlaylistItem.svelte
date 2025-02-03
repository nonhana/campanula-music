<script lang='ts'>
  import type { PlaylistItem } from '$lib/types'
  import Card from '$lib/components/hana/Card.svelte'
  import { PlayCircle } from 'lucide-svelte'

  interface Props {
    playlist: PlaylistItem
  }

  const { playlist }: Props = $props()
</script>

<Card elevated={false} divider={false} transparent>
  {#snippet mask()}
    <div class='absolute inset-0 size-full cursor-pointer hover:bg-gradient-to-b from-transparent to-primary/30 group/item'>
      <PlayCircle class='text-neutral absolute bottom-2 right-2 hidden group-hover/item:block' />
    </div>
  {/snippet}
  {#snippet header()}
    <img
      src={playlist.cover}
      alt={playlist.name}
    />
  {/snippet}
  <div class='flex flex-col px-4 py-2'>
    <span class='text-lg font-bold'>{playlist.name}</span>
    <span class='text-sm text-neutral'>{playlist.description}</span>
  </div>
</Card>
