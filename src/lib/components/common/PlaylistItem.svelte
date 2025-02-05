<script lang='ts'>
  import type { PlaylistItem } from '$lib/types'
  import Card from '$lib/components/hana/Card.svelte'
  import { PlayCircle } from 'lucide-svelte'

  interface Props {
    type?: 'home' | 'playlist'
    activated?: boolean
    playlist: PlaylistItem
  }

  const { type = 'home', activated = false, playlist }: Props = $props()
</script>

<Card
  elevated={false}
  divider={false}
  transparent
  href={type === 'playlist' ? `/playlists/${playlist.id}` : undefined}
>
  {#snippet mask()}
    <div
      class={[
        'absolute inset-0 size-full cursor-pointer hover:bg-gradient-to-b from-transparent to-primary/30 group/item',
        activated && 'bg-gradient-to-b from-transparent to-primary/30',
      ]}
    >
      <PlayCircle class={`text-neutral absolute bottom-2 right-2 hidden ${type === 'playlist' ? '' : 'group-hover/item:block'}`} />
    </div>
  {/snippet}
  {#snippet header()}
    <img
      src={playlist.cover}
      alt={playlist.name}
      class={[type === 'playlist' && 'w-40']}
    />
  {/snippet}
  <div class='flex flex-col px-4 py-2'>
    <span class='text-lg font-bold'>{playlist.name}</span>
    <span class='text-sm text-neutral'>{playlist.description}</span>
  </div>
</Card>
